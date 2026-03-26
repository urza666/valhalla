package guild

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// GuildRepository defines the data access interface for guilds.
type GuildRepository interface {
	CreateGuild(ctx context.Context, id int64, name string, ownerID int64) (*Guild, error)
	GetGuild(ctx context.Context, id int64) (*Guild, error)
	UpdateGuild(ctx context.Context, id int64, req UpdateGuildRequest) (*Guild, error)
	DeleteGuild(ctx context.Context, id int64) error
	GetUserGuilds(ctx context.Context, userID int64) ([]Guild, error)
	AddMember(ctx context.Context, userID, guildID int64) (*Member, error)
	GetMember(ctx context.Context, userID, guildID int64) (*Member, error)
	GetMembers(ctx context.Context, guildID int64, limit, offset int) ([]Member, error)
	RemoveMember(ctx context.Context, userID, guildID int64) error
	IsMember(ctx context.Context, userID, guildID int64) (bool, error)
	GetMemberRoleIDs(ctx context.Context, userID, guildID int64) ([]int64, error)
	AddMemberRole(ctx context.Context, userID, guildID, roleID int64) error
	CreateRole(ctx context.Context, id, guildID int64, name string, permissions int64, position int) (*Role, error)
	GetRoles(ctx context.Context, guildID int64) ([]Role, error)
	GetRole(ctx context.Context, roleID int64) (*Role, error)
	CreateInvite(ctx context.Context, guildID, channelID, inviterID int64, maxAge, maxUses int) (*Invite, error)
	GetInvite(ctx context.Context, code string) (*Invite, error)
	UseInvite(ctx context.Context, code string) error
	IsInviteValid(ctx context.Context, code string) (bool, error)
	CreateBan(ctx context.Context, guildID, userID, bannedBy int64, reason *string) error
	DeleteBan(ctx context.Context, guildID, userID int64) error
	IsBanned(ctx context.Context, guildID, userID int64) (bool, error)
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
	MemberCount(ctx context.Context, guildID int64) (int, error)
	SetSystemChannel(ctx context.Context, guildID, channelID int64) error
	GetEveryoneRole(ctx context.Context, guildID int64) (*Role, error)
}

var _ GuildRepository = (*Repository)(nil)
