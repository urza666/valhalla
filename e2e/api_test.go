package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/channel"
	"github.com/valhalla-chat/valhalla/internal/embed"
	"github.com/valhalla-chat/valhalla/internal/guild"
	"github.com/valhalla-chat/valhalla/internal/message"
	"github.com/valhalla-chat/valhalla/pkg/events"
	"github.com/valhalla-chat/valhalla/pkg/middleware"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

// testEnv holds all shared state for a test run.
type testEnv struct {
	server      *httptest.Server
	db          *pgxpool.Pool
	authService *auth.Service
}

// skipIfNoDB skips the test when TEST_DATABASE_URL is not set.
func skipIfNoDB(t *testing.T) string {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping E2E tests (requires PostgreSQL)")
	}
	return dbURL
}

// setupTestEnv creates a full API server backed by a real PostgreSQL database.
// It runs migrations, builds the chi router with all relevant handlers, and
// returns an httptest.Server ready for requests.
func setupTestEnv(t *testing.T) *testEnv {
	t.Helper()

	dbURL := skipIfNoDB(t)
	ctx := context.Background()

	// Run migrations
	migrationsPath := "file://../migrations"
	m, err := migrate.New(migrationsPath, dbURL)
	if err != nil {
		t.Fatalf("failed to create migrator: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("failed to run migrations: %v", err)
	}
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		t.Fatalf("migrator source close error: %v", srcErr)
	}
	if dbErr != nil {
		t.Fatalf("migrator db close error: %v", dbErr)
	}

	// Connect to database
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("failed to ping test database: %v", err)
	}

	// Services
	idGen := snowflake.NewGenerator(0, 0)
	tokenTTL := 1 * time.Hour

	authRepo := auth.NewPostgresRepository(pool)
	authService := auth.NewService(authRepo, idGen, tokenTTL)
	authService.SetDB(pool)
	authHandler := auth.NewHandler(authService)

	guildRepo := guild.NewRepository(pool)
	guildService := guild.NewService(guildRepo, idGen)
	guildHandler := guild.NewHandler(guildService)

	channelRepo := channel.NewRepository(pool)
	channelHandler := channel.NewHandler(channelRepo, idGen)

	embedService := embed.NewService()
	messageRepo := message.NewRepository(pool)
	dispatcher := events.NoopDispatcher{}
	messageHandler := message.NewHandler(messageRepo, idGen, dispatcher, embedService)

	// Router — mirrors cmd/api/main.go but without NATS, gateway, voice, etc.
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(middleware.MaxBodySize(1 << 20))
	// No CSRF protection in tests (no Origin header from httptest)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authService))

			// Users
			r.Get("/users/@me", authHandler.Me)

			// Guilds
			r.Post("/guilds", guildHandler.CreateGuild)
			r.Route("/guilds/{guildID}", func(r chi.Router) {
				r.Get("/", guildHandler.GetGuild)
				r.Get("/channels", channelHandler.GetGuildChannels)
				r.Get("/members", guildHandler.GetMembers)
			})

			// Invites
			r.Post("/invites/{code}/accept", guildHandler.JoinGuild)

			// Channels
			r.Route("/channels/{channelID}", func(r chi.Router) {
				r.Get("/messages", messageHandler.GetMessages)
				r.Post("/messages", messageHandler.CreateMessage)
				r.Patch("/messages/{messageID}", messageHandler.UpdateMessage)
				r.Delete("/messages/{messageID}", messageHandler.DeleteMessage)

				// Invites
				r.Post("/invites", guildHandler.CreateInvite)
			})
		})
	})

	ts := httptest.NewServer(r)

	t.Cleanup(func() {
		ts.Close()
		// Clean up test data in reverse dependency order
		pool.Exec(ctx, `DELETE FROM messages WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM invites WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM members WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM channels WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM guilds WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM sessions WHERE TRUE`)
		pool.Exec(ctx, `DELETE FROM users WHERE TRUE`)
		pool.Close()
	})

	return &testEnv{
		server:      ts,
		db:          pool,
		authService: authService,
	}
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

