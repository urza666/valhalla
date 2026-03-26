package gateway

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/pkg/events"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingInterval   = (pongWait * 9) / 10
	maxMessageSize = 4096

	// eventBufferSize is the max number of dispatched events kept for resume replay.
	eventBufferSize = 100
)

// bufferedEvent stores a dispatched event for replay on resume.
type bufferedEvent struct {
	Sequence int64
	Payload  []byte // pre-marshalled GatewayPayload
}

// Session represents a single WebSocket client connection.
type Session struct {
	ID        string
	UserID    int64
	Token     string // auth token, stored for resume validation
	Conn      *websocket.Conn
	Server    *Server
	Send      chan []byte
	Sequence  int64
	GuildIDs  []int64
	Status    string // online, idle, dnd, invisible

	mu        sync.Mutex
	closed    bool
	identified bool
	heartbeatReceived bool
	lastHeartbeat     time.Time

	// Ring buffer of recent dispatched events for resume replay.
	eventBuf    [eventBufferSize]bufferedEvent
	eventBufPos int  // next write position in ring buffer
	eventBufLen int  // number of events stored (max eventBufferSize)
}

// NewSession creates a new gateway session.
func NewSession(id string, conn *websocket.Conn, server *Server) *Session {
	return &Session{
		ID:     id,
		Conn:   conn,
		Server: server,
		Send:   make(chan []byte, 256),
	}
}

// ReadPump reads messages from the WebSocket connection.
func (s *Session) ReadPump() {
	defer func() {
		s.Server.Unregister(s)
		s.Conn.Close()
	}()

	s.Conn.SetReadLimit(maxMessageSize)
	s.Conn.SetReadDeadline(time.Now().Add(pongWait))
	s.Conn.SetPongHandler(func(string) error {
		s.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := s.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Warn().Err(err).Str("session", s.ID).Msg("unexpected close")
			}
			return
		}

		s.handleMessage(message)
	}
}

// WritePump writes messages to the WebSocket connection.
func (s *Session) WritePump() {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		s.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-s.Send:
			s.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				s.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := s.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			s.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := s.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (s *Session) handleMessage(raw []byte) {
	var payload events.GatewayPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		log.Warn().Err(err).Str("session", s.ID).Msg("invalid payload")
		return
	}

	switch payload.Op {
	case events.OpcodeHeartbeat:
		s.handleHeartbeat()
	case events.OpcodeIdentify:
		s.handleIdentify(payload.Data)
	case events.OpcodeResume:
		s.handleResume(payload.Data)
	case events.OpcodePresenceUpdate:
		s.handlePresenceUpdate(payload.Data)
	default:
		log.Warn().Int("op", payload.Op).Str("session", s.ID).Msg("unknown opcode")
	}
}

func (s *Session) handleHeartbeat() {
	s.mu.Lock()
	s.heartbeatReceived = true
	s.lastHeartbeat = time.Now()
	s.mu.Unlock()

	s.sendPayload(events.GatewayPayload{Op: events.OpcodeHeartbeatACK})
}

func (s *Session) handleIdentify(data json.RawMessage) {
	var identify events.IdentifyData
	if err := json.Unmarshal(data, &identify); err != nil {
		s.sendInvalidSession(false)
		return
	}

	// Validate token via auth service
	user, err := s.Server.AuthService.ValidateToken(s.Server.ctx, identify.Token)
	if err != nil {
		s.sendInvalidSession(false)
		return
	}

	s.mu.Lock()
	s.UserID = user.ID
	s.Token = identify.Token
	s.identified = true
	s.Status = "online"
	s.mu.Unlock()

	// Register the session for event routing
	s.Server.Register(s)

	// Mark user as online
	if s.Server.OnUserOnline != nil {
		s.Server.OnUserOnline(user.ID)
	}

	// Send READY event
	ready := events.ReadyData{
		Version:          1,
		User:             user,
		Guilds:           []any{}, // TODO: load user's guilds
		SessionID:        s.ID,
		ResumeGatewayURL: s.Server.ResumeURL,
	}

	s.sendDispatch(events.EventReady, ready)

	log.Info().
		Int64("user_id", user.ID).
		Str("session", s.ID).
		Msg("client identified")
}

