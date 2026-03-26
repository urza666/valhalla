package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

// Handler handles HTTP requests for authentication.
type Handler struct {
	service *Service
	lockout *LoginLockout
}

// NewHandler creates a new auth handler.
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
		lockout: NewLoginLockout(DefaultLockoutConfig),
	}
}

// Register handles POST /api/v1/auth/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	resp, err := h.service.Register(r.Context(), req)
	if err != nil {
		h.handleAuthError(w, err)
		return
	}

	// Set HttpOnly session cookie (7 days)
	SetSessionCookie(w, resp.Token, 7*24*60*60)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// Login handles POST /api/v1/auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	// Check lockout
	lockoutKey := r.RemoteAddr
	if h.lockout.IsLocked(lockoutKey) {
		apierror.NewBadRequest("Zu viele fehlgeschlagene Versuche. Bitte warte 15 Minuten.").Write(w)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	resp, err := h.service.Login(r.Context(), req)
	if err != nil {
		locked := h.lockout.RecordFailure(lockoutKey)
		if locked {
			apierror.NewBadRequest("Konto vorübergehend gesperrt nach zu vielen Fehlversuchen.").Write(w)
			return
		}
		h.handleAuthError(w, err)
		return
	}

	// Successful login — clear lockout
	h.lockout.RecordSuccess(lockoutKey)

	// Check if MFA is enabled
	if resp.User.MFAEnabled {
		// Return MFA challenge instead of full session
		// Store a temporary MFA ticket (reuse the token as ticket)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"mfa_required": true,
			"ticket":       resp.Token,
			"user":         map[string]string{"id": fmt.Sprintf("%d", resp.User.ID)},
		})
		return
	}

	// Set HttpOnly session cookie (7 days)
	SetSessionCookie(w, resp.Token, 7*24*60*60)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// MFALogin handles POST /api/v1/auth/mfa/login (complete login with TOTP code)
func (h *Handler) MFALogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Ticket string `json:"ticket"`
		Code   string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request").Write(w)
		return
	}

	// Validate ticket (it's actually a valid session token)
	user, err := h.service.ValidateToken(r.Context(), req.Ticket)
	if err != nil {
		apierror.ErrUnauthorized.Write(w)
		return
	}

	// Get MFA secret
	var secret *string
	h.service.db.QueryRow(r.Context(), `SELECT mfa_secret FROM users WHERE id = $1`, user.ID).Scan(&secret)
	if secret == nil {
		apierror.NewBadRequest("MFA not configured").Write(w)
		return
	}

	// Validate TOTP code
	if !ValidateTOTP(*secret, req.Code) {
		apierror.NewBadRequest("Ungültiger Code").Write(w)
		return
	}

	// MFA verified — set cookie and return full response
	SetSessionCookie(w, req.Ticket, 7*24*60*60)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token": req.Ticket,
		"user":  user,
	})
}

// Logout handles POST /api/v1/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	token := TokenFromRequest(r)
	if token == "" {
		apierror.ErrUnauthorized.Write(w)
		return
	}

	if err := h.service.Logout(r.Context(), token); err != nil {
		apierror.NewInternal("Failed to logout").Write(w)
		return
	}

	ClearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /api/v1/users/@me
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		apierror.ErrUnauthorized.Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// ForgotPassword handles POST /api/v1/auth/forgot-password
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	// Always return success to prevent email enumeration
	_ = h.service.CreatePasswordReset(r.Context(), req.Email)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "If an account with that email exists, a password reset link has been generated.",
	})
}

// ResetPassword handles POST /api/v1/auth/reset-password
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if len(req.NewPassword) < 8 || len(req.NewPassword) > 128 {
		apierror.NewValidationError("Password must be 8-128 characters").Write(w)
		return
	}

	if err := h.service.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		apierror.NewBadRequest("Invalid or expired reset token").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password has been reset successfully."})
}

// MFASetup handles POST /api/v1/users/@me/mfa/setup (start MFA enrollment)
func (h *Handler) MFASetup(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())

	// Generate TOTP secret
	secret, err := GenerateTOTPSecret()
	if err != nil {
		apierror.NewInternal("Failed to generate MFA secret").Write(w)
		return
	}

	// Store secret (not yet activated)
	h.service.db.Exec(r.Context(), `UPDATE users SET mfa_secret = $2 WHERE id = $1`, user.ID, secret)

	// Return secret + URI for QR code
	uri := GenerateTOTPURI(secret, user.Email, "Valhalla")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"secret": secret,
		"uri":    uri,
	})
}

// MFAVerify handles POST /api/v1/users/@me/mfa/verify (confirm MFA setup with first code)
func (h *Handler) MFAVerify(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request").Write(w)
		return
	}

	// Get stored secret
	var secret *string
	h.service.db.QueryRow(r.Context(), `SELECT mfa_secret FROM users WHERE id = $1`, user.ID).Scan(&secret)
	if secret == nil || *secret == "" {
		apierror.NewBadRequest("MFA not set up — call /mfa/setup first").Write(w)
		return
	}

	// Validate the code
	if !ValidateTOTP(*secret, req.Code) {
		apierror.NewBadRequest("Invalid code — please try again").Write(w)
		return
	}

	// Enable MFA
	h.service.db.Exec(r.Context(), `UPDATE users SET mfa_enabled = true WHERE id = $1`, user.ID)

	// Generate backup codes
	backupCodes, err := GenerateBackupCodes()
	if err != nil {
		apierror.NewInternal("Failed to generate backup codes").Write(w)
		return
	}

	// Store hashed backup codes
	for _, code := range backupCodes {
		hash, _ := hashPassword(code)
		h.service.db.Exec(r.Context(), `
			INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES ($1, $2, $3)
		`, h.service.idGen.Generate().Int64(), user.ID, hash)
	}

	// Invalidate session cache
	h.service.cache.InvalidateUser(user.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"enabled":      true,
		"backup_codes": backupCodes,
		"message":      "MFA enabled. Save your backup codes!",
	})
}

// MFADisable handles POST /api/v1/users/@me/mfa/disable
func (h *Handler) MFADisable(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())

	var req struct {
		Code string `json:"code"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Verify current TOTP code
	var secret *string
	h.service.db.QueryRow(r.Context(), `SELECT mfa_secret FROM users WHERE id = $1`, user.ID).Scan(&secret)
	if secret == nil || !ValidateTOTP(*secret, req.Code) {
		apierror.NewBadRequest("Invalid MFA code").Write(w)
		return
	}

	// Disable MFA
	h.service.db.Exec(r.Context(), `UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1`, user.ID)
	h.service.db.Exec(r.Context(), `DELETE FROM mfa_backup_codes WHERE user_id = $1`, user.ID)
	h.service.cache.InvalidateUser(user.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "MFA disabled"})
}

func (h *Handler) handleAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		apierror.ErrUnauthorized.Write(w)
	case errors.Is(err, ErrEmailTaken):
		apierror.NewConflict("Email is already registered").Write(w)
	case errors.Is(err, ErrUsernameTaken):
		apierror.NewConflict("Username is already taken").Write(w)
	case errors.Is(err, ErrInvalidEmail):
		apierror.NewValidationError("Invalid email address").Write(w)
	case errors.Is(err, ErrWeakPassword):
		apierror.NewValidationError("Password must be at least 8 characters").Write(w)
	case errors.Is(err, ErrInvalidUsername):
		apierror.NewValidationError("Username must be 2-32 characters, alphanumeric with dots and underscores").Write(w)
	default:
		apierror.NewInternal("Internal server error").Write(w)
	}
}
