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
)

// Session represents a single WebSocket client connection.
type Session struct {
	ID        string
	UserID    int64
	Conn      *websocket.Conn
	Server    *Server
	Send      chan []byte
	Sequence  int64
	GuildIDs  []int64
	mu        sync.Mutex
	closed    bool
	identified bool
	heartbeatReceived bool
	lastHeartbeat     time.Time
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
	s.identified = true
	s.mu.Unlock()

	// Register the session for event routing
	s.Server.Register(s)

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
	// TODO: implement session resume with event replay
	s.sendInvalidSession(false) // For now, require re-identify
}

func (s *Session) handlePresenceUpdate(data json.RawMessage) {
	// TODO: implement presence updates
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
func (s *Session) sendDispatch(eventName string, eventData any) {
	s.mu.Lock()
	s.Sequence++
	seq := s.Sequence
	s.mu.Unlock()

	d, _ := json.Marshal(eventData)
	payload := events.GatewayPayload{
		Op:       events.OpcodeDispatch,
		Data:     d,
		Sequence: &seq,
		Type:     eventName,
	}
	s.sendPayload(payload)
}

func (s *Session) sendInvalidSession(resumable bool) {
	d, _ := json.Marshal(resumable)
	s.sendPayload(events.GatewayPayload{
		Op:   events.OpcodeInvalidSession,
		Data: d,
	})
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
