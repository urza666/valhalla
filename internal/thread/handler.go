package thread

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

// CreateThread handles POST /api/v1/channels/{channelID}/threads
func (h *Handler) CreateThread(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req CreateThreadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	var guildID int64
	if h.perms != nil {
		ci, err := h.perms.GetChannelInfo(r.Context(), channelID)
		if err != nil {
			apierror.ErrNotFound.Write(w)
			return
		}
		guildID = ci.GuildID
		hasPerm, _ := h.perms.HasGuildPerm(r.Context(), user.ID, guildID, permissions.CreatePublicThreads)
		if !hasPerm {
			apierror.ErrForbidden.Write(w)
			return
		}
	}
	t, err := h.service.CreateThread(r.Context(), channelID, guildID, user.ID, req)
	if err != nil {
		apierror.NewBadRequest(err.Error()).Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

// GetActiveThreads handles GET /api/v1/channels/{channelID}/threads
func (h *Handler) GetActiveThreads(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	threads, err := h.service.GetActiveThreads(r.Context(), channelID)
	if err != nil {
		apierror.NewInternal("Failed to fetch threads").Write(w)
		return
	}
	if threads == nil {
		threads = []Thread{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(threads)
}

// ArchiveThread handles PATCH /api/v1/channels/{channelID} with thread_archived=true
// (reuses channel update for MVP)
