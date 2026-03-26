-- User consent tracking for DSGVO compliance
CREATE TABLE IF NOT EXISTS user_consent (
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type  VARCHAR(64) NOT NULL,  -- 'tenor_gif', 'link_previews', 'analytics', 'email_notifications'
    granted       BOOLEAN NOT NULL DEFAULT false,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, consent_type)
);

CREATE INDEX idx_user_consent_user ON user_consent(user_id);
