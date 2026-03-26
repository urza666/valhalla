package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

// RateLimiter implements a simple in-memory token bucket rate limiter.
// For production, replace with Redis-based rate limiting.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*bucket
	rate     int           // requests per window
	window   time.Duration // time window
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

	// Cleanup goroutine
	go func() {
		for {
			time.Sleep(window * 2)
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
		key := r.RemoteAddr

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
