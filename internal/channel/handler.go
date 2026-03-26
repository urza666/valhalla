package channel

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

type Handler struct {
	repo  *Repository
	idGen *snowflake.Generator
}

func NewHandler(repo *Repository, idGen *snowflake.Generator) *Handler {
	return &Handler{repo: repo, idGen: idGen}
}

// GetGuildChannels handles GET /api/v1/guilds/{guildID}/channels
func (h *Handler) GetGuildChannels(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserFromContext(r.Context())
	guildID, err := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// TODO: membership + permission check
	channels, err := h.repo.GetGuildChannels(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Failed to fetch channels").Write(w)
		return
	}
	if channels == nil {
		channels = []Channel{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(channels)
}

// CreateChannel handles POST /api/v1/guilds/{guildID}/channels
func (h *Handler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserFromContext(r.Context())
	guildID, err := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if req.Name == "" || len(req.Name) > 100 {
		apierror.NewValidationError("Channel name must be 1-100 characters").Write(w)
		return
	}

	// TODO: MANAGE_CHANNELS permission check
	channelID := h.idGen.Generate().Int64()
	ch, err := h.repo.Create(r.Context(), channelID, &guildID, req)
	if err != nil {
		apierror.NewInternal("Failed to create channel").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ch)
}

// GetChannel handles GET /api/v1/channels/{channelID}
func (h *Handler) GetChannel(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	ch, err := h.repo.Get(r.Context(), channelID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ch)
}

// UpdateChannel handles PATCH /api/v1/channels/{channelID}
func (h *Handler) UpdateChannel(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req UpdateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	ch, err := h.repo.Update(r.Context(), channelID, req)
	if err != nil {
		apierror.NewInternal("Failed to update channel").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ch)
}

// DeleteChannel handles DELETE /api/v1/channels/{channelID}
func (h *Handler) DeleteChannel(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if err := h.repo.Delete(r.Context(), channelID); err != nil {
		apierror.NewInternal("Failed to delete channel").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
