package sso

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

// Handler handles SSO HTTP endpoints (OIDC + SAML flows, provider CRUD).
type Handler struct {
	sso         *Service
	authService *auth.Service
	authRepo    auth.Repository
	db          *pgxpool.Pool
	idGen       *snowflake.Generator
	baseURL     string // Public API base URL (for callback URLs)
	frontendURL string // Frontend URL (redirect after SSO login)

	// In-memory state store for OIDC (replace with Redis in production)
	states     map[string]*oidcState
	statesMu   sync.Mutex
}

type oidcState struct {
	ProviderID int64
	GuildID    int64
	CreatedAt  time.Time
}

// NewHandler creates a new SSO handler.
func NewHandler(sso *Service, authService *auth.Service, authRepo auth.Repository, db *pgxpool.Pool, idGen *snowflake.Generator, baseURL, frontendURL string) *Handler {
	h := &Handler{
		sso:         sso,
		authService: authService,
		authRepo:    authRepo,
		db:          db,
		idGen:       idGen,
		baseURL:     strings.TrimRight(baseURL, "/"),
		frontendURL: strings.TrimRight(frontendURL, "/"),
		states:      make(map[string]*oidcState),
	}
	// Clean up expired states every 10 minutes
	go h.cleanupStates()
	return h
}

// ---------- OIDC Flow ----------

// OIDCRedirect handles GET /api/v1/auth/sso/oidc/{provider}
// It redirects the user to the OIDC provider's authorization endpoint.
func (h *Handler) OIDCRedirect(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "provider")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	provider, err := h.sso.GetProviderFull(r.Context(), providerID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if !provider.Enabled {
		apierror.NewBadRequest("SSO provider is disabled").Write(w)
		return
	}
	if provider.Type != TypeOIDC {
		apierror.NewBadRequest("Provider is not an OIDC provider").Write(w)
		return
	}
	if provider.OIDCIssuer == nil || provider.OIDCClientID == nil {
		apierror.NewInternal("OIDC provider is not properly configured").Write(w)
		return
	}

	// Discover OIDC configuration
	oidcConfig, err := discoverOIDC(r.Context(), *provider.OIDCIssuer)
	if err != nil {
		apierror.NewInternal("Failed to discover OIDC configuration").Write(w)
		return
	}

	// Generate state parameter (CSRF protection)
	state, err := generateState()
	if err != nil {
		apierror.NewInternal("Failed to generate state").Write(w)
		return
	}

	h.statesMu.Lock()
	h.states[state] = &oidcState{
		ProviderID: provider.ID,
		GuildID:    provider.GuildID,
		CreatedAt:  time.Now(),
	}
	h.statesMu.Unlock()

	// Build authorization URL
	scopes := "openid email profile"
	if len(provider.OIDCScopes) > 0 {
		scopes = strings.Join(provider.OIDCScopes, " ")
	}

	callbackURL := fmt.Sprintf("%s/api/v1/auth/sso/oidc/%d/callback", h.baseURL, provider.ID)

	authURL := fmt.Sprintf("%s?response_type=code&client_id=%s&redirect_uri=%s&scope=%s&state=%s",
		oidcConfig.AuthorizationEndpoint,
		*provider.OIDCClientID,
		callbackURL,
		scopes,
		state,
	)

	http.Redirect(w, r, authURL, http.StatusFound)
}

// OIDCCallback handles GET /api/v1/auth/sso/oidc/{provider}/callback
// It exchanges the authorization code for tokens, finds/creates a user, and creates a session.
func (h *Handler) OIDCCallback(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "provider")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	// Validate state
	state := r.URL.Query().Get("state")
	h.statesMu.Lock()
	stateData, ok := h.states[state]
	if ok {
		delete(h.states, state)
	}
	h.statesMu.Unlock()

	if !ok || stateData.ProviderID != providerID {
		apierror.NewBadRequest("Invalid or expired state parameter").Write(w)
		return
	}

	// Check for error from provider
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		desc := r.URL.Query().Get("error_description")
		apierror.NewBadRequest(fmt.Sprintf("OIDC error: %s - %s", errParam, desc)).Write(w)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		apierror.NewBadRequest("Missing authorization code").Write(w)
		return
	}

	provider, err := h.sso.GetProviderFull(r.Context(), providerID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Discover OIDC configuration
	oidcConfig, err := discoverOIDC(r.Context(), *provider.OIDCIssuer)
	if err != nil {
		apierror.NewInternal("Failed to discover OIDC configuration").Write(w)
		return
	}

	// Exchange code for tokens
	callbackURL := fmt.Sprintf("%s/api/v1/auth/sso/oidc/%d/callback", h.baseURL, provider.ID)
	tokenResp, err := exchangeCode(r.Context(), oidcConfig.TokenEndpoint, *provider.OIDCClientID, *provider.OIDCClientSecret, code, callbackURL)
	if err != nil {
		apierror.NewInternal("Failed to exchange authorization code").Write(w)
		return
	}

	// Get user info from the OIDC provider
	userInfo, err := getUserInfo(r.Context(), oidcConfig.UserinfoEndpoint, tokenResp.AccessToken)
	if err != nil {
		apierror.NewInternal("Failed to get user info from OIDC provider").Write(w)
		return
	}

	// Find or create user
	user, sessionToken, err := h.findOrCreateSSOUser(r.Context(), provider, userInfo)
	if err != nil {
		apierror.NewInternal("Failed to process SSO login").Write(w)
		return
	}

	// Set session cookie and redirect to frontend
	auth.SetSessionCookie(w, sessionToken, 7*24*60*60)

	// Redirect to frontend with a success indicator
	redirectURL := fmt.Sprintf("%s/sso/callback?status=success&guild_id=%d", h.frontendURL, provider.GuildID)
	http.Redirect(w, r, redirectURL, http.StatusFound)

	_ = user // user is fully processed
}

