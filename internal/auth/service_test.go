package auth

import (
	"context"
	"testing"
	"time"
)

// MockRepository implements the Repository interface for testing.
type MockRepository struct {
	users    map[int64]*User
	emails   map[string]*User
	pwHashes map[string]string
	sessions map[string]*Session
}

func NewMockRepo() *MockRepository {
	return &MockRepository{
		users:    make(map[int64]*User),
		emails:   make(map[string]*User),
		pwHashes: make(map[string]string),
		sessions: make(map[string]*Session),
	}
}

func (m *MockRepository) CreateUser(_ context.Context, id int64, username, email, passwordHash string) (*User, error) {
	user := &User{ID: id, Username: username, Email: email}
	m.users[id] = user
	m.emails[email] = user
	m.pwHashes[email] = passwordHash
	return user, nil
}

func (m *MockRepository) GetUserByEmail(_ context.Context, email string) (*User, string, error) {
	user, ok := m.emails[email]
	if !ok {
		return nil, "", ErrInvalidCredentials
	}
	return user, m.pwHashes[email], nil
}

func (m *MockRepository) GetUserByID(_ context.Context, id int64) (*User, error) {
	user, ok := m.users[id]
	if !ok {
		return nil, ErrSessionExpired
	}
	return user, nil
}

func (m *MockRepository) EmailExists(_ context.Context, email string) (bool, error) {
	_, ok := m.emails[email]
	return ok, nil
}

func (m *MockRepository) UsernameExists(_ context.Context, _ string) (bool, error) {
	return false, nil
}

func (m *MockRepository) CreateSession(_ context.Context, token string, userID int64, _, _ string, expiresAt time.Time) error {
	m.sessions[token] = &Session{UserID: userID, ExpiresAt: expiresAt}
	return nil
}

func (m *MockRepository) GetSession(_ context.Context, token string) (*Session, error) {
	s, ok := m.sessions[token]
	if !ok {
		return nil, ErrSessionExpired
	}
	return s, nil
}

func (m *MockRepository) DeleteSession(_ context.Context, token string) error {
	delete(m.sessions, token)
	return nil
}

func (m *MockRepository) DeleteUserSessions(_ context.Context, userID int64) error {
	for k, s := range m.sessions {
		if s.UserID == userID {
			delete(m.sessions, k)
		}
	}
	return nil
}

// ─── Tests ─────────────────────────────────────────────

func newTestService() (*Service, *MockRepository) {
	repo := NewMockRepo()
	gen := testSnowflakeGen()
	svc := NewService(repo, gen, 24*time.Hour)
	return svc, repo
}

func TestRegister_Success(t *testing.T) {
	svc, _ := newTestService()

	resp, err := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "securepassword123",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected token, got empty string")
	}
	if resp.User.Username != "testuser" {
		t.Fatalf("expected username 'testuser', got '%s'", resp.User.Username)
	}
}

func TestRegister_WeakPassword(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "short",
	})

	if err != ErrWeakPassword {
		t.Fatalf("expected ErrWeakPassword, got: %v", err)
	}
}

func TestRegister_TooLongPassword(t *testing.T) {
	svc, _ := newTestService()

	longPw := make([]byte, 200)
	for i := range longPw {
		longPw[i] = 'a'
	}

	_, err := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(longPw),
	})

	if err != ErrWeakPassword {
		t.Fatalf("expected ErrWeakPassword for >128 chars, got: %v", err)
	}
}

func TestRegister_InvalidEmail(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "notanemail",
		Password: "securepassword123",
	})

	if err != ErrInvalidEmail {
		t.Fatalf("expected ErrInvalidEmail, got: %v", err)
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.Register(context.Background(), RegisterRequest{
		Username: "user1",
		Email:    "test@example.com",
		Password: "securepassword123",
	})
	if err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	_, err = svc.Register(context.Background(), RegisterRequest{
		Username: "user2",
		Email:    "test@example.com",
		Password: "securepassword123",
	})
	if err != ErrEmailTaken {
		t.Fatalf("expected ErrEmailTaken, got: %v", err)
	}
}

func TestLogin_Success(t *testing.T) {
	svc, _ := newTestService()

	// Register first
	_, err := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "securepassword123",
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	// Login
	resp, err := svc.Login(context.Background(), LoginRequest{
		Email:    "test@example.com",
		Password: "securepassword123",
	})
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected token")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	svc, _ := newTestService()

	_, _ = svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "securepassword123",
	})

	_, err := svc.Login(context.Background(), LoginRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	})
	if err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestLogin_NonexistentUser(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.Login(context.Background(), LoginRequest{
		Email:    "nobody@example.com",
		Password: "somepassword",
	})
	if err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestValidateToken_Success(t *testing.T) {
	svc, _ := newTestService()

	resp, _ := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "securepassword123",
	})

	user, err := svc.ValidateToken(context.Background(), resp.Token)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if user.Username != "testuser" {
		t.Fatalf("expected 'testuser', got '%s'", user.Username)
	}
}

func TestValidateToken_Invalid(t *testing.T) {
	svc, _ := newTestService()

	_, err := svc.ValidateToken(context.Background(), "invalid-token-xyz")
	if err != ErrSessionExpired {
		t.Fatalf("expected ErrSessionExpired, got: %v", err)
	}
}

func TestLogout(t *testing.T) {
	svc, _ := newTestService()

	resp, _ := svc.Register(context.Background(), RegisterRequest{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "securepassword123",
	})

	err := svc.Logout(context.Background(), resp.Token)
	if err != nil {
		t.Fatalf("logout failed: %v", err)
	}

	// Token should no longer be valid
	_, err = svc.ValidateToken(context.Background(), resp.Token)
	if err != ErrSessionExpired {
		t.Fatalf("expected ErrSessionExpired after logout, got: %v", err)
	}
}

func TestPasswordHashing(t *testing.T) {
	hash, err := hashPassword("testpassword")
	if err != nil {
		t.Fatalf("hashing failed: %v", err)
	}
	if !verifyPassword("testpassword", hash) {
		t.Fatal("password verification failed")
	}
	if verifyPassword("wrongpassword", hash) {
		t.Fatal("wrong password should not verify")
	}
}

func TestUsernameValidation(t *testing.T) {
	cases := []struct {
		name  string
		valid bool
	}{
		{"ab", true},
		{"valid_user.name", true},
		{"a", false},                          // too short
		{"", false},                           // empty
		{"user with spaces", false},           // spaces
		{"user@name", false},                  // special chars
	}

	for _, tc := range cases {
		err := validateUsername(tc.name)
		if tc.valid && err != nil {
			t.Errorf("expected '%s' to be valid, got: %v", tc.name, err)
		}
		if !tc.valid && err == nil {
			t.Errorf("expected '%s' to be invalid", tc.name)
		}
	}
}
