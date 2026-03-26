package auth

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository implements Repository using PostgreSQL.
type PostgresRepository struct {
	db *pgxpool.Pool
}

// NewPostgresRepository creates a new PostgreSQL-backed auth repository.
func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(ctx context.Context, id int64, username, email, passwordHash string) (*User, error) {
	var user User
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (id, username, email, password_hash)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, display_name, email, avatar_hash, bio,
		          mfa_enabled, verified, flags, premium_type, locale, created_at
	`, id, username, email, passwordHash).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.AvatarHash, &user.Bio, &user.MFAEnabled, &user.Verified,
		&user.Flags, &user.PremiumType, &user.Locale, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresRepository) GetUserByEmail(ctx context.Context, email string) (*User, string, error) {
	var user User
	var passwordHash string
	err := r.db.QueryRow(ctx, `
		SELECT id, username, display_name, email, avatar_hash, bio,
		       mfa_enabled, verified, flags, premium_type, locale, created_at,
		       password_hash
		FROM users WHERE email = $1
	`, email).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.AvatarHash, &user.Bio, &user.MFAEnabled, &user.Verified,
		&user.Flags, &user.PremiumType, &user.Locale, &user.CreatedAt,
		&passwordHash,
	)
	if err != nil {
		return nil, "", err
	}
	return &user, passwordHash, nil
}

func (r *PostgresRepository) GetUserByID(ctx context.Context, id int64) (*User, error) {
	var user User
	err := r.db.QueryRow(ctx, `
		SELECT id, username, display_name, email, avatar_hash, bio,
		       mfa_enabled, verified, flags, premium_type, locale, created_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Email,
		&user.AvatarHash, &user.Bio, &user.MFAEnabled, &user.Verified,
		&user.Flags, &user.PremiumType, &user.Locale, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists)
	return exists, err
}

func (r *PostgresRepository) UsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	return exists, err
}

func (r *PostgresRepository) CreateSession(ctx context.Context, token string, userID int64, deviceInfo, ip string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO sessions (token, user_id, device_info, ip_address, expires_at)
		VALUES ($1, $2, $3, $4::inet, $5)
	`, token, userID, deviceInfo, ip, expiresAt)
	return err
}

func (r *PostgresRepository) GetSession(ctx context.Context, token string) (*Session, error) {
	var s Session
	err := r.db.QueryRow(ctx, `
		SELECT token, user_id, device_info, ip_address::text, created_at, expires_at
		FROM sessions WHERE token = $1
	`, token).Scan(&s.Token, &s.UserID, &s.DeviceInfo, &s.IPAddress, &s.CreatedAt, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *PostgresRepository) DeleteSession(ctx context.Context, token string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM sessions WHERE token = $1`, token)
	return err
}

func (r *PostgresRepository) DeleteUserSessions(ctx context.Context, userID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	return err
}
