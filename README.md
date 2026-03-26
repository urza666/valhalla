# Valhalla

**Open Source Real-Time Communication Platform**

A modern, self-hostable platform for text, voice, and video communication — built for communities and teams. Inspired by the best of Discord, Slack, and MS Teams, with unique features like Kanban boards, Wiki, and enterprise-grade compliance.

> This project is dedicated to the open source community. Thank you for the incredible tools, libraries, and inspiration over the years. Valhalla is my way of giving back.

---

## Features

### Communication
- **Text Channels** with Markdown, Reactions, Replies, Threads
- **Voice Channels** powered by LiveKit (WebRTC)
- **Video & Screen Share** with adaptive quality
- **Direct Messages** (1:1)
- **Typing Indicators** & **Presence** (Online/Idle/DND)

### Community
- **Guilds/Servers** with Categories and Channels
- **Roles & Permissions** — 53-bit hierarchical permission engine with channel overrides
- **Invite System** with expiry and max-uses
- **Member Management** — Kick, Ban, Timeout

### Business (What Discord doesn't have)
- **Kanban Boards** — In-channel task management
- **Wiki / Knowledge Base** — Per-guild documentation with revision history
- **Native Polls** — Multi-select, expiry, live results
- **Bot API** — Applications, Slash Commands, Webhooks
- **SSO/SAML** — SAML 2.0 + OIDC enterprise login
- **Compliance** — Retention policies, Legal Hold, Audit Export
- **Self-Hosting** — One-command Docker deployment

### Technical
- **Snowflake IDs** — Time-sortable, distributed
- **Real-time Gateway** — WebSocket with Heartbeat, Identify, Resume
- **Full-text Search** — Meilisearch powered
- **Link Previews** — OpenGraph embed extraction
- **3 Client Platforms** — Web (React), Desktop (Tauri), Mobile (React Native)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22 (chi, gorilla/websocket, pgx) |
| Web Client | React 19, TypeScript, Vite, Zustand |
| Desktop | Tauri 2.0 (Rust) |
| Mobile | React Native / Expo |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Voice/Video | LiveKit (WebRTC SFU) |
| Search | Meilisearch |
| Message Broker | NATS + JetStream |
| Object Storage | MinIO / S3 |
| Reverse Proxy | Caddy (auto-TLS) |

---

## Quick Start (Development)

```bash
# Prerequisites: Go 1.22+, Node.js 20+, Docker

# 1. Clone
git clone <repo-url>
cd valhalla

# 2. Start infrastructure
cp .env.example .env
make dev  # Starts PostgreSQL, Redis, NATS, MinIO, Meilisearch, LiveKit

# 3. Run migrations
make migrate-up

# 4. Start API + Gateway
make run-api

# 5. Start web client
cd web && npm install && npm run dev
# Open http://localhost:3000
```

## Self-Hosted Deployment (Production)

```bash
cd deployments
./setup.sh  # Auto-generates secrets, starts everything

# That's it. Caddy provides auto-TLS.
# Edit .env to set your DOMAIN before running.
```

---

## Project Structure

```
valhalla/
├── cmd/           # Go entry points (api, gateway, migrate)
├── internal/      # 23 business logic packages
│   ├── auth       # Registration, Login, Tokens (Argon2id)
│   ├── guild      # Server management
│   ├── channel    # Channel CRUD
│   ├── message    # Messaging with reactions
│   ├── gateway    # WebSocket real-time engine
│   ├── voice      # LiveKit integration
│   ├── kanban     # Task boards
│   ├── wiki       # Knowledge base
│   ├── poll       # Native polls
│   ├── bot        # Bot API & webhooks
│   ├── sso        # SAML/OIDC enterprise SSO
│   ├── compliance # Retention, Legal Hold
│   ├── admin      # Platform administration
│   └── ...        # dm, presence, search, embed, thread, notification
├── pkg/           # Shared libraries
│   ├── snowflake  # ID generator
│   ├── permissions # 53-bit permission engine
│   └── ...
├── web/           # React web client
├── mobile/        # React Native mobile client
├── desktop/       # Tauri desktop client
├── migrations/    # PostgreSQL migrations (39 tables)
├── deployments/   # Docker, Compose, Caddy, setup scripts
└── docs/          # Architecture documentation (14 documents)
```

---

## API Overview

57 REST endpoints + WebSocket Gateway. Key routes:

```
POST   /api/v1/auth/register          # Create account
POST   /api/v1/auth/login             # Login
GET    /api/v1/users/@me              # Current user
POST   /api/v1/guilds                 # Create server
GET    /api/v1/guilds/:id/channels    # List channels
POST   /api/v1/channels/:id/messages  # Send message
GET    /api/v1/channels/:id/messages  # Message history
POST   /api/v1/channels/:id/voice/join # Join voice
POST   /api/v1/channels/:id/boards    # Create kanban board
POST   /api/v1/guilds/:id/wiki        # Create wiki page
GET    /ws                             # WebSocket gateway
```

---

## Documentation

Comprehensive architecture documentation available in `/docs/`:

- Executive Summary & System Overview
- Complete Feature List (150+ features)
- UI/Screen/Component Catalog
- Backend Architecture (15 services, data model, infrastructure)
- Protocol Documentation (Gateway, Voice, Security)
- RBAC Permission Model (53 bits, 7-step algorithm)
- Discord Strengths/Weaknesses Analysis
- Future Feature Roadmap

---

## License

**AGPL-3.0 with Commons Clause**

- **Non-commercial use:** Free and open source (AGPL-3.0)
- **Commercial use:** Requires a separate license — contact the author
- **Contributions:** Welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

See [LICENSE](LICENSE) for details.

---

## Acknowledgments

This project stands on the shoulders of giants:

- [Go](https://go.dev) — The language that makes backend development a joy
- [React](https://react.dev) — UI library that changed frontend development
- [LiveKit](https://livekit.io) — Open source WebRTC infrastructure
- [PostgreSQL](https://postgresql.org) — The world's most advanced open source database
- [Tauri](https://tauri.app) — Building lightweight desktop apps with web tech
- [Meilisearch](https://meilisearch.com) — Lightning fast search engine
- [NATS](https://nats.io) — Cloud native messaging
- And countless other open source projects that make modern software possible

**Thank you, open source community.**
