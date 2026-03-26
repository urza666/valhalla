package notification

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ReadState represents a user's read position in a channel.
type ReadState struct {
	ChannelID    int64 `json:"channel_id,string"`
	LastMessageID int64 `json:"last_message_id,string"`
	MentionCount int   `json:"mention_count"`
}

// Service manages unread states and notification preferences.
type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// GetReadStates returns all read states for a user.
func (s *Service) GetReadStates(ctx context.Context, userID int64) ([]ReadState, error) {
	rows, err := s.db.Query(ctx, `
		SELECT channel_id, last_message_id, mention_count
		FROM read_states WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var states []ReadState
	for rows.Next() {
		var rs ReadState
		if err := rows.Scan(&rs.ChannelID, &rs.LastMessageID, &rs.MentionCount); err != nil {
			return nil, err
		}
		states = append(states, rs)
	}
	return states, nil
}

// Ack marks a message as read for a user, resetting mention count.
func (s *Service) Ack(ctx context.Context, userID, channelID, messageID int64) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO read_states (user_id, channel_id, last_message_id, mention_count)
		VALUES ($1, $2, $3, 0)
		ON CONFLICT (user_id, channel_id) DO UPDATE
		SET last_message_id = GREATEST(read_states.last_message_id, $3),
		    mention_count = 0
	`, userID, channelID, messageID)
	return err
}

// IncrementMentions increments the mention counter for users mentioned in a message.
func (s *Service) IncrementMentions(ctx context.Context, channelID int64, mentionedUserIDs []int64) error {
	if len(mentionedUserIDs) == 0 {
		return nil
	}

	for _, userID := range mentionedUserIDs {
		_, err := s.db.Exec(ctx, `
			INSERT INTO read_states (user_id, channel_id, last_message_id, mention_count)
			VALUES ($1, $2, 0, 1)
			ON CONFLICT (user_id, channel_id) DO UPDATE
			SET mention_count = read_states.mention_count + 1
		`, userID, channelID)
		if err != nil {
			return err
		}
	}
	return nil
}

// IsUnread checks if a channel has unread messages for a user.
func (s *Service) IsUnread(ctx context.Context, userID, channelID, lastChannelMessageID int64) (bool, int, error) {
	var rs ReadState
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(last_message_id, 0), COALESCE(mention_count, 0)
		FROM read_states WHERE user_id = $1 AND channel_id = $2
	`, userID, channelID).Scan(&rs.LastMessageID, &rs.MentionCount)
	if err != nil {
		// No read state = everything is unread (if there are messages)
		return lastChannelMessageID > 0, 0, nil
	}
	return rs.LastMessageID < lastChannelMessageID, rs.MentionCount, nil
}
