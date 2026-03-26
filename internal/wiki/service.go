package wiki

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var ErrPageNotFound = errors.New("wiki page not found")

type Page struct {
	ID           int64     `json:"id,string"`
	ChannelID    *int64    `json:"channel_id,string"`
	GuildID      int64     `json:"guild_id,string"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	ParentID     *int64    `json:"parent_id,string"`
	Position     int       `json:"position"`
	CreatedBy    int64     `json:"created_by,string"`
	LastEditedBy *int64    `json:"last_edited_by,string"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Revision struct {
	ID        int64     `json:"id,string"`
	PageID    int64     `json:"page_id,string"`
	Content   string    `json:"content"`
	EditedBy  int64     `json:"edited_by,string"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

func (s *Service) CreatePage(ctx context.Context, guildID int64, channelID *int64, userID int64, title, content string, parentID *int64) (*Page, error) {
	id := s.idGen.Generate().Int64()
	var p Page
	err := s.db.QueryRow(ctx, `
		INSERT INTO wiki_pages (id, guild_id, channel_id, title, content, parent_id, created_by, last_edited_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
		RETURNING id, channel_id, guild_id, title, content, parent_id, position, created_by, last_edited_by, created_at, updated_at
	`, id, guildID, channelID, title, content, parentID, userID).Scan(
		&p.ID, &p.ChannelID, &p.GuildID, &p.Title, &p.Content, &p.ParentID,
		&p.Position, &p.CreatedBy, &p.LastEditedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Save initial revision
	revID := s.idGen.Generate().Int64()
	s.db.Exec(ctx, `INSERT INTO wiki_revisions (id, page_id, content, edited_by) VALUES ($1, $2, $3, $4)`,
		revID, id, content, userID)

	return &p, nil
}

func (s *Service) GetPage(ctx context.Context, pageID int64) (*Page, error) {
	var p Page
	err := s.db.QueryRow(ctx, `
		SELECT id, channel_id, guild_id, title, content, parent_id, position, created_by, last_edited_by, created_at, updated_at
		FROM wiki_pages WHERE id = $1
	`, pageID).Scan(
		&p.ID, &p.ChannelID, &p.GuildID, &p.Title, &p.Content, &p.ParentID,
		&p.Position, &p.CreatedBy, &p.LastEditedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, ErrPageNotFound
	}
	return &p, nil
}

func (s *Service) UpdatePage(ctx context.Context, pageID, userID int64, title, content *string) (*Page, error) {
	if title != nil {
		s.db.Exec(ctx, `UPDATE wiki_pages SET title = $2, last_edited_by = $3 WHERE id = $1`, pageID, *title, userID)
	}
	if content != nil {
		s.db.Exec(ctx, `UPDATE wiki_pages SET content = $2, last_edited_by = $3 WHERE id = $1`, pageID, *content, userID)

		// Save revision
		revID := s.idGen.Generate().Int64()
		s.db.Exec(ctx, `INSERT INTO wiki_revisions (id, page_id, content, edited_by) VALUES ($1, $2, $3, $4)`,
			revID, pageID, *content, userID)
	}
	return s.GetPage(ctx, pageID)
}

func (s *Service) GetGuildPages(ctx context.Context, guildID int64) ([]Page, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, channel_id, guild_id, title, '', parent_id, position, created_by, last_edited_by, created_at, updated_at
		FROM wiki_pages WHERE guild_id = $1 ORDER BY position, title
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []Page
	for rows.Next() {
		var p Page
		rows.Scan(&p.ID, &p.ChannelID, &p.GuildID, &p.Title, &p.Content, &p.ParentID,
			&p.Position, &p.CreatedBy, &p.LastEditedBy, &p.CreatedAt, &p.UpdatedAt)
		pages = append(pages, p)
	}
	return pages, nil
}

func (s *Service) GetRevisions(ctx context.Context, pageID int64, limit int) ([]Revision, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		SELECT id, page_id, content, edited_by, created_at
		FROM wiki_revisions WHERE page_id = $1 ORDER BY created_at DESC LIMIT $2
	`, pageID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var revisions []Revision
	for rows.Next() {
		var r Revision
		rows.Scan(&r.ID, &r.PageID, &r.Content, &r.EditedBy, &r.CreatedAt)
		revisions = append(revisions, r)
	}
	return revisions, nil
}

func (s *Service) DeletePage(ctx context.Context, pageID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM wiki_pages WHERE id = $1`, pageID)
	return err
}
