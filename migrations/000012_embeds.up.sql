-- Message embeds: stores OpenGraph / link preview data per message
CREATE TABLE IF NOT EXISTS message_embeds (
    id          BIGINT PRIMARY KEY,
    message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type        VARCHAR(16) NOT NULL DEFAULT 'link',
    url         VARCHAR(2048) NOT NULL,
    title       VARCHAR(512),
    description VARCHAR(1024),
    site_name   VARCHAR(256),
    color       INT DEFAULT 0,
    thumbnail_url   VARCHAR(2048),
    thumbnail_width INT,
    thumbnail_height INT,
    image_url   VARCHAR(2048),
    image_width INT,
    image_height INT,
    provider_name VARCHAR(256),
    provider_url  VARCHAR(2048),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_embeds_message_id ON message_embeds(message_id);
