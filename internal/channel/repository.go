package channel

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, id int64, guildID *int64, req CreateChannelRequest) (*Channel, error) {
	pos := 0
	if req.Position != nil {
		pos = *req.Position
	}

	var ch Channel
	err := r.db.QueryRow(ctx, `
		INSERT INTO channels (id, guild_id, type, name, topic, position, parent_id, nsfw)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, guild_id, type, name, topic, position, parent_id, nsfw,
		          rate_limit_per_user, bitrate, user_limit, last_message_id, created_at
	`, id, guildID, req.Type, req.Name, req.Topic, pos, req.ParentID, req.NSFW).Scan(
		&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
		&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
		&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
	)
	return &ch, err
}

func (r *Repository) Get(ctx context.Context, id int64) (*Channel, error) {
	var ch Channel
	err := r.db.QueryRow(ctx, `
		SELECT id, guild_id, type, name, topic, position, parent_id, nsfw,
		       rate_limit_per_user, bitrate, user_limit, last_message_id, created_at
		FROM channels WHERE id = $1
	`, id).Scan(
		&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
		&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
		&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	ch.PermissionOverwrites, _ = r.GetOverwrites(ctx, id)
	return &ch, nil
}

func (r *Repository) GetGuildChannels(ctx context.Context, guildID int64) ([]Channel, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, guild_id, type, name, topic, position, parent_id, nsfw,
		       rate_limit_per_user, bitrate, user_limit, last_message_id, created_at
		FROM channels WHERE guild_id = $1
		ORDER BY position, id
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []Channel
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(
			&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
			&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
			&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
		); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

func (r *Repository) Update(ctx context.Context, id int64, req UpdateChannelRequest) (*Channel, error) {
	var ch Channel
	err := r.db.QueryRow(ctx, `
		UPDATE channels SET
			name = COALESCE($2, name),
			topic = COALESCE($3, topic),
			position = COALESCE($4, position),
			parent_id = COALESCE($5, parent_id),
			nsfw = COALESCE($6, nsfw),
			rate_limit_per_user = COALESCE($7, rate_limit_per_user),
			bitrate = COALESCE($8, bitrate),
			user_limit = COALESCE($9, user_limit)
		WHERE id = $1
		RETURNING id, guild_id, type, name, topic, position, parent_id, nsfw,
		          rate_limit_per_user, bitrate, user_limit, last_message_id, created_at
	`, id, req.Name, req.Topic, req.Position, req.ParentID, req.NSFW, req.RateLimitPerUser, req.Bitrate, req.UserLimit).Scan(
		&ch.ID, &ch.GuildID, &ch.Type, &ch.Name, &ch.Topic, &ch.Position,
		&ch.ParentID, &ch.NSFW, &ch.RateLimitPerUser, &ch.Bitrate,
		&ch.UserLimit, &ch.LastMessageID, &ch.CreatedAt,
	)
	return &ch, err
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM channels WHERE id = $1`, id)
	return err
}

func (r *Repository) UpdateLastMessage(ctx context.Context, channelID, messageID int64) error {
	_, err := r.db.Exec(ctx, `UPDATE channels SET last_message_id = $2 WHERE id = $1`, channelID, messageID)
	return err
}

func (r *Repository) GetOverwrites(ctx context.Context, channelID int64) ([]Overwrite, error) {
	rows, err := r.db.Query(ctx, `
		SELECT target_id, target_type, allow, deny
		FROM channel_overwrites WHERE channel_id = $1
	`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var overwrites []Overwrite
	for rows.Next() {
		var ow Overwrite
		if err := rows.Scan(&ow.ID, &ow.Type, &ow.Allow, &ow.Deny); err != nil {
			return nil, err
		}
		overwrites = append(overwrites, ow)
	}
	return overwrites, nil
}

func (r *Repository) SetOverwrite(ctx context.Context, channelID, targetID int64, targetType int, allow, deny int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO channel_overwrites (channel_id, target_id, target_type, allow, deny)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (channel_id, target_id) DO UPDATE SET allow = $4, deny = $5
	`, channelID, targetID, targetType, allow, deny)
	return err
}

func (r *Repository) DeleteOverwrite(ctx context.Context, channelID, targetID int64) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM channel_overwrites WHERE channel_id = $1 AND target_id = $2
	`, channelID, targetID)
	return err
}
