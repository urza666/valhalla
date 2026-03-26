-- Revert: make author_id NOT NULL again
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_author_id_fkey;
ALTER TABLE messages ALTER COLUMN author_id SET NOT NULL;
ALTER TABLE messages ADD CONSTRAINT messages_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id);

ALTER TABLE audit_log_entries DROP CONSTRAINT IF EXISTS audit_log_entries_user_id_fkey;
ALTER TABLE audit_log_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE audit_log_entries ADD CONSTRAINT audit_log_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_owner_id_fkey;
ALTER TABLE guilds ADD CONSTRAINT guilds_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id);
