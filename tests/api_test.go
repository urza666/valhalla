package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

// Test configuration — runs against live API
const baseURL = "http://localhost:3081/api/v1"

var (
	testToken   string
	testUserID  string
	testGuildID string
	testChanID  string
	testMsgID   string
	testRoleID  string
	testInvite  string
)

// Helper: HTTP request with JSON
func apiRequest(t *testing.T, method, path string, body any, token string) (int, map[string]any) {
	t.Helper()

	var reqBody io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, baseURL+path, reqBody)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
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

func apiRequestArray(t *testing.T, method, path, token string) (int, []any) {
	t.Helper()
	req, _ := http.NewRequest(method, baseURL+path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result []any
	json.Unmarshal(body, &result)
	return resp.StatusCode, result
}

// ═══════════════════════════════════════════════════════
// Test 1: Auth - Register + Login
// ═══════════════════════════════════════════════════════

func Test01_Register(t *testing.T) {
	_ = t // use t

	status, resp := apiRequest(t, "POST", "/auth/register", map[string]string{
		"username": "valhalla_test",
		"email":    "test_integration@valhalla.test",
		"password": "TestPass123!",
	}, "")

	if status == 409 {
		// Already exists, try login
		t.Log("User exists, logging in instead")
		return
	}

	if status != 201 {
		t.Fatalf("Register failed: status=%d resp=%v", status, resp)
	}

	if resp["token"] == nil {
		t.Fatal("Register: no token in response")
	}
	testToken = resp["token"].(string)
	t.Logf("Register OK: token=%s...", testToken[:8])
}

func Test02_Login(t *testing.T) {
	status, resp := apiRequest(t, "POST", "/auth/login", map[string]string{
		"email":    "test_integration@valhalla.test",
		"password": "TestPass123!",
	}, "")

	if status != 200 {
		t.Fatalf("Login failed: status=%d resp=%v", status, resp)
	}

	testToken = resp["token"].(string)
	if user, ok := resp["user"].(map[string]any); ok {
		testUserID = fmt.Sprintf("%v", user["id"])
	}
	t.Logf("Login OK: user=%s token=%s...", testUserID, testToken[:8])
}

func Test03_GetMe(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, resp := apiRequest(t, "GET", "/users/@me", nil, testToken)
	if status != 200 {
		t.Fatalf("GetMe failed: status=%d", status)
	}
	if resp["username"] == nil {
		t.Fatal("GetMe: no username")
	}
	t.Logf("GetMe OK: %s", resp["username"])
}

// ═══════════════════════════════════════════════════════
// Test 2: Profile
// ═══════════════════════════════════════════════════════

func Test04_UpdateProfile(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, resp := apiRequest(t, "PATCH", "/users/@me", map[string]any{
		"display_name": "Test Display",
		"bio":          "Integration test bio",
	}, testToken)

	if status != 200 {
		t.Fatalf("UpdateProfile failed: status=%d resp=%v", status, resp)
	}
	t.Log("UpdateProfile OK")
}

func Test05_ChangePassword(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	// Change then change back
	status, _ := apiRequest(t, "POST", "/users/@me/password", map[string]string{
		"current_password": "TestPass123!",
		"new_password":     "TestPass456!",
	}, testToken)

	if status != 204 {
		t.Fatalf("ChangePassword failed: status=%d", status)
	}

	// Change back
	apiRequest(t, "POST", "/users/@me/password", map[string]string{
		"current_password": "TestPass456!",
		"new_password":     "TestPass123!",
	}, testToken)

	t.Log("ChangePassword OK")
}

func Test06_GetSessions(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, result := apiRequestArray(t, "GET", "/users/@me/sessions", testToken)
	if status != 200 {
		t.Fatalf("GetSessions failed: status=%d", status)
	}
	if len(result) == 0 {
		t.Fatal("GetSessions: no sessions")
	}
	t.Logf("GetSessions OK: %d sessions", len(result))
}

// ═══════════════════════════════════════════════════════
// Test 3: Guild CRUD
// ═══════════════════════════════════════════════════════

func Test10_CreateGuild(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, resp := apiRequest(t, "POST", "/guilds", map[string]string{
		"name": "Test Server",
	}, testToken)

	if status != 201 {
		t.Fatalf("CreateGuild failed: status=%d resp=%v", status, resp)
	}

	guild, ok := resp["guild"].(map[string]any)
	if !ok {
		t.Fatal("CreateGuild: no guild in response")
	}
	testGuildID = fmt.Sprintf("%v", guild["id"])

	// Extract channel ID
	if channels, ok := resp["channels"].([]any); ok {
		for _, ch := range channels {
			if c, ok := ch.(map[string]any); ok {
				if c["type"].(float64) == 0 { // text channel
					testChanID = fmt.Sprintf("%v", c["id"])
					break
				}
			}
		}
	}

	t.Logf("CreateGuild OK: guild=%s channel=%s", testGuildID, testChanID)
}

func Test11_GetGuild(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, resp := apiRequest(t, "GET", "/guilds/"+testGuildID, nil, testToken)
	if status != 200 {
		t.Fatalf("GetGuild failed: status=%d", status)
	}
	if resp["name"] != "Test Server" {
		t.Fatalf("GetGuild: wrong name: %v", resp["name"])
	}
	t.Log("GetGuild OK")
}

func Test12_GetGuildChannels(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, result := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/channels", testToken)
	if status != 200 {
		t.Fatalf("GetGuildChannels failed: status=%d", status)
	}
	if len(result) < 2 { // at minimum: category + #general
		t.Fatalf("GetGuildChannels: expected >= 2 channels, got %d", len(result))
	}
	t.Logf("GetGuildChannels OK: %d channels", len(result))
}

func Test13_GetMembers(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, result := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/members", testToken)
	if status != 200 {
		t.Fatalf("GetMembers failed: status=%d", status)
	}
	if len(result) < 1 {
		t.Fatal("GetMembers: no members")
	}
	t.Logf("GetMembers OK: %d members", len(result))
}

func Test14_GetRoles(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, result := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/roles", testToken)
	if status != 200 {
		t.Fatalf("GetRoles failed: status=%d", status)
	}
	if len(result) < 1 { // at minimum @everyone
		t.Fatal("GetRoles: no roles")
	}
	t.Logf("GetRoles OK: %d roles", len(result))
}

// ═══════════════════════════════════════════════════════
// Test 4: Role CRUD
// ═══════════════════════════════════════════════════════

func Test15_CreateRole(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, resp := apiRequest(t, "POST", "/guilds/"+testGuildID+"/roles", map[string]any{
		"name": "Test Mod",
	}, testToken)

	if status != 201 {
		t.Fatalf("CreateRole failed: status=%d resp=%v", status, resp)
	}
	testRoleID = fmt.Sprintf("%v", resp["id"])
	t.Logf("CreateRole OK: role=%s", testRoleID)
}

func Test16_UpdateRole(t *testing.T) {
	if testRoleID == "" {
		t.Skip("No role")
	}

	status, resp := apiRequest(t, "PATCH", "/guilds/"+testGuildID+"/roles/"+testRoleID, map[string]any{
		"name":  "Test Moderator",
		"color": 5025616,
	}, testToken)

	if status != 200 {
		t.Fatalf("UpdateRole failed: status=%d resp=%v", status, resp)
	}
	t.Log("UpdateRole OK")
}

// ═══════════════════════════════════════════════════════
// Test 5: Messages
// ═══════════════════════════════════════════════════════

func Test20_SendMessage(t *testing.T) {
	if testChanID == "" {
		t.Skip("No channel")
	}

	status, resp := apiRequest(t, "POST", "/channels/"+testChanID+"/messages", map[string]string{
		"content": "Hello from integration test! **bold** and *italic*",
	}, testToken)

	if status != 201 {
		t.Fatalf("SendMessage failed: status=%d resp=%v", status, resp)
	}

	testMsgID = fmt.Sprintf("%v", resp["id"])
	t.Logf("SendMessage OK: msg=%s", testMsgID)
}

func Test21_GetMessages(t *testing.T) {
	if testChanID == "" {
		t.Skip("No channel")
	}

	status, result := apiRequestArray(t, "GET", "/channels/"+testChanID+"/messages?limit=10", testToken)
	if status != 200 {
		t.Fatalf("GetMessages failed: status=%d", status)
	}
	if len(result) < 1 {
		t.Fatal("GetMessages: no messages")
	}
	t.Logf("GetMessages OK: %d messages", len(result))
}

func Test22_EditMessage(t *testing.T) {
	if testMsgID == "" {
		t.Skip("No message")
	}

	status, resp := apiRequest(t, "PATCH", "/channels/"+testChanID+"/messages/"+testMsgID, map[string]string{
		"content": "Edited message from test",
	}, testToken)

	if status != 200 {
		t.Fatalf("EditMessage failed: status=%d resp=%v", status, resp)
	}
	if resp["edited_timestamp"] == nil {
		t.Fatal("EditMessage: no edited_timestamp")
	}
	t.Log("EditMessage OK")
}

func Test23_AddReaction(t *testing.T) {
	if testMsgID == "" {
		t.Skip("No message")
	}

	status, _ := apiRequest(t, "PUT", "/channels/"+testChanID+"/messages/"+testMsgID+"/reactions/👍/@me", nil, testToken)
	if status != 204 {
		t.Fatalf("AddReaction failed: status=%d", status)
	}
	t.Log("AddReaction OK")
}

func Test24_RemoveReaction(t *testing.T) {
	if testMsgID == "" {
		t.Skip("No message")
	}

	status, _ := apiRequest(t, "DELETE", "/channels/"+testChanID+"/messages/"+testMsgID+"/reactions/👍/@me", nil, testToken)
	if status != 204 {
		t.Fatalf("RemoveReaction failed: status=%d", status)
	}
	t.Log("RemoveReaction OK")
}

func Test25_Typing(t *testing.T) {
	if testChanID == "" {
		t.Skip("No channel")
	}

	status, _ := apiRequest(t, "POST", "/channels/"+testChanID+"/typing", nil, testToken)
	if status != 204 {
		t.Fatalf("Typing failed: status=%d", status)
	}
	t.Log("Typing OK")
}

func Test26_PinMessage(t *testing.T) {
	if testMsgID == "" || testChanID == "" {
		t.Skip("No message/channel")
	}

	// Pin
	status, _ := apiRequest(t, "PUT", "/channels/"+testChanID+"/pins/"+testMsgID, nil, testToken)
	if status != 204 {
		t.Fatalf("PinMessage failed: status=%d", status)
	}

	// Get pins
	status, result := apiRequestArray(t, "GET", "/channels/"+testChanID+"/pins", testToken)
	if status != 200 {
		t.Fatalf("GetPins failed: status=%d", status)
	}
	t.Logf("PinMessage OK: %d pinned messages", len(result))

	// Unpin
	status, _ = apiRequest(t, "DELETE", "/channels/"+testChanID+"/pins/"+testMsgID, nil, testToken)
	if status != 204 {
		t.Fatalf("UnpinMessage failed: status=%d", status)
	}
	t.Log("UnpinMessage OK")
}

func Test27_CreatePoll(t *testing.T) {
	if testChanID == "" {
		t.Skip("No channel")
	}

	status, resp := apiRequest(t, "POST", "/channels/"+testChanID+"/polls", map[string]any{
		"question":          "Test Umfrage?",
		"options":           []string{"Ja", "Nein", "Vielleicht"},
		"allow_multiselect": false,
		"duration_hours":    24,
	}, testToken)

	if status != 201 {
		t.Fatalf("CreatePoll failed: status=%d resp=%v", status, resp)
	}

	if resp["question"] != "Test Umfrage?" {
		t.Fatalf("CreatePoll: wrong question: %v", resp["question"])
	}
	t.Log("CreatePoll OK")
}

// ═══════════════════════════════════════════════════════
// Test 6: Invites
// ═══════════════════════════════════════════════════════

func Test30_CreateInvite(t *testing.T) {
	if testChanID == "" {
		t.Skip("No channel")
	}

	status, resp := apiRequest(t, "POST", "/channels/"+testChanID+"/invites", map[string]any{
		"max_age":  86400,
		"max_uses": 10,
	}, testToken)

	if status != 201 {
		t.Fatalf("CreateInvite failed: status=%d resp=%v", status, resp)
	}
	if resp["code"] != nil {
		testInvite = resp["code"].(string)
	}
	t.Logf("CreateInvite OK: code=%s", testInvite)
}

// ═══════════════════════════════════════════════════════
// Test 7: Relationships
// ═══════════════════════════════════════════════════════

func Test40_GetRelationships(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, _ := apiRequestArray(t, "GET", "/users/@me/relationships", testToken)
	if status != 200 {
		t.Fatalf("GetRelationships failed: status=%d", status)
	}
	t.Log("GetRelationships OK")
}

// ═══════════════════════════════════════════════════════
// Test 8: Kanban
// ═══════════════════════════════════════════════════════

func Test50_CreateBoard(t *testing.T) {
	if testChanID == "" || testGuildID == "" {
		t.Skip("No channel/guild")
	}

	status, resp := apiRequest(t, "POST", "/channels/"+testChanID+"/boards", map[string]any{
		"name":     "Test Board",
		"guild_id": testGuildID,
	}, testToken)

	if status != 201 {
		t.Fatalf("CreateBoard failed: status=%d resp=%v", status, resp)
	}
	t.Log("CreateBoard OK")
}

// ═══════════════════════════════════════════════════════
// Test 9: Wiki
// ═══════════════════════════════════════════════════════

func Test51_CreateWikiPage(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, resp := apiRequest(t, "POST", "/guilds/"+testGuildID+"/wiki", map[string]string{
		"title":   "Test Page",
		"content": "# Test\nHello from integration tests",
	}, testToken)

	if status != 201 {
		t.Fatalf("CreateWikiPage failed: status=%d resp=%v", status, resp)
	}
	t.Log("CreateWikiPage OK")
}

// ═══════════════════════════════════════════════════════
// Test 10: DMs
// ═══════════════════════════════════════════════════════

func Test52_GetDMs(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	status, _ := apiRequestArray(t, "GET", "/users/@me/channels", testToken)
	if status != 200 {
		t.Fatalf("GetDMs failed: status=%d", status)
	}
	t.Log("GetDMs OK")
}

// ═══════════════════════════════════════════════════════
// Test 11: Audit Log & Bans
// ═══════════════════════════════════════════════════════

func Test60_GetBans(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, _ := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/bans", testToken)
	if status != 200 {
		t.Fatalf("GetBans failed: status=%d", status)
	}
	t.Log("GetBans OK")
}

func Test61_GetAuditLog(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, _ := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/audit-logs", testToken)
	if status != 200 {
		t.Fatalf("GetAuditLog failed: status=%d", status)
	}
	t.Log("GetAuditLog OK")
}

// ═══════════════════════════════════════════════════════
// Test 12: Search
// ═══════════════════════════════════════════════════════

func Test70_Search(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, _ := apiRequest(t, "GET", "/guilds/"+testGuildID+"/messages/search?content=test", nil, testToken)
	// MeiliSearch might not be indexed yet, so 200 with empty results is OK
	if status != 200 {
		t.Logf("Search returned: status=%d (MeiliSearch may not be configured)", status)
	} else {
		t.Log("Search OK")
	}
}

// ═══════════════════════════════════════════════════════
// Test 13: Voice States
// ═══════════════════════════════════════════════════════

func Test80_GetVoiceStates(t *testing.T) {
	if testGuildID == "" {
		t.Skip("No guild")
	}

	status, _ := apiRequestArray(t, "GET", "/guilds/"+testGuildID+"/voice-states", testToken)
	if status != 200 {
		t.Fatalf("GetVoiceStates failed: status=%d", status)
	}
	t.Log("GetVoiceStates OK")
}

// ═══════════════════════════════════════════════════════
// Test 14: Unauthorized access
// ═══════════════════════════════════════════════════════

func Test90_UnauthorizedAccess(t *testing.T) {
	// No token
	status, _ := apiRequest(t, "GET", "/users/@me", nil, "")
	if status != 401 {
		t.Fatalf("Expected 401 without token, got %d", status)
	}

	// Invalid token
	status, _ = apiRequest(t, "GET", "/users/@me", nil, "invalid-token-abc123")
	if status != 401 {
		t.Fatalf("Expected 401 with invalid token, got %d", status)
	}

	t.Log("Unauthorized access correctly rejected")
}

func Test91_InvalidInput(t *testing.T) {
	if testToken == "" {
		t.Skip("No token")
	}

	// Empty message
	status, _ := apiRequest(t, "POST", "/channels/"+testChanID+"/messages", map[string]string{
		"content": "",
	}, testToken)
	if status != 400 {
		t.Fatalf("Expected 400 for empty message, got %d", status)
	}

	// Too long message
	status, _ = apiRequest(t, "POST", "/channels/"+testChanID+"/messages", map[string]string{
		"content": strings.Repeat("a", 5000),
	}, testToken)
	if status != 400 {
		t.Fatalf("Expected 400 for too-long message, got %d", status)
	}

	t.Log("Invalid input correctly rejected")
}

// ═══════════════════════════════════════════════════════
// Test 15: Cleanup — Delete message and role
// ═══════════════════════════════════════════════════════

func Test99_Cleanup(t *testing.T) {
	if testMsgID != "" && testChanID != "" {
		status, _ := apiRequest(t, "DELETE", "/channels/"+testChanID+"/messages/"+testMsgID, nil, testToken)
		t.Logf("Delete message: status=%d", status)
	}

	if testRoleID != "" && testGuildID != "" {
		status, _ := apiRequest(t, "DELETE", "/guilds/"+testGuildID+"/roles/"+testRoleID, nil, testToken)
		t.Logf("Delete role: status=%d", status)
	}

	// Don't delete guild — leave for manual inspection
	t.Log("Cleanup done")
}
