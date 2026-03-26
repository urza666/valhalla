# 4. Architektur-Liste

> **Quellenhinweise:**
> - **[O]** = Offiziell (Discord Engineering Blog, Developer Docs)
> - **[H]** = Herleitung (fundierte technische Schlussfolgerung)
> - **[A]** = Annahme (plausibel, aber nicht bestätigt)

---

## 4.1 Systemkontext

### Systemübersicht

```
                    ┌─────────────────────────────────┐
                    │         EXTERNE SYSTEME          │
                    │  E-Mail │ Push (FCM/APNs) │ CDN │
                    │  Tenor │ OAuth Providers │ DNS  │
                    │  Payment │ STUN/TURN Infra      │
                    └──────────────┬──────────────────┘
                                   │
┌─────────────┐    ┌──────────────┴──────────────────┐
│   CLIENTS   │    │         PLATFORM CORE            │
│             │    │                                   │
│ Web (React) ├───►│  API Gateway ◄──► Service Layer  │
│ Desktop     │    │  WS Gateway  ◄──► Event Bus      │
│ (Electron)  │    │  Voice GW    ◄──► Media Layer     │
│ Mobile      │    │                                   │
│ (RN/Native) │    │  ┌─── Data Layer ───┐            │
│             │    │  │ PostgreSQL       │            │
│ Bots/Apps   ├───►│  │ ScyllaDB         │            │
│ (API)       │    │  │ Redis            │            │
│             │    │  │ Elasticsearch    │            │
└─────────────┘    │  │ S3/Object Store  │            │
                    │  └─────────────────┘            │
                    └─────────────────────────────────┘
```

### Clients

| Client | Technologie | Besonderheiten |
|--------|-------------|----------------|
| **Web** | React, TypeScript, Webpack/Vite **[O/H]** | Vollständig im Browser, WebRTC für Voice/Video |
| **Desktop** | Electron (Chromium + Node.js) **[O]** | Native APIs (Notifications, Keybinds, Overlay), Auto-Update |
| **iOS** | React Native / Swift (hybrid) **[H]** | Push Notifications via APNs, Background Audio |
| **Android** | React Native / Kotlin (hybrid) **[H]** | FCM Push, Background Services |
| **Bot/API** | REST + WebSocket Gateway **[O]** | Rate-Limited, Intent-basiert |

### Externe Systeme

| System | Zweck | Kritikalität |
|--------|-------|-------------|
| **E-Mail-Provider** (SES/Mailgun) | Transactional Mails, Verifizierung | Hoch |
| **Push-Services** (FCM, APNs) | Mobile Notifications | Hoch |
| **CDN** (Cloudflare) **[O]** | Asset Delivery, DDoS-Schutz | Sehr hoch |
| **Object Storage** (S3/GCS) | Datei-/Medien-Speicherung | Hoch |
| **Tenor/Giphy API** | GIF-Integration | Niedrig |
| **OAuth Providers** | Social Login, Connected Accounts | Mittel |
| **Payment** (Stripe) **[H]** | Nitro/Shop Billing | Mittel (nur bei Monetarisierung) |
| **STUN/TURN** | NAT Traversal für Voice/Video | Sehr hoch |

---

## 4.2 Backend-Domänen / Services

### Service 1: Identity & Auth Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Registrierung, Login, Token-Management, MFA, Session-Verwaltung |
| **Kernobjekte** | User (auth), Session, Device, MFA-Config, OAuth-Grant |
| **APIs** | `POST /auth/register`, `POST /auth/login`, `POST /auth/mfa`, `POST /auth/token/refresh`, `DELETE /auth/sessions/:id` |
| **Events** | `USER_CREATED`, `SESSION_CREATED`, `SESSION_REVOKED` |
| **Abhängigkeiten** | PostgreSQL (Users), Redis (Sessions/Tokens), E-Mail-Service |
| **Skalierung** | Stateless, horizontal skalierbar; Redis für Session-Store |
| **Stateful/Stateless** | Stateless (State in DB/Redis) |
| **Kritikalität** | ★★★★★ — Kein Zugang ohne Auth |

### Service 2: User & Profile Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Profilverwaltung, Beziehungen (Freunde/Block), Connected Accounts |
| **Kernobjekte** | UserProfile, Relationship, ConnectedAccount, CustomStatus |
| **APIs** | `GET/PATCH /users/@me`, `GET /users/:id`, `PUT /users/@me/relationships/:id`, `GET /users/@me/connections` |
| **Events** | `USER_UPDATE`, `RELATIONSHIP_ADD/REMOVE`, `PRESENCE_UPDATE` |
| **Abhängigkeiten** | PostgreSQL, Asset Service (Avatare), Auth Service |
| **Skalierung** | Read-heavy, gut cachebar |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★★☆ |

