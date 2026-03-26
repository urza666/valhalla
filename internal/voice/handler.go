package voice

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/gateway"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/events"
)

type Handler struct {
	service  *Service
	gwServer *gateway.Server
}

func NewHandler(service *Service, gwServer *gateway.Server) *Handler {
	return &Handler{service: service, gwServer: gwServer}
}

// JoinVoice handles POST /api/v1/channels/{channelID}/voice/join
func (h *Handler) JoinVoice(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// TODO: Check CONNECT permission, channel type = voice, user limit

	var req struct {
		GuildID int64 `json:"guild_id,string"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	resp, err := h.service.JoinChannel(r.Context(), user.ID, user.Username, req.GuildID, channelID, "")
	if err != nil {
		apierror.NewInternal("Failed to join voice channel").Write(w)
		return
	}

	// Dispatch VOICE_STATE_UPDATE to guild
	if h.gwServer != nil {
		h.gwServer.DispatchToGuild(req.GuildID, events.EventVoiceStateUpdate, resp.VoiceState)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// LeaveVoice handles POST /api/v1/channels/{channelID}/voice/leave
func (h *Handler) LeaveVoice(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	state := h.service.LeaveChannel(user.ID)
	if state == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Dispatch disconnected state
	if h.gwServer != nil {
		h.gwServer.DispatchToGuild(state.GuildID, events.EventVoiceStateUpdate, state)
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateVoiceState handles PATCH /api/v1/voice/state
func (h *Handler) UpdateVoiceState(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	var req VoiceStateUpdate
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	state := h.service.UpdateState(user.ID, req)
	if state == nil {
		apierror.NewBadRequest("Not in a voice channel").Write(w)
		return
	}

	// Dispatch state update
	if h.gwServer != nil {
		h.gwServer.DispatchToGuild(state.GuildID, events.EventVoiceStateUpdate, state)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

// GetVoiceStates handles GET /api/v1/guilds/{guildID}/voice-states
func (h *Handler) GetVoiceStates(w http.ResponseWriter, r *http.Request) {
	guildID, err := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	states := h.service.GetGuildVoiceStates(guildID)
	if states == nil {
		states = []VoiceState{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(states)
}

// GetChannelVoiceUsers handles GET /api/v1/channels/{channelID}/voice/users
func (h *Handler) GetChannelVoiceUsers(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	states := h.service.GetChannelStates(channelID)
	if states == nil {
		states = []VoiceState{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(states)
}
