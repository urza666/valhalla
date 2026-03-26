# Kernkonzept: Valhalla — Echtzeit-Kommunikationsplattform

> **Projektname:** Valhalla (Arbeitstitel)
> **Vision:** Eine moderne, skalierbare Echtzeit-Kommunikationsplattform für Communities und Business-Teams — mit dem UX-Erlebnis von Discord, der Business-Tauglichkeit von MS Teams, und einzigartigen Differenzierungsmerkmalen.
> **Erstellt:** 2026-03-26

---

## 1. Produktvision

Valhalla vereint die besten Eigenschaften bestehender Kommunikationsplattformen und adressiert deren Schwächen:

- **Von Discord:** Persistente Voice Channels, Community-Struktur (Guilds), intuitive 3-Panel-Navigation, Echtzeit-First-Architektur
- **Von Slack:** Starke Thread-UX, strukturierte Workspace-Organisation, Integration-Ökosystem
- **Von MS Teams:** Business-Features (Kanban, Kalender, Dateien, SSO, Compliance), Enterprise-Tauglichkeit
- **Eigene Differenzierung:** AI-Features, Self-Hosting, Unified Inbox, leichtgewichtiger Client, native Produktivitäts-Module

### Zielgruppen

| Segment | Beschreibung | Priorität |
|---------|-------------|-----------|
| **Open Communities** | Gaming, Hobby, Fan-Communities (Discord-Equivalent) | P1 |
| **Small Teams** | Startups, kleine Unternehmen (5-50 Personen) | P1 |
| **Large Organizations** | Unternehmen (50-10.000+) | P2 |
| **Education** | Schulen, Universitäten, Lerngruppen | P2 |
| **Creator Economy** | Content Creator, Patreon-Communities | P3 |

---

## 2. Architektur-Grundprinzipien

### 2.1 Design Principles

1. **Realtime First** — Alles was sich ändern kann, wird in Echtzeit synchronisiert
2. **Permission by Default** — Sicherheit ist kein Feature, sondern Grundlage
3. **Modular by Design** — Features als unabhängige Module, nicht monolithisch
4. **Scale Horizontally** — Jede Komponente horizontal skalierbar designen
5. **Client-Agnostic** — API-First, alle Clients sind gleichberechtigte Konsumenten
6. **Self-Hostable** — Core muss ohne Cloud-Abhängigkeit deployt werden können
7. **Extensible** — Bot-API und Webhooks von Tag 1

### 2.2 Technologie-Entscheidungen

```
┌──────────────────────────────────────────────────────────┐
│                    EMPFOHLENER STACK                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CLIENTS                                                 │
│  ├── Web:     React + TypeScript + Zustand + TanStack    │
│  ├── Desktop: Tauri (Rust + Web) oder Electron           │
│  └── Mobile:  React Native / Expo                        │
│                                                          │
│  GATEWAY                                                 │
│  └── Elixir/Phoenix (BEAM VM) — WebSocket Gateway        │
│      ODER Go mit goroutines/channels                     │
│                                                          │
│  API LAYER                                               │
│  └── Go ODER Rust ODER Elixir/Phoenix                    │
│      (REST API + Internal gRPC)                          │
│                                                          │
│  VOICE/MEDIA                                             │
│  └── LiveKit (Open-Source SFU, Go+WebRTC)                │
│      ODER mediasoup (Node.js SFU)                        │
│                                                          │
│  DATABASES                                               │
│  ├── PostgreSQL — Relational Data (Users, Guilds, etc.)  │
│  ├── ScyllaDB  — Messages (high write throughput)        │
│  ├── Redis     — Cache, Sessions, Presence, Pub/Sub      │
│  └── Meilisearch/Elasticsearch — Search                  │
│                                                          │
│  INFRASTRUCTURE                                          │
│  ├── NATS/Redis Streams — Message Broker                 │
│  ├── MinIO/S3  — Object Storage                          │
│  ├── Caddy/Nginx — Reverse Proxy + Auto-TLS              │
│  ├── Docker + K8s — Container Orchestration              │
│  └── Prometheus + Grafana + Loki — Observability         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.3 System-Architektur Übersicht

```
                         ┌───────────────┐
                         │   CDN/Edge    │
                         │  (Cloudflare) │
                         └───────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
              │  REST API  │ │  WS    │ │  Voice   │
              │  Gateway   │ │Gateway │ │ Gateway  │
              │ (HTTP/S)   │ │(WSS)   │ │(WSS+UDP) │
              └─────┬──────┘ └───┬────┘ └────┬─────┘
                    │            │            │
              ┌─────▼────────────▼────────────▼─────┐
              │         SERVICE MESH / BUS           │
              │    (NATS / Redis Streams / gRPC)     │
              └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬───┘
                 │  │  │  │  │  │  │  │  │  │  │
    ┌────────────┤  │  │  │  │  │  │  │  │  │  │
    │            │  │  │  │  │  │  │  │  │  │  │
