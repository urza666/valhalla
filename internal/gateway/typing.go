package gateway

import (
	"sync"
	"time"
)

const (
	// TypingTimeout is how long a typing indicator stays active.
	TypingTimeout = 10 * time.Second
)

// TypingState tracks who is currently typing in which channel.
type TypingState struct {
	mu      sync.RWMutex
	entries map[int64]map[int64]time.Time // channelID -> userID -> expiresAt
}

func NewTypingState() *TypingState {
	ts := &TypingState{
		entries: make(map[int64]map[int64]time.Time),
	}
	go ts.cleanup()
	return ts
}

// Set marks a user as typing in a channel.
func (ts *TypingState) Set(channelID, userID int64) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if ts.entries[channelID] == nil {
		ts.entries[channelID] = make(map[int64]time.Time)
	}
	ts.entries[channelID][userID] = time.Now().Add(TypingTimeout)
}

// Clear removes a user's typing state (e.g., after sending a message).
func (ts *TypingState) Clear(channelID, userID int64) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if channel, ok := ts.entries[channelID]; ok {
		delete(channel, userID)
		if len(channel) == 0 {
			delete(ts.entries, channelID)
		}
	}
}

// GetTyping returns the user IDs currently typing in a channel.
func (ts *TypingState) GetTyping(channelID int64) []int64 {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	now := time.Now()
	var users []int64
	if channel, ok := ts.entries[channelID]; ok {
		for userID, expiresAt := range channel {
			if now.Before(expiresAt) {
				users = append(users, userID)
			}
		}
	}
	return users
}

// cleanup periodically removes expired typing entries.
func (ts *TypingState) cleanup() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ts.mu.Lock()
		now := time.Now()
		for channelID, channel := range ts.entries {
			for userID, expiresAt := range channel {
				if now.After(expiresAt) {
					delete(channel, userID)
				}
			}
			if len(channel) == 0 {
				delete(ts.entries, channelID)
			}
		}
		ts.mu.Unlock()
	}
}