### Service 3: Guild/Community Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Server-CRUD, Mitgliedschaftsverwaltung, Einladungen, Server-Einstellungen |
| **Kernobjekte** | Guild, Member, Invite, Ban, GuildSettings, Onboarding-Config |
| **APIs** | `POST /guilds`, `GET /guilds/:id`, `PATCH /guilds/:id`, `GET /guilds/:id/members`, `POST /guilds/:id/members`, `POST /invites`, `PUT /guilds/:id/bans/:user_id` |
| **Events** | `GUILD_CREATE`, `GUILD_UPDATE`, `GUILD_DELETE`, `GUILD_MEMBER_ADD/REMOVE/UPDATE`, `INVITE_CREATE/DELETE` |
| **Abhängigkeiten** | Auth, Permission, Channel Service |
| **Skalierung** | Mittel; Member-Listen bei großen Servern (>100K) sind herausfordernd **[O]** |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★★★ |

### Service 4: Channel Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Channel-CRUD, Kategorien, Thread-Management, Forum-Posts |
| **Kernobjekte** | Channel (Text/Voice/Category/Forum/Stage/Announcement), Thread, ForumPost, ForumTag |
| **APIs** | `POST /guilds/:id/channels`, `PATCH /channels/:id`, `POST /channels/:id/threads`, `GET /channels/:id/threads/active` |
| **Events** | `CHANNEL_CREATE/UPDATE/DELETE`, `THREAD_CREATE/UPDATE/DELETE`, `THREAD_MEMBER_UPDATE` |
| **Abhängigkeiten** | Guild Service, Permission Service |
| **Skalierung** | Read-heavy, gut cachebar |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★★★ |

### Service 5: Messaging Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Nachrichten-CRUD, Delivery, Reactions, Pins, Attachments, Embeds |
| **Kernobjekte** | Message, Attachment, Embed, Reaction, Pin |
| **APIs** | `POST /channels/:id/messages`, `PATCH /channels/:id/messages/:id`, `DELETE .../messages/:id`, `PUT .../messages/:id/reactions/:emoji/@me`, `GET .../messages?before=&limit=` |
| **Events** | `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`, `MESSAGE_REACTION_ADD/REMOVE`, `MESSAGE_BULK_DELETE` |
| **Abhängigkeiten** | Channel, Permission, Asset, Search (für Indexierung), Gateway (Fanout) |
| **Skalierung** | **Höchste Anforderungen.** Discord speichert Billionen Nachrichten. Cassandra/ScyllaDB für Messages **[O]**, partitioniert nach Channel+Time. |
| **Stateful/Stateless** | Stateless (Daten in ScyllaDB/Cassandra) |
| **Kritikalität** | ★★★★★ |

> **[O]** Discord migrierte von MongoDB (2015-2017) → Cassandra (2017) → ScyllaDB (2023) für Nachrichtenspeicherung.
> Partitionierung: `(channel_id, bucket)` wobei bucket ein Zeitfenster ist.
>
> **[O]** Cassandra-Probleme (Blog: "How Discord Stores Trillions of Messages", 2023):
> - JVM GC-Pauses → unvorhersehbare p99 Latenz
> - Hot Partitions bei sehr aktiven Channels
> - Tombstone-Problematik bei gelöschten Nachrichten → verlangsamte Reads
> - Compaction Storms → hohe I/O-Last
> - Cluster: ~177 Cassandra-Knoten, Billionen Nachrichten
>
> **[O]** ScyllaDB-Migration: C++-Reimplementierung ohne GC, Shard-per-Core (Seastar Framework), dramatisch bessere p99 Latenz.
>
> **[O]** Zusätzlich: Eigener **Data Services Layer in Rust** zwischen App und DB:
> - Request Coalescing (identische gleichzeitige Requests zusammengeführt)
> - Konsistentes Hashing für Routing
> - Schutzschicht gegen Hot-Partition-Probleme
>
> **[O]** Go → Rust Migration (Blog: "Why Discord is Switching from Go to Rust", 2020):
> Read States Service migriert wegen Go-GC Latenz-Spikes alle 2 Minuten. Rust eliminierte das Problem durch Ownership-Modell ohne GC.

### Service 6: Permission & Role Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Rollen-CRUD, Permission-Berechnung, Channel-Overrides |
| **Kernobjekte** | Role, Permission, PermissionOverwrite |
| **APIs** | `POST /guilds/:id/roles`, `PATCH /guilds/:id/roles/:id`, `PUT /channels/:id/permissions/:overwrite_id` |
| **Events** | `GUILD_ROLE_CREATE/UPDATE/DELETE` |
| **Abhängigkeiten** | Guild Service |
| **Skalierung** | Extrem performance-kritisch — wird bei JEDEM Request evaluiert |
| **Stateful/Stateless** | Stateless, aber aggressiv gecacht |
| **Kritikalität** | ★★★★★ |

**Permission-Berechnungslogik [O] (aus Discord Developer Docs):**

```
1. Starte mit @everyone-Permissions der Guild
2. Addiere (OR) alle Permissions der Rollen des Nutzers
3. Wenn ADMINISTRATOR-Flag → alle Permissions gewährt → STOP
4. Für Channel:
   a. Starte mit berechneten Guild-Permissions
   b. Wende @everyone Channel-Overwrite an (deny, dann allow)
   c. Sammle alle Rollen-Channel-Overwrites (OR deny, OR allow)
   d. Wende Deny, dann Allow an
   e. Wende User-spezifischen Channel-Overwrite an (deny, dann allow)
5. Ergebnis = finale Permissions für diesen User in diesem Channel
```

