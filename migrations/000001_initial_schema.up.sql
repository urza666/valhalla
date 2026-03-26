-- Valhalla Initial Schema
-- All IDs are Snowflake (BIGINT), generated application-side

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              BIGINT PRIMARY KEY,
    username        VARCHAR(32) NOT NULL UNIQUE,
    display_name    VARCHAR(32),
    email           VARCHAR(254) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_hash     VARCHAR(64),
    banner_hash     VARCHAR(64),
    bio             VARCHAR(190),
    locale          VARCHAR(10) NOT NULL DEFAULT 'en-US',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      VARCHAR(64),
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    flags           BIGINT NOT NULL DEFAULT 0,
    premium_type    SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);

CREATE TABLE sessions (
    token           VARCHAR(64) PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info     VARCHAR(255),
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- ============================================================
-- RELATIONSHIPS (Friends, Blocks)
-- ============================================================

CREATE TABLE relationships (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            SMALLINT NOT NULL, -- 1=friend, 2=blocked, 3=pending_incoming, 4=pending_outgoing
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, target_id)
);

CREATE INDEX idx_relationships_target ON relationships (target_id, type);

-- ============================================================
-- GUILDS (Servers)
-- ============================================================

CREATE TABLE guilds (
    id                          BIGINT PRIMARY KEY,
    name                        VARCHAR(100) NOT NULL,
    icon_hash                   VARCHAR(64),
    banner_hash                 VARCHAR(64),
    splash_hash                 VARCHAR(64),
    owner_id                    BIGINT NOT NULL REFERENCES users(id),
    description                 VARCHAR(1000),
    preferred_locale            VARCHAR(10) NOT NULL DEFAULT 'en-US',
    verification_level          SMALLINT NOT NULL DEFAULT 0,
    default_notifications       SMALLINT NOT NULL DEFAULT 0,
    explicit_content_filter     SMALLINT NOT NULL DEFAULT 0,
    features                    TEXT[] NOT NULL DEFAULT '{}',
    system_channel_id           BIGINT,
    rules_channel_id            BIGINT,
    max_members                 INT NOT NULL DEFAULT 500000,
    vanity_url_code             VARCHAR(32) UNIQUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guilds_owner ON guilds (owner_id);

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    color           INT NOT NULL DEFAULT 0,
    hoist           BOOLEAN NOT NULL DEFAULT FALSE,
    icon_hash       VARCHAR(64),
    position        INT NOT NULL DEFAULT 0,
    permissions     BIGINT NOT NULL DEFAULT 0,
    managed         BOOLEAN NOT NULL DEFAULT FALSE,
    mentionable     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_guild ON roles (guild_id, position);

-- ============================================================
-- MEMBERS
-- ============================================================

CREATE TABLE members (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    nickname        VARCHAR(32),
    avatar_hash     VARCHAR(64),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deaf            BOOLEAN NOT NULL DEFAULT FALSE,
    mute            BOOLEAN NOT NULL DEFAULT FALSE,
    pending         BOOLEAN NOT NULL DEFAULT FALSE,
    timeout_until   TIMESTAMPTZ,
    PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX idx_members_guild ON members (guild_id);

-- Member roles (many-to-many)
CREATE TABLE member_roles (
    user_id         BIGINT NOT NULL,
    guild_id        BIGINT NOT NULL,
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, guild_id, role_id),
    FOREIGN KEY (user_id, guild_id) REFERENCES members(user_id, guild_id) ON DELETE CASCADE
);

CREATE INDEX idx_member_roles_role ON member_roles (role_id);

-- ============================================================
-- CHANNELS
-- ============================================================

-- Channel types:
-- 0 = text, 1 = DM, 2 = voice, 3 = group_dm, 4 = category,
-- 5 = announcement, 11 = public_thread, 12 = private_thread,
-- 13 = stage, 15 = forum

CREATE TABLE channels (
    id                      BIGINT PRIMARY KEY,
    guild_id                BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
    type                    SMALLINT NOT NULL DEFAULT 0,
    name                    VARCHAR(100),
    topic                   VARCHAR(1024),
    position                INT NOT NULL DEFAULT 0,
    parent_id               BIGINT REFERENCES channels(id) ON DELETE SET NULL,
    nsfw                    BOOLEAN NOT NULL DEFAULT FALSE,
    rate_limit_per_user     INT NOT NULL DEFAULT 0,
    bitrate                 INT NOT NULL DEFAULT 64000,
    user_limit              INT NOT NULL DEFAULT 0,
    last_message_id         BIGINT,
    owner_id                BIGINT REFERENCES users(id), -- for group DMs and threads
    thread_archived         BOOLEAN NOT NULL DEFAULT FALSE,
    thread_auto_archive     INT NOT NULL DEFAULT 1440, -- minutes
    thread_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    default_thread_rate_limit INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_guild ON channels (guild_id, position);
CREATE INDEX idx_channels_parent ON channels (parent_id);

-- Channel permission overwrites
CREATE TABLE channel_overwrites (
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    target_id       BIGINT NOT NULL, -- role_id or user_id
    target_type     SMALLINT NOT NULL, -- 0 = role, 1 = member
    allow           BIGINT NOT NULL DEFAULT 0,
    deny            BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, target_id)
);

-- DM channel participants
CREATE TABLE dm_participants (
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_dm_participants_user ON dm_participants (user_id);

-- ============================================================
-- MESSAGES
-- ============================================================

-- Message types:
-- 0 = default, 1 = recipient_add, 2 = recipient_remove,
-- 6 = channel_pinned, 7 = user_join, 19 = reply, 21 = thread_starter

CREATE TABLE messages (
    id                  BIGINT PRIMARY KEY,
    channel_id          BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id           BIGINT NOT NULL REFERENCES users(id),
    content             VARCHAR(4000) NOT NULL DEFAULT '',
    edited_at           TIMESTAMPTZ,
    tts                 BOOLEAN NOT NULL DEFAULT FALSE,
    mention_everyone    BOOLEAN NOT NULL DEFAULT FALSE,
    pinned              BOOLEAN NOT NULL DEFAULT FALSE,
    type                SMALLINT NOT NULL DEFAULT 0,
    flags               INT NOT NULL DEFAULT 0,
    reference_id        BIGINT, -- replied-to message
    nonce               VARCHAR(64),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition messages by channel for query performance
CREATE INDEX idx_messages_channel_id ON messages (channel_id, id DESC);
CREATE INDEX idx_messages_author ON messages (author_id, id DESC);

-- Message mentions
CREATE TABLE message_mentions (
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, user_id)
);

-- Message role mentions
CREATE TABLE message_role_mentions (
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, role_id)
);

-- ============================================================
-- ATTACHMENTS
-- ============================================================

CREATE TABLE attachments (
    id              BIGINT PRIMARY KEY,
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    content_type    VARCHAR(128),
    size            BIGINT NOT NULL,
    url             VARCHAR(1024) NOT NULL,
    proxy_url       VARCHAR(1024),
    width           INT,
    height          INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments (message_id);

-- ============================================================
-- REACTIONS
-- ============================================================

CREATE TABLE reactions (
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji           VARCHAR(64) NOT NULL, -- unicode emoji or custom emoji ID
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions (message_id);

-- ============================================================
-- INVITES
-- ============================================================

CREATE TABLE invites (
    code            VARCHAR(16) PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    inviter_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    max_age         INT NOT NULL DEFAULT 86400, -- seconds, 0 = permanent
    max_uses        INT NOT NULL DEFAULT 0, -- 0 = unlimited
    uses            INT NOT NULL DEFAULT 0,
    temporary       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_guild ON invites (guild_id);

-- ============================================================
-- BANS
-- ============================================================

CREATE TABLE bans (
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason          VARCHAR(512),
    banned_by       BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log_entries (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id         BIGINT REFERENCES users(id), -- who performed the action
    target_id       BIGINT, -- affected entity
    action_type     SMALLINT NOT NULL,
    reason          VARCHAR(512),
    changes         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_guild ON audit_log_entries (guild_id, id DESC);
CREATE INDEX idx_audit_log_user ON audit_log_entries (guild_id, user_id);

-- ============================================================
-- WEBHOOKS
-- ============================================================

CREATE TABLE webhooks (
    id              BIGINT PRIMARY KEY,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,
    avatar_hash     VARCHAR(64),
    token           VARCHAR(68) NOT NULL UNIQUE,
    creator_id      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_channel ON webhooks (channel_id);

-- ============================================================
-- READ STATES (Unread tracking)
-- ============================================================

CREATE TABLE read_states (
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id          BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_message_id     BIGINT NOT NULL DEFAULT 0,
    mention_count       INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, channel_id)
);

-- ============================================================
-- PINNED MESSAGES
-- ============================================================

CREATE TABLE pinned_messages (
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by       BIGINT REFERENCES users(id),
    pinned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, message_id)
);

-- ============================================================
-- HELPER FUNCTION: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
