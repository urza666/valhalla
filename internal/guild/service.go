package guild

import (
	"context"
	"errors"

	"github.com/valhalla-chat/valhalla/pkg/permissions"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrNotFound      = errors.New("guild not found")
	ErrNotMember     = errors.New("not a member of this guild")
	ErrNotOwner      = errors.New("only the owner can perform this action")
	ErrAlreadyMember = errors.New("already a member")
	ErrBanned        = errors.New("you are banned from this guild")
	ErrInvalidName   = errors.New("guild name must be 2-100 characters")
	ErrInviteInvalid = errors.New("invite is invalid or expired")
)

// Service handles guild business logic.
type Service struct {
	repo  *Repository
	idGen *snowflake.Generator
}

func NewService(repo *Repository, idGen *snowflake.Generator) *Service {
	return &Service{repo: repo, idGen: idGen}
}

// CreateGuild creates a new guild with default channels and @everyone role.
func (s *Service) CreateGuild(ctx context.Context, ownerID int64, req CreateGuildRequest) (*Guild, []Role, []Channel, error) {
	if len(req.Name) < 2 || len(req.Name) > 100 {
		return nil, nil, nil, ErrInvalidName
	}

	guildID := s.idGen.Generate().Int64()

	g, err := s.repo.CreateGuild(ctx, guildID, req.Name, ownerID)
	if err != nil {
		return nil, nil, nil, err
	}

	// Create @everyone role (ID = Guild ID, as per Discord convention)
	everyoneRole, err := s.repo.CreateRole(ctx, guildID, guildID, "everyone",
		int64(permissions.DefaultEveryone), 0)
	if err != nil {
		return nil, nil, nil, err
	}

	// Add owner as member
	if _, err := s.repo.AddMember(ctx, ownerID, guildID); err != nil {
		return nil, nil, nil, err
	}

	// Create default channels
	channels, err := s.createDefaultChannels(ctx, guildID)
	if err != nil {
		return nil, nil, nil, err
	}

	// Set system channel
	if len(channels) > 0 {
		s.repo.SetSystemChannel(ctx, guildID, channels[0].ID)
	}

	return g, []Role{*everyoneRole}, channels, nil
}

// Channel type used here to avoid circular import — minimal inline struct.
type Channel struct {
	ID       int64  `json:"id,string"`
	GuildID  int64  `json:"guild_id,string"`
	Type     int    `json:"type"`
	Name     string `json:"name"`
	Position int    `json:"position"`
	ParentID *int64 `json:"parent_id,string"`
}

func (s *Service) createDefaultChannels(ctx context.Context, guildID int64) ([]Channel, error) {
	// Text Channels category
	catID := s.idGen.Generate().Int64()
	if _, err := s.repo.db.Exec(ctx, `
		INSERT INTO channels (id, guild_id, type, name, position)
		VALUES ($1, $2, 4, 'Text Channels', 0)
	`, catID, guildID); err != nil {
		return nil, err
	}

	// #general text channel
	generalID := s.idGen.Generate().Int64()
	if _, err := s.repo.db.Exec(ctx, `
		INSERT INTO channels (id, guild_id, type, name, position, parent_id)
		VALUES ($1, $2, 0, 'general', 0, $3)
	`, generalID, guildID, catID); err != nil {
		return nil, err
	}

	// Voice Channels category
	vCatID := s.idGen.Generate().Int64()
	if _, err := s.repo.db.Exec(ctx, `
		INSERT INTO channels (id, guild_id, type, name, position)
		VALUES ($1, $2, 4, 'Voice Channels', 1)
	`, vCatID, guildID); err != nil {
		return nil, err
	}

	// General voice channel
	voiceID := s.idGen.Generate().Int64()
	if _, err := s.repo.db.Exec(ctx, `
		INSERT INTO channels (id, guild_id, type, name, position, parent_id)
		VALUES ($1, $2, 2, 'General', 0, $3)
	`, voiceID, guildID, vCatID); err != nil {
		return nil, err
	}

	return []Channel{
		{ID: catID, GuildID: guildID, Type: 4, Name: "Text Channels", Position: 0},
		{ID: generalID, GuildID: guildID, Type: 0, Name: "general", Position: 0, ParentID: &catID},
		{ID: vCatID, GuildID: guildID, Type: 4, Name: "Voice Channels", Position: 1},
		{ID: voiceID, GuildID: guildID, Type: 2, Name: "General", Position: 0, ParentID: &vCatID},
	}, nil
}

// GetGuild retrieves a guild by ID (requires membership).
func (s *Service) GetGuild(ctx context.Context, guildID, userID int64) (*Guild, error) {
	isMember, err := s.repo.IsMember(ctx, userID, guildID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return nil, ErrNotFound
	}

	count, _ := s.repo.MemberCount(ctx, guildID)
	g.MemberCount = count
	return g, nil
}