### Service 7: Presence Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Online/Offline/Idle/DND Tracking, Activity Status, Typing Indicators |
| **Kernobjekte** | PresenceState, Activity, TypingState |
| **APIs** | `POST /gateway` (via WebSocket), Presence wird nicht via REST gesetzt |
| **Events** | `PRESENCE_UPDATE`, `TYPING_START` |
| **Abhängigkeiten** | Gateway (WebSocket-Verbindung = Heartbeat = Online) |
| **Skalierung** | **Sehr herausfordernd.** Globaler State für alle Online-Nutzer, Multi-Device-Aggregation, Fanout an alle relevanten Guilds **[O]** |
| **Stateful/Stateless** | **Stateful** (In-Memory State, oft Redis-backed) |
| **Kritikalität** | ★★★★☆ |

> **[O]** Discord hat öffentlich über die Herausforderungen des Presence-Systems bei Millionen gleichzeitiger Nutzer berichtet. Presence-Updates müssen an alle Guild-Mitglieder gefanoutet werden, die den Nutzer sehen können.

### Service 8: Notification Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Push-Notifications, Badge Counts, Notification Preferences, E-Mail-Notifications |
| **Kernobjekte** | NotificationPreference, PushToken, UnreadState |
| **APIs** | `PATCH /users/@me/guilds/:id/notification-settings`, `PUT /channels/:id/messages/:id/ack` |
| **Events** | `MESSAGE_ACK`, `NOTIFICATION_CREATE` (intern) |
| **Abhängigkeiten** | Messaging (Trigger), User Prefs, FCM/APNs (Delivery) |
| **Skalierung** | Hoch bei @everyone Mentions in großen Servern |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★★☆ |

### Service 9: Realtime Gateway Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | WebSocket-Verbindungen verwalten, Events dispatchen, Session Resume, Heartbeat |
| **Kernobjekte** | GatewaySession, Shard, EventPayload |
| **APIs** | `wss://gateway.discord.gg/?v=10&encoding=json` **[O]** |
| **Events** | Alle Events (Dispatch), plus: `HELLO`, `HEARTBEAT`, `HEARTBEAT_ACK`, `IDENTIFY`, `RESUME`, `RECONNECT`, `INVALID_SESSION` |
| **Abhängigkeiten** | Alle Services (empfängt und verteilt deren Events) |
| **Skalierung** | **Extremste Anforderung.** Millionen gleichzeitiger Verbindungen. Discord nutzt Erlang/Elixir für Gateway **[O]**. Sharding nach Guild-ID. |
| **Stateful/Stateless** | **Stateful** (jede Verbindung hält Session-State) |
| **Kritikalität** | ★★★★★ — Ausfall = kompletter Plattform-Ausfall |

> **[O]** Discord nutzt Elixir/Erlang für den Gateway aufgrund der massiven Concurrency-Fähigkeiten der BEAM VM. Jede WebSocket-Verbindung ist ein Erlang-Process. Sharding: Clients verbinden sich zu einem bestimmten Shard basierend auf `(guild_id >> 22) % num_shards`.
>
> **[O]** Blog-Post *"How Discord Scaled Elixir to 5 Million Concurrent Users"* (2017): Herausforderungen mit GC bei großen Erlang-Prozessen (Guilds mit 100K+ Mitgliedern), gelöst durch **Manifold** (eigenes Pub/Sub-System) und ETS-Tabellen.
>
> **[O]** Zellbasierte Architektur: Discord hat ihre Infrastruktur in unabhängige "Cells" aufgeteilt, um Blast Radius bei Ausfällen zu begrenzen.

### Service 10: Voice/Media Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Voice/Video-Signaling, Media Relay (SFU), Screen Share |
| **Kernobjekte** | VoiceSession, VoiceState, MediaStream, VoiceRegion |
| **APIs** | `wss://voice-gateway` (Signaling), UDP (Media Transport) **[O]** |
| **Events** | `VOICE_STATE_UPDATE`, `VOICE_SERVER_UPDATE` |
| **Abhängigkeiten** | Gateway (Signaling-Koordination), TURN/STUN Infra |
| **Skalierung** | CPU-intensiv (Transcoding optional, SFU Forwarding). Discord hat für Voice-Server Rust + C++ eingesetzt **[O]** |
| **Stateful/Stateless** | **Stateful** (Media-Sessions, UDP-Verbindungen) |
| **Kritikalität** | ★★★★★ für Voice-Features |

> **[O]** Discord's Voice-Architektur: Client → WebSocket Signaling → Voice Server zugewiesen → UDP-Verbindung zum Voice Server. Codec: Opus für Audio. Jeder Voice-Channel hat einen zugewiesenen Voice-Server. Discord betreibt eigene Voice-Server weltweit in verschiedenen Regionen.
>
> **[O]** Voice-Server laufen auf **Bare-Metal-Hardware** (nicht Cloud-VMs) für konsistente Latenz. Rust + C++ für performance-kritische Audio/Video-Verarbeitung.
>
> **[O]** Audio-Verschlüsselung: **XSalsa20-Poly1305** (Nacl/libsodium) — kein Standard-SRTP, sondern eigenes Verschlüsselungsschema über RTP.

