package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

// Handler handles HTTP requests for authentication.
type Handler struct {
	service *Service
}

// NewHandler creates a new auth handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	resp, err := h.service.Login(r.Context(), req)
	if err != nil {
		h.handleAuthError(w, err)
		return
	}

	// Set HttpOnly session cookie (7 days)
	SetSessionCookie(w, resp.Token, 7*24*60*60)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
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
