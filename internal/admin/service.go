package admin

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotPlatformAdmin = errors.New("not a platform admin")
)

type PlatformStats struct {
	TotalUsers    int   `json:"total_users"`
	TotalGuilds   int   `json:"total_guilds"`
	TotalChannels int   `json:"total_channels"`
	TotalMessages int64 `json:"total_messages"`
	OnlineUsers   int   `json:"online_users"` // placeholder, would come from presence service
}

type GuildStats struct {
	GuildID       int64  `json:"guild_id,string"`
	Name          string `json:"name"`
	OwnerID       int64  `json:"owner_id,string"`
	MemberCount   int    `json:"member_count"`
	ChannelCount  int    `json:"channel_count"`
	MessageCount  int64  `json:"message_count"`
	CreatedAt     time.Time `json:"created_at"`
}

type UsageSnapshot struct {
	Date          string `json:"date"`
	GuildID       int64  `json:"guild_id,string"`
	TotalMembers  int    `json:"total_members"`
	ActiveMembers int    `json:"active_members"`
	MessagesSent  int    `json:"messages_sent"`
	VoiceMinutes  int    `json:"voice_minutes"`
	FilesUploaded int    `json:"files_uploaded"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// IsPlatformAdmin checks if a user is a platform admin.
func (s *Service) IsPlatformAdmin(ctx context.Context, userID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id = $1)
	`, userID).Scan(&exists)
	return exists, err
}

// GetPlatformStats returns platform-wide statistics.
func (s *Service) GetPlatformStats(ctx context.Context) (*PlatformStats, error) {
	var stats PlatformStats

	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM guilds`).Scan(&stats.TotalGuilds)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM channels WHERE guild_id IS NOT NULL`).Scan(&stats.TotalChannels)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&stats.TotalMessages)

	return &stats, nil
}

// GetTopGuilds returns the largest guilds by member count.
func (s *Service) GetTopGuilds(ctx context.Context, limit int) ([]GuildStats, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	rows, err := s.db.Query(ctx, `
		SELECT g.id, g.name, g.owner_id, g.created_at,
		       (SELECT COUNT(*) FROM members m WHERE m.guild_id = g.id) as member_count,
		       (SELECT COUNT(*) FROM channels c WHERE c.guild_id = g.id) as channel_count,
		       (SELECT COUNT(*) FROM messages msg
		        INNER JOIN channels ch ON ch.id = msg.channel_id
		        WHERE ch.guild_id = g.id) as message_count
		FROM guilds g
		ORDER BY member_count DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var guilds []GuildStats
	for rows.Next() {
		var g GuildStats
		rows.Scan(&g.GuildID, &g.Name, &g.OwnerID, &g.CreatedAt,
			&g.MemberCount, &g.ChannelCount, &g.MessageCount)
		guilds = append(guilds, g)
	}
	return guilds, nil
}

// GetGuildUsageHistory returns daily usage snapshots for a guild.
func (s *Service) GetGuildUsageHistory(ctx context.Context, guildID int64, days int) ([]UsageSnapshot, error) {
	if days <= 0 || days > 365 {
		days = 30
	}

	rows, err := s.db.Query(ctx, `
		SELECT date::text, guild_id, total_members, active_members, messages_sent, voice_minutes, files_uploaded
		FROM usage_stats
		WHERE guild_id = $1 AND date >= CURRENT_DATE - ($2 || ' days')::interval
		ORDER BY date DESC
	`, guildID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []UsageSnapshot
	for rows.Next() {
		var s UsageSnapshot
		rows.Scan(&s.Date, &s.GuildID, &s.TotalMembers, &s.ActiveMembers,
			&s.MessagesSent, &s.VoiceMinutes, &s.FilesUploaded)
		snapshots = append(snapshots, s)
	}
	return snapshots, nil
}

// RecordDailyStats snapshots today's stats for a guild. Called by a daily cron.
func (s *Service) RecordDailyStats(ctx context.Context, guildID int64) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO usage_stats (date, guild_id, total_members, active_members, messages_sent)
		VALUES (
			CURRENT_DATE, $1,
			(SELECT COUNT(*) FROM members WHERE guild_id = $1),
			(SELECT COUNT(DISTINCT author_id) FROM messages m
			 INNER JOIN channels c ON c.id = m.channel_id
			 WHERE c.guild_id = $1 AND m.created_at >= CURRENT_DATE),
			(SELECT COUNT(*) FROM messages m
			 INNER JOIN channels c ON c.id = m.channel_id
			 WHERE c.guild_id = $1 AND m.created_at >= CURRENT_DATE)
		)
		ON CONFLICT (date, guild_id) DO UPDATE SET
			total_members = EXCLUDED.total_members,
			active_members = EXCLUDED.active_members,
			messages_sent = EXCLUDED.messages_sent
	`, guildID)
	return err
}

// GrantAdmin grants platform admin to a user.
func (s *Service) GrantAdmin(ctx context.Context, userID, grantedBy int64, role string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO platform_admins (user_id, role, granted_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET role = $2
	`, userID, role, grantedBy)
	return err
}

// RevokeAdmin removes platform admin from a user.
func (s *Service) RevokeAdmin(ctx context.Context, userID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM platform_admins WHERE user_id = $1`, userID)
	return err
}