func (s *Session) handleResume(data json.RawMessage) {
	var resume events.ResumeData
	if err := json.Unmarshal(data, &resume); err != nil {
		s.sendInvalidSession(false)
		return
	}

	// Validate the token
	user, err := s.Server.AuthService.ValidateToken(s.Server.ctx, resume.Token)
	if err != nil {
		s.sendInvalidSession(false)
		return
	}

	// Look up the old session
	oldSession := s.Server.FindSession(resume.SessionID)
	if oldSession == nil {
		// Session not found (expired or never existed) — client must re-identify
		s.sendInvalidSession(false)
		return
	}

	// Token must belong to the same user
	oldSession.mu.Lock()
	if oldSession.UserID != user.ID || oldSession.Token != resume.Token {
		oldSession.mu.Unlock()
		s.sendInvalidSession(false)
		return
	}

	// Collect missed events from the old session's ring buffer
	missedEvents := oldSession.getMissedEvents(resume.Sequence)
	oldUserID := oldSession.UserID
	oldGuildIDs := oldSession.GuildIDs
	oldStatus := oldSession.Status
	oldToken := oldSession.Token
	oldSession.mu.Unlock()

	if missedEvents == nil {
		// Client missed too many events; buffer doesn't go back far enough.
		// Tell client to reconnect and re-identify.
		s.sendInvalidSession(true)
		return
	}

	// Remove the old session from routing tables
	s.Server.Unregister(oldSession)

	// Transfer state to this new session, reusing the old session ID
	s.mu.Lock()
	s.ID = resume.SessionID
	s.UserID = oldUserID
	s.Token = oldToken
	s.identified = true
	s.GuildIDs = oldGuildIDs
	s.Status = oldStatus
	s.Sequence = resume.Sequence
	s.mu.Unlock()

	// Register the resumed session
	s.Server.Register(s)

	// Send RESUMED event
	s.sendDispatch(events.EventResumed, nil)

	// Replay missed events
	for _, evt := range missedEvents {
		s.mu.Lock()
		if s.closed {
			s.mu.Unlock()
			return
		}
		s.mu.Unlock()

		select {
		case s.Send <- evt.Payload:
		default:
			log.Warn().Str("session", s.ID).Msg("send buffer full during replay, aborting")
			return
		}
	}

	log.Info().
		Int64("user_id", oldUserID).
		Str("session", s.ID).
		Int("replayed", len(missedEvents)).
		Msg("session resumed")
}

func (s *Session) handlePresenceUpdate(data json.RawMessage) {
	var presence events.PresenceUpdateData
	if err := json.Unmarshal(data, &presence); err != nil {
		log.Warn().Err(err).Str("session", s.ID).Msg("invalid presence update payload")
		return
	}

	// Validate status
	switch presence.Status {
	case "online", "idle", "dnd", "invisible":
		// valid
	default:
		log.Warn().Str("status", presence.Status).Str("session", s.ID).Msg("invalid presence status")
		return
	}

	s.mu.Lock()
	if !s.identified {
		s.mu.Unlock()
		return
	}
	s.Status = presence.Status
	userID := s.UserID
	guildIDs := make([]int64, len(s.GuildIDs))
	copy(guildIDs, s.GuildIDs)
	s.mu.Unlock()

	// Dispatch PRESENCE_UPDATE to all guilds this user is in
	dispatchData := events.PresenceUpdateData{
		UserID:     userID,
		Status:     presence.Status,
		Activities: presence.Activities,
	}
	for _, guildID := range guildIDs {
		s.Server.DispatchToGuild(guildID, events.EventPresenceUpdate, dispatchData)
	}

	log.Debug().
		Int64("user_id", userID).
		Str("status", presence.Status).
		Msg("presence updated")
}

// sendPayload sends a gateway payload to this session.
func (s *Session) sendPayload(payload events.GatewayPayload) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal payload")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}

	select {
	case s.Send <- data:
	default:
		log.Warn().Str("session", s.ID).Msg("send buffer full, dropping message")
	}
}

// sendDispatch sends a dispatch event (op=0) to this session.
// Unlike sendPayload, this handles sequencing and buffering in a single lock.
func (s *Session) sendDispatch(eventName string, eventData any) {
	d, _ := json.Marshal(eventData)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.Sequence++
	seq := s.Sequence

	payload := events.GatewayPayload{
		Op:       events.OpcodeDispatch,
		Data:     d,
		Sequence: &seq,
		Type:     eventName,
	}

	marshalled, _ := json.Marshal(payload)

	// Buffer the event for potential resume replay.
	s.eventBuf[s.eventBufPos] = bufferedEvent{Sequence: seq, Payload: marshalled}
	s.eventBufPos = (s.eventBufPos + 1) % eventBufferSize
	if s.eventBufLen < eventBufferSize {
		s.eventBufLen++
	}

	if s.closed {
		return
	}

	select {
	case s.Send <- marshalled:
	default:
		log.Warn().Str("session", s.ID).Msg("send buffer full, dropping message")
	}
}

func (s *Session) sendInvalidSession(resumable bool) {
	d, _ := json.Marshal(resumable)
	s.sendPayload(events.GatewayPayload{
		Op:   events.OpcodeInvalidSession,
		Data: d,
	})
}

// getMissedEvents returns buffered events with sequence > lastSeq.
// Returns nil if the buffer doesn't cover the requested sequence (too old).
// Must be called with s.mu held.
func (s *Session) getMissedEvents(lastSeq int64) []bufferedEvent {
	if s.eventBufLen == 0 {
		return []bufferedEvent{}
	}

	// Find the oldest event in the buffer
	oldestIdx := (s.eventBufPos - s.eventBufLen + eventBufferSize) % eventBufferSize
	oldestSeq := s.eventBuf[oldestIdx].Sequence

	// If client's last sequence is older than our oldest buffered event,
	// the gap is too large to replay.
	if lastSeq < oldestSeq-1 {
		return nil
	}

	// Collect events newer than lastSeq
	var missed []bufferedEvent
	for i := 0; i < s.eventBufLen; i++ {
		idx := (oldestIdx + i) % eventBufferSize
		if s.eventBuf[idx].Sequence > lastSeq {
			missed = append(missed, s.eventBuf[idx])
		}
	}
	return missed
}

// Close marks the session as closed.
func (s *Session) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.closed {
		s.closed = true
		close(s.Send)
	}
}
