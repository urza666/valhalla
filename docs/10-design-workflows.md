# 10. Design, Workflows & Communication Stack

---

## 10.1 Design System Grundlagen

### Farb-Palette (Empfehlung basierend auf Discord-Analyse)

```
Primärfarben:
  --brand-primary:    #5865F2  (Discord Blurple → eigene Brand-Farbe wählen)
  --brand-secondary:  #57F287  (Erfolg/Online)
  --brand-accent:     #FEE75C  (Warnung/Idle)

Hintergrund (Dark Mode):
  --bg-primary:       #313338  (Content-Bereich)
  --bg-secondary:     #2B2D31  (Sidebars)
  --bg-tertiary:      #1E1F22  (Server-Sidebar)
  --bg-floating:      #111214  (Modals/Popouts)

Text:
  --text-primary:     #F2F3F5  (Standard-Text)
  --text-secondary:   #B5BAC1  (Sekundärer Text)
  --text-muted:       #6D6F78  (Hinweise/Timestamps)
  --text-link:        #00A8FC  (Links)

Status-Farben:
  --status-online:    #23A55A
  --status-idle:      #F0B232
  --status-dnd:       #F23F43
  --status-offline:   #80848E
  --status-streaming: #593695

Semantische Farben:
  --danger:           #F23F43  (Löschen, Fehler)
  --warning:          #F0B232  (Warnungen)
  --success:          #23A55A  (Erfolg)
  --info:             #5865F2  (Information)
```

### Typografie

```
Font-Stack:
  --font-primary: 'gg sans', 'Noto Sans', Helvetica Neue, Helvetica, Arial, sans-serif
  --font-code:    'Consolas', 'Monaco', 'Andale Mono', monospace
  --font-display: 'gg sans', 'Noto Sans', sans-serif

Font-Sizes:
  --fs-xs:    12px  (Timestamps, Badges)
  --fs-sm:    14px  (Sekundärtext, Channel-Neben-Info)
  --fs-base:  16px  (Nachrichten, Standard-Text)
  --fs-lg:    20px  (Channel-Header)
  --fs-xl:    24px  (Überschriften)
  --fs-xxl:   32px  (Seiten-Titel)

Line Heights:
  --lh-tight: 1.2   (Überschriften)
  --lh-base:  1.375 (Nachrichten)
  --lh-loose: 1.5   (Beschreibungen)
```

### Spacing-System

```
Basis: 4px Grid

  --space-1:  4px
  --space-2:  8px
  --space-3:  12px
  --space-4:  16px
  --space-5:  20px
  --space-6:  24px
  --space-8:  32px
  --space-10: 40px
  --space-12: 48px
  --space-16: 64px
```

### Komponentengrößen

```
Server-Sidebar:     72px Breite (48px Icons + Padding)
Channel-Sidebar:    240px Breite
Member-List:        240px Breite
Content-Area:       flex (min 480px)
Message-Avatar:     40px (Normal), 16px (Compact)
Guild-Icon:         48px
Composer-Min-Height: 44px
Header-Height:      48px
Modal-Max-Width:    720px (Standard), 480px (Small)
```

---

## 10.2 Kern-Workflows

### Workflow 1: Registrierung & Erster Server

```
┌──────────┐    ┌────────────┐    ┌───────────┐    ┌─────────────┐
│ Landing  │───►│ Register   │───►│ Verify    │───►│ Create/Join │
│ Page     │    │ (E-Mail,   │    │ E-Mail    │    │ Server      │
│          │    │  Username, │    │           │    │             │
│          │    │  Password) │    │           │    │             │
└──────────┘    └────────────┘    └───────────┘    └──────┬──────┘
                                                          │
                                                    ┌─────▼──────┐
                                                    │ Onboarding │
                                                    │ (Channels, │
                                                    │  Rollen)   │
                                                    └─────┬──────┘
                                                          │
                                                    ┌─────▼──────┐
                                                    │ Main App   │
                                                    │ (Chat View)│
                                                    └────────────┘
```