// ---------- SAML Flow ----------

// SAMLMetadata handles GET /api/v1/auth/sso/saml/{provider}/metadata
// It serves the SAML Service Provider metadata XML.
func (h *Handler) SAMLMetadata(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "provider")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	provider, err := h.sso.GetProvider(r.Context(), providerID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	if provider.Type != TypeSAML {
		apierror.NewBadRequest("Provider is not a SAML provider").Write(w)
		return
	}

	acsURL := fmt.Sprintf("%s/api/v1/auth/sso/saml/%d/acs", h.baseURL, provider.ID)
	entityID := fmt.Sprintf("%s/api/v1/auth/sso/saml/%d/metadata", h.baseURL, provider.ID)

	metadata := buildSPMetadata(entityID, acsURL)

	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	enc.Encode(metadata)
}

// SAMLAssertionConsumer handles POST /api/v1/auth/sso/saml/{provider}/acs
// It processes the SAML assertion from the IdP.
func (h *Handler) SAMLAssertionConsumer(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "provider")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	provider, err := h.sso.GetProviderFull(r.Context(), providerID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if !provider.Enabled {
		apierror.NewBadRequest("SSO provider is disabled").Write(w)
		return
	}
	if provider.Type != TypeSAML {
		apierror.NewBadRequest("Provider is not a SAML provider").Write(w)
		return
	}

	// Parse the SAML response
	if err := r.ParseForm(); err != nil {
		apierror.NewBadRequest("Invalid SAML response").Write(w)
		return
	}

	samlResponse := r.FormValue("SAMLResponse")
	if samlResponse == "" {
		apierror.NewBadRequest("Missing SAMLResponse").Write(w)
		return
	}

	// Decode and parse the SAML assertion (basic parsing -- production should validate signature)
	assertion, err := parseSAMLResponse(samlResponse)
	if err != nil {
		apierror.NewBadRequest("Invalid SAML assertion").Write(w)
		return
	}

	userInfo := &OIDCUserInfo{
		Sub:   assertion.NameID,
		Email: assertion.Email,
		Name:  assertion.DisplayName,
	}

	// Find or create user
	user, sessionToken, err := h.findOrCreateSSOUser(r.Context(), provider, userInfo)
	if err != nil {
		apierror.NewInternal("Failed to process SSO login").Write(w)
		return
	}

	// Set session cookie and redirect to frontend
	auth.SetSessionCookie(w, sessionToken, 7*24*60*60)

	redirectURL := fmt.Sprintf("%s/sso/callback?status=success&guild_id=%d", h.frontendURL, provider.GuildID)
	http.Redirect(w, r, redirectURL, http.StatusFound)

	_ = user
}

// ---------- Provider CRUD (guild admin endpoints) ----------

