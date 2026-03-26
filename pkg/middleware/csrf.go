package middleware

import (
	"net/http"
	"strings"
)

// CSRFProtection validates the Origin header on state-changing requests.
// Combined with SameSite=Strict cookies, this prevents CSRF attacks.
// Safe methods (GET, HEAD, OPTIONS) are always allowed.
func CSRFProtection(allowedOrigins []string) func(http.Handler) http.Handler {
	originSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.TrimSpace(o)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Safe methods don't need CSRF protection
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// API clients using Authorization header (bots, mobile apps) bypass CSRF
			if r.Header.Get("Authorization") != "" {
				next.ServeHTTP(w, r)
				return
			}

			// For cookie-authenticated requests, validate Origin
			origin := r.Header.Get("Origin")
			if origin == "" {
				// No Origin header — could be same-origin or non-browser client
				// Check Referer as fallback
				referer := r.Header.Get("Referer")
				if referer != "" {
					for allowed := range originSet {
						if strings.HasPrefix(referer, allowed) {
							next.ServeHTTP(w, r)
							return
						}
					}
					http.Error(w, "CSRF: invalid referer", http.StatusForbidden)
					return
				}
				// No Origin and no Referer — allow (same-origin or non-browser)
				next.ServeHTTP(w, r)
				return
			}

			// Validate Origin against whitelist
			if originSet[origin] {
				next.ServeHTTP(w, r)
				return
			}

			http.Error(w, "CSRF: origin not allowed", http.StatusForbidden)
		})
	}
}
