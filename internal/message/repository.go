package message

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

func (r *Repository) Create(ctx context.Context, id, channelID, authorID int64, req CreateMessageRequest) (*Message, error) {
	msgType := TypeDefault
	if req.ReferenceID != nil {
		msgType = TypeReply
	}

	var msg Message
	msg.Author = &Author{}
	err := r.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO messages (id, channel_id, author_id, content, tts, type, reference_id, nonce)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, channel_id, author_id, content, edited_at, tts,
			          mention_everyone, pinned, type, flags, reference_id, nonce, created_at
		)
		SELECT i.id, i.channel_id, i.content, i.edited_at, i.tts,
		       i.mention_everyone, i.pinned, i.type, i.flags, i.reference_id, i.nonce, i.created_at,
		       u.id, u.username, u.display_name, u.avatar_hash
		FROM inserted i
		INNER JOIN users u ON u.id = i.author_id
	`, id, channelID, authorID, req.Content, req.TTS, msgType, req.ReferenceID, req.Nonce).Scan(
		&msg.ID, &msg.ChannelID, &msg.Content, &msg.EditedAt, &msg.TTS,
		&msg.MentionEveryone, &msg.Pinned, &msg.Type, &msg.Flags,
		&msg.ReferenceID, &msg.Nonce, &msg.CreatedAt,
		&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarHash,
	)
	return &msg, err
}

func (r *Repository) Get(ctx context.Context, id int64) (*Message, error) {
	var msg Message
	msg.Author = &Author{}
	err := r.db.QueryRow(ctx, `
		SELECT m.id, m.channel_id, m.content, m.edited_at, m.tts,
		       m.mention_everyone, m.pinned, m.type, m.flags, m.reference_id, m.created_at,
		       u.id, u.username, u.display_name, u.avatar_hash
		FROM messages m
		INNER JOIN users u ON u.id = m.author_id
		WHERE m.id = $1
	`, id).Scan(
		&msg.ID, &msg.ChannelID, &msg.Content, &msg.EditedAt, &msg.TTS,
		&msg.MentionEveryone, &msg.Pinned, &msg.Type, &msg.Flags,
		&msg.ReferenceID, &msg.CreatedAt,
		&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarHash,
	)
	return &msg, err
}

func (r *Repository) GetMessages(ctx context.Context, channelID int64, q MessagesQuery) ([]Message, error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 50
	}

	var query string
	var args []any

	if q.Before > 0 {
		query = `
			SELECT m.id, m.channel_id, m.content, m.edited_at, m.tts,
			       m.mention_everyone, m.pinned, m.type, m.flags, m.reference_id, m.created_at,
			       u.id, u.username, u.display_name, u.avatar_hash
			FROM messages m
			INNER JOIN users u ON u.id = m.author_id
			WHERE m.channel_id = $1 AND m.id < $2
			ORDER BY m.id DESC
			LIMIT $3
		`
		args = []any{channelID, q.Before, q.Limit}
	} else if q.After > 0 {
		query = `
			SELECT m.id, m.channel_id, m.content, m.edited_at, m.tts,
			       m.mention_everyone, m.pinned, m.type, m.flags, m.reference_id, m.created_at,
			       u.id, u.username, u.display_name, u.avatar_hash
			FROM messages m
			INNER JOIN users u ON u.id = m.author_id
			WHERE m.channel_id = $1 AND m.id > $2
			ORDER BY m.id ASC
			LIMIT $3
		`
		args = []any{channelID, q.After, q.Limit}
	} else {
		query = `
			SELECT m.id, m.channel_id, m.content, m.edited_at, m.tts,
			       m.mention_everyone, m.pinned, m.type, m.flags, m.reference_id, m.created_at,
			       u.id, u.username, u.display_name, u.avatar_hash
			FROM messages m
			INNER JOIN users u ON u.id = m.author_id
			WHERE m.channel_id = $1
			ORDER BY m.id DESC
			LIMIT $2
		`
		args = []any{channelID, q.Limit}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		msg.Author = &Author{}
		if err := rows.Scan(
			&msg.ID, &msg.ChannelID, &msg.Content, &msg.EditedAt, &msg.TTS,
			&msg.MentionEveryone, &msg.Pinned, &msg.Type, &msg.Flags,
			&msg.ReferenceID, &msg.CreatedAt,
			&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarHash,
		); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

func (r *Repository) Update(ctx context.Context, id int64, content string) (*Message, error) {
	var msg Message
	msg.Author = &Author{}
	err := r.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE messages SET content = $2, edited_at = NOW()
			WHERE id = $1
			RETURNING id, channel_id, author_id, content, edited_at, tts,
			          mention_everyone, pinned, type, flags, reference_id, created_at
		)
		SELECT u2.id, u2.channel_id, u2.content, u2.edited_at, u2.tts,
		       u2.mention_everyone, u2.pinned, u2.type, u2.flags, u2.reference_id, u2.created_at,
		       usr.id, usr.username, usr.display_name, usr.avatar_hash
		FROM updated u2
		INNER JOIN users usr ON usr.id = u2.author_id
	`, id, content).Scan(
		&msg.ID, &msg.ChannelID, &msg.Content, &msg.EditedAt, &msg.TTS,
		&msg.MentionEveryone, &msg.Pinned, &msg.Type, &msg.Flags,
		&msg.ReferenceID, &msg.CreatedAt,
		&msg.Author.ID, &msg.Author.Username, &msg.Author.DisplayName, &msg.Author.AvatarHash,
	)
	return &msg, err
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM messages WHERE id = $1`, id)
	return err
}

func (r *Repository) GetAuthorID(ctx context.Context, id int64) (int64, error) {
	var authorID int64
	err := r.db.QueryRow(ctx, `SELECT author_id FROM messages WHERE id = $1`, id).Scan(&authorID)
	return authorID, err
}

// --- Reactions ---

func (r *Repository) AddReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, messageID, userID, emoji)
	return err
}

func (r *Repository) RemoveReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3
	`, messageID, userID, emoji)
	return err
}

func (r *Repository) GetReactions(ctx context.Context, messageID int64, viewerID int64) ([]Reaction, error) {
	rows, err := r.db.Query(ctx, `
		SELECT emoji, COUNT(*) as count,
		       BOOL_OR(user_id = $2) as me
		FROM reactions WHERE message_id = $1
		GROUP BY emoji
	`, messageID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reactions []Reaction
	for rows.Next() {
		var r Reaction
		if err := rows.Scan(&r.Emoji, &r.Count, &r.Me); err != nil {
			return nil, err
		}
		reactions = append(reactions, r)
	}
	return reactions, nil
}

// --- Read States ---

func (r *Repository) AckMessage(ctx context.Context, userID, channelID, messageID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO read_states (user_id, channel_id, last_message_id, mention_count)
		VALUES ($1, $2, $3, 0)
		ON CONFLICT (user_id, channel_id) DO UPDATE
		SET last_message_id = GREATEST(read_states.last_message_id, $3), mention_count = 0
	`, userID, channelID, messageID)
	return err
}

// GetChannelGuildID resolves the guild_id for a channel.
func (r *Repository) GetChannelGuildID(ctx context.Context, channelID int64) int64 {
	var guildID *int64
	r.db.QueryRow(ctx, `SELECT guild_id FROM channels WHERE id = $1`, channelID).Scan(&guildID)
	if guildID != nil {
		return *guildID
	}
	return 0
}
