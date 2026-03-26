package guild

import (
	"context"
	"crypto/rand"
	"encoding/hex"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// --- Guild ---

func (r *Repository) CreateGuild(ctx context.Context, id int64, name string, ownerID int64) (*Guild, error) {
	var g Guild
	err := r.db.QueryRow(ctx, `
		INSERT INTO guilds (id, name, owner_id)
		VALUES ($1, $2, $3)
		RETURNING id, name, icon_hash, banner_hash, owner_id, description,
		          preferred_locale, verification_level, default_notifications,
		          features, system_channel_id, max_members, created_at
	`, id, name, ownerID).Scan(
		&g.ID, &g.Name, &g.IconHash, &g.BannerHash, &g.OwnerID, &g.Description,
		&g.PreferredLocale, &g.VerificationLevel, &g.DefaultNotifications,
		&g.Features, &g.SystemChannelID, &g.MaxMembers, &g.CreatedAt,
	)
	return &g, err
}

func (r *Repository) GetGuild(ctx context.Context, id int64) (*Guild, error) {
	var g Guild
	err := r.db.QueryRow(ctx, `
		SELECT id, name, icon_hash, banner_hash, owner_id, description,
		       preferred_locale, verification_level, default_notifications,
		       features, system_channel_id, max_members, created_at
		FROM guilds WHERE id = $1
	`, id).Scan(
		&g.ID, &g.Name, &g.IconHash, &g.BannerHash, &g.OwnerID, &g.Description,
		&g.PreferredLocale, &g.VerificationLevel, &g.DefaultNotifications,
		&g.Features, &g.SystemChannelID, &g.MaxMembers, &g.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *Repository) UpdateGuild(ctx context.Context, id int64, req UpdateGuildRequest) (*Guild, error) {
	var g Guild
	err := r.db.QueryRow(ctx, `
		UPDATE guilds SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			icon_hash = COALESCE($4, icon_hash)
		WHERE id = $1
		RETURNING id, name, icon_hash, banner_hash, owner_id, description,
		          preferred_locale, verification_level, default_notifications,
		          features, system_channel_id, max_members, created_at
	`, id, req.Name, req.Description, req.IconHash).Scan(
		&g.ID, &g.Name, &g.IconHash, &g.BannerHash, &g.OwnerID, &g.Description,
		&g.PreferredLocale, &g.VerificationLevel, &g.DefaultNotifications,
		&g.Features, &g.SystemChannelID, &g.MaxMembers, &g.CreatedAt,
	)
	return &g, err
}

func (r *Repository) DeleteGuild(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM guilds WHERE id = $1`, id)
	return err
}

func (r *Repository) GetUserGuilds(ctx context.Context, userID int64) ([]Guild, error) {
	rows, err := r.db.Query(ctx, `
		SELECT g.id, g.name, g.icon_hash, g.banner_hash, g.owner_id, g.description,
		       g.preferred_locale, g.verification_level, g.default_notifications,
		       g.features, g.system_channel_id, g.max_members, g.created_at
		FROM guilds g
		INNER JOIN members m ON m.guild_id = g.id
		WHERE m.user_id = $1
		ORDER BY g.id
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var guilds []Guild
	for rows.Next() {
		var g Guild
		if err := rows.Scan(
			&g.ID, &g.Name, &g.IconHash, &g.BannerHash, &g.OwnerID, &g.Description,
			&g.PreferredLocale, &g.VerificationLevel, &g.DefaultNotifications,
			&g.Features, &g.SystemChannelID, &g.MaxMembers, &g.CreatedAt,
		); err != nil {
			return nil, err
		}
		guilds = append(guilds, g)
	}
	return guilds, nil
}

// --- Members ---

func (r *Repository) AddMember(ctx context.Context, userID, guildID int64) (*Member, error) {
	_, err := r.db.Exec(ctx, `
		INSERT INTO members (user_id, guild_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, userID, guildID)
	if err != nil {
		return nil, err
	}
	return r.GetMember(ctx, userID, guildID)
}

func (r *Repository) GetMember(ctx context.Context, userID, guildID int64) (*Member, error) {
	var m Member
	m.User = &MemberUser{}
	err := r.db.QueryRow(ctx, `
		SELECT m.user_id, m.guild_id, m.nickname, m.avatar_hash,
		       m.joined_at, m.deaf, m.mute, m.pending, m.timeout_until,
		       u.id, u.username, u.display_name, u.avatar_hash
		FROM members m
		INNER JOIN users u ON u.id = m.user_id
		WHERE m.user_id = $1 AND m.guild_id = $2
	`, userID, guildID).Scan(
		&m.UserID, &m.GuildID, &m.Nickname, &m.AvatarHash,
		&m.JoinedAt, &m.Deaf, &m.Mute, &m.Pending, &m.TimeoutUntil,
		&m.User.ID, &m.User.Username, &m.User.DisplayName, &m.User.AvatarHash,
	)
	if err != nil {
		return nil, err
	}

	// Load role IDs
	m.RoleIDs, _ = r.GetMemberRoleIDs(ctx, userID, guildID)
	return &m, nil
}

func (r *Repository) GetMembers(ctx context.Context, guildID int64, limit, offset int) ([]Member, error) {
	rows, err := r.db.Query(ctx, `
		SELECT m.user_id, m.guild_id, m.nickname, m.avatar_hash,
		       m.joined_at, m.deaf, m.mute, m.pending, m.timeout_until,
		       u.id, u.username, u.display_name, u.avatar_hash
		FROM members m
		INNER JOIN users u ON u.id = m.user_id
		WHERE m.guild_id = $1
		ORDER BY m.joined_at
		LIMIT $2 OFFSET $3
	`, guildID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		m.User = &MemberUser{}
		if err := rows.Scan(
			&m.UserID, &m.GuildID, &m.Nickname, &m.AvatarHash,
			&m.JoinedAt, &m.Deaf, &m.Mute, &m.Pending, &m.TimeoutUntil,
			&m.User.ID, &m.User.Username, &m.User.DisplayName, &m.User.AvatarHash,
		); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *Repository) RemoveMember(ctx context.Context, userID, guildID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM members WHERE user_id = $1 AND guild_id = $2`, userID, guildID)
	return err
}

func (r *Repository) IsMember(ctx context.Context, userID, guildID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM members WHERE user_id = $1 AND guild_id = $2)
	`, userID, guildID).Scan(&exists)
	return exists, err
}

func (r *Repository) GetMemberRoleIDs(ctx context.Context, userID, guildID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx, `
		SELECT role_id FROM member_roles WHERE user_id = $1 AND guild_id = $2
	`, userID, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roleIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		roleIDs = append(roleIDs, id)
	}
	return roleIDs, nil
}

func (r *Repository) AddMemberRole(ctx context.Context, userID, guildID, roleID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO member_roles (user_id, guild_id, role_id) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, userID, guildID, roleID)
	return err
}

// --- Roles ---

func (r *Repository) CreateRole(ctx context.Context, id, guildID int64, name string, permissions int64, position int) (*Role, error) {
	var role Role
	err := r.db.QueryRow(ctx, `
		INSERT INTO roles (id, guild_id, name, permissions, position)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, guild_id, name, color, hoist, position, permissions, managed, mentionable
	`, id, guildID, name, permissions, position).Scan(
		&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Hoist,
		&role.Position, &role.Permissions, &role.Managed, &role.Mentionable,
	)
	return &role, err
}

func (r *Repository) GetRoles(ctx context.Context, guildID int64) ([]Role, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, guild_id, name, color, hoist, position, permissions, managed, mentionable
		FROM roles WHERE guild_id = $1 ORDER BY position
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var role Role
		if err := rows.Scan(
			&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Hoist,
			&role.Position, &role.Permissions, &role.Managed, &role.Mentionable,
		); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, nil
}

func (r *Repository) GetRole(ctx context.Context, roleID int64) (*Role, error) {
	var role Role
	err := r.db.QueryRow(ctx, `
		SELECT id, guild_id, name, color, hoist, position, permissions, managed, mentionable
		FROM roles WHERE id = $1
	`, roleID).Scan(
		&role.ID, &role.GuildID, &role.Name, &role.Color, &role.Hoist,
		&role.Position, &role.Permissions, &role.Managed, &role.Mentionable,
	)
	return &role, err
}

// --- Invites ---

func (r *Repository) CreateInvite(ctx context.Context, guildID, channelID, inviterID int64, maxAge, maxUses int) (*Invite, error) {
	code := generateInviteCode()
	var inv Invite
	err := r.db.QueryRow(ctx, `
		INSERT INTO invites (code, guild_id, channel_id, inviter_id, max_age, max_uses)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING code, guild_id, channel_id, inviter_id, max_age, max_uses, uses, temporary, created_at
	`, code, guildID, channelID, inviterID, maxAge, maxUses).Scan(
		&inv.Code, &inv.GuildID, &inv.ChannelID, &inv.InviterID,
		&inv.MaxAge, &inv.MaxUses, &inv.Uses, &inv.Temporary, &inv.CreatedAt,
	)
	return &inv, err
}

func (r *Repository) GetInvite(ctx context.Context, code string) (*Invite, error) {
	var inv Invite
	err := r.db.QueryRow(ctx, `
		SELECT i.code, i.guild_id, i.channel_id, i.inviter_id,
		       i.max_age, i.max_uses, i.uses, i.temporary, i.created_at,
		       g.id, g.name, g.icon_hash
		FROM invites i
		INNER JOIN guilds g ON g.id = i.guild_id
		WHERE i.code = $1
	`, code).Scan(
		&inv.Code, &inv.GuildID, &inv.ChannelID, &inv.InviterID,
		&inv.MaxAge, &inv.MaxUses, &inv.Uses, &inv.Temporary, &inv.CreatedAt,
		&inv.Guild.ID, &inv.Guild.Name, &inv.Guild.IconHash,
	)
	return &inv, err
}

func (r *Repository) UseInvite(ctx context.Context, code string) error {
	_, err := r.db.Exec(ctx, `UPDATE invites SET uses = uses + 1 WHERE code = $1`, code)
	return err
}

func (r *Repository) IsInviteValid(ctx context.Context, code string) (bool, error) {
	var valid bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM invites
			WHERE code = $1
			AND (max_uses = 0 OR uses < max_uses)
			AND (max_age = 0 OR created_at + (max_age || ' seconds')::interval > NOW())
		)
	`, code).Scan(&valid)
	return valid, err
}

