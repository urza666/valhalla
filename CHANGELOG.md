# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] — Pre-Beta

### Added
- **MFA (TOTP)** — Multi-Factor Authentication with backup codes (RFC 6238)
- **Account Lockout** — 5 failed logins → 15min IP lockout
- **Presence System** — Online/Idle/Offline via Gateway session tracking
- **File Upload** — Drag-and-drop, extension whitelist, magic-byte detection, XSS prevention
- **Unread Badges** — Per-channel and per-guild unread message counters
- **@Mention Autocomplete** — Member dropdown when typing @
- **Slash Commands** — /poll, /flip, /roll, /shrug, /tableflip, /me, /spoiler, /giphy
- **Search Panel** — Full-text search via Meilisearch, Ctrl+K shortcut
- **Pinned Messages** — Pin/unpin with panel view
- **Keyboard Shortcuts** — Ctrl+Shift+M (mute), Ctrl+Shift+D (deafen), Alt+Arrows (channels)
- **Onboarding Wizard** — Post-registration server create/join flow
- **Toast Notifications** — Global success/error/info feedback system
- **NATS Event Bus** — Horizontal scaling via NATS JetStream pub/sub
- **Prometheus Metrics** — /metrics endpoint with 10+ metrics
- **Grafana Dashboards** — Monitoring stack with 6 alert rules
- **Audit Logging** — security_audit_log table tracking 13 action categories
- **Session Cache** — In-memory 5min TTL cache (eliminates 2 DB queries/request)
- **GDPR Compliance** — Account deletion (Art. 17), data export (Art. 20), content reports
- **Password Reset** — Token-based forgot/reset password flow
- **OpenAPI 3.0 Spec** — Full API documentation at /api/docs (Swagger UI)
- **GitLab CI Pipeline** — Lint, test, build, deploy stages
- **Backup System** — PostgreSQL pg_dump with 14-day rotation + restore runbook
- **GIF Consent** — Tenor GIF API requires explicit opt-in (GDPR)

### Security
- HttpOnly session cookies (SameSite=Strict)
- CSRF protection (Origin-header validation middleware)
- File upload hardening (extension whitelist, magic-byte content-type detection)
- WebSocket origin whitelist (configurable via ALLOWED_ORIGINS)
- Constant-time password comparison (crypto/subtle)
- JSON body size limit (1 MB global middleware)
- Permission checks on message/channel/pin operations
- Strict auth rate limiting (5/min per IP)
- Docker images pinned to specific versions
- Metrics endpoint restricted to internal IPs
- All credentials moved to Hashicorp Vault

### Improved
- Light theme fully functional (theme-aware CSS variables)
- Complete German localization (UI, errors, audit log actions)
- Responsive design with 3 breakpoints (tablet, mobile, small)
- Accessibility: skip-nav, ARIA labels, keyboard navigation, reduced-motion
- Markdown: underline parsed before italic (regex order fix)
- ServerSettings: all API calls moved to useEffect (no render-body calls)
- Guild handler: raw SQL moved to repository methods
- GetPinnedMessages: direct SQL query instead of load-all-filter
- Batch loading for reactions and attachments (fixes N+1 queries)
- Repository interfaces for message, channel, guild packages
- EventDispatcher interface decouples handlers from gateway

### Infrastructure
- OpenTofu config for vSphere VM provisioning
- Ansible role + playbooks for automated deployment
- Staging server (AlmaLinux 9 CIS L1)
- Docker Compose with 10+ services

## [0.1.0] — 2026-03-26 (Initial)

### Core Features
- Guild/Server management (CRUD, invites, bans)
- Channel management (text, voice, categories)
- Real-time messaging via WebSocket gateway
- Voice/Video via LiveKit WebRTC
- Kanban boards, Wiki, Polls
- Role-based permission system (49+ permission bits)
- SSO (SAML/OIDC), Compliance (retention, legal holds)
- Friends/relationships, DMs
- Emoji picker, typing indicators
- Dark/Light theme