// jsonReq performs an HTTP request with JSON body and returns the status code
// and decoded response body.
func jsonReq(t *testing.T, method, url string, body any, token string) (int, map[string]any) {
	t.Helper()

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request %s %s failed: %v", method, url, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if len(respBody) == 0 {
		return resp.StatusCode, nil
	}

	var result map[string]any
	json.Unmarshal(respBody, &result)
	return resp.StatusCode, result
}

// jsonReqArray is like jsonReq but decodes a JSON array response.
func jsonReqArray(t *testing.T, method, url, token string) (int, []any) {
	t.Helper()

	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request %s %s failed: %v", method, url, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result []any
	json.Unmarshal(respBody, &result)
	return resp.StatusCode, result
}

// ─── Helper functions for common operations ──────────────────────────────────

// registerUser creates a new user and returns the token and user ID.
func registerUser(t *testing.T, baseURL, username, email, password string) (token string, userID string) {
	t.Helper()

	status, resp := jsonReq(t, "POST", baseURL+"/api/v1/auth/register", map[string]string{
		"username": username,
		"email":    email,
		"password": password,
	}, "")

	if status != 201 {
		t.Fatalf("registerUser: expected 201, got %d: %v", status, resp)
	}
	token, _ = resp["token"].(string)
	if token == "" {
		t.Fatal("registerUser: no token in response")
	}
	if user, ok := resp["user"].(map[string]any); ok {
		userID = fmt.Sprintf("%v", user["id"])
	}
	return token, userID
}

// loginUser logs in and returns the token.
func loginUser(t *testing.T, baseURL, email, password string) string {
	t.Helper()

	status, resp := jsonReq(t, "POST", baseURL+"/api/v1/auth/login", map[string]string{
		"email":    email,
		"password": password,
	}, "")

	if status != 200 {
		t.Fatalf("loginUser: expected 200, got %d: %v", status, resp)
	}
	token, _ := resp["token"].(string)
	if token == "" {
		t.Fatal("loginUser: no token in response")
	}
	return token
}

// createGuild creates a guild and returns the guild ID and the first text
// channel ID.
func createGuild(t *testing.T, baseURL, token, name string) (guildID, channelID string) {
	t.Helper()

	status, resp := jsonReq(t, "POST", baseURL+"/api/v1/guilds", map[string]string{
		"name": name,
	}, token)

	if status != 201 {
		t.Fatalf("createGuild: expected 201, got %d: %v", status, resp)
	}

	g, ok := resp["guild"].(map[string]any)
	if !ok {
		t.Fatal("createGuild: no guild in response")
	}
	guildID = fmt.Sprintf("%v", g["id"])

	if channels, ok := resp["channels"].([]any); ok {
		for _, ch := range channels {
			if c, ok := ch.(map[string]any); ok {
				if cType, ok := c["type"].(float64); ok && cType == 0 {
					channelID = fmt.Sprintf("%v", c["id"])
					break
				}
			}
		}
	}
	if channelID == "" {
		t.Fatal("createGuild: no text channel found in response")
	}
	return guildID, channelID
}

// sendMessage sends a message and returns the message ID.
func sendMessage(t *testing.T, baseURL, token, channelID, content string) string {
	t.Helper()

	status, resp := jsonReq(t, "POST", baseURL+"/api/v1/channels/"+channelID+"/messages", map[string]string{
		"content": content,
	}, token)

	if status != 201 {
		t.Fatalf("sendMessage: expected 201, got %d: %v", status, resp)
	}
	msgID := fmt.Sprintf("%v", resp["id"])
	if msgID == "" || msgID == "<nil>" {
		t.Fatal("sendMessage: no message ID in response")
	}
	return msgID
}