**Technischer Flow:**
```
1. POST /auth/register { email, username, password, date_of_birth }
   → 201 { user, token }
   → Verification-Mail gesendet

2. GET /auth/verify?token=xxx
   → User.verified = true

3a. POST /guilds { name, icon? }
    → 201 { guild } mit Default-Channels
3b. POST /invites/{code}/accept
    → 201 { guild, member }

4. WS IDENTIFY { token }
   → READY { user, guilds[], private_channels[] }
   → GUILD_CREATE { guild, channels[], roles[], members[] }
```

### Workflow 2: Nachricht senden

```
User tippt → Typing Event → Nachricht absenden → Server-Verarbeitung → Fanout

Detailliert:
1. User beginnt zu tippen
   → Client: Debounced (alle 10s) WS TYPING_START senden
   → Gateway → Fanout TYPING_START an Channel-Subscriber

2. User drückt Enter
   → Client: POST /channels/:id/messages { content, nonce, message_reference? }
   → Client: Optimistic UI (Nachricht sofort anzeigen, "pending" State)

3. Server:
   a. Permission-Check (SEND_MESSAGES)
   b. Content-Validierung (Länge, Rate Limit, Slowmode)
   c. AutoMod-Prüfung (falls konfiguriert)
   d. Mention-Parsing (@user, @role, @everyone)
   e. Message in DB persistieren (ScyllaDB/PostgreSQL)
   f. Embed-Generierung async starten (Link Preview)
   g. EVENT publizieren: MESSAGE_CREATE

4. Gateway:
   a. Event empfangen
   b. Channel-Subscriber identifizieren (per Shard)
   c. Permission-Filter (Lazy Guilds)
   d. Dispatch an alle verbundenen Clients

5. Client:
   a. MESSAGE_CREATE empfangen
   b. Nonce matchen → Optimistic Message bestätigen
   c. ODER neue Message einfügen (von anderem User)
   d. Unread-State aktualisieren
   e. Notification-Logik evaluieren
```

### Workflow 3: Voice Channel beitreten

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐
│ Click    │───►│ WS: Voice   │───►│ Voice Server │───►│ UDP Audio │
│ Voice    │    │ State Update│    │ Assignment   │    │ Connected │
│ Channel  │    │             │    │ + WSS Connect│    │           │
└──────────┘    └─────────────┘    └──────────────┘    └───────────┘

Detailliert:
1. Client → Gateway: VOICE_STATE_UPDATE { guild_id, channel_id }

2. Gateway:
   a. Permission-Check (CONNECT, SPEAK)
   b. User-Limit prüfen
   c. Voice-Server zuweisen (Region-basiert)
   d. → Client: VOICE_STATE_UPDATE (eigener State)
   e. → Client: VOICE_SERVER_UPDATE { endpoint, token }
   f. → Andere Clients: VOICE_STATE_UPDATE (neuer User)

3. Client → Voice Server: WSS Connect + Identify

4. Voice Server → Client: HELLO { ssrc, ip, port, modes }

5. Client: UDP IP Discovery
   → Eigene externe IP:Port ermitteln

6. Client → Voice Server: SELECT_PROTOCOL { udp, ip, port, mode }

7. Voice Server → Client: SESSION_DESCRIPTION { mode, secret_key }

8. Audio-Stream:
   → Mikrofon → Opus Encode → Encrypt → UDP Senden
   → UDP Empfangen → Decrypt → Opus Decode → Speaker
```

### Workflow 4: Einladung erstellen & annehmen

```
Ersteller:
1. POST /channels/:id/invites { max_age, max_uses, temporary }
   → 201 { code, guild, channel, inviter, ... }
2. Invite-Link teilen: https://valhalla.app/invite/{code}

Eingeladener:
1. GET /invites/{code} → Invite-Details + Guild-Preview
2. UI: Guild-Name, Icon, Member-Count, Online-Count anzeigen
3. POST /invites/{code}/accept
4. Server:
   a. Invite validieren (Ablauf, Max-Uses, Bans)
   b. Member erstellen
   c. Onboarding-Check
   d. EVENT: GUILD_MEMBER_ADD
5. Client: GUILD_CREATE Event mit allen Guild-Daten
```

### Workflow 5: Permission-Check (intern)

```
Eingabe: user_id, channel_id, required_permission

1. Member laden (user_id, guild_id)
   → Rollen-IDs extrahieren

