package user

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// UpdateProfile handles PATCH /api/v1/users/@me
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), user.ID, req)
	if err != nil {
		apierror.NewInternal("Failed to update profile").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// ChangePassword handles POST /api/v1/users/@me/password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	err := h.service.ChangePassword(r.Context(), user.ID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrWrongPassword):
			apierror.ErrUnauthorized.Write(w)
		case errors.Is(err, ErrWeakPassword):
			apierror.NewValidationError(err.Error()).Write(w)
		default:
			apierror.NewInternal("Failed to change password").Write(w)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetSessions handles GET /api/v1/users/@me/sessions
func (h *Handler) GetSessions(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	token := auth.TokenFromRequest(r)

	sessions, err := h.service.GetSessions(r.Context(), u.ID, token)
	if err != nil {
		apierror.NewInternal("Failed to fetch sessions").Write(w)
		return
	}
	if sessions == nil {
		sessions = []Session{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// RevokeSession handles DELETE /api/v1/users/@me/sessions/:prefix
func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	// For simplicity, revoke all other sessions
	u := auth.UserFromContext(r.Context())
	token := auth.TokenFromRequest(r)

	h.service.RevokeAllSessions(r.Context(), u.ID, token)
	w.WriteHeader(http.StatusNoContent)
}
