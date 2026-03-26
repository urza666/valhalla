package middleware

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/permissions"
)

// GuildMember ensures the user is a member of the guild in the URL.
func GuildMember(db *pgxpool.Pool) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := auth.UserFromContext(r.Context())
			if user == nil {
				apierror.ErrUnauthorized.Write(w)
				return
			}

			guildIDStr := chi.URLParam(r, "guildID")
			if guildIDStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			guildID, err := strconv.ParseInt(guildIDStr, 10, 64)
			if err != nil {
				apierror.ErrNotFound.Write(w)
				return
			}

			var isMember bool
			db.QueryRow(r.Context(), `
				SELECT EXISTS(SELECT 1 FROM members WHERE user_id = $1 AND guild_id = $2)
			`, user.ID, guildID).Scan(&isMember)

			if !isMember {
				apierror.ErrForbidden.Write(w)
				return
			}

			// Store guild ID in context for downstream use
			ctx := context.WithValue(r.Context(), guildIDKey, guildID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission checks that the user has a specific permission in the guild.
func RequirePermission(db *pgxpool.Pool, perm permissions.Permission) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := auth.UserFromContext(r.Context())
			if user == nil {
				apierror.ErrUnauthorized.Write(w)
				return
			}

			guildID := GuildIDFromContext(r.Context())
			if guildID == 0 {
				// Try URL param
				guildIDStr := chi.URLParam(r, "guildID")
				if guildIDStr != "" {
					guildID, _ = strconv.ParseInt(guildIDStr, 10, 64)
				}
			}

			if guildID == 0 {
				next.ServeHTTP(w, r)
				return
			}

			// Check if owner (owner has all permissions)
			var ownerID int64
			db.QueryRow(r.Context(), `SELECT owner_id FROM guilds WHERE id = $1`, guildID).Scan(&ownerID)
			if ownerID == user.ID {
				next.ServeHTTP(w, r)
				return
			}

			// Compute base permissions
			var everyonePerms int64
			db.QueryRow(r.Context(), `SELECT permissions FROM roles WHERE id = $1`, guildID).Scan(&everyonePerms)

			// Get user's roles
			rows, err := db.Query(r.Context(), `
				SELECT r.permissions FROM roles r
				INNER JOIN member_roles mr ON mr.role_id = r.id
				WHERE mr.user_id = $1 AND mr.guild_id = $2
			`, user.ID, guildID)
			if err == nil {
				defer rows.Close()
			}

			basePerms := permissions.Bitfield(everyonePerms)
			if rows != nil {
				for rows.Next() {
					var rp int64
					rows.Scan(&rp)
					basePerms |= permissions.Bitfield(rp)
				}
			}

			// Admin bypasses all
			if basePerms.Has(permissions.Administrator) {
				next.ServeHTTP(w, r)
				return
			}

			if !basePerms.Has(perm) {
				apierror.ErrForbidden.Write(w)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type ctxKey string

const guildIDKey ctxKey = "guild_id"

func GuildIDFromContext(ctx context.Context) int64 {
	v, _ := ctx.Value(guildIDKey).(int64)
	return v
}