┌───▼──┐  ┌─────▼┐ │  │  │  │  │  │  │  │  │  │
│Auth  │  │User  │ │  │  │  │  │  │  │  │  │  │
│Svc   │  │Svc   │ │  │  │  │  │  │  │  │  │  │
└──────┘  └──────┘ │  │  │  │  │  │  │  │  │  │
    ┌──────────────┘  │  │  │  │  │  │  │  │  │
┌───▼──┐  ┌───────────▼┐│  │  │  │  │  │  │  │
│Guild │  │Channel     ││  │  │  │  │  │  │  │
│Svc   │  │Svc         ││  │  │  │  │  │  │  │
└──────┘  └────────────┘│  │  │  │  │  │  │  │
    ┌───────────────────┘  │  │  │  │  │  │  │
┌───▼──┐  ┌────────────────▼┐│  │  │  │  │  │
│Msg   │  │Permission      ││  │  │  │  │  │
│Svc   │  │Svc             ││  │  │  │  │  │
└──────┘  └────────────────┘│  │  │  │  │  │
    ┌───────────────────────┘  │  │  │  │  │
┌───▼──────┐  ┌────────────────▼┐│  │  │  │
│Presence  │  │Notification    ││  │  │  │
│Svc       │  │Svc             ││  │  │  │
└──────────┘  └────────────────┘│  │  │  │
    ┌───────────────────────────┘  │  │  │
┌───▼──────┐  ┌────────────────────▼┐│  │
│Search    │  │Moderation          ││  │
│Svc       │  │Svc                 ││  │
└──────────┘  └────────────────────┘│  │
    ┌───────────────────────────────┘  │
┌───▼──────┐  ┌────────────────────────▼┐
│Media/    │  │Bot/Integration         │
│Voice Svc │  │Platform                │
└──────────┘  └────────────────────────┘
```

---

## 3. Kern-Datenmodell (vereinfacht)

```
User ──────────┬──── Member ──── Guild
               │        │          │
               │     has Roles ◄───┤
               │        │          │
               ├──── Relationship  ├──── Channel ──── Message
               │                   │        │           │
               └──── Session       │        │        Attachment
                                   │        │        Reaction
                                   │     Thread      Embed
                                   │
                                   ├──── Invite
                                   ├──── Ban
                                   ├──── Emoji
                                   └──── AuditLogEntry
```

### ID-Strategie: Snowflake

```
64-Bit Snowflake:
[Timestamp 42 Bit][Worker 5 Bit][Process 5 Bit][Increment 12 Bit]

- Custom Epoch: Projektstartdatum
- Zeitlich sortierbar → kein created_at-Feld nötig
- Dezentral generierbar → kein Single Point of Failure
- Effizient als Primary Key in allen Datenbanken
```

---

## 4. Realtime-Kommunikationskonzept

### 4.1 Drei Kommunikationsebenen

| Ebene | Transport | Daten | Latenz-Ziel |
|-------|-----------|-------|-------------|
| **Control Plane** | WebSocket (WSS) | Events, Presence, Typing, State Changes | <500ms |
| **Data Plane** | HTTPS/REST | CRUD, History, Search, Upload | <2s |
| **Media Plane** | UDP/SRTP | Audio, Video, Screen Share | <200ms |

### 4.2 Gateway-Protokoll

```
Opcodes:
0  = Dispatch (Server → Client, mit Event-Name + Payload)
1  = Heartbeat (bidirektional)
2  = Identify (Client → Server, Auth)
3  = Presence Update (Client → Server)
4  = Voice State Update (Client → Server)
6  = Resume (Client → Server)
7  = Reconnect (Server → Client)
8  = Request Guild Members (Client → Server)
9  = Invalid Session (Server → Client)
10 = Hello (Server → Client, mit Heartbeat-Intervall)
11 = Heartbeat ACK (Server → Client)

Jedes Dispatch-Event hat:
- op: 0
- s: sequence_number (incrementing)
- t: event_name (z.B. "MESSAGE_CREATE")
- d: event_payload (JSON)
```

### 4.3 Voice-Architektur

```
Empfehlung: LiveKit als SFU

