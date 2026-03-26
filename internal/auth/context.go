package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userContextKey contextKey = "user"

const SessionCookieName = "valhalla_session"

// UserFromContext extracts the authenticated user from context.
func UserFromContext(ctx context.Context) *User {
	user, _ := ctx.Value(userContextKey).(*User)
	return user
}

// ContextWithUser returns a new context with the user attached.
func ContextWithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

// TokenFromRequest extracts the auth token from the request.
// Priority: 1) Authorization header, 2) HttpOnly session cookie.
func TokenFromRequest(r *http.Request) string {
	// Check Authorization header first (for API clients, bots, WebSocket identify)
	header := r.Header.Get("Authorization")
	if header != "" {
		if strings.HasPrefix(header, "Bearer ") {
			return strings.TrimPrefix(header, "Bearer ")
		}
		return header
	}

	// Fall back to HttpOnly cookie (for browser requests)
	cookie, err := r.Cookie(SessionCookieName)
	if err == nil && cookie.Value != "" {
		return cookie.Value
	}

	return ""
}

// SetSessionCookie sets the session token as an HttpOnly secure cookie.
func SetSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteStrictMode,
	})
}

// ClearSessionCookie removes the session cookie.
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}
