package poll

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var ErrPollNotFound = errors.New("poll not found")
var ErrAlreadyVoted = errors.New("already voted for this option")
var ErrPollExpired  = errors.New("poll has expired")

type Poll struct {
	ID              int64       `json:"id,string"`
	MessageID       int64       `json:"message_id,string"`
	ChannelID       int64       `json:"channel_id,string"`
	Question        string      `json:"question"`
	AllowMultiselect bool       `json:"allow_multiselect"`
	ExpiresAt       *time.Time  `json:"expires_at"`
	CreatedBy       int64       `json:"created_by,string"`
	CreatedAt       time.Time   `json:"created_at"`
	Options         []Option    `json:"options"`
	TotalVotes      int         `json:"total_votes"`
}

type Option struct {
	ID       int64   `json:"id,string"`
	PollID   int64   `json:"poll_id,string"`
	Text     string  `json:"text"`
	Emoji    *string `json:"emoji"`
	Position int     `json:"position"`
	Votes    int     `json:"votes"`
	Voted    bool    `json:"voted"` // whether the requesting user voted for this
}

type CreatePollRequest struct {
	Question         string   `json:"question"`
	Options          []string `json:"options"`
	AllowMultiselect bool     `json:"allow_multiselect"`
	DurationHours    int      `json:"duration_hours"` // 0 = no expiry
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

func (s *Service) CreatePoll(ctx context.Context, messageID, channelID, userID int64, req CreatePollRequest) (*Poll, error) {
	pollID := s.idGen.Generate().Int64()

	var expiresAt *time.Time
	if req.DurationHours > 0 {
		t := time.Now().Add(time.Duration(req.DurationHours) * time.Hour)
		expiresAt = &t
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var p Poll
	err = tx.QueryRow(ctx, `
		INSERT INTO polls (id, message_id, channel_id, question, allow_multiselect, expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, message_id, channel_id, question, allow_multiselect, expires_at, created_by, created_at
	`, pollID, messageID, channelID, req.Question, req.AllowMultiselect, expiresAt, userID).Scan(
		&p.ID, &p.MessageID, &p.ChannelID, &p.Question, &p.AllowMultiselect,
		&p.ExpiresAt, &p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	for i, text := range req.Options {
		optID := s.idGen.Generate().Int64()
		tx.Exec(ctx, `
			INSERT INTO poll_options (id, poll_id, text, position) VALUES ($1, $2, $3, $4)
		`, optID, pollID, text, i)
		p.Options = append(p.Options, Option{
			ID: optID, PollID: pollID, Text: text, Position: i,
		})
	}

	return &p, tx.Commit(ctx)
}

func (s *Service) GetPoll(ctx context.Context, pollID, viewerID int64) (*Poll, error) {
	var p Poll
	err := s.db.QueryRow(ctx, `
		SELECT id, message_id, channel_id, question, allow_multiselect, expires_at, created_by, created_at
		FROM polls WHERE id = $1
	`, pollID).Scan(
		&p.ID, &p.MessageID, &p.ChannelID, &p.Question, &p.AllowMultiselect,
		&p.ExpiresAt, &p.CreatedBy, &p.CreatedAt,
	)
	if err != nil {
		return nil, ErrPollNotFound
	}

	// Load options with vote counts and viewer's votes
	rows, err := s.db.Query(ctx, `
		SELECT o.id, o.poll_id, o.text, o.emoji, o.position,
		       COUNT(v.user_id) as votes,
		       BOOL_OR(v.user_id = $2) as voted
		FROM poll_options o
		LEFT JOIN poll_votes v ON v.option_id = o.id
		WHERE o.poll_id = $1
		GROUP BY o.id
		ORDER BY o.position
	`, pollID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var o Option
		rows.Scan(&o.ID, &o.PollID, &o.Text, &o.Emoji, &o.Position, &o.Votes, &o.Voted)
		p.TotalVotes += o.Votes
		p.Options = append(p.Options, o)
	}

	return &p, nil
}

func (s *Service) Vote(ctx context.Context, pollID, optionID, userID int64) error {
	// Check expiry
	var expiresAt *time.Time
	var allowMulti bool
	err := s.db.QueryRow(ctx, `SELECT expires_at, allow_multiselect FROM polls WHERE id = $1`, pollID).Scan(&expiresAt, &allowMulti)
	if err != nil {
		return ErrPollNotFound
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		return ErrPollExpired
	}

	// If not multiselect, remove existing vote first
	if !allowMulti {
		s.db.Exec(ctx, `DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, pollID, userID)
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, pollID, optionID, userID)
	return err
}

func (s *Service) Unvote(ctx context.Context, pollID, optionID, userID int64) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM poll_votes WHERE poll_id = $1 AND option_id = $2 AND user_id = $3
	`, pollID, optionID, userID)
	return err
}

func (s *Service) GetPollByMessage(ctx context.Context, messageID, viewerID int64) (*Poll, error) {
	var pollID int64
	err := s.db.QueryRow(ctx, `SELECT id FROM polls WHERE message_id = $1`, messageID).Scan(&pollID)
	if err != nil {
		return nil, ErrPollNotFound
	}
	return s.GetPoll(ctx, pollID, viewerID)
}