// --- Bans ---

func (r *Repository) CreateBan(ctx context.Context, guildID, userID, bannedBy int64, reason *string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO bans (guild_id, user_id, banned_by, reason) VALUES ($1, $2, $3, $4)
		ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = $4, banned_by = $3
	`, guildID, userID, bannedBy, reason)
	return err
}

func (r *Repository) DeleteBan(ctx context.Context, guildID, userID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM bans WHERE guild_id = $1 AND user_id = $2`, guildID, userID)
	return err
}

func (r *Repository) IsBanned(ctx context.Context, guildID, userID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM bans WHERE guild_id = $1 AND user_id = $2)
	`, guildID, userID).Scan(&exists)
	return exists, err
}

// --- Transactions ---

func (r *Repository) WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func generateInviteCode() string {
	b := make([]byte, 5)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// MemberCount returns the member count for a guild.
func (r *Repository) MemberCount(ctx context.Context, guildID int64) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM members WHERE guild_id = $1`, guildID).Scan(&count)
	return count, err
}

// SetSystemChannel sets the system channel for a guild.
func (r *Repository) SetSystemChannel(ctx context.Context, guildID, channelID int64) error {
	_, err := r.db.Exec(ctx, `UPDATE guilds SET system_channel_id = $2 WHERE id = $1`, guildID, channelID)
	return err
}

