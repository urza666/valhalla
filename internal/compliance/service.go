package compliance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrPolicyNotFound = errors.New("retention policy not found")
	ErrHoldNotFound   = errors.New("legal hold not found")
)

type RetentionPolicy struct {
	ID            int64     `json:"id,string"`
	GuildID       int64     `json:"guild_id,string"`
	ChannelID     *int64    `json:"channel_id,string"` // nil = guild-wide
	RetentionDays int       `json:"retention_days"`    // 0 = forever
	Enabled       bool      `json:"enabled"`
	CreatedBy     *int64    `json:"created_by,string"`
	CreatedAt     time.Time `json:"created_at"`
}

type LegalHold struct {
	ID          int64      `json:"id,string"`
	GuildID     int64      `json:"guild_id,string"`
	Name        string     `json:"name"`
	Description *string    `json:"description"`
	ChannelIDs  []int64    `json:"channel_ids"`
	UserIDs     []int64    `json:"user_ids"`
	StartDate   time.Time  `json:"start_date"`
	EndDate     *time.Time `json:"end_date"`
	Active      bool       `json:"active"`
	CreatedBy   int64      `json:"created_by,string"`
	CreatedAt   time.Time  `json:"created_at"`
}

type AuditExport struct {
	ID          int64      `json:"id,string"`
	GuildID     int64      `json:"guild_id,string"`
	RequestedBy int64     `json:"requested_by,string"`
	Status      string     `json:"status"` // pending, processing, completed, failed
	Filters     any        `json:"filters"`
	FileURL     *string    `json:"file_url"`
	FileSize    *int64     `json:"file_size"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// --- Retention Policies ---

func (s *Service) CreateRetentionPolicy(ctx context.Context, guildID int64, channelID *int64, retentionDays int, userID int64) (*RetentionPolicy, error) {
	id := s.idGen.Generate().Int64()
	var p RetentionPolicy
	err := s.db.QueryRow(ctx, `
		INSERT INTO retention_policies (id, guild_id, channel_id, retention_days, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, guild_id, channel_id, retention_days, enabled, created_by, created_at
	`, id, guildID, channelID, retentionDays, userID).Scan(
		&p.ID, &p.GuildID, &p.ChannelID, &p.RetentionDays, &p.Enabled, &p.CreatedBy, &p.CreatedAt,
	)
	return &p, err
}

func (s *Service) GetRetentionPolicies(ctx context.Context, guildID int64) ([]RetentionPolicy, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, guild_id, channel_id, retention_days, enabled, created_by, created_at
		FROM retention_policies WHERE guild_id = $1 ORDER BY created_at
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []RetentionPolicy
	for rows.Next() {
		var p RetentionPolicy
		rows.Scan(&p.ID, &p.GuildID, &p.ChannelID, &p.RetentionDays, &p.Enabled, &p.CreatedBy, &p.CreatedAt)
		policies = append(policies, p)
	}
	return policies, nil
}

// IsMessageUnderHold checks if a message is protected by a legal hold.
func (s *Service) IsMessageUnderHold(ctx context.Context, guildID, channelID, authorID int64, messageTime time.Time) (bool, error) {
	var held bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM legal_holds
			WHERE guild_id = $1 AND active = true
			AND (channel_ids IS NULL OR $2 = ANY(channel_ids))
			AND (user_ids IS NULL OR $3 = ANY(user_ids))
			AND start_date <= $4
			AND (end_date IS NULL OR end_date >= $4)
		)
	`, guildID, channelID, authorID, messageTime).Scan(&held)
	return held, err
}

// --- Legal Holds ---

func (s *Service) CreateLegalHold(ctx context.Context, guildID, userID int64, name string, description *string, channelIDs, userIDs []int64, startDate time.Time, endDate *time.Time) (*LegalHold, error) {
	id := s.idGen.Generate().Int64()
	var h LegalHold
	err := s.db.QueryRow(ctx, `
		INSERT INTO legal_holds (id, guild_id, name, description, channel_ids, user_ids, start_date, end_date, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, guild_id, name, description, channel_ids, user_ids, start_date, end_date, active, created_by, created_at
	`, id, guildID, name, description, channelIDs, userIDs, startDate, endDate, userID).Scan(
		&h.ID, &h.GuildID, &h.Name, &h.Description, &h.ChannelIDs, &h.UserIDs,
		&h.StartDate, &h.EndDate, &h.Active, &h.CreatedBy, &h.CreatedAt,
	)
	return &h, err
}

func (s *Service) GetLegalHolds(ctx context.Context, guildID int64) ([]LegalHold, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, guild_id, name, description, channel_ids, user_ids, start_date, end_date, active, created_by, created_at
		FROM legal_holds WHERE guild_id = $1 ORDER BY created_at DESC
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holds []LegalHold
	for rows.Next() {
		var h LegalHold
		rows.Scan(&h.ID, &h.GuildID, &h.Name, &h.Description, &h.ChannelIDs, &h.UserIDs,
			&h.StartDate, &h.EndDate, &h.Active, &h.CreatedBy, &h.CreatedAt)
		holds = append(holds, h)
	}
	return holds, nil
}

func (s *Service) ReleaseLegalHold(ctx context.Context, holdID int64) error {
	_, err := s.db.Exec(ctx, `UPDATE legal_holds SET active = false WHERE id = $1`, holdID)
	return err
}

// --- Audit Exports ---

func (s *Service) RequestExport(ctx context.Context, guildID, userID int64, filters any) (*AuditExport, error) {
	id := s.idGen.Generate().Int64()
	var e AuditExport
	err := s.db.QueryRow(ctx, `
		INSERT INTO audit_exports (id, guild_id, requested_by, filters)
		VALUES ($1, $2, $3, $4)
		RETURNING id, guild_id, requested_by, status, filters, file_url, file_size, started_at, completed_at, created_at
	`, id, guildID, userID, filters).Scan(
		&e.ID, &e.GuildID, &e.RequestedBy, &e.Status, &e.Filters,
		&e.FileURL, &e.FileSize, &e.StartedAt, &e.CompletedAt, &e.CreatedAt,
	)
	return &e, err
}

func (s *Service) GetExports(ctx context.Context, guildID int64) ([]AuditExport, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, guild_id, requested_by, status, filters, file_url, file_size, started_at, completed_at, created_at
		FROM audit_exports WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 50
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exports []AuditExport
	for rows.Next() {
		var e AuditExport
		rows.Scan(&e.ID, &e.GuildID, &e.RequestedBy, &e.Status, &e.Filters,
			&e.FileURL, &e.FileSize, &e.StartedAt, &e.CompletedAt, &e.CreatedAt)
		exports = append(exports, e)
	}
	return exports, nil
}

// EnforceRetention deletes messages older than the retention policy. Called by a cron/worker.
func (s *Service) EnforceRetention(ctx context.Context) (int64, error) {
	result, err := s.db.Exec(ctx, `
		DELETE FROM messages m
		USING channels c, retention_policies rp
		WHERE m.channel_id = c.id
		AND c.guild_id = rp.guild_id
		AND (rp.channel_id IS NULL OR rp.channel_id = c.id)
		AND rp.enabled = true
		AND rp.retention_days > 0
		AND m.created_at < NOW() - (rp.retention_days || ' days')::interval
		AND NOT EXISTS (
			SELECT 1 FROM legal_holds lh
			WHERE lh.guild_id = c.guild_id AND lh.active = true
			AND (lh.channel_ids IS NULL OR c.id = ANY(lh.channel_ids))
			AND lh.start_date <= m.created_at
			AND (lh.end_date IS NULL OR lh.end_date >= m.created_at)
		)
	`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
