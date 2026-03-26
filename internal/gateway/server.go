package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/events"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

const heartbeatInterval = 41250 // milliseconds (same as Discord)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: restrict in production
	},
}

// Server manages all WebSocket sessions.
type Server struct {
	ctx         context.Context
	AuthService *auth.Service
	ResumeURL   string
	idGen       *snowflake.Generator
	Typing      *TypingState

	mu       sync.RWMutex
	sessions map[string]*Session       // sessionID → Session
	users    map[int64][]*Session       // userID → Sessions (multi-device)
	guilds   map[int64]map[string]bool  // guildID → set of sessionIDs
}

// NewServer creates a new gateway server.
func NewServer(ctx context.Context, authService *auth.Service, idGen *snowflake.Generator, resumeURL string) *Server {
	return &Server{
		ctx:         ctx,
		AuthService: authService,
		ResumeURL:   resumeURL,
		idGen:       idGen,
		Typing:      NewTypingState(),
		sessions:    make(map[string]*Session),
		users:       make(map[int64][]*Session),
		guilds:      make(map[int64]map[string]bool),
	}
}

// HandleWebSocket handles incoming WebSocket connections.
func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}

	sessionID := s.idGen.Generate().String()
	session := NewSession(sessionID, conn, s)

	// Send HELLO with heartbeat interval
	helloData, _ := json.Marshal(events.HelloData{
		HeartbeatInterval: heartbeatInterval,
	})
	session.sendPayload(events.GatewayPayload{
		Op:   events.OpcodeHello,
		Data: helloData,
	})

	// Start read/write pumps
	go session.WritePump()
	go session.ReadPump()

	log.Debug().Str("session", sessionID).Msg("new websocket connection")
}

// Register adds an identified session to the routing tables.
func (s *Server) Register(session *Session) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions[session.ID] = session

	// Add to user's session list (multi-device)
	s.users[session.UserID] = append(s.users[session.UserID], session)

	// Subscribe to user's guilds
	for _, guildID := range session.GuildIDs {
		if s.guilds[guildID] == nil {
			s.guilds[guildID] = make(map[string]bool)
		}
		s.guilds[guildID][session.ID] = true
	}

	log.Info().
		Int64("user", session.UserID).
		Str("session", session.ID).
		Int("total_sessions", len(s.sessions)).
		Msg("session registered")
}

// Unregister removes a session from the routing tables.
func (s *Server) Unregister(session *Session) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, session.ID)

	// Remove from user sessions
	userSessions := s.users[session.UserID]
	for i, sess := range userSessions {
		if sess.ID == session.ID {
			s.users[session.UserID] = append(userSessions[:i], userSessions[i+1:]...)
			break
		}
	}
	if len(s.users[session.UserID]) == 0 {
		delete(s.users, session.UserID)
	}

	// Remove from guild subscriptions
	for _, guildID := range session.GuildIDs {
		if s.guilds[guildID] != nil {
			delete(s.guilds[guildID], session.ID)
			if len(s.guilds[guildID]) == 0 {
				delete(s.guilds, guildID)
			}
		}
	}

	session.Close()

	log.Info().
		Int64("user", session.UserID).
		Str("session", session.ID).
		Int("total_sessions", len(s.sessions)).
		Msg("session unregistered")
}

// DispatchToGuild sends a dispatch event to all sessions subscribed to a guild.
func (s *Server) DispatchToGuild(guildID int64, eventName string, data any) {
	s.mu.RLock()
	sessionIDs := s.guilds[guildID]
	targets := make([]*Session, 0, len(sessionIDs))
	for sid := range sessionIDs {
		if sess, ok := s.sessions[sid]; ok {
			targets = append(targets, sess)
		}
	}
	s.mu.RUnlock()

	for _, sess := range targets {
		sess.sendDispatch(eventName, data)
	}
}

// DispatchToChannel sends a dispatch event to sessions that can see a channel.
// TODO: Add permission filtering for lazy guilds.
func (s *Server) DispatchToChannel(guildID int64, channelID int64, eventName string, data any) {
	// For now, fan out to entire guild. Permission-filtered fan-out comes later.
	s.DispatchToGuild(guildID, eventName, data)
}

// DispatchToUser sends a dispatch event to all sessions of a specific user.
func (s *Server) DispatchToUser(userID int64, eventName string, data any) {
	s.mu.RLock()
	sessions := s.users[userID]
	targets := make([]*Session, len(sessions))
	copy(targets, sessions)
	s.mu.RUnlock()

	for _, sess := range targets {
		sess.sendDispatch(eventName, data)
	}
}

// SessionCount returns the number of active sessions.
func (s *Server) SessionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}

// StartHeartbeatChecker periodically checks for dead sessions.
func (s *Server) StartHeartbeatChecker() {
	ticker := time.NewTicker(time.Duration(heartbeatInterval) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.mu.RLock()
			var deadSessions []*Session
			for _, sess := range s.sessions {
				sess.mu.Lock()
				if sess.identified && !sess.heartbeatReceived && time.Since(sess.lastHeartbeat) > time.Duration(heartbeatInterval*2)*time.Millisecond {
					deadSessions = append(deadSessions, sess)
				}
				sess.heartbeatReceived = false
				sess.mu.Unlock()
			}
			s.mu.RUnlock()

			for _, sess := range deadSessions {
				log.Warn().Str("session", sess.ID).Msg("heartbeat timeout, closing session")
				sess.Conn.Close()
			}
		}
	}
}