Client → WebSocket Signaling → LiveKit Server → WebRTC/UDP Media

Vorteile von LiveKit:
- Open Source (Apache 2.0)
- Production-ready SFU in Go
- WebRTC-kompatibel
- Screen Share, Simulcast, SVC Support
- Eigene Client-SDKs (Web, React Native, Flutter, Swift, Kotlin)
- Recording-Unterstützung
- Self-hostable
```

---

## 5. Permission-Modell

```
Hierarchie:
1. Server-Ebene (@everyone)
2. + Rollen-Permissions (OR-Verknüpft)
3. → Wenn ADMINISTRATOR → Alles erlaubt
4. Für Channel:
   a. Basis = berechnete Server-Permissions
   b. - @everyone Channel Deny
   c. + @everyone Channel Allow
   d. - Rollen Channel Deny (OR aller Rollen)
   e. + Rollen Channel Allow (OR aller Rollen)
   f. - User Channel Deny
   g. + User Channel Allow
   = Finale Channel-Permissions

Caching:
- Computed Permissions pro (user, channel) cachen
- Invalidierung bei: Rollen-Änderung, Override-Änderung, Mitglieds-Rollen-Änderung
```

---

## 6. Differenzierungs-Strategie

### Was wir besser machen als Discord

| Bereich | Discord | Valhalla |
|---------|---------|---------|
| **Organisation** | Nur Server-Ordner | Unified Inbox, Quick Switcher, Global Favorites |
| **Threads** | Schwache Sichtbarkeit | Dediziertes Thread-Panel, Thread-Inbox |
| **Business** | Keine Business-Features | Kanban, Wiki, Kalender, SSO, Compliance |
| **AI** | Clyde (limitiert) | Channel Summary, Transcription, Smart Search |
| **Client** | Electron (schwer) | Tauri (leicht) oder optimiertes Electron |
| **Hosting** | Nur Cloud | Self-Hosting Option |
| **Moderation** | Basis-AutoMod | ML-Moderation, Mod-Dashboard, Warn-System |
| **Suche** | Langsam, begrenzt | Schnelle semantische Suche + Attachment-Indexierung |

---

## 7. Build-Roadmap Übersicht

```
PHASE 0: Foundation          [Woche 1-2]
  → Projekt-Setup, DB-Schema, Auth, REST-Framework, WS-Grundgerüst

PHASE 1: Text-Chat MVP       [Woche 3-6]
  → Guilds, Channels, Messaging, Realtime, Basis-Permissions, Web Client

PHASE 2: Social & DMs        [Woche 7-8]
  → DMs, Freunde, Profile, Presence, Reactions, File Upload

PHASE 3: Voice               [Woche 9-12]
  → LiveKit Integration, Voice Channels, Mute/Deafen, Voice UI

PHASE 4: Polish              [Woche 13-16]
  → Moderation, Threads, Embeds, Suche, Notifications

PHASE 5: Video & Multi-Plat. [Woche 17-24]
  → Video, Screenshare, Desktop, Mobile, Push

PHASE 6: Differenzierung     [Woche 25-36]
  → Kanban, Wiki, AI-Features, Bot API, SSO

PHASE 7: Enterprise          [Woche 37+]
  → Compliance, Self-Hosting, Federation, Marketplace
```

---

## 8. Entscheidungsprotokoll

| Entscheidung | Option A | Option B | Gewählt | Begründung |
|-------------|----------|----------|---------|------------|
| Gateway-Sprache | Elixir/BEAM | Go | **Zu evaluieren** | Elixir: bessere Concurrency; Go: größerer Talentpool |
| API-Sprache | Go | Rust | **Zu evaluieren** | Go: schnellere Entwicklung; Rust: bessere Performance |
| SFU | LiveKit | mediasoup | **LiveKit** | Go-basiert, bessere Docs, Self-hostable, aktive Community |
| Desktop Client | Electron | Tauri | **Tauri** | Deutlich geringerer RAM, Rust-Backend, moderne Architektur |
| Nachrichten-DB | PostgreSQL | ScyllaDB | **PostgreSQL (MVP)** | Für MVP reicht PG; ScyllaDB bei >10M Messages evaluieren |
| ID-Strategie | UUID | Snowflake | **Snowflake** | Sortierbar, effizienter, enthält Timestamp |
| Search | Meilisearch | Elasticsearch | **Meilisearch (MVP)** | Einfacher zu betreiben; ES bei Enterprise-Scale |
| Message Broker | NATS | Redis Streams | **NATS** | Persistenz, bessere Pub/Sub-Semantik, JetStream |
