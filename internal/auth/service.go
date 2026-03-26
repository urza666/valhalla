package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email is already registered")
	ErrUsernameTaken      = errors.New("username is already taken")
	ErrInvalidEmail       = errors.New("invalid email address")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrInvalidUsername    = errors.New("username must be 2-32 characters, alphanumeric with dots and underscores")
	ErrSessionExpired     = errors.New("session has expired")
)

// Repository defines the data access interface for auth.
type Repository interface {
	CreateUser(ctx context.Context, id int64, username, email, passwordHash string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, string, error) // returns user + password_hash
	GetUserByID(ctx context.Context, id int64) (*User, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	UsernameExists(ctx context.Context, username string) (bool, error)
	CreateSession(ctx context.Context, token string, userID int64, deviceInfo, ip string, expiresAt time.Time) error
	GetSession(ctx context.Context, token string) (*Session, error)
	DeleteSession(ctx context.Context, token string) error
	DeleteUserSessions(ctx context.Context, userID int64) error
}

// Service handles authentication business logic.
type Service struct {
	repo      Repository
	db        *pgxpool.Pool
	idGen     *snowflake.Generator
	tokenTTL  time.Duration
	cache     *SessionCache
}

// NewService creates a new auth service.
func NewService(repo Repository, idGen *snowflake.Generator, tokenTTL time.Duration) *Service {
	return &Service{
		repo:     repo,
		idGen:    idGen,
		tokenTTL: tokenTTL,
		cache:    NewSessionCache(5 * time.Minute), // Cache sessions for 5 minutes
	}
}

// SetDB sets the database pool for password reset queries.
func (s *Service) SetDB(db *pgxpool.Pool) {
	s.db = db
}

// Register creates a new user account.
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*TokenResponse, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	if err := validateEmail(req.Email); err != nil {
		return nil, err
	}
	if err := validateUsername(req.Username); err != nil {
		return nil, err
	}
	if len(req.Password) < 8 || len(req.Password) > 128 {
		return nil, ErrWeakPassword
	}

	exists, err := s.repo.EmailExists(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailTaken
	}

	exists, err = s.repo.UsernameExists(ctx, req.Username)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrUsernameTaken
	}

	passwordHash, err := hashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	userID := s.idGen.Generate().Int64()
	user, err := s.repo.CreateUser(ctx, userID, req.Username, req.Email, passwordHash)
	if err != nil {
		return nil, err
	}

	token, err := s.createSession(ctx, user.ID, "", "")
	if err != nil {
		return nil, err
	}

	return &TokenResponse{Token: token, User: user}, nil
}

// Login authenticates a user with email and password.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	user, passwordHash, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !verifyPassword(req.Password, passwordHash) {
		return nil, ErrInvalidCredentials
	}

	token, err := s.createSession(ctx, user.ID, "", "")
	if err != nil {
		return nil, err
	}

	return &TokenResponse{Token: token, User: user}, nil
}

// ValidateToken checks if a token is valid and returns the associated user.
// Uses an in-memory cache to avoid 2 DB queries per request.
func (s *Service) ValidateToken(ctx context.Context, token string) (*User, error) {
	// Check cache first
	if cached := s.cache.Get(token); cached != nil {
		return cached, nil
	}

	// Cache miss — hit DB
	session, err := s.repo.GetSession(ctx, token)
	if err != nil {
		return nil, ErrSessionExpired
	}

	if time.Now().After(session.ExpiresAt) {
		s.repo.DeleteSession(ctx, token)
		return nil, ErrSessionExpired
	}

	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return nil, err
	}

	// Store in cache
	s.cache.Set(token, user)
	return user, nil
}

// Logout invalidates a session token.
func (s *Service) Logout(ctx context.Context, token string) error {
	s.cache.Invalidate(token)
	return s.repo.DeleteSession(ctx, token)
}

func (s *Service) createSession(ctx context.Context, userID int64, deviceInfo, ip string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	expiresAt := time.Now().Add(s.tokenTTL)
	if err := s.repo.CreateSession(ctx, token, userID, deviceInfo, ip, expiresAt); err != nil {
		return "", err
	}
	return token, nil
}

// generateToken creates a cryptographically secure random token.
func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashPassword creates an Argon2id hash of the password.
func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey([]byte(password), salt, 2, 64*1024, 4, 32)

	// Format: $argon2id$v=19$m=65536,t=2,p=4$<salt>$<hash>
	saltHex := hex.EncodeToString(salt)
	hashHex := hex.EncodeToString(hash)
	return "$argon2id$" + saltHex + "$" + hashHex, nil
}

// verifyPassword checks a password against an Argon2id hash.
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

	// Constant-time comparison to prevent timing side-channel attacks
	return subtle.ConstantTimeCompare(hash, expectedHash) == 1
}

// CreatePasswordReset generates a reset token for the given email.
func (s *Service) CreatePasswordReset(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))

	// Look up user by email
	user, _, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil // Silent — don't leak whether email exists
	}

	// Generate reset token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return err
	}
	token := hex.EncodeToString(tokenBytes)

	// Save to DB (expires in 1 hour)
	_, err = s.db.Exec(ctx, `
		INSERT INTO password_resets (token, user_id, expires_at)
		VALUES ($1, $2, NOW() + INTERVAL '1 hour')
	`, token, user.ID)
	if err != nil {
		return err
	}

	// In production, send email. For now, log the token.
	// log.Info().Str("reset_token", token).Int64("user_id", user.ID).Msg("Password reset requested")
	// The token can be used at POST /api/v1/auth/reset-password
	return nil
}

// ResetPassword validates a reset token and sets a new password.
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	var userID int64
	err := s.db.QueryRow(ctx, `
		SELECT user_id FROM password_resets
		WHERE token = $1 AND expires_at > NOW() AND used = false
	`, token).Scan(&userID)
	if err != nil {
		return errors.New("invalid or expired token")
	}

	// Hash new password
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}

	// Update password
	s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, hash)

	// Mark token as used
	s.db.Exec(ctx, `UPDATE password_resets SET used = true WHERE token = $1`, token)

	// Invalidate all sessions
	s.db.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)

	return nil
}

func validateEmail(email string) error {
	if len(email) < 3 || len(email) > 254 || !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return ErrInvalidEmail
	}
	return nil
}

func validateUsername(username string) error {
	if len(username) < 2 || len(username) > 32 {
		return ErrInvalidUsername
	}
	for _, c := range username {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '.') {
			return ErrInvalidUsername
		}
	}
	return nil
}