### Service 11: File/Asset Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Datei-Upload, Bild-Verarbeitung (Resize, Thumbnail), CDN-Integration |
| **Kernobjekte** | Attachment, Avatar, Emoji, Sticker, Banner |
| **APIs** | `POST /channels/:id/messages` (multipart), Presigned Upload URLs **[H]** |
| **Events** | Keine eigenen (Teil von MESSAGE_CREATE) |
| **Abhängigkeiten** | Object Storage (S3/GCS), CDN, Image Processing Pipeline |
| **Skalierung** | I/O-bound, horizontal skalierbar |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★☆☆ |

> **[O]** Discord liefert Attachments über CDN-URLs aus: `cdn.discordapp.com/attachments/{channel_id}/{attachment_id}/{filename}`. Bilder werden in verschiedenen Größen bereitgestellt.

### Service 12: Search Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Volltextsuche über Nachrichten, Berechtigungsfilterung |
| **Kernobjekte** | SearchIndex, SearchQuery, SearchResult |
| **APIs** | `GET /guilds/:id/messages/search?content=&author_id=&has=&before=&after=&channel_id=` **[O]** |
| **Events** | Keine (Request/Response) |
| **Abhängigkeiten** | Elasticsearch **[O]**, Permission Service |
| **Skalierung** | Index-Größe wächst mit Nachrichtenvolumen; Elasticsearch Cluster |
| **Stateful/Stateless** | Stateless (Elasticsearch ist der State) |
| **Kritikalität** | ★★★☆☆ |

### Service 13: Moderation Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | AutoMod-Regelauswertung, Report-Verarbeitung, Content-Scanning |
| **Kernobjekte** | AutoModRule, AutoModAction, Report, ModerationAction |
| **APIs** | `POST /guilds/:id/auto-moderation/rules`, `GET /guilds/:id/auto-moderation/rules` **[O]** |
| **Events** | `AUTO_MODERATION_RULE_CREATE/UPDATE/DELETE`, `AUTO_MODERATION_ACTION_EXECUTION` **[O]** |
| **Abhängigkeiten** | Messaging (Message-Analyse), Guild, Permission |
| **Skalierung** | Inline-Processing bei jeder Nachricht → Latenz-kritisch |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★★☆ (Safety) |

### Service 14: Audit Log Service

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Protokollierung aller Admin-Aktionen |
| **Kernobjekte** | AuditLogEntry, AuditLogChange |
| **APIs** | `GET /guilds/:id/audit-logs?user_id=&action_type=&before=` **[O]** |
| **Events** | `GUILD_AUDIT_LOG_ENTRY_CREATE` **[O]** |
| **Abhängigkeiten** | Alle Services (jede Admin-Aktion muss geloggt werden) |
| **Skalierung** | Append-only, Write-heavy |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★☆☆ |

### Service 15: Bot/Integration Platform

| Aspekt | Detail |
|--------|--------|
| **Aufgabe** | Bot-Registrierung, OAuth2, Interaction Handling, Webhook-Delivery |
| **Kernobjekte** | Application, Bot, OAuth2App, Webhook, InteractionPayload |
| **APIs** | `POST /interactions/:id/:token/callback`, `POST /webhooks/:id/:token`, OAuth2 Flows **[O]** |
| **Events** | `INTERACTION_CREATE`, `INTEGRATION_CREATE/UPDATE/DELETE` **[O]** |
| **Abhängigkeiten** | Gateway, Auth, alle Content-Services |
| **Skalierung** | Webhook-Delivery kann burst-artig sein |
| **Stateful/Stateless** | Stateless |
| **Kritikalität** | ★★★☆☆ (Ökosystem) |

---

## 4.3 Datenmodell

### Zentrale Entitäten

#### User

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake (int64) | Unique ID, enthält Timestamp **[O]** |
| username | string | Globaler unique Username |
| display_name | string? | Anzeigename |
| email | string | E-Mail (verschlüsselt gespeichert) |
| password_hash | string | bcrypt/argon2 Hash |
| avatar_hash | string? | Hash für CDN-URL-Konstruktion |
| banner_hash | string? | Profil-Banner |
| bio | string? | About me |
| locale | string | Sprache |
| mfa_enabled | bool | 2FA aktiv |
| flags | bitfield | System-Flags |
| premium_type | int | Nitro-Stufe |
| created_at | timestamp | Registrierung |

**Beziehungen:** Guilds (via Member), DM-Channels, Sessions, Relationships
**Änderungsfrequenz:** Selten (Profil-Updates)
**Konsistenz:** Stark konsistent (Auth-kritisch)

#### Guild/Server

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID |
| name | string | Servername |
| icon_hash | string? | Server-Icon |
| owner_id | Snowflake | Eigentümer |
| region | string | Voice-Region (deprecated, jetzt automatisch) |
| verification_level | int | 0-4 |
| default_message_notifications | int | Notification-Default |
| explicit_content_filter | int | Content-Filter-Stufe |
| features | string[] | Aktivierte Features |
| max_members | int | Max. Mitglieder (aktuell 500K) **[O]** |
| preferred_locale | string | Sprache |
| system_channel_id | Snowflake? | Für Systemnachrichten |