// GetProviders handles GET /api/v1/guilds/{guildID}/sso/providers
func (h *Handler) GetProviders(w http.ResponseWriter, r *http.Request) {
	guildIDStr := chi.URLParam(r, "guildID")
	guildID, err := strconv.ParseInt(guildIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid guild ID").Write(w)
		return
	}

	providers, err := h.sso.GetProviders(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Failed to get SSO providers").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}

// CreateProvider handles POST /api/v1/guilds/{guildID}/sso/providers
func (h *Handler) CreateProvider(w http.ResponseWriter, r *http.Request) {
	guildIDStr := chi.URLParam(r, "guildID")
	guildID, err := strconv.ParseInt(guildIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid guild ID").Write(w)
		return
	}

	var req CreateProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if req.Name == "" {
		apierror.NewValidationError("Provider name is required").Write(w)
		return
	}

	provider, err := h.sso.CreateProvider(r.Context(), guildID, req)
	if err != nil {
		apierror.NewInternal("Failed to create SSO provider").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(provider)
}

// DeleteProvider handles DELETE /api/v1/guilds/{guildID}/sso/providers/{providerID}
func (h *Handler) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "providerID")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	if err := h.sso.DeleteProvider(r.Context(), providerID); err != nil {
		apierror.NewInternal("Failed to delete SSO provider").Write(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ToggleProvider handles PATCH /api/v1/guilds/{guildID}/sso/providers/{providerID}
func (h *Handler) ToggleProvider(w http.ResponseWriter, r *http.Request) {
	providerIDStr := chi.URLParam(r, "providerID")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		apierror.NewBadRequest("Invalid provider ID").Write(w)
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if err := h.sso.ToggleProvider(r.Context(), providerID, req.Enabled); err != nil {
		apierror.NewInternal("Failed to update SSO provider").Write(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ---------- Internal helpers ----------

// findOrCreateSSOUser finds an existing linked user or creates a new one,
// then creates a session and returns the user + session token.
func (h *Handler) findOrCreateSSOUser(ctx context.Context, provider *Provider, userInfo *OIDCUserInfo) (*auth.User, string, error) {
	// Try to find an existing linked user
	userID, err := h.sso.FindUserByExternalID(ctx, provider.ID, userInfo.Sub)
	if err == nil {
		// User is already linked -- create session
		user, err := h.authRepo.GetUserByID(ctx, userID)
		if err != nil {
			return nil, "", fmt.Errorf("failed to get linked user: %w", err)
		}
		token, err := h.createSSOSession(ctx, user.ID)
		if err != nil {
			return nil, "", err
		}
		return user, token, nil
	}

	// Try to find by email
	email := userInfo.Email
	if email == "" {
		return nil, "", fmt.Errorf("OIDC provider did not return an email address")
	}
	email = strings.ToLower(strings.TrimSpace(email))

	user, _, err := h.authRepo.GetUserByEmail(ctx, email)
	if err == nil {
		// User exists but not linked -- link and create session
		name := userInfo.Name
		if name == "" {
			name = userInfo.PreferredUsername
		}
		if linkErr := h.sso.LinkUser(ctx, provider.ID, user.ID, userInfo.Sub, email, name); linkErr != nil {
			return nil, "", fmt.Errorf("failed to link SSO user: %w", linkErr)
		}
		token, err := h.createSSOSession(ctx, user.ID)
		if err != nil {
			return nil, "", err
		}
		return user, token, nil
	}

	// No existing user -- auto-create if enabled
	if !provider.AutoCreateMembers {
		return nil, "", fmt.Errorf("auto-creation disabled and no matching user found")
	}

	// Generate a username from the OIDC info
	username := sanitizeUsername(userInfo.PreferredUsername)
	if username == "" {
		username = sanitizeUsername(userInfo.Name)
	}
	if username == "" {
		username = sanitizeUsername(strings.Split(email, "@")[0])
	}

	// Ensure username uniqueness
	baseUsername := username
	for i := 1; ; i++ {
		exists, _ := h.authRepo.UsernameExists(ctx, username)
		if !exists {
			break
		}
		username = fmt.Sprintf("%s%d", baseUsername, i)
		if i > 100 {
			return nil, "", fmt.Errorf("could not generate unique username")
		}
	}

	// Create the user with a random password (SSO users authenticate via SSO, not password)
	randomPass := make([]byte, 32)
	rand.Read(randomPass)
	passwordHash := "$sso$" + base64.RawURLEncoding.EncodeToString(randomPass) // Marker that this is an SSO-only account

	newUserID := h.idGen.Generate().Int64()
	user, err = h.authRepo.CreateUser(ctx, newUserID, username, email, passwordHash)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create SSO user: %w", err)
	}

	// Link the SSO identity
	name := userInfo.Name
	if name == "" {
		name = userInfo.PreferredUsername
	}
	if err := h.sso.LinkUser(ctx, provider.ID, user.ID, userInfo.Sub, email, name); err != nil {
		return nil, "", fmt.Errorf("failed to link new SSO user: %w", err)
	}

	// Auto-add to guild as member
	h.db.Exec(ctx, `
		INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, provider.GuildID, user.ID)

	token, err := h.createSSOSession(ctx, user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}

// createSSOSession creates a session for an SSO-authenticated user.
func (h *Handler) createSSOSession(ctx context.Context, userID int64) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := fmt.Sprintf("%x", tokenBytes)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	if err := h.authRepo.CreateSession(ctx, token, userID, "sso", "", expiresAt); err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	return token, nil
}

// cleanupStates periodically removes expired OIDC states.
func (h *Handler) cleanupStates() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		h.statesMu.Lock()
		cutoff := time.Now().Add(-15 * time.Minute)
		for k, v := range h.states {
			if v.CreatedAt.Before(cutoff) {
				delete(h.states, k)
			}
		}
		h.statesMu.Unlock()
	}
}

// sanitizeUsername makes a string safe for use as a Valhalla username.
func sanitizeUsername(s string) string {
	s = strings.TrimSpace(s)
	var result []rune
	for _, c := range s {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '.' {
			result = append(result, c)
		}
	}
	if len(result) < 2 {
		return ""
	}
	if len(result) > 32 {
		result = result[:32]
	}
	return string(result)
}

// generateState creates a random state string for OIDC CSRF protection.
func generateState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