// UpdateGuild updates guild settings (owner only).
func (s *Service) UpdateGuild(ctx context.Context, guildID, userID int64, req UpdateGuildRequest) (*Guild, error) {
	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return nil, ErrNotFound
	}
	if g.OwnerID != userID {
		// TODO: check MANAGE_GUILD permission instead of owner-only
		return nil, ErrNotOwner
	}

	return s.repo.UpdateGuild(ctx, guildID, req)
}

// DeleteGuild deletes a guild (owner only).
func (s *Service) DeleteGuild(ctx context.Context, guildID, userID int64) error {
	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return ErrNotFound
	}
	if g.OwnerID != userID {
		return ErrNotOwner
	}
	return s.repo.DeleteGuild(ctx, guildID)
}

// JoinGuild adds a user to a guild via invite code.
func (s *Service) JoinGuild(ctx context.Context, userID int64, inviteCode string) (*Guild, *Member, error) {
	valid, err := s.repo.IsInviteValid(ctx, inviteCode)
	if err != nil || !valid {
		return nil, nil, ErrInviteInvalid
	}

	inv, err := s.repo.GetInvite(ctx, inviteCode)
	if err != nil {
		return nil, nil, ErrInviteInvalid
	}

	banned, _ := s.repo.IsBanned(ctx, inv.GuildID, userID)
	if banned {
		return nil, nil, ErrBanned
	}

	already, _ := s.repo.IsMember(ctx, userID, inv.GuildID)
	if already {
		return nil, nil, ErrAlreadyMember
	}

	member, err := s.repo.AddMember(ctx, userID, inv.GuildID)
	if err != nil {
		return nil, nil, err
	}

	s.repo.UseInvite(ctx, inviteCode)

	g, err := s.repo.GetGuild(ctx, inv.GuildID)
	if err != nil {
		return nil, nil, err
	}

	return g, member, nil
}

// LeaveGuild removes a user from a guild.
func (s *Service) LeaveGuild(ctx context.Context, guildID, userID int64) error {
	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return ErrNotFound
	}
	if g.OwnerID == userID {
		return errors.New("owner cannot leave guild, transfer ownership or delete")
	}
	return s.repo.RemoveMember(ctx, userID, guildID)
}

// GetMembers returns the member list for a guild.
func (s *Service) GetMembers(ctx context.Context, guildID, userID int64, limit, offset int) ([]Member, error) {
	isMember, err := s.repo.IsMember(ctx, userID, guildID)
	if err != nil || !isMember {
		return nil, ErrNotMember
	}
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	return s.repo.GetMembers(ctx, guildID, limit, offset)
}

// GetUserGuilds returns all guilds a user is a member of.
func (s *Service) GetUserGuilds(ctx context.Context, userID int64) ([]Guild, error) {
	return s.repo.GetUserGuilds(ctx, userID)
}

// GetRoles returns all roles for a guild.
func (s *Service) GetRoles(ctx context.Context, guildID, userID int64) ([]Role, error) {
	isMember, err := s.repo.IsMember(ctx, userID, guildID)
	if err != nil || !isMember {
		return nil, ErrNotMember
	}
	return s.repo.GetRoles(ctx, guildID)
}

// CreateInvite creates a new invite for a channel.
func (s *Service) CreateInvite(ctx context.Context, guildID, channelID, userID int64, maxAge, maxUses int) (*Invite, error) {
	isMember, err := s.repo.IsMember(ctx, userID, guildID)
	if err != nil || !isMember {
		return nil, ErrNotMember
	}
	// TODO: check CREATE_INSTANT_INVITE permission
	if maxAge == 0 {
		maxAge = 86400 // default 24h
	}
	return s.repo.CreateInvite(ctx, guildID, channelID, userID, maxAge, maxUses)
}

// KickMember removes a member from the guild.
func (s *Service) KickMember(ctx context.Context, guildID, targetID, actorID int64) error {
	// TODO: check KICK_MEMBERS permission + role hierarchy
	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return ErrNotFound
	}
	if targetID == g.OwnerID {
		return errors.New("cannot kick the guild owner")
	}
	return s.repo.RemoveMember(ctx, targetID, guildID)
}

// BanMember bans a user from the guild.
func (s *Service) BanMember(ctx context.Context, guildID, targetID, actorID int64, reason *string) error {
	// TODO: check BAN_MEMBERS permission + role hierarchy
	g, err := s.repo.GetGuild(ctx, guildID)
	if err != nil {
		return ErrNotFound
	}
	if targetID == g.OwnerID {
		return errors.New("cannot ban the guild owner")
	}
	s.repo.RemoveMember(ctx, targetID, guildID)
	return s.repo.CreateBan(ctx, guildID, targetID, actorID, reason)
}
