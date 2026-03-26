package search

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/permissions"
)

type Handler struct {
	service *Service
	perms   *permissions.Resolver
}

func NewHandler(service *Service, perms *permissions.Resolver) *Handler {
	return &Handler{service: service, perms: perms}
}

// SearchMessages handles GET /api/v1/guilds/{guildID}/messages/search
func (h *Handler) SearchMessages(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	query := r.URL.Query().Get("content")
	if query == "" {
		apierror.NewValidationError("content query parameter is required").Write(w)
		return
	}

	// Optional filters
	var channelID *int64
	if v := r.URL.Query().Get("channel_id"); v != "" {
		id, _ := strconv.ParseInt(v, 10, 64)
		channelID = &id
	}

	var authorID *int64
	if v := r.URL.Query().Get("author_id"); v != "" {
		id, _ := strconv.ParseInt(v, 10, 64)
		authorID = &id
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	// Membership check
	if h.perms != nil {
		isMember, _ := h.perms.IsMember(r.Context(), user.ID, guildID)
		if !isMember {
			apierror.ErrForbidden.Write(w)
			return
		}
	}

	result, err := h.service.Search(r.Context(), query, guildID, channelID, authorID, limit, offset)
	if err != nil {
		apierror.NewInternal("Search failed").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
