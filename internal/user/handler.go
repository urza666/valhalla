package user

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

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

// GetRelationships handles GET /api/v1/users/@me/relationships
func (h *Handler) GetRelationships(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	rels, err := h.service.GetRelationships(r.Context(), u.ID)
	if err != nil {
		apierror.NewInternal("Failed to fetch relationships").Write(w)
		return
	}
	if rels == nil {
		rels = []Relationship{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rels)
}

// SendFriendRequest handles POST /api/v1/users/@me/relationships
func (h *Handler) SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	var req struct {
		Username string `json:"username"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	err := h.service.SendFriendRequest(r.Context(), u.ID, req.Username)
	if err != nil {
		switch {
		case errors.Is(err, ErrTargetNotFound):
			apierror.NewBadRequest("Benutzer nicht gefunden").Write(w)
		case errors.Is(err, ErrSelfRelation):
			apierror.NewBadRequest("Kannst du nicht mit dir selbst").Write(w)
		case errors.Is(err, ErrAlreadyFriends):
			apierror.NewConflict("Bereits befreundet").Write(w)
		default:
			apierror.NewBadRequest(err.Error()).Write(w)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AcceptFriend handles PUT /api/v1/users/@me/relationships/{targetID}
func (h *Handler) AcceptFriend(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	targetID, _ := strconv.ParseInt(chi.URLParam(r, "targetID"), 10, 64)

	h.service.AcceptFriend(r.Context(), u.ID, targetID)
	w.WriteHeader(http.StatusNoContent)
}

// RemoveFriend handles DELETE /api/v1/users/@me/relationships/{targetID}
func (h *Handler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	targetID, _ := strconv.ParseInt(chi.URLParam(r, "targetID"), 10, 64)

	h.service.RemoveFriend(r.Context(), u.ID, targetID)
	w.WriteHeader(http.StatusNoContent)
}

// BlockUser handles PUT /api/v1/users/@me/blocks/{targetID}
func (h *Handler) BlockUser(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	targetID, _ := strconv.ParseInt(chi.URLParam(r, "targetID"), 10, 64)

	h.service.BlockUser(r.Context(), u.ID, targetID)
	w.WriteHeader(http.StatusNoContent)
}

// UnblockUser handles DELETE /api/v1/users/@me/blocks/{targetID}
func (h *Handler) UnblockUser(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFromContext(r.Context())
	targetID, _ := strconv.ParseInt(chi.URLParam(r, "targetID"), 10, 64)

	h.service.UnblockUser(r.Context(), u.ID, targetID)
	w.WriteHeader(http.StatusNoContent)
}

// GetUserProfile handles GET /api/v1/users/{userID}/profile
func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	targetID, _ := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)

	var user map[string]any
	var id int64
	var username string
	var displayName, avatarHash, bio *string
	err := h.service.db.QueryRow(r.Context(), `
		SELECT id, username, display_name, avatar_hash, bio FROM users WHERE id = $1
	`, targetID).Scan(&id, &username, &displayName, &avatarHash, &bio)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	user = map[string]any{
		"id": id, "username": username, "display_name": displayName,
		"avatar": avatarHash, "bio": bio,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
