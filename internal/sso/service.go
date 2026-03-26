package sso

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

var (
	ErrProviderNotFound = errors.New("SSO provider not found")
	ErrProviderDisabled = errors.New("SSO provider is disabled")
	ErrUserNotLinked    = errors.New("no linked account found")
)

type ProviderType string

const (
	TypeSAML ProviderType = "saml"
	TypeOIDC ProviderType = "oidc"
)

type Provider struct {
	ID                 int64        `json:"id,string"`
	GuildID            int64        `json:"guild_id,string"`
	Type               ProviderType `json:"type"`
	Name               string       `json:"name"`
	Enabled            bool         `json:"enabled"`
	SAMLEntityID       *string      `json:"saml_entity_id,omitempty"`
	SAMLSSOURL         *string      `json:"saml_sso_url,omitempty"`
	SAMLCertificate    *string      `json:"saml_certificate,omitempty"`
	OIDCIssuer         *string      `json:"oidc_issuer,omitempty"`
	OIDCClientID       *string      `json:"oidc_client_id,omitempty"`
	OIDCClientSecret   *string      `json:"oidc_client_secret,omitempty"`
	OIDCScopes         []string     `json:"oidc_scopes"`
	AutoCreateMembers  bool         `json:"auto_create_members"`
	DefaultRoleID      *int64       `json:"default_role_id,string"`
	CreatedAt          time.Time    `json:"created_at"`
}

type UserLink struct {
	ProviderID    int64     `json:"provider_id,string"`
	ExternalID    string    `json:"external_id"`
	UserID        int64     `json:"user_id,string"`
	ExternalEmail *string   `json:"external_email"`
	ExternalName  *string   `json:"external_name"`
	LinkedAt      time.Time `json:"linked_at"`
}

type CreateProviderRequest struct {
	Type             ProviderType `json:"type"`
	Name             string       `json:"name"`
	SAMLEntityID     *string      `json:"saml_entity_id,omitempty"`
	SAMLSSOURL       *string      `json:"saml_sso_url,omitempty"`
	SAMLCertificate  *string      `json:"saml_certificate,omitempty"`
	OIDCIssuer       *string      `json:"oidc_issuer,omitempty"`
	OIDCClientID     *string      `json:"oidc_client_id,omitempty"`
	OIDCClientSecret *string      `json:"oidc_client_secret,omitempty"`
}

type Service struct {
	db    *pgxpool.Pool
	idGen *snowflake.Generator
}

func NewService(db *pgxpool.Pool, idGen *snowflake.Generator) *Service {
	return &Service{db: db, idGen: idGen}
}

// CreateProvider creates a new SSO provider for a guild.
func (s *Service) CreateProvider(ctx context.Context, guildID int64, req CreateProviderRequest) (*Provider, error) {
	id := s.idGen.Generate().Int64()
	var p Provider
	err := s.db.QueryRow(ctx, `
		INSERT INTO sso_providers (id, guild_id, type, name,
			saml_entity_id, saml_sso_url, saml_certificate,
			oidc_issuer, oidc_client_id, oidc_client_secret)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, guild_id, type, name, enabled,
			saml_entity_id, saml_sso_url,
			oidc_issuer, oidc_client_id,
			auto_create_members, default_role_id, created_at
	`, id, guildID, req.Type, req.Name,
		req.SAMLEntityID, req.SAMLSSOURL, req.SAMLCertificate,
		req.OIDCIssuer, req.OIDCClientID, req.OIDCClientSecret,
	).Scan(
		&p.ID, &p.GuildID, &p.Type, &p.Name, &p.Enabled,
		&p.SAMLEntityID, &p.SAMLSSOURL,
		&p.OIDCIssuer, &p.OIDCClientID,
		&p.AutoCreateMembers, &p.DefaultRoleID, &p.CreatedAt,
	)
	return &p, err
}

// GetProviders returns all SSO providers for a guild.
func (s *Service) GetProviders(ctx context.Context, guildID int64) ([]Provider, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, guild_id, type, name, enabled,
		       saml_entity_id, saml_sso_url,
		       oidc_issuer, oidc_client_id,
		       auto_create_members, default_role_id, created_at
		FROM sso_providers WHERE guild_id = $1
	`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var providers []Provider
	for rows.Next() {
		var p Provider
		rows.Scan(&p.ID, &p.GuildID, &p.Type, &p.Name, &p.Enabled,
			&p.SAMLEntityID, &p.SAMLSSOURL,
			&p.OIDCIssuer, &p.OIDCClientID,
			&p.AutoCreateMembers, &p.DefaultRoleID, &p.CreatedAt)
		providers = append(providers, p)
	}
	return providers, nil
}

// LinkUser links an external SSO identity to a Valhalla user.
func (s *Service) LinkUser(ctx context.Context, providerID, userID int64, externalID, email, name string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO sso_user_links (provider_id, external_id, user_id, external_email, external_name)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (provider_id, external_id) DO UPDATE SET user_id = $3, external_email = $4, external_name = $5
	`, providerID, externalID, userID, email, name)
	return err
}

