package thread

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrInvalidName = errors.New("thread name must be 1-100 characters")
	ErrNotFound    = errors.New("thread not found")
)

// Thread is a channel of type 11 (public thread) or 12 (private thread).
type Thread struct {
	ID              int64     `json:"id,string"`
	GuildID         *int64    `json:"guild_id,string"`
	ParentID        int64     `json:"parent_id,string"`
	OwnerID         int64     `json:"owner_id,string"`
	Type            int       `json:"type"` // 11 = public, 12 = private
	Name            string    `json:"name"`
	LastMessageID   *int64    `json:"last_message_id,string"`
	MessageCount    int       `json:"message_count"`
	Archived        bool      `json:"thread_metadata_archived"`
	Locked          bool      `json:"thread_metadata_locked"`
	AutoArchive     int       `json:"auto_archive_duration"` // minutes
	CreatedAt       time.Time `json:"created_at"`
}

type CreateThreadRequest struct {
	Name          string `json:"name"`
	AutoArchive   int    `json:"auto_archive_duration"` // 60, 1440, 4320, 10080
	Type          int    `json:"type,omitempty"`         // 11 or 12, default 11
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// CreateThread creates a new thread from a message or channel.
func (s *Service) CreateThread(ctx context.Context, parentChannelID, guildID, ownerID int64, req CreateThreadRequest) (*Thread, error) {
	if len(req.Name) < 1 || len(req.Name) > 100 {
		return nil, ErrInvalidName
	}

	threadType := req.Type
	if threadType == 0 {
		threadType = 11 // public thread
	}

	autoArchive := req.AutoArchive
	if autoArchive == 0 {
		autoArchive = 1440 // 24h default
	}

	threadID := s.idGen.Generate().Int64()

	var t Thread
	err := s.db.QueryRow(ctx, `
		INSERT INTO channels (id, guild_id, type, name, parent_id, owner_id, thread_auto_archive)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, guild_id, type, name, parent_id, owner_id, last_message_id,
		          thread_archived, thread_locked, thread_auto_archive, created_at
	`, threadID, guildID, threadType, req.Name, parentChannelID, ownerID, autoArchive).Scan(
		&t.ID, &t.GuildID, &t.Type, &t.Name, &t.ParentID, &t.OwnerID,
		&t.LastMessageID, &t.Archived, &t.Locked, &t.AutoArchive, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &t, nil
}

// GetThread retrieves a thread by ID.
func (s *Service) GetThread(ctx context.Context, threadID int64) (*Thread, error) {
	var t Thread
	err := s.db.QueryRow(ctx, `
		SELECT id, guild_id, type, name, parent_id, owner_id, last_message_id,
		       thread_archived, thread_locked, thread_auto_archive, created_at
		FROM channels WHERE id = $1 AND type IN (11, 12)
	`, threadID).Scan(
		&t.ID, &t.GuildID, &t.Type, &t.Name, &t.ParentID, &t.OwnerID,
		&t.LastMessageID, &t.Archived, &t.Locked, &t.AutoArchive, &t.CreatedAt,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	// Get message count
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM messages WHERE channel_id = $1`, threadID).Scan(&t.MessageCount)

	return &t, nil
}

// GetActiveThreads returns all active (non-archived) threads in a channel.
func (s *Service) GetActiveThreads(ctx context.Context, parentChannelID int64) ([]Thread, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, guild_id, type, name, parent_id, owner_id, last_message_id,
		       thread_archived, thread_locked, thread_auto_archive, created_at
		FROM channels
		WHERE parent_id = $1 AND type IN (11, 12) AND thread_archived = false
		ORDER BY COALESCE(last_message_id, id) DESC
	`, parentChannelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var threads []Thread
	for rows.Next() {
		var t Thread
		if err := rows.Scan(
			&t.ID, &t.GuildID, &t.Type, &t.Name, &t.ParentID, &t.OwnerID,
			&t.LastMessageID, &t.Archived, &t.Locked, &t.AutoArchive, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		threads = append(threads, t)
	}
	return threads, nil
}

// ArchiveThread sets a thread as archived.
func (s *Service) ArchiveThread(ctx context.Context, threadID int64) error {
	_, err := s.db.Exec(ctx, `
		UPDATE channels SET thread_archived = true WHERE id = $1 AND type IN (11, 12)
	`, threadID)
	return err
}

// UnarchiveThread unarchives a thread.
func (s *Service) UnarchiveThread(ctx context.Context, threadID int64) error {
	_, err := s.db.Exec(ctx, `
		UPDATE channels SET thread_archived = false WHERE id = $1 AND type IN (11, 12)
	`, threadID)
	return err
}