// createInvite creates an invite for a channel and returns the invite code.
func createInvite(t *testing.T, baseURL, token, channelID string) string {
	t.Helper()

	status, resp := jsonReq(t, "POST", baseURL+"/api/v1/channels/"+channelID+"/invites", map[string]any{
		"max_age":  86400,
		"max_uses": 10,
	}, token)

	if status != 201 {
		t.Fatalf("createInvite: expected 201, got %d: %v", status, resp)
	}
	code, _ := resp["code"].(string)
	if code == "" {
		t.Fatal("createInvite: no code in response")
	}
	return code
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 1: Auth Flow
// ═══════════════════════════════════════════════════════════════════════════════

func TestAuthFlow_RegisterNewUser(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	status, resp := jsonReq(t, "POST", base+"/api/v1/auth/register", map[string]string{
		"username": "authtest_user",
		"email":    "authtest@valhalla.test",
		"password": "SecurePass123!",
	}, "")

	if status != 201 {
		t.Fatalf("expected status 201, got %d: %v", status, resp)
	}
	if resp["token"] == nil || resp["token"].(string) == "" {
		t.Fatal("expected token in response")
	}
	if resp["user"] == nil {
		t.Fatal("expected user in response")
	}
	user := resp["user"].(map[string]any)
	if user["username"] != "authtest_user" {
		t.Fatalf("expected username 'authtest_user', got %v", user["username"])
	}
}

func TestAuthFlow_LoginValidCredentials(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// Register first
	registerUser(t, base, "login_user", "login@valhalla.test", "SecurePass123!")

	// Login via helper
	token := loginUser(t, base, "login@valhalla.test", "SecurePass123!")
	if token == "" {
		t.Fatal("expected non-empty token from login")
	}

	// Verify the token works
	status, resp := jsonReq(t, "GET", base+"/api/v1/users/@me", nil, token)
	if status != 200 {
		t.Fatalf("expected status 200, got %d: %v", status, resp)
	}
}

func TestAuthFlow_LoginWrongPassword(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// Register first
	registerUser(t, base, "wrongpw_user", "wrongpw@valhalla.test", "SecurePass123!")

	// Login with wrong password
	status, _ := jsonReq(t, "POST", base+"/api/v1/auth/login", map[string]string{
		"email":    "wrongpw@valhalla.test",
		"password": "WrongPassword999!",
	}, "")

	if status != 401 {
		t.Fatalf("expected status 401, got %d", status)
	}
}

func TestAuthFlow_ProtectedRouteWithoutToken(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// Access protected route without token
	status, _ := jsonReq(t, "GET", base+"/api/v1/users/@me", nil, "")
	if status != 401 {
		t.Fatalf("expected status 401 without token, got %d", status)
	}

	// Access protected route with invalid token
	status, _ = jsonReq(t, "GET", base+"/api/v1/users/@me", nil, "invalid-token-abc123")
	if status != 401 {
		t.Fatalf("expected status 401 with invalid token, got %d", status)
	}
}

func TestAuthFlow_ProtectedRouteWithToken(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "protected_user", "protected@valhalla.test", "SecurePass123!")

	status, resp := jsonReq(t, "GET", base+"/api/v1/users/@me", nil, token)
	if status != 200 {
		t.Fatalf("expected status 200, got %d: %v", status, resp)
	}
	if resp["username"] != "protected_user" {
		t.Fatalf("expected username 'protected_user', got %v", resp["username"])
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 2: Guild Flow
// ═══════════════════════════════════════════════════════════════════════════════

func TestGuildFlow_CreateGuild(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "guild_creator", "guildcreator@valhalla.test", "SecurePass123!")

	status, resp := jsonReq(t, "POST", base+"/api/v1/guilds", map[string]string{
		"name": "Test Guild E2E",
	}, token)

	if status != 201 {
		t.Fatalf("expected status 201, got %d: %v", status, resp)
	}

	g, ok := resp["guild"].(map[string]any)
	if !ok {
		t.Fatal("expected guild in response")
	}
	if g["name"] != "Test Guild E2E" {
		t.Fatalf("expected guild name 'Test Guild E2E', got %v", g["name"])
	}

	// Should include default channels
	channels, ok := resp["channels"].([]any)
	if !ok || len(channels) == 0 {
		t.Fatal("expected default channels in guild creation response")
	}

	// Verify at least one text channel exists
	hasTextChannel := false
	for _, ch := range channels {
		if c, ok := ch.(map[string]any); ok {
			if cType, ok := c["type"].(float64); ok && cType == 0 {
				hasTextChannel = true
				break
			}
		}
	}
	if !hasTextChannel {
		t.Fatal("expected at least one text channel in guild creation response")
	}
}

func TestGuildFlow_GetGuild(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "guild_getter", "guildgetter@valhalla.test", "SecurePass123!")
	guildID, _ := createGuild(t, base, token, "Get Guild Test")

	status, resp := jsonReq(t, "GET", base+"/api/v1/guilds/"+guildID, nil, token)
	if status != 200 {
		t.Fatalf("expected status 200, got %d: %v", status, resp)
	}
	if resp["name"] != "Get Guild Test" {
		t.Fatalf("expected guild name 'Get Guild Test', got %v", resp["name"])
	}
}