**Beziehungen:** Channels, Roles, Members, Emojis, Stickers, Invites, Bans
**Änderungsfrequenz:** Selten
**Konsistenz:** Stark konsistent

#### Member

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| user_id | Snowflake | FK → User |
| guild_id | Snowflake | FK → Guild |
| nickname | string? | Server-Nickname |
| avatar_hash | string? | Server-spezifischer Avatar |
| roles | Snowflake[] | Zugewiesene Rollen-IDs |
| joined_at | timestamp | Beitrittsdatum |
| premium_since | timestamp? | Boost-Start |
| deaf | bool | Server-deafen |
| mute | bool | Server-mute |
| pending | bool | Membership Screening ausstehend |
| communication_disabled_until | timestamp? | Timeout-Ende |

**Beziehungen:** User, Guild, Roles
**Änderungsfrequenz:** Mittel (Rollen-Updates)
**Konsistenz:** Stark konsistent (Rechte-Evaluation)

#### Role

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID |
| guild_id | Snowflake | FK → Guild |
| name | string | Rollenname |
| color | int | Farbe (0 = keine) |
| hoist | bool | Separat in Mitgliederliste anzeigen |
| icon_hash | string? | Rollen-Icon |
| position | int | Hierarchie-Position |
| permissions | bitfield (int64) | Permission-Bits **[O]** |
| managed | bool | Von Integration verwaltet |
| mentionable | bool | Erwähnbar |

**Beziehungen:** Guild, Members (many-to-many)
**Änderungsfrequenz:** Selten
**Konsistenz:** Stark konsistent

#### Channel

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID |
| type | int | 0=Text, 2=Voice, 4=Category, 5=Announcement, 11=PublicThread, 13=StageVoice, 15=Forum **[O]** |
| guild_id | Snowflake? | FK → Guild (null für DMs) |
| name | string | Channel-Name |
| topic | string? | Channel-Beschreibung |
| position | int | Sortierung |
| parent_id | Snowflake? | Kategorie oder Parent-Channel (Threads) |
| nsfw | bool | NSFW-Flag |
| rate_limit_per_user | int | Slowmode (Sekunden) |
| bitrate | int | Audio-Bitrate (Voice) |
| user_limit | int | Max. User (Voice) |
| permission_overwrites | Overwrite[] | Channel-spezifische Rechte |
| last_message_id | Snowflake? | Letzte Nachricht (für Unread) |

**Beziehungen:** Guild, Category (parent), Messages, Threads, Permission Overwrites
**Änderungsfrequenz:** Selten (Settings), häufig (last_message_id)
**Konsistenz:** Stark konsistent (Permissions)

#### Message

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID (enthält Timestamp) |
| channel_id | Snowflake | FK → Channel |
| author_id | Snowflake | FK → User |
| content | string | Nachrichtentext (max 2000 Zeichen **[O]**) |
| timestamp | timestamp | Erstellzeit |
| edited_timestamp | timestamp? | Letzte Bearbeitung |
| tts | bool | Text-to-Speech |
| mention_everyone | bool | @everyone erwähnt |
| mentions | Snowflake[] | Erwähnte User-IDs |
| mention_roles | Snowflake[] | Erwähnte Rollen-IDs |
| attachments | Attachment[] | Datei-Anhänge |
| embeds | Embed[] | Rich Embeds |
| reactions | Reaction[] | Emoji-Reaktionen |
| pinned | bool | Angeheftet |
| type | int | Normal, Reply, System, Thread-Start etc. **[O]** |
| message_reference | Reference? | Reply-Referenz |
| thread | Channel? | Angehängter Thread |
| flags | bitfield | Nachricht-Flags |

**Beziehungen:** Channel, Author (User), Referenced Message, Thread, Attachments
**Änderungsfrequenz:** Schreib-lastig (neue Nachrichten), selten bearbeitet
**Konsistenz:** Eventual Consistency akzeptabel (ScyllaDB) **[O]**

**Speicherpartitionierung [O]:**
```
Primary Key: (channel_id, message_bucket)
Clustering Key: message_id DESC

Bucket = Zeitfenster (z.B. 10 Tage)
→ Ermöglicht effizientes Time-Range-Querying
→ Begrenzt Partition-Größe
```

#### Attachment

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID |
| filename | string | Original-Dateiname |
| content_type | string | MIME-Type |
| size | int | Dateigröße in Bytes |
| url | string | CDN-URL |
| proxy_url | string | Proxy-URL (für Embed-Sicherheit) |
| width | int? | Bildbreite |
| height | int? | Bildhöhe |

#### Reaction

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| emoji | Emoji | Unicode oder Custom Emoji |
| count | int | Anzahl Reaktionen |
| me | bool | Eigene Reaktion |

