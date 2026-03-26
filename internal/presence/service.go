package presence

import (
	"sync"
	"time"
)

// Status represents a user's online status.
type Status string

const (
	StatusOnline    Status = "online"
	StatusIdle      Status = "idle"
	StatusDND       Status = "dnd"
	StatusOffline   Status = "offline"
	StatusInvisible Status = "invisible"

	// IdleTimeout: user is set to idle after 5 minutes of inactivity.
	IdleTimeout = 5 * time.Minute
)

// UserPresence represents a user's current presence state.
type UserPresence struct {
	UserID       int64  `json:"user_id,string"`
	Status       Status `json:"status"`
	CustomStatus string `json:"custom_status,omitempty"`
	ClientStatus struct {
		Desktop Status `json:"desktop,omitempty"`
		Mobile  Status `json:"mobile,omitempty"`
		Web     Status `json:"web,omitempty"`
	} `json:"client_status"`
	LastActivity time.Time `json:"-"`
}

// PresenceUpdate is dispatched to other users.
type PresenceUpdate struct {
	UserID       int64  `json:"user_id,string"`
	GuildID      int64  `json:"guild_id,string,omitempty"`
	Status       Status `json:"status"`
	CustomStatus string `json:"custom_status,omitempty"`
}

// Service tracks user presence in-memory.
// For scale, this would be backed by Redis.
type Service struct {
	mu        sync.RWMutex
	presences map[int64]*UserPresence // userID -> presence
	// guildMembers maps guildID -> set of userIDs for fanout
	guildMembers map[int64]map[int64]bool
}

func NewService() *Service {
	s := &Service{
		presences:    make(map[int64]*UserPresence),
		guildMembers: make(map[int64]map[int64]bool),
	}
	go s.idleChecker()
	return s
}

// SetOnline marks a user as online.
func (s *Service) SetOnline(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, exists := s.presences[userID]
	if !exists {
		p = &UserPresence{
			UserID: userID,
			Status: StatusOnline,
		}
		s.presences[userID] = p
	}
	p.Status = StatusOnline
	p.LastActivity = time.Now()
}

// SetStatus sets a user's status explicitly.
func (s *Service) SetStatus(userID int64, status Status) {
	s.mu.Lock()
	defer s.mu.Unlock()

	p, exists := s.presences[userID]
	if !exists {
		p = &UserPresence{UserID: userID}
		s.presences[userID] = p
	}
	p.Status = status
	p.LastActivity = time.Now()
}

// SetOffline removes a user's presence.
func (s *Service) SetOffline(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.presences, userID)
}

// Touch updates the last activity timestamp (prevents idle).
func (s *Service) Touch(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if p, ok := s.presences[userID]; ok {
		p.LastActivity = time.Now()
		if p.Status == StatusIdle {
			p.Status = StatusOnline
		}
	}
}

// GetPresence returns a user's current presence.
func (s *Service) GetPresence(userID int64) *UserPresence {
	s.mu.RLock()
	defer s.mu.RUnlock()

	p, exists := s.presences[userID]
	if !exists {
		return &UserPresence{UserID: userID, Status: StatusOffline}
	}
	return p
}

// GetGuildPresences returns presence for all online members of a guild.
func (s *Service) GetGuildPresences(guildID int64) []UserPresence {
	s.mu.RLock()
	defer s.mu.RUnlock()

	members := s.guildMembers[guildID]
	if members == nil {
		return nil
	}

	var result []UserPresence
	for userID := range members {
		if p, ok := s.presences[userID]; ok && p.Status != StatusOffline {
			result = append(result, *p)
		}
	}
	return result
}

// GetOnlineCount returns the number of online users in a guild.
func (s *Service) GetOnlineCount(guildID int64) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	if members, ok := s.guildMembers[guildID]; ok {
		for userID := range members {
			if p, ok := s.presences[userID]; ok && p.Status != StatusOffline {
				count++
			}
		}
	}
	return count
}

// RegisterGuildMember registers a user as a member of a guild (for fanout).
func (s *Service) RegisterGuildMember(userID, guildID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.guildMembers[guildID] == nil {
		s.guildMembers[guildID] = make(map[int64]bool)
	}
	s.guildMembers[guildID][userID] = true
}

// UnregisterGuildMember removes a user from guild membership tracking.
func (s *Service) UnregisterGuildMember(userID, guildID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if members, ok := s.guildMembers[guildID]; ok {
		delete(members, userID)
	}
}

// GetGuildsForUser returns all guildIDs where the user is tracked.
func (s *Service) GetGuildsForUser(userID int64) []int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var guilds []int64
	for guildID, members := range s.guildMembers {
		if members[userID] {
			guilds = append(guilds, guildID)
		}
	}
	return guilds
}

// idleChecker periodically checks for idle users.
func (s *Service) idleChecker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for _, p := range s.presences {
			if p.Status == StatusOnline && now.Sub(p.LastActivity) > IdleTimeout {
				p.Status = StatusIdle
			}
		}
		s.mu.Unlock()
	}
}
