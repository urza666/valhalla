-- ============================================================
-- KANBAN BOARDS
-- ============================================================

CREATE TABLE kanban_boards (
    id              BIGINT PRIMARY KEY,
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kanban_boards_channel ON kanban_boards (channel_id);

CREATE TABLE kanban_buckets (
    id              BIGINT PRIMARY KEY,
    board_id        BIGINT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    position        INT NOT NULL DEFAULT 0,
    color           VARCHAR(7), -- hex color e.g. #5865F2
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kanban_buckets_board ON kanban_buckets (board_id, position);

CREATE TABLE kanban_tasks (
    id              BIGINT PRIMARY KEY,
    bucket_id       BIGINT NOT NULL REFERENCES kanban_buckets(id) ON DELETE CASCADE,
    board_id        BIGINT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    position        INT NOT NULL DEFAULT 0,
    priority        SMALLINT NOT NULL DEFAULT 0, -- 0=none, 1=low, 2=medium, 3=high, 4=urgent
    due_date        TIMESTAMPTZ,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    assigned_to     BIGINT REFERENCES users(id),
    labels          TEXT[] NOT NULL DEFAULT '{}',
    completed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kanban_tasks_bucket ON kanban_tasks (bucket_id, position);
CREATE INDEX idx_kanban_tasks_board ON kanban_tasks (board_id);
CREATE INDEX idx_kanban_tasks_assigned ON kanban_tasks (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TRIGGER update_kanban_tasks_updated_at BEFORE UPDATE ON kanban_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- WIKI PAGES
-- ============================================================

CREATE TABLE wiki_pages (
    id              BIGINT PRIMARY KEY,
    channel_id      BIGINT REFERENCES channels(id) ON DELETE CASCADE,
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    parent_id       BIGINT REFERENCES wiki_pages(id) ON DELETE SET NULL,
    position        INT NOT NULL DEFAULT 0,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    last_edited_by  BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_pages_guild ON wiki_pages (guild_id);
CREATE INDEX idx_wiki_pages_channel ON wiki_pages (channel_id);
CREATE INDEX idx_wiki_pages_parent ON wiki_pages (parent_id);

CREATE TRIGGER update_wiki_pages_updated_at BEFORE UPDATE ON wiki_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE wiki_revisions (
    id              BIGINT PRIMARY KEY,
    page_id         BIGINT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    edited_by       BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_revisions_page ON wiki_revisions (page_id, created_at DESC);

-- ============================================================
-- POLLS
-- ============================================================

CREATE TABLE polls (
    id              BIGINT PRIMARY KEY,
    message_id      BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    channel_id      BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    question        VARCHAR(300) NOT NULL,
    allow_multiselect BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_polls_message ON polls (message_id);

CREATE TABLE poll_options (
    id              BIGINT PRIMARY KEY,
    poll_id         BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text            VARCHAR(100) NOT NULL,
    emoji           VARCHAR(64),
    position        INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_poll_options_poll ON poll_options (poll_id, position);

CREATE TABLE poll_votes (
    poll_id         BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id       BIGINT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, option_id, user_id)
);

-- ============================================================
-- BOT / APPLICATIONS
-- ============================================================

CREATE TABLE applications (
    id              BIGINT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     VARCHAR(1000),
    icon_hash       VARCHAR(64),
    owner_id        BIGINT NOT NULL REFERENCES users(id),
    bot_token       VARCHAR(128) UNIQUE,
    bot_user_id     BIGINT UNIQUE REFERENCES users(id),
    public_key      VARCHAR(64), -- for interaction verification
    redirect_uris   TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_owner ON applications (owner_id);
CREATE INDEX idx_applications_bot_token ON applications (bot_token);

CREATE TABLE slash_commands (
    id              BIGINT PRIMARY KEY,
    application_id  BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    guild_id        BIGINT REFERENCES guilds(id) ON DELETE CASCADE, -- null = global
    name            VARCHAR(32) NOT NULL,
    description     VARCHAR(100) NOT NULL,
    options         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slash_commands_app ON slash_commands (application_id);
CREATE INDEX idx_slash_commands_guild ON slash_commands (guild_id) WHERE guild_id IS NOT NULL;