#### VoiceState

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| guild_id | Snowflake? | Guild |
| channel_id | Snowflake? | Voice-Channel (null = nicht verbunden) |
| user_id | Snowflake | User |
| session_id | string | Voice-Session |
| deaf | bool | Server-deafen |
| mute | bool | Server-mute |
| self_deaf | bool | Self-deafen |
| self_mute | bool | Self-mute |
| self_stream | bool | Streamt |
| self_video | bool | Video aktiv |
| suppress | bool | In Stage unterdrückt |
| request_to_speak_timestamp | timestamp? | Hand-Raise-Zeit |

**Beziehungen:** Guild, Channel, User
**Änderungsfrequenz:** Hoch (Mute/Unmute)
**Konsistenz:** Stark konsistent (Echtzeit-State)

#### Presence

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| user_id | Snowflake | User |
| guild_id | Snowflake | Kontext (Guild-spezifisch verteilt) |
| status | string | online/idle/dnd/offline |
| activities | Activity[] | Aktuelle Aktivitäten |
| client_status | ClientStatus | Desktop/Mobile/Web Status |

**Änderungsfrequenz:** Sehr hoch
**Konsistenz:** Eventual Consistency akzeptabel

#### Invite

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| code | string | Unique Invite-Code |
| guild_id | Snowflake | Ziel-Server |
| channel_id | Snowflake | Ziel-Channel |
| inviter_id | Snowflake | Ersteller |
| max_age | int | Ablauf in Sekunden (0 = permanent) |
| max_uses | int | Max. Nutzungen (0 = unbegrenzt) |
| uses | int | Aktuelle Nutzungen |
| temporary | bool | Temporäre Mitgliedschaft |
| created_at | timestamp | Erstellung |

#### AuditLogEntry

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| id | Snowflake | Unique ID |
| guild_id | Snowflake | Guild |
| user_id | Snowflake | Ausführender User |
| target_id | Snowflake? | Betroffene Entität |
| action_type | int | Art der Aktion (>90 Typen) **[O]** |
| changes | Change[] | Was wurde geändert |
| reason | string? | Audit-Log-Reason |

### Snowflake ID Format [O]

```
Discord Snowflake (64 Bit):
┌──────────────────────────────────────┬──────┬───────┬────────────┐
│  Timestamp (ms since Discord Epoch)  │Worker│Process│ Increment  │
│            42 Bits                   │5 Bits│5 Bits │  12 Bits   │
└──────────────────────────────────────┴──────┴───────┴────────────┘

Discord Epoch: 2015-01-01T00:00:00.000Z (1420070400000)

Vorteile:
- Zeitlich sortierbar (wichtig für Message-Ordering)
- Kein zentraler ID-Generator nötig (Worker+Process)
- Enthält implizit Timestamp (created_at ableitbar)
- 64-Bit Integer → effizient in DB und Netzwerk
```

---

## 4.4 Infrastruktur

### Datenbanken

| Technologie | Einsatzbereich | Begründung |
|-------------|----------------|------------|
| **PostgreSQL** | User, Guilds, Channels, Roles, Auth, Relational Data | ACID, Relations, bewährt **[H]** |
| **ScyllaDB** (Cassandra-kompatibel) | Messages, Reactions | Horizontale Skalierung, hoher Write-Throughput **[O]** |
| **Redis** | Sessions, Presence, Rate Limits, Cache, Pub/Sub | In-Memory Speed, Pub/Sub für Events **[H]** |
| **Elasticsearch** | Nachrichtensuche | Volltextsuche mit Filtern **[O]** |

### Caching

| Layer | Technologie | Zweck |
|-------|-------------|-------|
| **Application Cache** | Redis/Memcached | Permission-Berechnungen, User-Profile, Guild-Daten **[H]** |
| **Local Cache** | In-Process Memory | Hot-Path-Daten (Permissions, Routing) **[H]** |
| **CDN Cache** | Cloudflare **[O]** | Statische Assets, Avatare, Attachments |
| **Client Cache** | IndexedDB/SQLite | Offline-Daten, Message-Cache **[H]** |

### Message Broker

| Technologie | Einsatzbereich |
|-------------|----------------|
| **NATS / Kafka / RabbitMQ** **[A]** | Inter-Service-Kommunikation, Event-Distribution |
| **Redis Pub/Sub** **[H]** | Gateway-Fanout, Presence-Updates |

> **[A]** Der konkrete Message Broker ist nicht öffentlich bekannt. Basierend auf den Anforderungen (hoher Durchsatz, Low-Latency) sind NATS oder Kafka wahrscheinlich.

### Object Storage & CDN

```
Upload Flow:
Client → API → S3/GCS (Object Store) → CDN Edge → Client Download

Optimierungen:
- Presigned Upload URLs (Client → S3 direkt) [H]
- Image Resizing Pipeline (Thumbnails, Proxied Embeds)
- CDN mit DDoS-Schutz (Cloudflare) [O]
- Signed URLs für temporären Zugriff [O] (seit 2023)
```

### Monitoring & Observability

