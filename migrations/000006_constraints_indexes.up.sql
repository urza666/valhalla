-- CHECK constraints on type fields
ALTER TABLE channels ADD CONSTRAINT chk_channel_type CHECK (type IN (0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 15));
ALTER TABLE messages ADD CONSTRAINT chk_message_type CHECK (type IN (0, 1, 2, 6, 7, 19, 21));
ALTER TABLE relationships ADD CONSTRAINT chk_relationship_type CHECK (type IN (1, 2, 3, 4));
ALTER TABLE kanban_tasks ADD CONSTRAINT chk_task_priority CHECK (priority BETWEEN 0 AND 4);
ALTER TABLE sso_providers ADD CONSTRAINT chk_sso_type CHECK (type IN ('saml', 'oidc'));

-- Remove redundant indexes (UNIQUE constraints already create implicit indexes)
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_messages_reference ON messages (reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_pending ON attachments (id) WHERE message_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (user_id, expires_at);
