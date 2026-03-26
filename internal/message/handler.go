package message

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/gateway"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/events"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

type Handler struct {
	repo      *Repository
	idGen     *snowflake.Generator
	gwServer  *gateway.Server
}

func NewHandler(repo *Repository, idGen *snowflake.Generator, gwServer *gateway.Server) *Handler {
	return &Handler{repo: repo, idGen: idGen, gwServer: gwServer}
}

// GetMessages handles GET /api/v1/channels/{channelID}/messages
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// TODO: VIEW_CHANNEL + READ_MESSAGE_HISTORY permission check

	q := MessagesQuery{Limit: 50}
	if v := r.URL.Query().Get("before"); v != "" {
		q.Before, _ = strconv.ParseInt(v, 10, 64)
	}
	if v := r.URL.Query().Get("after"); v != "" {
		q.After, _ = strconv.ParseInt(v, 10, 64)
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		q.Limit, _ = strconv.Atoi(v)
	}

	messages, err := h.repo.GetMessages(r.Context(), channelID, q)
	if err != nil {
		apierror.NewInternal("Failed to fetch messages").Write(w)
		return
	}
	if messages == nil {
		messages = []Message{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// CreateMessage handles POST /api/v1/channels/{channelID}/messages
func (h *Handler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if len(req.Content) == 0 || len(req.Content) > 4000 {
		apierror.NewValidationError("Message content must be 1-4000 characters").Write(w)
		return
	}

	// TODO: SEND_MESSAGES permission check + slowmode check

	msgID := h.idGen.Generate().Int64()
	msg, err := h.repo.Create(r.Context(), msgID, channelID, user.ID, req)
	if err != nil {
		apierror.NewInternal("Failed to create message").Write(w)
		return
	}

	// Dispatch MESSAGE_CREATE to all subscribers via WebSocket Gateway
	guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
	if h.gwServer != nil {
		h.gwServer.DispatchToChannel(guildID, channelID, events.EventMessageCreate, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

// UpdateMessage handles PATCH /api/v1/channels/{channelID}/messages/{messageID}
func (h *Handler) UpdateMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	messageID, err := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Only the author can edit their own message
	authorID, err := h.repo.GetAuthorID(r.Context(), messageID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	if authorID != user.ID {
		apierror.ErrForbidden.Write(w)
		return
	}

	var req UpdateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	msg, err := h.repo.Update(r.Context(), messageID, req.Content)
	if err != nil {
		apierror.NewInternal("Failed to update message").Write(w)
		return
	}

	if h.gwServer != nil {
		gID := h.repo.GetChannelGuildID(r.Context(), msg.ChannelID)
		h.gwServer.DispatchToChannel(gID, msg.ChannelID, events.EventMessageUpdate, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msg)
}

// DeleteMessage handles DELETE /api/v1/channels/{channelID}/messages/{messageID}
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	messageID, err := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Author or MANAGE_MESSAGES permission
	authorID, err := h.repo.GetAuthorID(r.Context(), messageID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	if authorID != user.ID {
		// TODO: check MANAGE_MESSAGES permission
		apierror.ErrForbidden.Write(w)
		return
	}

	if err := h.repo.Delete(r.Context(), messageID); err != nil {
		apierror.NewInternal("Failed to delete message").Write(w)
		return
	}

	if h.gwServer != nil {
		delGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.gwServer.DispatchToChannel(delGuildID, channelID, events.EventMessageDelete, map[string]any{
			"id":         strconv.FormatInt(messageID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// AddReaction handles PUT /api/v1/channels/{channelID}/messages/{messageID}/reactions/{emoji}/@me
func (h *Handler) AddReaction(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	messageID, _ := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	emoji := chi.URLParam(r, "emoji")

	if err := h.repo.AddReaction(r.Context(), messageID, user.ID, emoji); err != nil {
		apierror.NewInternal("Failed to add reaction").Write(w)
		return
	}

	if h.gwServer != nil {
		rGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.gwServer.DispatchToChannel(rGuildID, channelID, events.EventMessageReactionAdd, map[string]any{
			"user_id":    strconv.FormatInt(user.ID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
			"message_id": strconv.FormatInt(messageID, 10),
			"emoji":      emoji,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// RemoveReaction handles DELETE /api/v1/channels/{channelID}/messages/{messageID}/reactions/{emoji}/@me
func (h *Handler) RemoveReaction(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	messageID, _ := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	emoji := chi.URLParam(r, "emoji")

	if err := h.repo.RemoveReaction(r.Context(), messageID, user.ID, emoji); err != nil {
		apierror.NewInternal("Failed to remove reaction").Write(w)
		return
	}

	if h.gwServer != nil {
		rrGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.gwServer.DispatchToChannel(rrGuildID, channelID, events.EventMessageReactionRemove, map[string]any{
			"user_id":    strconv.FormatInt(user.ID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
			"message_id": strconv.FormatInt(messageID, 10),
			"emoji":      emoji,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// AckMessage handles POST /api/v1/channels/{channelID}/messages/{messageID}/ack
func (h *Handler) AckMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	messageID, _ := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)

	if err := h.repo.AckMessage(r.Context(), user.ID, channelID, messageID); err != nil {
		apierror.NewInternal("Failed to ack message").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