2. Guild-Permissions berechnen:
   base = guild.everyone_role.permissions
   for role in member.roles:
     base |= role.permissions
   if base & ADMINISTRATOR:
     return ALLOW_ALL

3. Channel-Permissions berechnen:
   channel_perms = base

   // @everyone overwrite
   if overwrite = channel.overwrites[@everyone]:
     channel_perms &= ~overwrite.deny
     channel_perms |= overwrite.allow

   // Rollen-Overwrites (gesammelt)
   role_allow = 0
   role_deny = 0
   for role in member.roles:
     if overwrite = channel.overwrites[role]:
       role_allow |= overwrite.allow
       role_deny |= overwrite.deny
   channel_perms &= ~role_deny
   channel_perms |= role_allow

   // User-Overwrite
   if overwrite = channel.overwrites[user_id]:
     channel_perms &= ~overwrite.deny
     channel_perms |= overwrite.allow

4. return (channel_perms & required_permission) == required_permission
```

### Workflow 6: Moderation — AutoMod

```
Nachricht eingehend:
1. AutoMod-Regeln für Guild laden (gecacht)

2. Für jede aktive Regel:
   a. Keyword-Filter: Content gegen Keyword-Liste prüfen
      → Regex-Match oder Wildcard-Match
   b. Spam-Detection: Rate des Users im Channel prüfen
   c. Mention-Spam: Anzahl Mentions > Threshold?
   d. Link-Filter: URLs gegen Allowlist/Blocklist

3. Bei Match:
   a. Action ausführen:
      - BLOCK_MESSAGE → Nachricht nicht senden, User informieren
      - ALERT → Nachricht an Alert-Channel senden
      - TIMEOUT → User temporär stummschalten
   b. EVENT: AUTO_MODERATION_ACTION_EXECUTION
   c. Audit-Log-Eintrag erstellen

