package middleware

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

// AuditLogger logs state-changing requests to the audit_log table.
// Only logs POST, PUT, PATCH, DELETE methods.
type AuditLogger struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

// NewAuditLogger creates a new audit logger.
func NewAuditLogger(db *pgxpool.Pool, idGen *snowflake.Generator) *AuditLogger {
	return &AuditLogger{db: db, idGen: idGen}
}

// Log is middleware that records audit events for state-changing requests.
func (al *AuditLogger) Log(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only log state-changing methods
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		// Capture response status
		rw := &auditRW{ResponseWriter: w, statusCode: http.StatusOK}
		start := time.Now()

		next.ServeHTTP(rw, r)

		// Only log successful mutations (2xx)
		if rw.statusCode < 200 || rw.statusCode >= 300 {
			return
		}

		// Extract user (may be nil for public endpoints)
		user := auth.UserFromContext(r.Context())
		var userID *int64
		if user != nil {
			id := user.ID
			userID = &id
		}

		// Determine action from method + path
		action := categorizeAction(r.Method, r.URL.Path)
		if action == "" {
			return // Not an auditable action
		}

		// Log to database (async, don't block response)
		go func() {
			ip := extractIP(r)
			_, err := al.db.Exec(r.Context(), `
				INSERT INTO security_audit_log (id, user_id, action, resource, ip_address, method, path, status_code, duration_ms, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
			`, al.idGen.Generate().Int64(), userID, action, r.URL.Path, ip, r.Method, r.URL.Path, rw.statusCode, time.Since(start).Milliseconds())
			if err != nil {
				log.Warn().Err(err).Str("action", action).Msg("Failed to write audit log")
			}
		}()
	})
}

type auditRW struct {
	http.ResponseWriter
	statusCode int
}

func (rw *auditRW) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *auditRW) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("upstream ResponseWriter does not implement http.Hijacker")
}

// categorizeAction maps HTTP method + path to an audit action name.
func categorizeAction(method, path string) string {
	switch {
	case strings.Contains(path, "/auth/login") && method == "POST":
		return "user.login"
	case strings.Contains(path, "/auth/register") && method == "POST":
		return "user.register"
	case strings.Contains(path, "/auth/logout") && method == "POST":
		return "user.logout"
	case strings.Contains(path, "/auth/reset-password") && method == "POST":
		return "user.password_reset"
	case strings.Contains(path, "/users/@me/delete") && method == "POST":
		return "user.account_delete"
	case strings.Contains(path, "/guilds") && method == "POST" && !strings.Contains(path, "/channels"):
		return "guild.create"
	case strings.Contains(path, "/guilds") && method == "DELETE":
		return "guild.delete"
	case strings.Contains(path, "/channels") && method == "POST" && strings.Contains(path, "/messages"):
		return "" // Too noisy — don't audit every message
	case strings.Contains(path, "/channels") && method == "DELETE":
		return "channel.delete"
	case strings.Contains(path, "/roles") && method == "POST":
		return "role.create"
	case strings.Contains(path, "/roles") && method == "DELETE":
		return "role.delete"
	case strings.Contains(path, "/bans") && method == "PUT":
		return "member.ban"
	case strings.Contains(path, "/bans") && method == "DELETE":
		return "member.unban"
	case strings.Contains(path, "/members") && method == "DELETE":
		return "member.kick"
	case strings.Contains(path, "/report") && method == "POST":
		return "content.report"
	default:
		return ""
	}
}
