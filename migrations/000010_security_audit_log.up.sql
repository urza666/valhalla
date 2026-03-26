-- Security audit log for tracking state-changing operations
CREATE TABLE IF NOT EXISTS security_audit_log (
    id              BIGINT PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,
    resource        VARCHAR(500),
    ip_address      VARCHAR(45),
    method          VARCHAR(10),
    path            VARCHAR(500),
    status_code     SMALLINT,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_audit_user ON security_audit_log (user_id, created_at DESC);
CREATE INDEX idx_security_audit_action ON security_audit_log (action, created_at DESC);
CREATE INDEX idx_security_audit_time ON security_audit_log (created_at DESC);
