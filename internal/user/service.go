package user

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrWrongPassword   = errors.New("current password is incorrect")
	ErrWeakPassword    = errors.New("new password must be at least 8 characters")
	ErrEmailTaken      = errors.New("email already in use")
	ErrInvalidUsername  = errors.New("username must be 2-32 alphanumeric characters")
)

type UpdateProfileRequest struct {
	DisplayName *string `json:"display_name"`
	Bio         *string `json:"bio"`
	Locale      *string `json:"locale"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type Session struct {
	Token      string `json:"token"`
	DeviceInfo string `json:"device_info"`
	IPAddress  string `json:"ip_address"`
	CreatedAt  string `json:"created_at"`
	LastUsed   string `json:"last_used_at"`
	Current    bool   `json:"current"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// UpdateProfile updates display name, bio, locale.
func (s *Service) UpdateProfile(ctx context.Context, userID int64, req UpdateProfileRequest) (map[string]any, error) {
	if req.DisplayName != nil {
		s.db.Exec(ctx, `UPDATE users SET display_name = $2 WHERE id = $1`, userID, *req.DisplayName)
	}
	if req.Bio != nil {
		if len(*req.Bio) > 190 {
			trimmed := (*req.Bio)[:190]
			req.Bio = &trimmed
		}
		s.db.Exec(ctx, `UPDATE users SET bio = $2 WHERE id = $1`, userID, *req.Bio)
	}
	if req.Locale != nil {
		s.db.Exec(ctx, `UPDATE users SET locale = $2 WHERE id = $1`, userID, *req.Locale)
	}

	// Return updated user
	row := s.db.QueryRow(ctx, `
		SELECT id, username, display_name, email, avatar_hash, bio, locale,
		       mfa_enabled, verified, flags, premium_type, created_at::text
		FROM users WHERE id = $1
	`, userID)

	var uid int64
	var username, email, locale, createdAt string
	var displayName, avatarHash, bio *string
	var mfaEnabled, verified bool
	var flags int64
	var premiumType int

	err := row.Scan(&uid, &username, &displayName, &email, &avatarHash, &bio, &locale,
		&mfaEnabled, &verified, &flags, &premiumType, &createdAt)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return map[string]any{
		"id": uid, "username": username, "display_name": displayName,
		"email": email, "avatar": avatarHash, "bio": bio, "locale": locale,
		"mfa_enabled": mfaEnabled, "verified": verified, "flags": flags,
		"premium_type": premiumType, "created_at": createdAt,
	}, nil
}

// ChangePassword verifies current password and sets new one.
func (s *Service) ChangePassword(ctx context.Context, userID int64, req ChangePasswordRequest) error {
	if len(req.NewPassword) < 8 {
		return ErrWeakPassword
	}

	// Get current hash
	var currentHash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&currentHash)
	if err != nil {
		return ErrUserNotFound
	}

	// Verify current password
	if !verifyPassword(req.CurrentPassword, currentHash) {
		return ErrWrongPassword
	}

	// Hash new password
	newHash, err := hashPassword(req.NewPassword)
	if err != nil {
		return err
	}

	// Update password and invalidate all other sessions
	s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, newHash)

	return nil
}

// GetSessions returns all active sessions for a user.
func (s *Service) GetSessions(ctx context.Context, userID int64, currentToken string) ([]Session, error) {
	rows, err := s.db.Query(ctx, `
		SELECT token, device_info, COALESCE(ip_address::text, ''), created_at::text, last_used_at::text
		FROM sessions WHERE user_id = $1 AND expires_at > NOW()
		ORDER BY last_used_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		rows.Scan(&s.Token, &s.DeviceInfo, &s.IPAddress, &s.CreatedAt, &s.LastUsed)
		// Mask token but mark current
		if s.Token == currentToken {
			s.Current = true
		}
		s.Token = s.Token[:8] + "..." // Only show first 8 chars
		sessions = append(sessions, s)
	}
	return sessions, nil
}

// RevokeSession deletes a specific session.
func (s *Service) RevokeSession(ctx context.Context, userID int64, tokenPrefix string) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM sessions WHERE user_id = $1 AND token LIKE $2
	`, userID, tokenPrefix+"%")
	return err
}

