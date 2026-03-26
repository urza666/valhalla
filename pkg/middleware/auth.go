package middleware

import (
	"net/http"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

// Auth is middleware that validates the auth token and injects the user into context.
func Auth(authService *auth.Service) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := auth.TokenFromRequest(r)
			if token == "" {
				apierror.ErrUnauthorized.Write(w)
				return
			}

			user, err := authService.ValidateToken(r.Context(), token)
			if err != nil {
				apierror.ErrUnauthorized.Write(w)
				return
			}

			ctx := auth.ContextWithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
