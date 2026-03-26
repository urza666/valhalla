-- Revert CHECK constraints
ALTER TABLE channels DROP CONSTRAINT IF EXISTS chk_channel_type;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_message_type;
ALTER TABLE relationships DROP CONSTRAINT IF EXISTS chk_relationship_type;
ALTER TABLE kanban_tasks DROP CONSTRAINT IF EXISTS chk_task_priority;
ALTER TABLE sso_providers DROP CONSTRAINT IF EXISTS chk_sso_type;

-- Re-add redundant indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Drop added indexes
DROP INDEX IF EXISTS idx_messages_reference;
DROP INDEX IF EXISTS idx_attachments_pending;
DROP INDEX IF EXISTS idx_sessions_expiry;