| Bereich | Werkzeuge (Branchenstandard) **[H]** |
|---------|--------------------------------------|
| **Metrics** | Prometheus + Grafana / Datadog |
| **Logging** | ELK Stack / Loki |
| **Tracing** | Jaeger / OpenTelemetry |
| **Alerting** | PagerDuty / OpsGenie |
| **Uptime** | Status Page (discordstatus.com) **[O]** |

### Netzwerk-Infrastruktur

| Komponente | Technologie | Zweck |
|------------|-------------|-------|
| **Reverse Proxy / Load Balancer** | Cloudflare + Nginx/Envoy **[H]** | SSL Termination, Routing, Rate Limiting |
| **API Gateway** | Custom / Kong / Envoy **[H]** | REST-Routing, Auth-Middleware, Rate Limits |
| **WebSocket Gateway** | Elixir/Erlang Custom **[O]** | Persistent Connections, Event-Dispatch |
| **TURN/STUN Server** | Custom + Coturn **[H]** | NAT Traversal für Voice/Video |
| **SFU (Selective Forwarding Unit)** | Custom (Rust/C++) **[O]** | Voice/Video Media Relay |
| **Service Discovery** | Consul / etcd / K8s DNS **[A]** | Service-Lokalisierung |
| **Secret Management** | HashiCorp Vault / AWS Secrets **[A]** | Token, Keys, Credentials |

---

## 4.5 Realtime-Architektur

### Event-Transportschichten

```
┌────────────────────────────────────────────────────────┐
│                    CLIENT                               │
│                                                        │
│  WebSocket ◄──────── Realtime Events ────────►         │
│  (Text, Presence,   (Messages, Typing,                 │
│   State Changes)     Presence, Voice State)             │
│                                                        │
│  HTTPS/REST ◄──────── Request/Response ──────►         │
│  (CRUD Ops,          (Read History, Search,             │
│   Settings)           Upload, Settings)                 │
│                                                        │
│  UDP ◄──────────── Media Transport ──────────►         │
│  (Voice Audio,       (RTP/SRTP Packets,                │
│   Video Frames,       Encrypted Audio/Video)            │
│   Screen Share)                                        │
└────────────────────────────────────────────────────────┘
```

### Was über WebSocket läuft [O]

| Event-Kategorie | Events | Frequenz | Latenz-Anforderung |
|-----------------|--------|----------|-------------------|
| **Messages** | MESSAGE_CREATE, _UPDATE, _DELETE | Hoch (pro Channel) | <500ms |
| **Typing** | TYPING_START | Sehr hoch (throttled auf 10s) | <1s |
| **Presence** | PRESENCE_UPDATE | Sehr hoch | <5s akzeptabel |
| **Voice State** | VOICE_STATE_UPDATE | Mittel | <1s |
| **Guild State** | GUILD_*, CHANNEL_*, ROLE_* | Niedrig | <2s |
| **Reactions** | MESSAGE_REACTION_ADD/REMOVE | Mittel | <1s |
| **Thread** | THREAD_CREATE, _UPDATE, _MEMBER_UPDATE | Niedrig | <2s |
| **User** | USER_UPDATE | Niedrig | <5s |

### Was über REST/HTTP läuft [O]

| Operation | Route-Pattern | Warum nicht Realtime |
|-----------|--------------|---------------------|
| **Message History** | `GET /channels/:id/messages` | Pagination, kein Live-Bedarf |
| **Search** | `GET /guilds/:id/messages/search` | Schwere Query, nicht zeitkritisch |
| **CRUD-Operationen** | `POST/PATCH/DELETE /...` | Request/Response-Semantik passend |
| **File Upload** | `POST /channels/:id/messages` | Multipart, groß, nicht streambar |
| **Settings** | `GET/PATCH /users/@me/settings` | Selten, nicht realtime-relevant |
| **Audit Log** | `GET /guilds/:id/audit-logs` | Historical, Pagination |

### Was über UDP/Media-Layer läuft [O]

| Daten | Protokoll | Format |
|-------|-----------|--------|
| **Voice Audio** | UDP + RTP/SRTP | Opus-codiert, verschlüsselt |
| **Video Frames** | UDP + RTP/SRTP | VP8/VP9/H.264 **[H]** |
| **Screen Share** | UDP + RTP/SRTP | VP8/VP9/H.264 mit hoher Auflösung |

### Fanout-Architektur [H]

```
Nachricht in Channel C von Guild G:

1. Client → API Gateway → Messaging Service
2. Messaging Service:
   - Persistiert in ScyllaDB
   - Publiziert MESSAGE_CREATE Event auf Message Bus
3. Message Bus → Gateway Nodes:
   - Gateway identifiziert: welche Shards haben Guild G?
   - Pro Shard: welche Verbindungen haben Channel C subscribed?
   - Filtert nach Permissions (Lazy Guilds: nicht alle Members bekommen alles)
4. Gateway → WebSocket → Client

Optimierungen:
- "Lazy Guilds" [O]: Bei großen Servern (>75K Members)
  werden nicht alle Member-Listen initial geladen
- Presence wird nur für sichtbare Nutzer gesendet
- Events werden pro Guild/Channel gefiltert
- Compression (zlib) für Gateway-Verbindungen [O]
```

