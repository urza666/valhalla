package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

// RateLimiter implements a per-IP token bucket rate limiter.
// Supports differentiated limits per endpoint category.
// TODO: Replace with Redis-based sliding window for multi-instance deployments.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*bucket
	rate     int
	window   time.Duration
}

type bucket struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a new rate limiter.
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*bucket),
		rate:     rate,
		window:   window,
	}

	// Background cleanup of expired entries
	go func() {
		ticker := time.NewTicker(window * 2)
		defer ticker.Stop()
		for range ticker.C {
			rl.mu.Lock()
			for key, b := range rl.visitors {
				if time.Since(b.lastReset) > window*2 {
					delete(rl.visitors, key)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

// Limit is middleware that applies rate limiting per IP.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := extractIP(r)

		rl.mu.Lock()
		b, exists := rl.visitors[key]
		if !exists {
			b = &bucket{tokens: rl.rate, lastReset: time.Now()}
			rl.visitors[key] = b
		}

		if time.Since(b.lastReset) > rl.window {
			b.tokens = rl.rate
			b.lastReset = time.Now()
		}

		if b.tokens <= 0 {
			rl.mu.Unlock()
			w.Header().Set("Retry-After", "1")
			apierror.ErrRateLimited.Write(w)
			return
		}

		b.tokens--
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

// StrictLimit creates a stricter rate limiter for sensitive endpoints (login, register).
func StrictLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	limiter := NewRateLimiter(maxRequests, window)
	return limiter.Limit
}

// extractIP gets the real client IP, handling proxies.
func extractIP(r *http.Request) string {
	// Check X-Real-IP (set by chi.RealIP middleware)
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	// Check X-Forwarded-For
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	// Fall back to RemoteAddr (strip port)
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}