func TestGuildFlow_CreateInviteAndJoin(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// User A creates a guild
	tokenA, _ := registerUser(t, base, "inviter", "inviter@valhalla.test", "SecurePass123!")
	guildID, channelID := createGuild(t, base, tokenA, "Invite Test Guild")

	// User A creates an invite
	code := createInvite(t, base, tokenA, channelID)
	if code == "" {
		t.Fatal("expected non-empty invite code")
	}

	// User B registers and joins with the invite
	tokenB, _ := registerUser(t, base, "joiner", "joiner@valhalla.test", "SecurePass123!")

	status, resp := jsonReq(t, "POST", base+"/api/v1/invites/"+code+"/accept", nil, tokenB)
	if status != 201 {
		t.Fatalf("expected status 201 for join, got %d: %v", status, resp)
	}

	joinedGuild, ok := resp["guild"].(map[string]any)
	if !ok {
		t.Fatal("expected guild in join response")
	}
	joinedGuildID := fmt.Sprintf("%v", joinedGuild["id"])
	if joinedGuildID != guildID {
		t.Fatalf("joined guild ID %s does not match created guild ID %s", joinedGuildID, guildID)
	}

	// Verify user B can see the guild's channels
	status, channels := jsonReqArray(t, "GET", base+"/api/v1/guilds/"+guildID+"/channels", tokenB)
	if status != 200 {
		t.Fatalf("expected 200 for get channels, got %d", status)
	}
	if len(channels) == 0 {
		t.Fatal("expected at least one channel after joining guild")
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 3: Messaging Flow
// ═══════════════════════════════════════════════════════════════════════════════

func TestMessagingFlow_SendMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "msg_sender", "msgsender@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "Message Test Guild")

	status, resp := jsonReq(t, "POST", base+"/api/v1/channels/"+channelID+"/messages", map[string]string{
		"content": "Hello from E2E test!",
	}, token)

	if status != 201 {
		t.Fatalf("expected status 201, got %d: %v", status, resp)
	}
	if resp["id"] == nil {
		t.Fatal("expected message ID in response")
	}
	if resp["content"] != "Hello from E2E test!" {
		t.Fatalf("expected content 'Hello from E2E test!', got %v", resp["content"])
	}
}

func TestMessagingFlow_GetMessages(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "msg_reader", "msgreader@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "GetMsg Test Guild")

	// Send a few messages
	sendMessage(t, base, token, channelID, "First message")
	sendMessage(t, base, token, channelID, "Second message")
	sendMessage(t, base, token, channelID, "Third message")

	// Get messages
	status, result := jsonReqArray(t, "GET", base+"/api/v1/channels/"+channelID+"/messages?limit=10", token)
	if status != 200 {
		t.Fatalf("expected status 200, got %d", status)
	}
	if len(result) < 3 {
		t.Fatalf("expected at least 3 messages, got %d", len(result))
	}
}

func TestMessagingFlow_EditMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "msg_editor", "msgeditor@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "EditMsg Test Guild")

	msgID := sendMessage(t, base, token, channelID, "Original content")

	// Edit the message
	status, resp := jsonReq(t, "PATCH", base+"/api/v1/channels/"+channelID+"/messages/"+msgID, map[string]string{
		"content": "Edited content",
	}, token)

	if status != 200 {
		t.Fatalf("expected status 200, got %d: %v", status, resp)
	}
	if resp["content"] != "Edited content" {
		t.Fatalf("expected content 'Edited content', got %v", resp["content"])
	}
	if resp["edited_timestamp"] == nil {
		t.Fatal("expected edited_timestamp after edit")
	}
}

