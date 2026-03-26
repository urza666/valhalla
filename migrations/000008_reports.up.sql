CREATE TABLE reports (
    id              BIGINT PRIMARY KEY,
    reporter_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id        BIGINT REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id      BIGINT REFERENCES channels(id) ON DELETE SET NULL,
    message_id      BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    target_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reason          VARCHAR(1000) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewer_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewer_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_reports_guild ON reports (guild_id, status);
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
