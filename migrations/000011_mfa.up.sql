-- MFA (Multi-Factor Authentication) support
-- mfa_secret in users is already VARCHAR but stores plaintext — will be used for TOTP secret
-- Add backup codes table

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id          BIGINT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(128) NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_backup_user ON mfa_backup_codes (user_id);

-- Track MFA setup status on users table
-- mfa_enabled already exists as boolean column
-- mfa_secret already exists as varchar column
