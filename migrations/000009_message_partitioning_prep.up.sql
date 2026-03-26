-- Preparation for message table partitioning at scale.
-- This migration adds helper views and a cleanup function.
-- Actual partitioning (converting to partitioned table) requires downtime
-- and should be done as a separate migration when messages > 10M rows.

-- View: message count per channel (for capacity planning)
CREATE OR REPLACE VIEW v_channel_message_counts AS
SELECT channel_id, COUNT(*) as message_count, MIN(created_at) as oldest, MAX(created_at) as newest
FROM messages
GROUP BY channel_id;

-- Function: cleanup old pending attachments (not linked to any message after 24h)
CREATE OR REPLACE FUNCTION cleanup_pending_attachments() RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM attachments
    WHERE message_id IS NULL AND created_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: cleanup expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_resets() RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM password_resets WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
