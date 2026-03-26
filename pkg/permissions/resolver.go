package permissions

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Resolver queries the database to compute a user's effective permissions.
type Resolver struct {
	db *pgxpool.Pool
}

func NewResolver(db *pgxpool.Pool) *Resolver {
	return &Resolver{db: db}
}

// HasGuildPerm checks if a user has a specific permission at guild level.
func (r *Resolver) HasGuildPerm(ctx context.Context, userID, guildID int64, perm Permission) (bool, error) {
	perms, err := r.ComputeGuildPerms(ctx, userID, guildID)
	if err != nil {
		return false, err
	}
	return perms.Has(perm), nil
}

// ComputeGuildPerms returns the effective guild-level permissions for a user.
func (r *Resolver) ComputeGuildPerms(ctx context.Context, userID, guildID int64) (Bitfield, error) {
	// Check guild ownership
	var ownerID int64
	err := r.db.QueryRow(ctx, `SELECT owner_id FROM guilds WHERE id = $1`, guildID).Scan(&ownerID)
	if err != nil {
		return 0, err
	}
	if ownerID == userID {
		return All, nil
	}

	// Get @everyone role permissions (role ID = guild ID)
	var everyonePerms int64
	err = r.db.QueryRow(ctx, `SELECT permissions FROM roles WHERE id = $1`, guildID).Scan(&everyonePerms)
	if err != nil {
		return 0, err
	}

	// Get user's role permissions
	rows, err := r.db.Query(ctx, `
		SELECT r.permissions FROM roles r
		INNER JOIN member_roles mr ON mr.role_id = r.id
		WHERE mr.user_id = $1 AND mr.guild_id = $2
	`, userID, guildID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var rolePerms []Bitfield
	for rows.Next() {
		var p int64
		if err := rows.Scan(&p); err != nil {
			return 0, err
		}
		rolePerms = append(rolePerms, Bitfield(p))
	}

	return ComputeBasePermissions(ownerID, userID, Bitfield(everyonePerms), rolePerms), nil
}

// IsMember checks if a user is a member of a guild.
func (r *Resolver) IsMember(ctx context.Context, userID, guildID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM members WHERE user_id = $1 AND guild_id = $2)
	`, userID, guildID).Scan(&exists)
	return exists, err
}

// ChannelInfo returns the type and guild_id for a channel.
type ChannelInfo struct {
	GuildID int64
	Type    int
}

func (r *Resolver) GetChannelInfo(ctx context.Context, channelID int64) (*ChannelInfo, error) {
	var ci ChannelInfo
	err := r.db.QueryRow(ctx, `SELECT COALESCE(guild_id, 0), type FROM channels WHERE id = $1`, channelID).Scan(&ci.GuildID, &ci.Type)
	if err != nil {
		return nil, err
	}
	return &ci, nil
}

// UserGuildIDs returns all guild IDs a user belongs to.
func (r *Resolver) UserGuildIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := r.db.Query(ctx, `SELECT guild_id FROM members WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}
