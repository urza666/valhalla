package middleware

import "net/http"

// SecurityHeaders adds HSTS, CSP, and other security headers to all responses.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss:; font-src 'self'; media-src 'self' blob:; frame-ancestors 'none'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

// PaginationLimit enforces a maximum limit on query parameters.
func PaginationLimit(maxLimit int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			if limit := q.Get("limit"); limit != "" {
				var l int
				for _, c := range limit {
					if c >= '0' && c <= '9' {
						l = l*10 + int(c-'0')
					}
				}
				if l > maxLimit || l <= 0 {
					q.Set("limit", "50")
					r.URL.RawQuery = q.Encode()
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
