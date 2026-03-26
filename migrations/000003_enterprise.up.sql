-- ============================================================
-- SSO / IDENTITY PROVIDERS
-- ============================================================

CREATE TABLE sso_providers (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL, -- 'saml' or 'oidc'
    name            VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,

    -- SAML fields
    saml_entity_id      VARCHAR(500),
    saml_sso_url        VARCHAR(500),
    saml_certificate    TEXT,

    -- OIDC fields
    oidc_issuer         VARCHAR(500),
    oidc_client_id      VARCHAR(255),
    oidc_client_secret  VARCHAR(500),
    oidc_scopes         TEXT[] NOT NULL DEFAULT '{openid,profile,email}',

    -- Common
    auto_create_members BOOLEAN NOT NULL DEFAULT TRUE,
    default_role_id     BIGINT REFERENCES roles(id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sso_providers_guild ON sso_providers (guild_id);
CREATE TRIGGER update_sso_providers_updated_at BEFORE UPDATE ON sso_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SSO user linkage
CREATE TABLE sso_user_links (
    provider_id     BIGINT NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
    external_id     VARCHAR(255) NOT NULL,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_email  VARCHAR(254),
    external_name   VARCHAR(100),
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider_id, external_id)
);

CREATE INDEX idx_sso_user_links_user ON sso_user_links (user_id);

-- ============================================================
-- COMPLIANCE / RETENTION
-- ============================================================

CREATE TABLE retention_policies (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id      BIGINT REFERENCES channels(id) ON DELETE CASCADE, -- null = guild-wide
    retention_days  INT NOT NULL, -- 0 = forever
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retention_policies_guild ON retention_policies (guild_id);

CREATE TABLE legal_holds (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    channel_ids     BIGINT[], -- null = all channels
    user_ids        BIGINT[], -- null = all users
    start_date      TIMESTAMPTZ NOT NULL,
    end_date        TIMESTAMPTZ,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_legal_holds_guild ON legal_holds (guild_id);

-- Compliance audit exports
CREATE TABLE audit_exports (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    requested_by    BIGINT NOT NULL REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    filters         JSONB, -- channel_ids, user_ids, date range, etc.
    file_url        VARCHAR(1024),
    file_size       BIGINT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMIN / PLATFORM
-- ============================================================

CREATE TABLE platform_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    updated_by      BIGINT REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform admin users
CREATE TABLE platform_admins (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'admin', -- 'admin' or 'superadmin'
    granted_by      BIGINT REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage analytics snapshots (daily)
CREATE TABLE usage_stats (
    date            DATE NOT NULL,
    guild_id        BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
    total_members   INT NOT NULL DEFAULT 0,
    active_members  INT NOT NULL DEFAULT 0,
    messages_sent   INT NOT NULL DEFAULT 0,
    voice_minutes   INT NOT NULL DEFAULT 0,
    files_uploaded  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (date, guild_id)
);
