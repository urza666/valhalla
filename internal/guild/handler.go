package guild

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

// CreateGuild handles POST /api/v1/guilds
func (h *Handler) CreateGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	var req CreateGuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	g, roles, channels, err := h.service.CreateGuild(r.Context(), user.ID, req)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"guild":    g,
		"roles":    roles,
		"channels": channels,
	})
}

// GetGuild handles GET /api/v1/guilds/{guildID}
func (h *Handler) GetGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	g, err := h.service.GetGuild(r.Context(), guildID, user.ID)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// UpdateGuild handles PATCH /api/v1/guilds/{guildID}
func (h *Handler) UpdateGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req UpdateGuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	g, err := h.service.UpdateGuild(r.Context(), guildID, user.ID, req)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// DeleteGuild handles DELETE /api/v1/guilds/{guildID}
func (h *Handler) DeleteGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if err := h.service.DeleteGuild(r.Context(), guildID, user.ID); err != nil {
		handleGuildError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetUserGuilds handles GET /api/v1/users/@me/guilds
func (h *Handler) GetUserGuilds(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guilds, err := h.service.GetUserGuilds(r.Context(), user.ID)
	if err != nil {
		apierror.NewInternal("Failed to fetch guilds").Write(w)
		return
	}
	if guilds == nil {
		guilds = []Guild{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(guilds)
}

// GetMembers handles GET /api/v1/guilds/{guildID}/members
func (h *Handler) GetMembers(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	members, err := h.service.GetMembers(r.Context(), guildID, user.ID, limit, offset)
	if err != nil {
		handleGuildError(w, err)
		return
	}
	if members == nil {
		members = []Member{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// GetRoles handles GET /api/v1/guilds/{guildID}/roles
func (h *Handler) GetRoles(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))

	roles, err := h.service.GetRoles(r.Context(), guildID, user.ID)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

// JoinGuild handles POST /api/v1/invites/{code}/accept
func (h *Handler) JoinGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	code := chi.URLParam(r, "code")

	g, member, err := h.service.JoinGuild(r.Context(), user.ID, code)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"guild":  g,
		"member": member,
	})
}

// CreateInvite handles POST /api/v1/channels/{channelID}/invites
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := parseID(chi.URLParam(r, "channelID"))

	var body struct {
		MaxAge  int `json:"max_age"`
		MaxUses int `json:"max_uses"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	// TODO: resolve guildID from channelID properly
	inv, err := h.service.CreateInvite(r.Context(), 0, channelID, user.ID, body.MaxAge, body.MaxUses)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(inv)
}

// KickMember handles DELETE /api/v1/guilds/{guildID}/members/{userID}
func (h *Handler) KickMember(w http.ResponseWriter, r *http.Request) {
	actor := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	targetID, _ := parseID(chi.URLParam(r, "userID"))

	if err := h.service.KickMember(r.Context(), guildID, targetID, actor.ID); err != nil {
		handleGuildError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseID(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func handleGuildError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		apierror.ErrNotFound.Write(w)
	case errors.Is(err, ErrNotMember):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrNotOwner):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrAlreadyMember):
		apierror.NewConflict("Already a member of this guild").Write(w)
	case errors.Is(err, ErrBanned):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrInvalidName):
		apierror.NewValidationError(err.Error()).Write(w)
	case errors.Is(err, ErrInviteInvalid):
		apierror.NewBadRequest("Invalid or expired invite").Write(w)
	default:
		apierror.NewInternal("Internal server error").Write(w)
	}
}
