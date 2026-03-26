package guild

import "time"

// Guild represents a server/community.
type Guild struct {
	ID                    int64    `json:"id,string"`
	Name                  string   `json:"name"`
	IconHash              *string  `json:"icon"`
	BannerHash            *string  `json:"banner"`
	OwnerID               int64    `json:"owner_id,string"`
	Description           *string  `json:"description"`
	PreferredLocale       string   `json:"preferred_locale"`
	VerificationLevel     int      `json:"verification_level"`
	DefaultNotifications  int      `json:"default_message_notifications"`
	Features              []string `json:"features"`
	SystemChannelID       *int64   `json:"system_channel_id,string"`
	MaxMembers            int      `json:"max_members"`
	MemberCount           int      `json:"member_count,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
}

// CreateGuildRequest is the payload for creating a guild.
type CreateGuildRequest struct {
	Name string `json:"name"`
}

// UpdateGuildRequest is the payload for updating a guild.
type UpdateGuildRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	IconHash    *string `json:"icon,omitempty"`
}

// Member represents a guild member.
type Member struct {
	UserID       int64     `json:"user_id,string"`
	GuildID      int64     `json:"guild_id,string"`
	Nickname     *string   `json:"nick"`
	AvatarHash   *string   `json:"avatar"`
	RoleIDs      []int64   `json:"roles"`
	JoinedAt     time.Time `json:"joined_at"`
	Deaf         bool      `json:"deaf"`
	Mute         bool      `json:"mute"`
	Pending      bool      `json:"pending"`
	TimeoutUntil *time.Time `json:"communication_disabled_until"`
	// Joined user data (populated when needed)
	User *MemberUser `json:"user,omitempty"`
}

// MemberUser is the user portion embedded in a member object.
type MemberUser struct {
	ID          int64   `json:"id,string"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarHash  *string `json:"avatar"`
}

// Role represents a guild role.
type Role struct {
	ID          int64  `json:"id,string"`
	GuildID     int64  `json:"guild_id,string"`
	Name        string `json:"name"`
	Color       int    `json:"color"`
	Hoist       bool   `json:"hoist"`
	Position    int    `json:"position"`
	Permissions int64  `json:"permissions,string"`
	Managed     bool   `json:"managed"`
	Mentionable bool   `json:"mentionable"`
}

// CreateRoleRequest is the payload for creating a role.
type CreateRoleRequest struct {
	Name        string `json:"name"`
	Color       int    `json:"color"`
	Hoist       bool   `json:"hoist"`
	Permissions int64  `json:"permissions,string"`
	Mentionable bool   `json:"mentionable"`
}

// Invite represents a guild invite.
type Invite struct {
	Code      string    `json:"code"`
	GuildID   int64     `json:"guild_id,string"`
	ChannelID int64     `json:"channel_id,string"`
	InviterID *int64    `json:"inviter_id,string"`
	MaxAge    int       `json:"max_age"`
	MaxUses   int       `json:"max_uses"`
	Uses      int       `json:"uses"`
	Temporary bool      `json:"temporary"`
	CreatedAt time.Time `json:"created_at"`
	Guild     *Guild    `json:"guild,omitempty"`
}

// Ban represents a guild ban.
type Ban struct {
	GuildID   int64     `json:"guild_id,string"`
	UserID    int64     `json:"user_id,string"`
	Reason    *string   `json:"reason"`
	User      *MemberUser `json:"user,omitempty"`
}