4. Wenn keine Regel greift → Nachricht normal verarbeiten
```

---

## 10.3 Communication Stack — Detaillierte Schicht-Dokumentation

### Schicht 1: Edge / CDN Layer

```
┌─────────────────────────────────────────────────────────┐
│                    EDGE LAYER                            │
│                                                         │
│  Cloudflare / eigener Edge                              │
│  ├── DDoS-Schutz                                       │
│  ├── WAF (Web Application Firewall)                     │
│  ├── SSL/TLS Termination                               │
│  ├── Static Asset Caching                               │
│  ├── WebSocket Proxying                                 │
│  ├── Rate Limiting (L7)                                 │
│  └── Geo-Routing                                        │
│                                                         │
│  Routing-Regeln:                                        │
│  /api/*          → API Gateway Cluster                  │
│  /ws/*           → WebSocket Gateway Cluster            │
│  /voice/*        → Voice Gateway (Region-basiert)       │
│  /assets/*       → CDN / Object Storage                 │
│  /*              → Web Client (SPA)                     │
└─────────────────────────────────────────────────────────┘
```

### Schicht 2: API Gateway Layer

```
┌─────────────────────────────────────────────────────────┐
│                  API GATEWAY                              │
│                                                         │
│  Aufgaben:                                              │
│  ├── Request-Routing zu Backend-Services                │
│  ├── Authentication Middleware (Token → User)           │
│  ├── Rate Limiting (Per-User, Per-Route)               │
│  ├── Request/Response Logging                          │
│  ├── CORS-Handling                                      │
│  ├── Request Validation                                │
│  └── API Versioning (/api/v1/)                          │
│                                                         │
│  Technologie: Nginx/Caddy + Custom Middleware           │
│  ODER: Go/Rust Service mit embedded Router              │
│                                                         │
│  Rate-Limit-Architektur:                                │
│  ├── Global: 50 req/s pro User (Redis Counter)         │
│  ├── Per-Route: Konfigurierbar (Token Bucket)           │
│  └── Shared Buckets: Routes die zusammen limitiert sind │
└─────────────────────────────────────────────────────────┘
```

### Schicht 3: WebSocket Gateway Layer

```
┌─────────────────────────────────────────────────────────┐
│              WEBSOCKET GATEWAY                           │
│                                                         │
│  Technologie: Elixir/BEAM oder Go                       │
│                                                         │
│  Architektur:                                           │
│  ├── N Gateway-Nodes hinter Load Balancer              │
│  ├── Jeder Node hält M Shards                          │
│  ├── Jeder Shard = Subset von Guilds                   │
│  ├── Guild → Shard Mapping: (guild_id >> 22) % shards  │
│  └── Connections pro Node: 100K-1M (je nach HW)        │
│                                                         │
│  Event-Routing:                                         │
│  1. Service publiziert Event auf Message Bus            │
│  2. Bus → alle Gateway-Nodes (Topic: guild_id)          │
│  3. Node: Shard identifizieren → Connections filtern    │
│  4. Pro Connection: Permission-Check + Dispatch          │
│                                                         │
│  Skalierung:                                            │
│  ├── Horizontal: Mehr Nodes = mehr Connections          │
│  ├── Sharding: Guilds auf Shards verteilt              │
│  └── Backpressure: Slow Consumers werden disconnected  │
└─────────────────────────────────────────────────────────┘
```

### Schicht 4: Service Layer

```
┌─────────────────────────────────────────────────────────┐
│                SERVICE LAYER                             │
│                                                         │
│  Inter-Service-Kommunikation:                           │
│  ├── Synchron: gRPC (für Permission-Checks, Lookups)   │
│  ├── Asynchron: NATS JetStream (Events, Tasks)         │
│  └── Cache: Redis (Shared State)                       │
│                                                         │
│  Jeder Service:                                         │
│  ├── Eigene Datenbank/Schema (Service Ownership)       │
│  ├── Eigene gRPC API (intern)                          │
│  ├── Publiziert Events auf NATS                         │
│  ├── Health Check Endpoint                              │
│  └── Prometheus Metrics Endpoint                       │
│                                                         │
│  Service Discovery:                                     │
│  └── Kubernetes DNS oder Consul                        │
└─────────────────────────────────────────────────────────┘
```

### Schicht 5: Data Layer

```
┌─────────────────────────────────────────────────────────┐
│                  DATA LAYER                               │
│                                                         │
│  PostgreSQL (Primary):                                  │
│  ├── Users, Guilds, Channels, Roles, Members           │
│  ├── Invites, Bans, Webhooks, OAuth                    │
│  ├── Audit Logs, AutoMod Rules                         │
│  └── Replikation: 1 Primary + N Replicas (Read)        │
│                                                         │
│  ScyllaDB (Messages — ab Scale):                        │
│  ├── Messages partitioniert: (channel_id, time_bucket) │
│  ├── Reactions, Attachments (denormalisiert)            │
│  └── Horizontal skalierbar, Multi-DC                   │
│                                                         │
│  Redis:                                                  │
│  ├── Sessions (TTL-basiert)                             │
│  ├── Presence State (Hash per Guild)                   │
│  ├── Rate Limit Counters (INCR + EXPIRE)               │
│  ├── Permission Cache (TTL + Invalidation)             │
│  ├── Pub/Sub (Gateway Event Routing)                   │
│  └── Typing State (SETEX, kurze TTL)                   │
│                                                         │
│  Meilisearch/Elasticsearch:                              │
│  ├── Message Search Index                               │
│  ├── Guild Discovery Index                              │
│  └── User Search Index                                 │
│                                                         │
│  Object Storage (MinIO/S3):                              │
│  ├── Attachments: /attachments/{channel_id}/{msg_id}/  │
│  ├── Avatars: /avatars/{user_id}/{hash}.{ext}          │
│  ├── Icons: /icons/{guild_id}/{hash}.{ext}             │
│  ├── Emojis: /emojis/{emoji_id}.{ext}                 │
│  └── Presigned URLs für Upload + Download              │
└─────────────────────────────────────────────────────────┘
```

### Schicht 6: Media / Voice Layer

```
┌─────────────────────────────────────────────────────────┐
│                MEDIA LAYER (LiveKit)                      │
│                                                         │
│  Architektur:                                           │
│  ├── LiveKit Server Cluster (pro Region)               │
│  ├── TURN/STUN Server (Coturn, pro Region)             │
│  └── Recording Service (optional, S3-backed)           │
│                                                         │
│  Voice Flow:                                            │
│  1. Client → REST API: Voice Channel Join               │
│  2. API → LiveKit: Room erstellen/joinen               │
│  3. LiveKit → Client: WebRTC Token                     │
│  4. Client → LiveKit: WebRTC Connect                   │
│  5. Audio/Video: WebRTC (ICE + DTLS-SRTP)              │
│                                                         │
│  Codec-Strategie:                                       │
│  ├── Audio: Opus (Default, 48kHz, ~64kbps)             │
│  ├── Video: VP9 (Default), H.264 (Fallback)            │
│  └── Screen: VP9 (hohe Auflösung, niedrige FPS)        │
│                                                         │
│  Skalierung:                                            │
│  ├── Regionale Deployments (EU, US-East, US-West, Asia)│
│  ├── Auto-Scaling basierend auf Participant-Count       │
│  └── Cascading SFU für Cross-Region                    │
│                                                         │
│  Quality Features:                                       │
│  ├── Simulcast (multiple Qualitäts-Layer)              │
│  ├── Adaptive Bitrate (basierend auf Bandwidth)        │
│  ├── Noise Suppression (Krisp/RNNoise Integration)     │
│  └── Echo Cancellation (WebRTC AEC)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 10.4 Event-Katalog

### Kern-Events (über WebSocket Gateway)

| Event | Trigger | Payload (Kern) | Fan-Out Scope |
|-------|---------|----------------|--------------|
| `MESSAGE_CREATE` | Neue Nachricht | message, author, channel_id | Channel Subscribers |
| `MESSAGE_UPDATE` | Nachricht bearbeitet | message (partial), channel_id | Channel Subscribers |
| `MESSAGE_DELETE` | Nachricht gelöscht | id, channel_id, guild_id | Channel Subscribers |
| `MESSAGE_REACTION_ADD` | Reaction hinzugefügt | user_id, channel_id, message_id, emoji | Channel Subscribers |
| `MESSAGE_REACTION_REMOVE` | Reaction entfernt | user_id, channel_id, message_id, emoji | Channel Subscribers |
| `TYPING_START` | User tippt | channel_id, user_id, timestamp | Channel Subscribers |
| `PRESENCE_UPDATE` | Status-Änderung | user_id, status, activities, client_status | Guild Members (mutual) |
| `VOICE_STATE_UPDATE` | Voice State ändert sich | user_id, channel_id, guild_id, mute, deaf | Guild Members |
| `GUILD_CREATE` | Initial/Join | Vollständige Guild-Daten | Nur dieser User |
| `GUILD_UPDATE` | Guild-Einstellungen geändert | guild (partial) | Guild Members |
| `GUILD_DELETE` | Guild gelöscht oder User entfernt | guild_id | Betroffene User |
| `GUILD_MEMBER_ADD` | Neues Mitglied | member, guild_id | Guild Members |
| `GUILD_MEMBER_UPDATE` | Mitglied geändert (Rollen etc.) | member (partial), guild_id | Guild Members |
| `GUILD_MEMBER_REMOVE` | Mitglied entfernt | user_id, guild_id | Guild Members |
| `CHANNEL_CREATE` | Neuer Channel | channel | Guild Members (mit Zugriff) |
| `CHANNEL_UPDATE` | Channel geändert | channel (partial) | Guild Members (mit Zugriff) |
| `CHANNEL_DELETE` | Channel gelöscht | channel_id, guild_id | Guild Members |
| `GUILD_ROLE_CREATE` | Neue Rolle | role, guild_id | Guild Members |
| `GUILD_ROLE_UPDATE` | Rolle geändert | role, guild_id | Guild Members |
| `GUILD_ROLE_DELETE` | Rolle gelöscht | role_id, guild_id | Guild Members |
| `THREAD_CREATE` | Neuer Thread | thread (channel object) | Channel Subscribers |
| `THREAD_UPDATE` | Thread geändert | thread (partial) | Thread Members |
| `USER_UPDATE` | Eigenes Profil geändert | user | Nur dieser User |
| `VOICE_SERVER_UPDATE` | Voice-Server zugewiesen | token, guild_id, endpoint | Nur dieser User |

---

## 10.5 API-Route-Übersicht

### Auth

```
POST   /api/v1/auth/register        → Registrierung
POST   /api/v1/auth/login            → Login
POST   /api/v1/auth/mfa              → MFA-Verifizierung
POST   /api/v1/auth/token/refresh    → Token Refresh
POST   /api/v1/auth/logout           → Logout
POST   /api/v1/auth/verify-email     → E-Mail verifizieren
POST   /api/v1/auth/reset-password   → Passwort-Reset anfordern
POST   /api/v1/auth/reset-password/confirm → Passwort-Reset bestätigen
```

### Users

```
GET    /api/v1/users/@me             → Eigenes Profil
PATCH  /api/v1/users/@me             → Profil bearbeiten
GET    /api/v1/users/:id             → User-Profil
GET    /api/v1/users/@me/guilds      → Eigene Server
GET    /api/v1/users/@me/channels    → DM-Channels
POST   /api/v1/users/@me/channels    → DM erstellen
GET    /api/v1/users/@me/relationships → Freundesliste
PUT    /api/v1/users/@me/relationships/:id → Freund hinzufügen
DELETE /api/v1/users/@me/relationships/:id → Freund entfernen
```

### Guilds

```
POST   /api/v1/guilds                → Server erstellen
GET    /api/v1/guilds/:id            → Server-Details
PATCH  /api/v1/guilds/:id            → Server bearbeiten
DELETE /api/v1/guilds/:id            → Server löschen
GET    /api/v1/guilds/:id/channels   → Channel-Liste
POST   /api/v1/guilds/:id/channels   → Channel erstellen
GET    /api/v1/guilds/:id/members    → Mitglieder-Liste
GET    /api/v1/guilds/:id/members/:id → Einzelnes Mitglied
PATCH  /api/v1/guilds/:id/members/:id → Mitglied bearbeiten
DELETE /api/v1/guilds/:id/members/:id → Mitglied entfernen (Kick)
GET    /api/v1/guilds/:id/roles      → Rollen-Liste
POST   /api/v1/guilds/:id/roles      → Rolle erstellen
PATCH  /api/v1/guilds/:id/roles/:id  → Rolle bearbeiten
DELETE /api/v1/guilds/:id/roles/:id  → Rolle löschen
GET    /api/v1/guilds/:id/bans       → Ban-Liste
PUT    /api/v1/guilds/:id/bans/:user_id → User bannen
DELETE /api/v1/guilds/:id/bans/:user_id → Ban aufheben
GET    /api/v1/guilds/:id/invites    → Einladungs-Liste
GET    /api/v1/guilds/:id/audit-logs → Audit Log
```

### Channels

```
GET    /api/v1/channels/:id          → Channel-Details
PATCH  /api/v1/channels/:id          → Channel bearbeiten
DELETE /api/v1/channels/:id          → Channel löschen
GET    /api/v1/channels/:id/messages → Nachrichtenverlauf
POST   /api/v1/channels/:id/messages → Nachricht senden
GET    /api/v1/channels/:id/messages/:id → Einzelne Nachricht
PATCH  /api/v1/channels/:id/messages/:id → Nachricht bearbeiten
DELETE /api/v1/channels/:id/messages/:id → Nachricht löschen
POST   /api/v1/channels/:id/messages/bulk-delete → Bulk Delete
PUT    /api/v1/channels/:id/messages/:id/reactions/:emoji/@me → Reaction
DELETE /api/v1/channels/:id/messages/:id/reactions/:emoji/@me → Reaction entfernen
GET    /api/v1/channels/:id/pins     → Gepinnte Nachrichten
PUT    /api/v1/channels/:id/pins/:message_id → Nachricht pinnen
POST   /api/v1/channels/:id/invites  → Einladung erstellen
POST   /api/v1/channels/:id/threads  → Thread erstellen
PUT    /api/v1/channels/:id/permissions/:overwrite_id → Permission Overwrite
```

### Invites

```
GET    /api/v1/invites/:code         → Invite-Details
POST   /api/v1/invites/:code/accept  → Einladung annehmen
DELETE /api/v1/invites/:code         → Einladung löschen
```

### Voice

```
(Primär über WebSocket Gateway Opcodes)
POST   /api/v1/voice/regions         → Verfügbare Voice-Regionen
```

### Search

```
GET    /api/v1/guilds/:id/messages/search?content=&author_id=&has=&before=&after=&channel_id=
```
