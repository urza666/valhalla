-- Allow attachments to be uploaded before being linked to a message
ALTER TABLE attachments ALTER COLUMN message_id DROP NOT NULL;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_message_id_fkey;
ALTER TABLE attachments ADD CONSTRAINT attachments_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