func TestMessagingFlow_DeleteMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "msg_deleter", "msgdeleter@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "DeleteMsg Test Guild")

	msgID := sendMessage(t, base, token, channelID, "Message to delete")

	// Delete the message
	status, _ := jsonReq(t, "DELETE", base+"/api/v1/channels/"+channelID+"/messages/"+msgID, nil, token)
	if status != 204 {
		t.Fatalf("expected status 204, got %d", status)
	}

	// Verify message is gone (or soft-deleted) by fetching messages
	getStatus, result := jsonReqArray(t, "GET", base+"/api/v1/channels/"+channelID+"/messages?limit=50", token)
	if getStatus != 200 {
		t.Fatalf("expected status 200 for get messages, got %d", getStatus)
	}

	// The deleted message should not appear in the list
	for _, msg := range result {
		if m, ok := msg.(map[string]any); ok {
			id := fmt.Sprintf("%v", m["id"])
			if id == msgID {
				t.Fatalf("deleted message %s still appears in message list", msgID)
			}
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 4: Permission Flow
// ═══════════════════════════════════════════════════════════════════════════════

func TestPermissionFlow_NonMemberCannotSendMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// User A creates a guild
	tokenA, _ := registerUser(t, base, "guild_owner", "owner@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, tokenA, "Private Guild")

	// User B registers but does NOT join the guild
	tokenB, _ := registerUser(t, base, "outsider", "outsider@valhalla.test", "SecurePass123!")

	// User B tries to send a message to the guild's channel
	status, _ := jsonReq(t, "POST", base+"/api/v1/channels/"+channelID+"/messages", map[string]string{
		"content": "I should not be able to send this",
	}, tokenB)

	if status != 403 {
		t.Fatalf("expected status 403 for non-member sending message, got %d", status)
	}
}

func TestPermissionFlow_NonMemberCannotReadMessages(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// User A creates a guild and sends a message
	tokenA, _ := registerUser(t, base, "reader_owner", "readerowner@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, tokenA, "Read Test Guild")
	sendMessage(t, base, tokenA, channelID, "Secret message")

	// User B registers but does NOT join the guild
	tokenB, _ := registerUser(t, base, "reader_outsider", "readeroutsider@valhalla.test", "SecurePass123!")

	// User B tries to read messages from the guild's channel
	status, _ := jsonReqArray(t, "GET", base+"/api/v1/channels/"+channelID+"/messages", tokenB)
	if status != 403 {
		t.Fatalf("expected status 403 for non-member reading messages, got %d", status)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 5: Input Validation
// ═══════════════════════════════════════════════════════════════════════════════

func TestValidation_EmptyMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "empty_msg", "emptymsg@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "Validation Guild")

	status, _ := jsonReq(t, "POST", base+"/api/v1/channels/"+channelID+"/messages", map[string]string{
		"content": "",
	}, token)
	if status != 400 {
		t.Fatalf("expected status 400 for empty message, got %d", status)
	}
}

func TestValidation_TooLongMessage(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	token, _ := registerUser(t, base, "long_msg", "longmsg@valhalla.test", "SecurePass123!")
	_, channelID := createGuild(t, base, token, "Long Msg Guild")

	status, _ := jsonReq(t, "POST", base+"/api/v1/channels/"+channelID+"/messages", map[string]string{
		"content": strings.Repeat("a", 5000),
	}, token)
	if status != 400 {
		t.Fatalf("expected status 400 for too-long message, got %d", status)
	}
}

func TestValidation_RegisterWeakPassword(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	status, _ := jsonReq(t, "POST", base+"/api/v1/auth/register", map[string]string{
		"username": "weakpw",
		"email":    "weakpw@valhalla.test",
		"password": "short",
	}, "")

	if status != 400 {
		t.Fatalf("expected status 400 for weak password, got %d", status)
	}
}

func TestValidation_RegisterDuplicateEmail(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	registerUser(t, base, "dup_user1", "duplicate@valhalla.test", "SecurePass123!")

	// Try to register with the same email
	status, _ := jsonReq(t, "POST", base+"/api/v1/auth/register", map[string]string{
		"username": "dup_user2",
		"email":    "duplicate@valhalla.test",
		"password": "SecurePass123!",
	}, "")

	if status != 409 {
		t.Fatalf("expected status 409 for duplicate email, got %d", status)
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite 6: Full User Journey
// ═══════════════════════════════════════════════════════════════════════════════

func TestFullJourney_RegisterCreateGuildInviteMessageCleanup(t *testing.T) {
	env := setupTestEnv(t)
	base := env.server.URL

	// Step 1: Alice registers
	aliceToken, _ := registerUser(t, base, "alice", "alice@valhalla.test", "AlicePass123!")

	// Step 2: Alice creates a guild
	guildID, channelID := createGuild(t, base, aliceToken, "Alice's Guild")

	// Step 3: Alice sends a message
	msgID := sendMessage(t, base, aliceToken, channelID, "Welcome to my guild!")

	// Step 4: Alice creates an invite
	inviteCode := createInvite(t, base, aliceToken, channelID)

	// Step 5: Bob registers
	bobToken, _ := registerUser(t, base, "bob", "bob@valhalla.test", "BobPass123!")

	// Step 6: Bob joins the guild
	joinStatus, joinResp := jsonReq(t, "POST", base+"/api/v1/invites/"+inviteCode+"/accept", nil, bobToken)
	if joinStatus != 201 {
		t.Fatalf("Bob join: expected 201, got %d: %v", joinStatus, joinResp)
	}

	// Step 7: Bob can read messages
	getStatus, messages := jsonReqArray(t, "GET", base+"/api/v1/channels/"+channelID+"/messages?limit=50", bobToken)
	if getStatus != 200 {
		t.Fatalf("Bob get messages: expected 200, got %d", getStatus)
	}
	if len(messages) < 1 {
		t.Fatal("Bob should see at least Alice's message")
	}

	// Step 8: Bob sends a message
	bobMsgID := sendMessage(t, base, bobToken, channelID, "Hey Alice!")

	// Step 9: Bob edits his message
	editStatus, editResp := jsonReq(t, "PATCH", base+"/api/v1/channels/"+channelID+"/messages/"+bobMsgID, map[string]string{
		"content": "Hey Alice! How are you?",
	}, bobToken)
	if editStatus != 200 {
		t.Fatalf("Bob edit: expected 200, got %d: %v", editStatus, editResp)
	}

	// Step 10: Alice can see all messages
	aliceGetStatus, aliceMessages := jsonReqArray(t, "GET", base+"/api/v1/channels/"+channelID+"/messages?limit=50", aliceToken)
	if aliceGetStatus != 200 {
		t.Fatalf("Alice get messages: expected 200, got %d", aliceGetStatus)
	}
	if len(aliceMessages) < 2 {
		t.Fatalf("Alice should see at least 2 messages, got %d", len(aliceMessages))
	}

	// Step 11: Bob deletes his message
	delStatus, _ := jsonReq(t, "DELETE", base+"/api/v1/channels/"+channelID+"/messages/"+bobMsgID, nil, bobToken)
	if delStatus != 204 {
		t.Fatalf("Bob delete: expected 204, got %d", delStatus)
	}

	// Step 12: Alice deletes her message
	delStatus, _ = jsonReq(t, "DELETE", base+"/api/v1/channels/"+channelID+"/messages/"+msgID, nil, aliceToken)
	if delStatus != 204 {
		t.Fatalf("Alice delete: expected 204, got %d", delStatus)
	}

	// Step 13: Verify guild members include both users
	memStatus, members := jsonReqArray(t, "GET", base+"/api/v1/guilds/"+guildID+"/members", aliceToken)
	if memStatus != 200 {
		t.Fatalf("get members: expected 200, got %d", memStatus)
	}
	if len(members) < 2 {
		t.Fatalf("expected at least 2 members (Alice + Bob), got %d", len(members))
	}
}
