-- Revert: make message_id NOT NULL again
DELETE FROM attachments WHERE message_id IS NULL;
ALTER TABLE attachments ALTER COLUMN message_id SET NOT NULL;