// RevokeAllSessions deletes all sessions except current.
func (s *Service) RevokeAllSessions(ctx context.Context, userID int64, exceptToken string) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM sessions WHERE user_id = $1 AND token != $2
	`, userID, exceptToken)
	return err
}

// DeleteAccount permanently deletes a user account and all associated data.
// Guild ownership must be transferred or guild deleted before calling this.
func (s *Service) DeleteAccount(ctx context.Context, userID int64, password string) error {
	// Verify password
	var currentHash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&currentHash)
	if err != nil {
		return ErrUserNotFound
	}
	if !verifyPassword(password, currentHash) {
		return ErrWrongPassword
	}

	// Check if user owns any guilds (must transfer first)
	var ownedGuilds int
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM guilds WHERE owner_id = $1`, userID).Scan(&ownedGuilds)
	if ownedGuilds > 0 {
		return errors.New("transfer or delete all owned servers before deleting your account")
	}

	// Delete user — cascades to sessions, members, relationships, reactions, etc.
	// Messages will have author_id set to NULL (ON DELETE SET NULL)
	_, err = s.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	return err
}

// ExportUserData collects all personal data for GDPR Art. 20 data portability.
func (s *Service) ExportUserData(ctx context.Context, userID int64) (map[string]any, error) {
	export := make(map[string]any)

	// User profile
	row := s.db.QueryRow(ctx, `
		SELECT id, username, display_name, email, bio, locale, created_at::text
		FROM users WHERE id = $1
	`, userID)
	var uid int64
	var username, email, createdAt string
	var displayName, bio, locale *string
	if err := row.Scan(&uid, &username, &displayName, &email, &bio, &locale, &createdAt); err != nil {
		return nil, ErrUserNotFound
	}
	export["profile"] = map[string]any{
		"id": uid, "username": username, "display_name": displayName,
		"email": email, "bio": bio, "locale": locale, "created_at": createdAt,
	}

	// Guild memberships
	memberRows, _ := s.db.Query(ctx, `
		SELECT g.id, g.name, m.joined_at::text
		FROM members m JOIN guilds g ON g.id = m.guild_id
		WHERE m.user_id = $1
	`, userID)
	var guilds []map[string]any
	if memberRows != nil {
		defer memberRows.Close()
		for memberRows.Next() {
			var gid int64
			var name, joinedAt string
			memberRows.Scan(&gid, &name, &joinedAt)
			guilds = append(guilds, map[string]any{"guild_id": gid, "guild_name": name, "joined_at": joinedAt})
		}
	}
	export["guild_memberships"] = guilds

	// Messages (last 10000)
	msgRows, _ := s.db.Query(ctx, `
		SELECT id, channel_id, content, created_at::text
		FROM messages WHERE author_id = $1
		ORDER BY id DESC LIMIT 10000
	`, userID)
	var messages []map[string]any
	if msgRows != nil {
		defer msgRows.Close()
		for msgRows.Next() {
			var mid, cid int64
			var content, ts string
			msgRows.Scan(&mid, &cid, &content, &ts)
			messages = append(messages, map[string]any{"id": mid, "channel_id": cid, "content": content, "timestamp": ts})
		}
	}
	export["messages"] = messages
	export["message_count"] = len(messages)

	// Relationships
	relRows, _ := s.db.Query(ctx, `
		SELECT target_id, type FROM relationships WHERE user_id = $1
	`, userID)
	var rels []map[string]any
	if relRows != nil {
		defer relRows.Close()
		for relRows.Next() {
			var tid int64
			var rtype int
			relRows.Scan(&tid, &rtype)
			rels = append(rels, map[string]any{"target_id": tid, "type": rtype})
		}
	}
	export["relationships"] = rels

	export["export_date"] = time.Now().Format(time.RFC3339)
	export["format_version"] = "1.0"

	return export, nil
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 2, 64*1024, 4, 32)
	return "$argon2id$" + hex.EncodeToString(salt) + "$" + hex.EncodeToString(hash), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[1] != "argon2id" {
		return false
	}
	salt, err := hex.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expectedHash, err := hex.DecodeString(parts[3])
	if err != nil {
		return false
	}
	hash := argon2.IDKey([]byte(password), salt, 2, 64*1024, 4, 32)
	if len(hash) != len(expectedHash) {
		return false
	}
	for i := range hash {
		if hash[i] != expectedHash[i] {
			return false
		}
	}
	return true
}