// FindUserByExternalID looks up a Valhalla user by their SSO external ID.
func (s *Service) FindUserByExternalID(ctx context.Context, providerID int64, externalID string) (int64, error) {
	var userID int64
	err := s.db.QueryRow(ctx, `
		SELECT user_id FROM sso_user_links WHERE provider_id = $1 AND external_id = $2
	`, providerID, externalID).Scan(&userID)
	if err != nil {
		return 0, ErrUserNotLinked
	}
	return userID, nil
}

// GetProvider retrieves a single SSO provider.
func (s *Service) GetProvider(ctx context.Context, providerID int64) (*Provider, error) {
	var p Provider
	err := s.db.QueryRow(ctx, `
		SELECT id, guild_id, type, name, enabled,
		       saml_entity_id, saml_sso_url,
		       oidc_issuer, oidc_client_id,
		       auto_create_members, default_role_id, created_at
		FROM sso_providers WHERE id = $1
	`, providerID).Scan(
		&p.ID, &p.GuildID, &p.Type, &p.Name, &p.Enabled,
		&p.SAMLEntityID, &p.SAMLSSOURL,
		&p.OIDCIssuer, &p.OIDCClientID,
		&p.AutoCreateMembers, &p.DefaultRoleID, &p.CreatedAt,
	)
	if err != nil {
		return nil, ErrProviderNotFound
	}
	return &p, nil
}

// GetProviderByGuildAndName looks up a provider by guild ID and name.
func (s *Service) GetProviderByGuildAndName(ctx context.Context, guildID int64, name string) (*Provider, error) {
	var p Provider
	err := s.db.QueryRow(ctx, `
		SELECT id, guild_id, type, name, enabled,
		       saml_entity_id, saml_sso_url, saml_certificate,
		       oidc_issuer, oidc_client_id, oidc_client_secret,
		       auto_create_members, default_role_id, created_at
		FROM sso_providers WHERE guild_id = $1 AND name = $2
	`, guildID, name).Scan(
		&p.ID, &p.GuildID, &p.Type, &p.Name, &p.Enabled,
		&p.SAMLEntityID, &p.SAMLSSOURL, &p.SAMLCertificate,
		&p.OIDCIssuer, &p.OIDCClientID, &p.OIDCClientSecret,
		&p.AutoCreateMembers, &p.DefaultRoleID, &p.CreatedAt,
	)
	if err != nil {
		return nil, ErrProviderNotFound
	}
	return &p, nil
}

// GetProviderFull retrieves a single SSO provider including secrets.
func (s *Service) GetProviderFull(ctx context.Context, providerID int64) (*Provider, error) {
	var p Provider
	err := s.db.QueryRow(ctx, `
		SELECT id, guild_id, type, name, enabled,
		       saml_entity_id, saml_sso_url, saml_certificate,
		       oidc_issuer, oidc_client_id, oidc_client_secret,
		       auto_create_members, default_role_id, created_at
		FROM sso_providers WHERE id = $1
	`, providerID).Scan(
		&p.ID, &p.GuildID, &p.Type, &p.Name, &p.Enabled,
		&p.SAMLEntityID, &p.SAMLSSOURL, &p.SAMLCertificate,
		&p.OIDCIssuer, &p.OIDCClientID, &p.OIDCClientSecret,
		&p.AutoCreateMembers, &p.DefaultRoleID, &p.CreatedAt,
	)
	if err != nil {
		return nil, ErrProviderNotFound
	}
	return &p, nil
}

// DeleteProvider removes an SSO provider.
func (s *Service) DeleteProvider(ctx context.Context, providerID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sso_providers WHERE id = $1`, providerID)
	return err
}

// ToggleProvider enables or disables a provider.
func (s *Service) ToggleProvider(ctx context.Context, providerID int64, enabled bool) error {
	_, err := s.db.Exec(ctx, `UPDATE sso_providers SET enabled = $2 WHERE id = $1`, providerID, enabled)
	return err
}
