package auth

import (
	"sync"
	"time"
)

// LoginLockout tracks failed login attempts and locks accounts temporarily.
// After MaxAttempts failures within Window, the IP/email is locked for LockoutDuration.
type LoginLockout struct {
	mu       sync.Mutex
	attempts map[string]*lockoutEntry
	config   LockoutConfig
}

type LockoutConfig struct {
	MaxAttempts     int
	Window          time.Duration
	LockoutDuration time.Duration
}

type lockoutEntry struct {
	failures  int
	firstFail time.Time
	lockedAt  *time.Time
}

// DefaultLockoutConfig: 5 failures in 10 minutes → 15 minute lockout
var DefaultLockoutConfig = LockoutConfig{
	MaxAttempts:     5,
	Window:          10 * time.Minute,
	LockoutDuration: 15 * time.Minute,
}

func NewLoginLockout(config LockoutConfig) *LoginLockout {
	l := &LoginLockout{
		attempts: make(map[string]*lockoutEntry),
		config:   config,
	}
	// Cleanup goroutine
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			l.cleanup()
		}
	}()
	return l
}

// IsLocked checks if the given key (IP or email) is currently locked out.
func (l *LoginLockout) IsLocked(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, ok := l.attempts[key]
	if !ok {
		return false
	}

	if entry.lockedAt != nil {
		if time.Since(*entry.lockedAt) < l.config.LockoutDuration {
			return true
		}
		// Lockout expired — reset
		delete(l.attempts, key)
		return false
	}

	return false
}

// RecordFailure records a failed login attempt. Returns true if now locked out.
func (l *LoginLockout) RecordFailure(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, ok := l.attempts[key]
	if !ok {
		entry = &lockoutEntry{firstFail: time.Now()}
		l.attempts[key] = entry
	}

	// Reset if outside window
	if time.Since(entry.firstFail) > l.config.Window {
		entry.failures = 0
		entry.firstFail = time.Now()
		entry.lockedAt = nil
	}

	entry.failures++

	if entry.failures >= l.config.MaxAttempts {
		now := time.Now()
		entry.lockedAt = &now
		return true
	}

	return false
}

// RecordSuccess clears failure tracking for the key.
func (l *LoginLockout) RecordSuccess(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}

func (l *LoginLockout) cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for key, entry := range l.attempts {
		if entry.lockedAt != nil && now.Sub(*entry.lockedAt) > l.config.LockoutDuration*2 {
			delete(l.attempts, key)
		} else if entry.lockedAt == nil && now.Sub(entry.firstFail) > l.config.Window*2 {
			delete(l.attempts, key)
		}
	}
}
