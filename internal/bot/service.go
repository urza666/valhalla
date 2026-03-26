package bot

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrAppNotFound = errors.New("application not found")
	ErrInvalidToken = errors.New("invalid bot token")
)

type Application struct {
	ID           int64     `json:"id,string"`
	Name         string    `json:"name"`
	Description  *string   `json:"description"`
	IconHash     *string   `json:"icon"`
	OwnerID      int64     `json:"owner_id,string"`
	BotToken     string    `json:"bot_token,omitempty"` // only shown once on creation
	BotUserID    *int64    `json:"bot_user_id,string"`
	PublicKey    *string   `json:"public_key"`
	RedirectURIs []string  `json:"redirect_uris"`
	CreatedAt    time.Time `json:"created_at"`
}

type SlashCommand struct {
	ID            int64  `json:"id,string"`
	ApplicationID int64  `json:"application_id,string"`
	GuildID       *int64 `json:"guild_id,string"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Options       any    `json:"options"`
}

type Webhook struct {
	ID        int64   `json:"id,string"`
	GuildID   int64   `json:"guild_id,string"`
	ChannelID int64   `json:"channel_id,string"`
	Name      string  `json:"name"`
	Token     string  `json:"token"`
	CreatorID *int64  `json:"creator_id,string"`
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// CreateApplication creates a new bot application.
func (s *Service) CreateApplication(ctx context.Context, ownerID int64, name string) (*Application, error) {
	appID := s.idGen.Generate().Int64()
	botToken, err := generateBotToken(appID)
	if err != nil {
		return nil, err
	}

	// Create a bot user account
	botUserID := s.idGen.Generate().Int64()
	_, err = s.db.Exec(ctx, `
		INSERT INTO users (id, username, email, password_hash, verified)
		VALUES ($1, $2, $3, 'bot-no-password', true)
	`, botUserID, name+" Bot", generateBotEmail(appID))
	if err != nil {
		return nil, err
	}

	var app Application
	err = s.db.QueryRow(ctx, `
		INSERT INTO applications (id, name, owner_id, bot_token, bot_user_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, description, icon_hash, owner_id, bot_token, bot_user_id, public_key, redirect_uris, created_at
	`, appID, name, ownerID, botToken, botUserID).Scan(
		&app.ID, &app.Name, &app.Description, &app.IconHash, &app.OwnerID,
		&app.BotToken, &app.BotUserID, &app.PublicKey, &app.RedirectURIs, &app.CreatedAt,
	)
	return &app, err
}

// GetApplication retrieves an application by ID.
func (s *Service) GetApplication(ctx context.Context, appID int64) (*Application, error) {
	var app Application
	err := s.db.QueryRow(ctx, `
		SELECT id, name, description, icon_hash, owner_id, '', bot_user_id, public_key, redirect_uris, created_at
		FROM applications WHERE id = $1
	`, appID).Scan(
		&app.ID, &app.Name, &app.Description, &app.IconHash, &app.OwnerID,
		&app.BotToken, &app.BotUserID, &app.PublicKey, &app.RedirectURIs, &app.CreatedAt,
	)
	if err != nil {
		return nil, ErrAppNotFound
	}
	return &app, nil
}

// ValidateBotToken checks a bot token and returns the bot user ID.
func (s *Service) ValidateBotToken(ctx context.Context, token string) (int64, error) {
	var botUserID int64
	err := s.db.QueryRow(ctx, `
		SELECT bot_user_id FROM applications WHERE bot_token = $1
	`, token).Scan(&botUserID)
	if err != nil {
		return 0, ErrInvalidToken
	}
	return botUserID, nil
}

// GetMyApplications returns all applications owned by a user.
func (s *Service) GetMyApplications(ctx context.Context, ownerID int64) ([]Application, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, description, icon_hash, owner_id, '', bot_user_id, public_key, redirect_uris, created_at
		FROM applications WHERE owner_id = $1 ORDER BY created_at
	`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []Application
	for rows.Next() {
		var app Application
		rows.Scan(&app.ID, &app.Name, &app.Description, &app.IconHash, &app.OwnerID,
			&app.BotToken, &app.BotUserID, &app.PublicKey, &app.RedirectURIs, &app.CreatedAt)
		apps = append(apps, app)
	}
	return apps, nil
}

// RegisterSlashCommand registers a slash command for an application.
func (s *Service) RegisterSlashCommand(ctx context.Context, appID int64, guildID *int64, name, description string, options any) (*SlashCommand, error) {
	cmdID := s.idGen.Generate().Int64()
	optJSON, _ := json.Marshal(options)

	var cmd SlashCommand
	err := s.db.QueryRow(ctx, `
		INSERT INTO slash_commands (id, application_id, guild_id, name, description, options)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (application_id, guild_id, name)
		DO UPDATE SET description = $5, options = $6
		RETURNING id, application_id, guild_id, name, description
	`, cmdID, appID, guildID, name, description, optJSON).Scan(
		&cmd.ID, &cmd.ApplicationID, &cmd.GuildID, &cmd.Name, &cmd.Description,
	)
	return &cmd, err
}

// CreateWebhook creates a new webhook for a channel.
func (s *Service) CreateWebhook(ctx context.Context, guildID, channelID, creatorID int64, name string) (*Webhook, error) {
	whID := s.idGen.Generate().Int64()
	token := generateWebhookToken()

	_, err := s.db.Exec(ctx, `
		INSERT INTO webhooks (id, guild_id, channel_id, name, token, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, whID, guildID, channelID, name, token, creatorID)
	if err != nil {
		return nil, err
	}

	return &Webhook{
		ID: whID, GuildID: guildID, ChannelID: channelID,
		Name: name, Token: token, CreatorID: &creatorID,
	}, nil
}

func generateBotToken(appID int64) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "Bot." + hex.EncodeToString(b), nil
}

func generateBotEmail(appID int64) string {
	return "bot-" + strconv.FormatInt(appID, 10) + "@valhalla.internal"
}

func generateWebhookToken() string {
	b := make([]byte, 34)
	rand.Read(b)
	return hex.EncodeToString(b)
}
