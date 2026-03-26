package auth

import (
	"sync"
	"time"
)

// SessionCache provides an in-memory cache for validated sessions.
// This eliminates 2 DB queries per request for recently validated tokens.
// Can be replaced with Redis for multi-instance deployments.
type SessionCache struct {
	mu      sync.RWMutex
	entries map[string]*cachedUser
	ttl     time.Duration
}

type cachedUser struct {
	user      *User
	expiresAt time.Time
}

// NewSessionCache creates a cache with the given TTL per entry.
func NewSessionCache(ttl time.Duration) *SessionCache {
	c := &SessionCache{
		entries: make(map[string]*cachedUser),
		ttl:     ttl,
	}
	// Background cleanup every minute
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()
	return c
}

// Get returns a cached user for the token, or nil if not cached/expired.
func (c *SessionCache) Get(token string) *User {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.entries[token]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil
	}
	return entry.user
}

// Set stores a user in the cache.
func (c *SessionCache) Set(token string, user *User) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[token] = &cachedUser{
		user:      user,
		expiresAt: time.Now().Add(c.ttl),
	}
}

// Invalidate removes a token from the cache (used on logout).
func (c *SessionCache) Invalidate(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, token)
}

// InvalidateUser removes all cached sessions for a user (used on password change).
func (c *SessionCache) InvalidateUser(userID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for token, entry := range c.entries {
		if entry.user.ID == userID {
			delete(c.entries, token)
		}
	}
}

func (c *SessionCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for token, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, token)
		}
	}
}