// GetGuildEveryone gets the @everyone role for a guild (role ID = guild ID).
func (r *Repository) GetEveryoneRole(ctx context.Context, guildID int64) (*Role, error) {
	return r.GetRole(ctx, guildID)
}

// UpdateRole applies partial updates to a role.
func (r *Repository) UpdateRole(ctx context.Context, roleID int64, name *string, color *int, permissions *int64, hoist *bool, mentionable *bool) error {
	if name != nil {
		r.db.Exec(ctx, `UPDATE roles SET name = $2 WHERE id = $1`, roleID, *name)
	}
	if color != nil {
		r.db.Exec(ctx, `UPDATE roles SET color = $2 WHERE id = $1`, roleID, *color)
	}
	if permissions != nil {
		r.db.Exec(ctx, `UPDATE roles SET permissions = $2 WHERE id = $1`, roleID, *permissions)
	}
	if hoist != nil {
		r.db.Exec(ctx, `UPDATE roles SET hoist = $2 WHERE id = $1`, roleID, *hoist)
	}
	if mentionable != nil {
		r.db.Exec(ctx, `UPDATE roles SET mentionable = $2 WHERE id = $1`, roleID, *mentionable)
	}
	return nil
}

// DeleteRole removes a non-managed role.
func (r *Repository) DeleteRole(ctx context.Context, roleID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM roles WHERE id = $1 AND managed = false`, roleID)
	return err
}

// GetBans returns all bans for a guild with user info.
func (r *Repository) GetBans(ctx context.Context, guildID int64) ([]Ban, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.guild_id, b.user_id, b.reason, u.id, u.username, u.display_name, u.avatar_hash
		FROM bans b INNER JOIN users u ON u.id = b.user_id
		WHERE b.guild_id = $1
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bans []Ban
	for rows.Next() {
		var b Ban
		b.User = &MemberUser{}
		rows.Scan(&b.GuildID, &b.UserID, &b.Reason, &b.User.ID, &b.User.Username, &b.User.DisplayName, &b.User.AvatarHash)
		bans = append(bans, b)
	}
	return bans, nil
}

// AuditLogEntry represents a single audit log entry.
type AuditLogEntry struct {
	ID         int64   `json:"id,string"`
	GuildID    int64   `json:"guild_id,string"`
	UserID     *int64  `json:"user_id,string"`
	TargetID   *int64  `json:"target_id,string"`
	ActionType int     `json:"action_type"`
	Reason     *string `json:"reason"`
	Changes    any     `json:"changes"`
	CreatedAt  string  `json:"created_at"`
}

// GetAuditLog returns the last 50 audit log entries for a guild.
func (r *Repository) GetAuditLog(ctx context.Context, guildID int64) ([]AuditLogEntry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, guild_id, user_id, target_id, action_type, reason, changes, created_at::text
		FROM audit_log_entries WHERE guild_id = $1
		ORDER BY id DESC LIMIT 50
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AuditLogEntry
	for rows.Next() {
		var e AuditLogEntry
		rows.Scan(&e.ID, &e.GuildID, &e.UserID, &e.TargetID, &e.ActionType, &e.Reason, &e.Changes, &e.CreatedAt)
		entries = append(entries, e)
	}
	return entries, nil
}