### Horizontale Skalierung [H]

```
Gateway Scaling:
┌─────────────────────────────────────────────┐
│  Load Balancer (Session Sticky oder Shard)  │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Gateway #1│ │Gateway #2│ │Gateway #N│   │
│  │Shard 0-99│ │Shard 100-│ │Shard N*K-│   │
│  │          │ │199       │ │N*K+K-1   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └─────────────┼─────────────┘         │
│                     │                       │
│              Message Bus                    │
│         (Redis Pub/Sub / NATS)              │
└─────────────────────────────────────────────┘

Jeder Gateway-Node:
- Hält N Shards
- Jeder Shard = Subset von Guilds
- Event-Routing: Guild → Shard → Connection(s)
```

---

## 4.6 Client-Architektur

### Web-Client

| Aspekt | Detail | Quelle |
|--------|--------|--------|
| **Framework** | React (mit eigenem Framework "Flux-ähnlich") | [O/H] |
| **State Management** | Flux/Redux-ähnlich, Stores pro Domäne | [H] |
| **Routing** | Client-Side Routing (React Router oder Custom) | [H] |
| **WebSocket** | Eigene Gateway-Bibliothek mit Reconnect/Resume | [O] |
| **Voice/Video** | WebRTC API | [O] |
| **Rendering** | Virtualisierte Listen (Messages), React Concurrent | [H] |
| **Build** | Webpack (historisch), möglicherweise Vite/RSBuild | [H] |
| **Internationalisierung** | i18n Framework, ~30 Sprachen | [B] |

### Desktop-Client

| Aspekt | Detail | Quelle |
|--------|--------|--------|
| **Basis** | Electron (Chromium + Node.js) | [O] |
| **Updater** | Auto-Update über eigenes Update-System | [B] |
| **Native APIs** | System Tray, Global Keybinds, Rich Presence, Overlay | [B] |
| **Overlay** | In-Game-Overlay (Windows) für Voice-Status | [B] |
| **Performance** | Bekannt für hohen RAM-Verbrauch (Electron) | [B] |

### Mobile-Client

| Aspekt | Detail | Quelle |
|--------|--------|--------|
| **Basis** | React Native (wahrscheinlich mit nativen Modulen) | [H] |
| **Push** | FCM (Android), APNs (iOS) | [B] |
| **Background Audio** | Natives Modul für Voice im Hintergrund | [B] |
| **Offline** | Begrenzt (letzte Nachrichten gecacht) | [B] |
| **Navigation** | Bottom Tab + Drawer (Swipe) | [B] |
| **Media** | Native Camera/Gallery-Integration | [B] |

### State-Management (alle Clients) [H]

```
┌─────────────────────────────────────────────┐
│              CLIENT STATE                    │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Auth     │  │ Gateway  │  │ Voice    │ │
│  │ Store    │  │ Store    │  │ Store    │ │
│  │ (Token,  │  │ (Conn,   │  │ (State,  │ │
│  │  User)   │  │  Session)│  │  Media)  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Guild    │  │ Channel  │  │ Message  │ │
│  │ Store    │  │ Store    │  │ Store    │ │
│  │ (Guilds, │  │ (Channels│  │ (by Chan │ │
│  │  Members)│  │  Threads)│  │  ID)     │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Presence │  │ Notif.   │  │ UI       │ │
│  │ Store    │  │ Store    │  │ Store    │ │
│  │ (Status, │  │ (Unreads,│  │ (Modals, │ │
│  │  Typing) │  │  Badges) │  │  Route)  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
```

### Offline-/Reconnect-Verhalten [B/H]

```
Reconnect-Strategie:
1. WebSocket-Verbindung bricht ab
2. Client versucht sofort Reconnect
3. Sendet RESUME mit session_id + last_sequence_number [O]
4. Gateway sendet verpasste Events nach (Replay)
5. Wenn Resume fehlschlägt (Session expired):
   → Neuer IDENTIFY → Full State Re-Sync (READY Event)
6. Client merged neuen State mit lokalem Cache

Exponential Backoff:
- 1s → 2s → 4s → 8s → ... → Max 60s
- Jitter hinzufügen um Thundering Herd zu vermeiden

Offline-Fähigkeiten (begrenzt):
- Letzte Nachrichten aus Cache anzeigen
- Verfasste Nachrichten queuen (nicht implementiert bei Discord) [B]
- Voice bricht sofort ab (keine Offline-Voice) [B]
```

### Event-Synchronisierung [H]

```
Initial Connection (IDENTIFY):
1. Client → IDENTIFY { token, intents, properties }
2. Server → READY {
     user, guilds[], private_channels[],
     session_id, resume_gateway_url,
     application
   }
3. Für jede Guild: GUILD_CREATE Event mit:
   - Channels, Roles, Members (bis zu Limit),
   - Presences (initial Online-Members),
   - Voice States

Laufender Betrieb:
- Heartbeat alle ~41.25s [O] (Server sendet Intervall in HELLO)
- Missed Heartbeat → Reconnect
- Sequence Numbers für Event-Ordering
- Jedes Dispatch-Event hat incrementing sequence_number
```
