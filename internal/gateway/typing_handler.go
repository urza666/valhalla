package gateway

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/events"
)

// HandleTyping handles POST /api/v1/channels/{channelID}/typing
// This triggers a TYPING_START dispatch to channel subscribers.
func (s *Server) HandleTyping(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Track typing state
	s.Typing.Set(channelID, user.ID)

	// Dispatch TYPING_START to channel subscribers
	typingData := events.TypingStartData{
		ChannelID: channelID,
		UserID:    user.ID,
		Timestamp: time.Now().Unix(),
	}
	s.DispatchToChannel(0, channelID, events.EventTypingStart, typingData)

	w.WriteHeader(http.StatusNoContent)
}

// HandleTypingWS handles typing from the WebSocket (alternative to REST).
func (s *Server) HandleTypingWS(sess *Session, data json.RawMessage) {
	var req struct {
		ChannelID int64 `json:"channel_id,string"`
	}
	if err := json.Unmarshal(data, &req); err != nil || req.ChannelID == 0 {
		return
	}

	s.Typing.Set(req.ChannelID, sess.UserID)

	typingData := events.TypingStartData{
		ChannelID: req.ChannelID,
		UserID:    sess.UserID,
		Timestamp: time.Now().Unix(),
	}
	s.DispatchToChannel(0, req.ChannelID, events.EventTypingStart, typingData)
}
