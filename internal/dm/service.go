package dm

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/internal/channel"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

// Service manages direct message channels.
type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// GetOrCreateDM finds an existing DM channel between two users or creates one.
func (s *Service) GetOrCreateDM(ctx context.Context, userID, targetID int64) (*channel.Channel, error) {
	// Check if DM already exists
	var ch channel.Channel
	err := s.db.QueryRow(ctx, `
		SELECT c.id, c.guild_id, c.type, c.name, c.topic, c.position,
		       c.parent_id, c.nsfw, c.rate_limit_per_user, c.bitrate,
		       c.user_limit, c.last_message_id, c.created_at
		FROM channels c
		INNER JOIN dm_participants p1 ON p1.channel_id = c.id AND p1.user_id = $1
		INNER JOIN dm_participants p2 ON p2.channel_id = c.id AND p2.user_id = $2
		WHERE c.type = 1
		LIMIT 1
	`, userID, targetID).Scan(
		&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
		&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
		&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
	)
	if err == nil {
		return &ch, nil
	}

	// Create new DM channel
	channelID := s.idGen.Generate().Int64()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO channels (id, type) VALUES ($1, 1)
		RETURNING id, guild_id, type, name, topic, position,
		          parent_id, nsfw, rate_limit_per_user, bitrate,
		          user_limit, last_message_id, created_at
	`, channelID).Scan(
		&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
		&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
		&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Add both participants
	if _, err := tx.Exec(ctx, `
		INSERT INTO dm_participants (channel_id, user_id) VALUES ($1, $2), ($1, $3)
	`, channelID, userID, targetID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &ch, nil
}

// GetUserDMs returns all DM channels for a user with participant info.
func (s *Service) GetUserDMs(ctx context.Context, userID int64) ([]DMChannel, error) {
	rows, err := s.db.Query(ctx, `
		SELECT c.id, c.type, c.last_message_id, c.created_at,
		       u.id, u.username, u.display_name, u.avatar_hash
		FROM channels c
		INNER JOIN dm_participants p1 ON p1.channel_id = c.id AND p1.user_id = $1
		INNER JOIN dm_participants p2 ON p2.channel_id = c.id AND p2.user_id != $1
		INNER JOIN users u ON u.id = p2.user_id
		WHERE c.type = 1
		ORDER BY COALESCE(c.last_message_id, c.id) DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dms []DMChannel
	for rows.Next() {
		var dm DMChannel
		if err := rows.Scan(
			&dm.ID, &dm.Type, &dm.LastMessageID, &dm.CreatedAt,
			&dm.Recipient.ID, &dm.Recipient.Username,
			&dm.Recipient.DisplayName, &dm.Recipient.AvatarHash,
		); err != nil {
			return nil, err
		}
		dms = append(dms, dm)
	}
	return dms, nil
}

// CanAccessDM checks if a user is a participant of a DM channel.
func (s *Service) CanAccessDM(ctx context.Context, channelID, userID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dm_participants WHERE channel_id = $1 AND user_id = $2
		)
	`, channelID, userID).Scan(&exists)
	return exists, err
}

// CloseDM removes a user from a DM (hides it from their list, doesn't delete messages).
func (s *Service) CloseDM(ctx context.Context, channelID, userID int64) error {
	// In Discord, closing a DM just hides it — it reappears when a new message arrives.
	// For MVP, we'll just remove the participant entry.
	_, err := s.db.Exec(ctx, `
		DELETE FROM dm_participants WHERE channel_id = $1 AND user_id = $2
	`, channelID, userID)
	return err
}
