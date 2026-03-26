# Valhalla — Public Beta Go/No-Go Checkliste

## Status: PRE-BETA (Stand: März 2026)

---

## 1. Security (BLOCKER)

- [x] Argon2id Password Hashing
- [x] Constant-time Token Verification
- [x] HttpOnly Session Cookies (SameSite=Strict)
- [x] CSRF Protection (Origin Validation)
- [x] JSON Body-Size Limits (1 MB)
- [x] File-Upload: Extension Whitelist + Magic-Byte Detection
- [x] File-Upload: Content-Disposition + Security Headers
- [x] WebSocket Origin Whitelist (configurable)
- [x] Rate Limiting: Auth 5/min, Global 50/s
- [x] Permission Checks on Message/Channel operations
- [x] MFA (TOTP) Support
- [ ] E-Mail-Versand für Password-Reset (aktuell nur Token-Generierung)
- [x] Account-Lockout (5 Fehlversuche → 15min IP-Lockout)

## 2. Legal / Compliance (BLOCKER)

- [x] Impressum (Ankh-IT SARL, Luxembourg — RCS + TVA-Nummer noch eintragen)
- [x] Datenschutzerklärung (DSGVO Art. 13/14)
- [x] Nutzungsbedingungen mit AUP
- [x] Account-Löschung (DSGVO Art. 17)
- [x] Daten-Export (DSGVO Art. 20)
- [x] Content-Report-System
- [ ] Impressum: RCS-Nummer und TVA-Nummer eintragen (sobald Registrierung abgeschlossen)
- [ ] AVV-Vorlage für Self-Hosting-Betreiber
- [x] Consent-Management für Tenor GIF-API (Opt-in Banner)

## 3. Core Functionality (BLOCKER)

- [x] User Registration + Login + Logout
- [x] Guild/Server CRUD
- [x] Channel CRUD (Text, Voice, Category)
- [x] Real-time Messaging (WebSocket)
- [x] Message Edit/Delete/Reply/Pin
- [x] File Upload + Attachment Display
- [x] Reactions
- [x] Typing Indicators
- [x] Voice/Video (LiveKit)
- [x] Kanban Boards
- [x] Wiki/Knowledge Base
- [x] Polls
- [x] Friends/Relationships
- [x] DM Support
- [x] Invite System
- [x] Role/Permission Management
- [x] Search (Meilisearch)
- [x] Unread Badges
- [x] @Mention Autocomplete
- [ ] Thread Support (UI)
- [x] Presence System (Gateway hooks → Online/Idle/Offline)

## 4. Infrastructure (BLOCKER)

- [x] Docker Compose (8+ Services)
- [x] Production Compose with Caddy + Auto-TLS
- [x] Prometheus Monitoring
- [x] Grafana Dashboards
- [x] PostgreSQL Backup Script + Restore Runbook
- [x] NATS Event Bus (horizontal scaling ready)
- [x] Audit Logging (security_audit_log)
- [x] GitLab CI Pipeline
- [x] Image Pinning (no :latest)
- [x] Graceful Shutdown
- [x] Staging Environment (see Vault for host details, AlmaLinux 9)
- [ ] Automated Backup Verification
- [x] Alerting Rules (6 alert rules: API down, errors, WS sessions, memory, goroutines, restarts)

## 5. Code Quality

- [x] Repository Interfaces (auth, message, channel, guild)
- [x] EventDispatcher Interface
- [x] Session Cache (in-memory, 5min TTL)
- [x] Backend Unit Tests (auth: 14, permissions: 11, MFA: 7 = 32 total)
- [x] Frontend Unit Tests (toast, unread, settings, markdown = 28 total)
- [x] API Integration Tests (33)
- [x] E2E Tests (Playwright, 21)
- [x] OpenAPI 3.0 Specification
- [x] Swagger UI (/api/docs)
- [ ] Backend Test Coverage > 60%
- [ ] Frontend Test Coverage > 40%
- [ ] No `any` types in critical paths

## 6. UX / Accessibility

- [x] German Localization (konsistent)
- [x] Dark + Light Theme
- [x] Responsive Design (3 Breakpoints)
- [x] Mobile Hamburger Menu
- [x] Toast Notification System
- [x] Keyboard Shortcuts (Ctrl+K, Ctrl+Shift+M/D, Alt+Arrows)
- [x] Skip-Navigation Link
- [x] ARIA Labels on interactive elements
- [x] aria-live Regions (messages, typing)
- [x] prefers-reduced-motion Support
- [x] Onboarding Wizard
- [x] Drag-and-Drop File Upload
- [ ] Full Screen-Reader Testing
- [ ] Color Contrast Audit (WCAG AA)

## 7. Documentation

- [x] Architecture Docs (docs/04-architektur.md)
- [x] Feature List (docs/02-feature-liste.md)
- [x] API Docs (OpenAPI + Swagger UI)
- [x] Setup Guide (setup.sh + README)
- [x] Backup Restore Runbook
- [x] Permission System Docs (docs/12, 13)
- [ ] Contributing Guide (CONTRIBUTING.md aktualisieren)
- [x] Changelog (CHANGELOG.md)

---

## Go/No-Go Entscheidung

### BLOCKER (müssen vor Beta gelöst sein):
1. ~~Impressum mit echten Daten befüllen~~ → Ankh-IT SARL eingetragen, RCS/TVA ausstehend
2. **E-Mail-Provider konfigurieren** (Password-Reset, MFA-Recovery)
3. ~~Rechtsform klären~~ → Ankh-IT SARL, Luxembourg

### EMPFOHLEN (sollten vor Beta gelöst sein):
4. Staging-Environment aufsetzen
5. Alerting-Regeln konfigurieren
6. Presence-System (Online/Offline-Status)
7. AVV-Vorlage erstellen

### NICE-TO-HAVE (kann nach Beta kommen):
8. Thread-UI
9. Test-Coverage > 60%
10. Kubernetes-Migration

---

## Zusammenfassung

| Kategorie | Bereit | Ausstehend | Blocker |
|---|---|---|---|
| Security | 11/13 | 2 | 0 |
| Legal | 6/9 | 3 | 1 (Impressum) |
| Funktionalität | 20/22 | 2 | 0 |
| Infrastruktur | 10/13 | 3 | 0 |
| Code-Qualität | 9/12 | 3 | 0 |
| UX/A11y | 12/14 | 2 | 0 |
| Dokumentation | 6/8 | 2 | 0 |
| **Gesamt** | **79/90 (87%)** | **11** | **1** |

**Empfehlung:** Das Projekt ist zu **87% Beta-Ready**. Der einzige harte Blocker ist das Impressum (echte Daten). Nach Klärung der Rechtsform und E-Mail-Provider-Konfiguration kann die Public Beta starten.
