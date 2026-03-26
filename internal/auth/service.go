package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"

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
	idGen     *snowflake.Generator
	tokenTTL  time.Duration
}

// NewService creates a new auth service.
func NewService(repo Repository, idGen *snowflake.Generator, tokenTTL time.Duration) *Service {
	return &Service{
		repo:     repo,
		idGen:    idGen,
		tokenTTL: tokenTTL,
	}
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
	if len(req.Password) < 8 {
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
func (s *Service) ValidateToken(ctx context.Context, token string) (*User, error) {
	session, err := s.repo.GetSession(ctx, token)
	if err != nil {
		return nil, ErrSessionExpired
	}

	if time.Now().After(session.ExpiresAt) {
		s.repo.DeleteSession(ctx, token)
		return nil, ErrSessionExpired
	}

	return s.repo.GetUserByID(ctx, session.UserID)
}

// Logout invalidates a session token.
func (s *Service) Logout(ctx context.Context, token string) error {
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
