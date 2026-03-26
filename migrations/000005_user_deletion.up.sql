-- Allow user deletion by making messages.author_id nullable (SET NULL on delete)
-- Messages remain but show "Deleted User" instead of the original author
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_author_id_fkey;
ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE messages ADD CONSTRAINT messages_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- Audit log entries: keep the entry but null out the user reference
ALTER TABLE audit_log_entries DROP CONSTRAINT IF EXISTS audit_log_entries_user_id_fkey;
ALTER TABLE audit_log_entries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_log_entries ADD CONSTRAINT audit_log_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Guild ownership must be transferred before deletion (RESTRICT)
ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_owner_id_fkey;
ALTER TABLE guilds ADD CONSTRAINT guilds_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
