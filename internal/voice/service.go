package voice

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/livekit/protocol/auth"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

// Service manages voice state and LiveKit room integration.
type Service struct {
	mu     sync.RWMutex
	states map[int64]*VoiceState // userID -> voice state

	// channelUsers maps channelID -> set of userIDs
	channelUsers map[int64]map[int64]bool

	lkClient  *lksdk.RoomServiceClient
	lkHost    string
	lkAPIKey  string
	lkSecret  string
}

func NewService(lkHost, lkAPIKey, lkSecret string) *Service {
	client := lksdk.NewRoomServiceClient(lkHost, lkAPIKey, lkSecret)
	return &Service{
		states:       make(map[int64]*VoiceState),
		channelUsers: make(map[int64]map[int64]bool),
		lkClient:     client,
		lkHost:       lkHost,
		lkAPIKey:     lkAPIKey,
		lkSecret:     lkSecret,
	}
}

// JoinChannel connects a user to a voice channel.
func (s *Service) JoinChannel(ctx context.Context, userID int64, username string, guildID, channelID int64, sessionID string) (*JoinVoiceResponse, error) {
	// Leave current channel if in one
	s.leaveCurrentChannel(userID)

	// Create or ensure LiveKit room exists
	roomName := fmt.Sprintf("vc_%d", channelID)
	s.ensureRoom(ctx, roomName)

	// Generate LiveKit access token for this user
	token, err := s.generateToken(roomName, userID, username)
	if err != nil {
		return nil, fmt.Errorf("failed to generate voice token: %w", err)
	}

	// Update voice state
	state := &VoiceState{
		GuildID:   guildID,
		ChannelID: &channelID,
		UserID:    userID,
		SessionID: sessionID,
		SelfMute:  false,
		SelfDeaf:  false,
	}

	s.mu.Lock()
	s.states[userID] = state
	if s.channelUsers[channelID] == nil {
		s.channelUsers[channelID] = make(map[int64]bool)
	}
	s.channelUsers[channelID][userID] = true
	s.mu.Unlock()

	// Build WebSocket URL from HTTP URL
	wsEndpoint := s.lkHost
	// LiveKit client SDK needs the ws:// endpoint
	// In production this would be wss://
	if len(wsEndpoint) > 4 && wsEndpoint[:4] == "http" {
		wsEndpoint = "ws" + wsEndpoint[4:]
	}

	return &JoinVoiceResponse{
		VoiceState: *state,
		Server: VoiceServerInfo{
			Token:    token,
			Endpoint: wsEndpoint,
		},
	}, nil
}

// LeaveChannel disconnects a user from their current voice channel.
func (s *Service) LeaveChannel(userID int64) *VoiceState {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldState, ok := s.states[userID]
	if !ok {
		return nil
	}

	// Remove from channel user set
	if oldState.ChannelID != nil {
		if users, ok := s.channelUsers[*oldState.ChannelID]; ok {
			delete(users, userID)
			if len(users) == 0 {
				delete(s.channelUsers, *oldState.ChannelID)
			}
		}
	}

	delete(s.states, userID)

	// Return a "disconnected" state for dispatch
	return &VoiceState{
		GuildID:   oldState.GuildID,
		ChannelID: nil, // nil = disconnected
		UserID:    userID,
		SessionID: oldState.SessionID,
	}
}

// UpdateState updates mute/deaf/video/stream state.
func (s *Service) UpdateState(userID int64, update VoiceStateUpdate) *VoiceState {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.states[userID]
	if !ok {
		return nil
	}

	if update.SelfMute != nil {
		state.SelfMute = *update.SelfMute
	}
	if update.SelfDeaf != nil {
		state.SelfDeaf = *update.SelfDeaf
		if *update.SelfDeaf {
			state.SelfMute = true // Deaf implies mute
		}
	}
	if update.SelfVideo != nil {
		state.SelfVideo = *update.SelfVideo
	}
	if update.SelfStream != nil {
		state.Stream = *update.SelfStream
	}

	return state
}

// GetState returns a user's current voice state.
func (s *Service) GetState(userID int64) *VoiceState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.states[userID]
}

// GetChannelUsers returns all users in a voice channel.
func (s *Service) GetChannelUsers(channelID int64) []int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var users []int64
	if channelUsers, ok := s.channelUsers[channelID]; ok {
		for uid := range channelUsers {
			users = append(users, uid)
		}
	}
	return users
}

// GetChannelStates returns voice states for all users in a channel.
func (s *Service) GetChannelStates(channelID int64) []VoiceState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var states []VoiceState
	if channelUsers, ok := s.channelUsers[channelID]; ok {
		for uid := range channelUsers {
			if state, ok := s.states[uid]; ok {
				states = append(states, *state)
			}
		}
	}
	return states
}

// GetGuildVoiceStates returns all voice states for a guild.
func (s *Service) GetGuildVoiceStates(guildID int64) []VoiceState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var states []VoiceState
	for _, state := range s.states {
		if state.GuildID == guildID {
			states = append(states, *state)
		}
	}
	return states
}

func (s *Service) leaveCurrentChannel(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if state, ok := s.states[userID]; ok && state.ChannelID != nil {
		if users, ok := s.channelUsers[*state.ChannelID]; ok {
			delete(users, userID)
			if len(users) == 0 {
				delete(s.channelUsers, *state.ChannelID)
			}
		}
		delete(s.states, userID)
	}
}

func (s *Service) ensureRoom(ctx context.Context, roomName string) {
	s.lkClient.CreateRoom(ctx, &livekit.CreateRoomRequest{
		Name:            roomName,
		EmptyTimeout:    300, // 5 min empty timeout
		MaxParticipants: 99,
	})
	// Ignore error — room may already exist
}

func (s *Service) generateToken(roomName string, userID int64, username string) (string, error) {
	at := auth.NewAccessToken(s.lkAPIKey, s.lkSecret)
	identity := fmt.Sprintf("%d", userID)

	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}

	at.AddGrant(grant).
		SetIdentity(identity).
		SetName(username).
		SetValidFor(24 * time.Hour)

	return at.ToJWT()
}
