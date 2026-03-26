package guild

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// CreateGuild handles POST /api/v1/guilds
func (h *Handler) CreateGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	var req CreateGuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	g, roles, channels, err := h.service.CreateGuild(r.Context(), user.ID, req)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"guild":    g,
		"roles":    roles,
		"channels": channels,
	})
}

// GetGuild handles GET /api/v1/guilds/{guildID}
func (h *Handler) GetGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	g, err := h.service.GetGuild(r.Context(), guildID, user.ID)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// UpdateGuild handles PATCH /api/v1/guilds/{guildID}
func (h *Handler) UpdateGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req UpdateGuildRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	g, err := h.service.UpdateGuild(r.Context(), guildID, user.ID, req)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(g)
}

// DeleteGuild handles DELETE /api/v1/guilds/{guildID}
func (h *Handler) DeleteGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, err := parseID(chi.URLParam(r, "guildID"))
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if err := h.service.DeleteGuild(r.Context(), guildID, user.ID); err != nil {
		handleGuildError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetUserGuilds handles GET /api/v1/users/@me/guilds
func (h *Handler) GetUserGuilds(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guilds, err := h.service.GetUserGuilds(r.Context(), user.ID)
	if err != nil {
		apierror.NewInternal("Failed to fetch guilds").Write(w)
		return
	}
	if guilds == nil {
		guilds = []Guild{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(guilds)
}

// GetMembers handles GET /api/v1/guilds/{guildID}/members
func (h *Handler) GetMembers(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	members, err := h.service.GetMembers(r.Context(), guildID, user.ID, limit, offset)
	if err != nil {
		handleGuildError(w, err)
		return
	}
	if members == nil {
		members = []Member{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// GetRoles handles GET /api/v1/guilds/{guildID}/roles
func (h *Handler) GetRoles(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))

	roles, err := h.service.GetRoles(r.Context(), guildID, user.ID)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

// JoinGuild handles POST /api/v1/invites/{code}/accept
func (h *Handler) JoinGuild(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	code := chi.URLParam(r, "code")

	g, member, err := h.service.JoinGuild(r.Context(), user.ID, code)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"guild":  g,
		"member": member,
	})
}

// CreateInvite handles POST /api/v1/channels/{channelID}/invites
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := parseID(chi.URLParam(r, "channelID"))

	var body struct {
		MaxAge  int `json:"max_age"`
		MaxUses int `json:"max_uses"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	// Resolve guildID from channel
	var guildID int64
	h.service.repo.db.QueryRow(r.Context(), `SELECT COALESCE(guild_id, 0) FROM channels WHERE id = $1`, channelID).Scan(&guildID)

	inv, err := h.service.CreateInvite(r.Context(), guildID, channelID, user.ID, body.MaxAge, body.MaxUses)
	if err != nil {
		handleGuildError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(inv)
}

// KickMember handles DELETE /api/v1/guilds/{guildID}/members/{userID}
func (h *Handler) KickMember(w http.ResponseWriter, r *http.Request) {
	actor := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	targetID, _ := parseID(chi.URLParam(r, "userID"))

	if err := h.service.KickMember(r.Context(), guildID, targetID, actor.ID); err != nil {
		handleGuildError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateRole handles POST /api/v1/guilds/{guildID}/roles
func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))

	var req CreateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}
	if req.Name == "" {
		req.Name = "new role"
	}

	// TODO: check MANAGE_ROLES permission
	_ = user

	roleID := h.service.idGen.Generate().Int64()
	// Get next position
	roles, _ := h.service.repo.GetRoles(r.Context(), guildID)
	pos := len(roles)

	role, err := h.service.repo.CreateRole(r.Context(), roleID, guildID, req.Name, req.Permissions, pos)
	if err != nil {
		apierror.NewInternal("Failed to create role").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(role)
}

// UpdateRole handles PATCH /api/v1/guilds/{guildID}/roles/{roleID}
func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	roleID, _ := parseID(chi.URLParam(r, "roleID"))

	var updates map[string]any
	json.NewDecoder(r.Body).Decode(&updates)

	// Apply updates
	if name, ok := updates["name"].(string); ok {
		h.service.repo.db.Exec(r.Context(), `UPDATE roles SET name = $2 WHERE id = $1`, roleID, name)
	}
	if color, ok := updates["color"].(float64); ok {
		h.service.repo.db.Exec(r.Context(), `UPDATE roles SET color = $2 WHERE id = $1`, roleID, int(color))
	}
	if perms, ok := updates["permissions"].(string); ok {
		p, _ := strconv.ParseInt(perms, 10, 64)
		h.service.repo.db.Exec(r.Context(), `UPDATE roles SET permissions = $2 WHERE id = $1`, roleID, p)
	}
	if hoist, ok := updates["hoist"].(bool); ok {
		h.service.repo.db.Exec(r.Context(), `UPDATE roles SET hoist = $2 WHERE id = $1`, roleID, hoist)
	}
	if mentionable, ok := updates["mentionable"].(bool); ok {
		h.service.repo.db.Exec(r.Context(), `UPDATE roles SET mentionable = $2 WHERE id = $1`, roleID, mentionable)
	}

	role, err := h.service.repo.GetRole(r.Context(), roleID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(role)
}

// DeleteRole handles DELETE /api/v1/guilds/{guildID}/roles/{roleID}
func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	roleID, _ := parseID(chi.URLParam(r, "roleID"))

	_, err := h.service.repo.db.Exec(r.Context(), `DELETE FROM roles WHERE id = $1 AND managed = false`, roleID)
	if err != nil {
		apierror.NewInternal("Failed to delete role").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// BanMember handles PUT /api/v1/guilds/{guildID}/bans/{userID}
func (h *Handler) BanMember(w http.ResponseWriter, r *http.Request) {
	actor := auth.UserFromContext(r.Context())
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	targetID, _ := parseID(chi.URLParam(r, "userID"))

	var body struct {
		Reason *string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if err := h.service.BanMember(r.Context(), guildID, targetID, actor.ID, body.Reason); err != nil {
		handleGuildError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UnbanMember handles DELETE /api/v1/guilds/{guildID}/bans/{userID}
func (h *Handler) UnbanMember(w http.ResponseWriter, r *http.Request) {
	guildID, _ := parseID(chi.URLParam(r, "guildID"))
	targetID, _ := parseID(chi.URLParam(r, "userID"))

	h.service.repo.DeleteBan(r.Context(), guildID, targetID)
	w.WriteHeader(http.StatusNoContent)
}

// GetBans handles GET /api/v1/guilds/{guildID}/bans
func (h *Handler) GetBans(w http.ResponseWriter, r *http.Request) {
	guildID, _ := parseID(chi.URLParam(r, "guildID"))

	rows, err := h.service.repo.db.Query(r.Context(), `
		SELECT b.guild_id, b.user_id, b.reason, u.id, u.username, u.display_name, u.avatar_hash
		FROM bans b INNER JOIN users u ON u.id = b.user_id
		WHERE b.guild_id = $1
	`, guildID)
	if err != nil {
		apierror.NewInternal("Failed to fetch bans").Write(w)
		return
	}
	defer rows.Close()

	var bans []Ban
	for rows.Next() {
		var b Ban
		b.User = &MemberUser{}
		rows.Scan(&b.GuildID, &b.UserID, &b.Reason, &b.User.ID, &b.User.Username, &b.User.DisplayName, &b.User.AvatarHash)
		bans = append(bans, b)
	}
	if bans == nil {
		bans = []Ban{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bans)
}

// GetAuditLog handles GET /api/v1/guilds/{guildID}/audit-logs
func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	guildID, _ := parseID(chi.URLParam(r, "guildID"))

	rows, err := h.service.repo.db.Query(r.Context(), `
		SELECT id, guild_id, user_id, target_id, action_type, reason, changes, created_at::text
		FROM audit_log_entries WHERE guild_id = $1
		ORDER BY id DESC LIMIT 50
	`, guildID)
	if err != nil {
		apierror.NewInternal("Failed to fetch audit log").Write(w)
		return
	}
	defer rows.Close()

	type AuditEntry struct {
		ID         int64  `json:"id,string"`
		GuildID    int64  `json:"guild_id,string"`
		UserID     *int64 `json:"user_id,string"`
		TargetID   *int64 `json:"target_id,string"`
		ActionType int    `json:"action_type"`
		Reason     *string `json:"reason"`
		Changes    any    `json:"changes"`
		CreatedAt  string `json:"created_at"`
	}

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		rows.Scan(&e.ID, &e.GuildID, &e.UserID, &e.TargetID, &e.ActionType, &e.Reason, &e.Changes, &e.CreatedAt)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []AuditEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func parseID(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func handleGuildError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		apierror.ErrNotFound.Write(w)
	case errors.Is(err, ErrNotMember):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrNotOwner):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrAlreadyMember):
		apierror.NewConflict("Already a member of this guild").Write(w)
	case errors.Is(err, ErrBanned):
		apierror.ErrForbidden.Write(w)
	case errors.Is(err, ErrInvalidName):
		apierror.NewValidationError(err.Error()).Write(w)
	case errors.Is(err, ErrInviteInvalid):
		apierror.NewBadRequest("Invalid or expired invite").Write(w)
	default:
		apierror.NewInternal("Internal server error").Write(w)
	}
}
