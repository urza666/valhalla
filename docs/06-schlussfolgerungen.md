# 6. Abgeleitete Schlussfolgerung: Was braucht man, um so ein Tool zu programmieren?

---

## 6.1 Zwingend notwendige Bausteine

Ohne die folgenden Bausteine ist **keine funktionsfähige Plattform** möglich:

### Infrastruktur-Bausteine

| # | Baustein | Begründung |
|---|---------|------------|
| 1 | **WebSocket Gateway** | Jede Realtime-Kommunikation basiert darauf. Ohne Gateway keine Live-Events. |
| 2 | **REST API** | CRUD-Operationen, History, Settings — alles braucht eine HTTP-API. |
| 3 | **Relationale Datenbank** (PostgreSQL) | User, Guilds, Channels, Roles — relationale Daten mit ACID-Garantien. |
| 4 | **In-Memory Cache/Store** (Redis) | Sessions, Presence, Rate Limits, Pub/Sub für Event-Routing. |
| 5 | **Object Storage** (S3-kompatibel) | Datei-Uploads, Avatare, Medien. |
| 6 | **CDN** | Asset-Delivery mit akzeptabler Latenz weltweit. |
| 7 | **Message Broker** | Event-Distribution zwischen Services. |
| 8 | **Reverse Proxy / LB** | TLS Termination, Routing, DDoS-Basisschutz. |

### Service-Bausteine

| # | Service | Begründung |
|---|---------|------------|
| 1 | **Auth Service** | Ohne Authentifizierung kein Zugang. |
| 2 | **User Service** | Konten und Profile sind Grundvoraussetzung. |
| 3 | **Guild/Community Service** | Die Server-Struktur ist das Kern-Organisationsmodell. |
| 4 | **Channel Service** | Channels sind der Ort der Kommunikation. |
| 5 | **Messaging Service** | Nachrichten senden/empfangen = Kern-Feature. |
| 6 | **Permission Engine** | Ohne Rechteprüfung keine Multi-User-Sicherheit. |
| 7 | **Realtime Gateway** | WebSocket-Verbindungen + Event-Distribution. |
| 8 | **Presence Service** | Online-Status ist fundamentales UX-Element. |
| 9 | **Notification Service** | Ohne Benachrichtigungen keine Engagement-Loops. |
| 10 | **File/Asset Service** | Upload und Delivery von Medien. |

### Client-Bausteine

| # | Baustein | Begründung |
|---|---------|------------|
| 1 | **Web Client** (React/Vue/Svelte) | Universeller Zugang ohne Installation. |
| 2 | **WebSocket-Client-Bibliothek** | Reconnect, Resume, Heartbeat, Event-Handling. |
| 3 | **State Management** | Konsistenter Client-State über alle Views. |
| 4 | **Virtualisierte Listen** | Performance bei tausenden Nachrichten. |
| 5 | **Markdown Renderer** | Textformatierung ist Basis-Erwartung. |

---

## 6.2 MVP-Umfang

Ein MVP muss folgende Frage beantworten: **"Können Nutzer in Communities sinnvoll Text-chatten und optional Voice nutzen?"**

### MVP Feature-Scope

| Bereich | Enthalten | Nicht enthalten |
|---------|-----------|----------------|
| **Auth** | E-Mail-Registrierung, Login, Sessions | MFA, Phone Verify, QR Login |
| **Profile** | Username, Avatar, Display Name | Banner, Bio, Connected Accounts |
| **Guilds** | Erstellen, beitreten, verlassen, Icon | Templates, Discovery, Boost, Onboarding |
| **Channels** | Text-Channels, Kategorien, Voice-Channels | Forum, Stage, Announcement |
| **Messaging** | Text senden/empfangen, Bearbeiten, Löschen, Replies, Markdown | Threads, Suche, Embeds, Sticker |
| **Reactions** | Emoji-Reaktionen (Unicode) | Custom Emoji, Super Reactions |
| **Files** | Bild-Upload mit Vorschau | Video-Player, Audio-Player, große Dateien |
| **Voice** | Join/Leave, Mute/Deafen, Sprachübertragung | Video, Screenshare, Noise Suppression |
| **Roles** | Erstellen, zuweisen, Basis-Permissions | Channel Overrides, komplexe Hierarchie |
| **Presence** | Online/Offline/Idle | DND, Custom Status, Activity |
| **Notifications** | Unread-Badges, @mention Highlighting | Push Notifications, Preferences pro Channel |
| **DMs** | 1:1 Direktnachrichten | Gruppen-DMs |
| **Invites** | Einladungslinks erstellen/nutzen | Ablauf, Max Uses, Tracking |
| **Moderation** | Kick, Ban | Timeout, AutoMod, Audit Log |
| **Clients** | Web Client | Desktop, Mobile |

### MVP Technologie-Stack (Empfehlung)

```
Client:     React + TypeScript + Zustand/Jotai + TanStack Query
Gateway:    Elixir/Phoenix oder Go + Goroutines oder Node.js
REST API:   Go / Rust / Elixir / Node.js (TypeScript)
Voice:      Mediasoup (Node.js SFU) oder Janus oder LiveKit
Database:   PostgreSQL
Cache:      Redis
Storage:    MinIO / S3
Broker:     Redis Pub/Sub (für MVP ausreichend)
Proxy:      Nginx / Caddy
```

### MVP-Aufwand (grobe Schätzung)

| Team-Größe | Dauer |
|------------|-------|
| 1-2 Full-Stack + 1 Voice/Infra | 4-6 Monate |
| 3-4 Full-Stack + 1 Voice/Infra | 2-3 Monate |

---

## 6.3 Produktionsreife Version

Zusätzlich zum MVP für ein **ernsthaft nutzbares System**:

### Phase 2: Core Completion (nach MVP)

| Feature | Aufwand | Begründung |
|---------|---------|------------|
| **MFA (TOTP)** | 1-2 Wochen | Sicherheitsstandard |
| **Channel Permission Overrides** | 2-3 Wochen | Nötig für jede reale Community |
| **Threads** | 2-3 Wochen | Diskussions-Organisation |
| **Suche** (Elasticsearch) | 2-4 Wochen | Ab ~1000 Nachrichten unverzichtbar |
| **Push Notifications** | 1-2 Wochen | Mobile-Nutzung |
| **Desktop Client** (Electron) | 2-3 Wochen | User-Erwartung |
| **Mobile Client** | 6-12 Wochen | Reichweite |
| **Audit Log** | 1-2 Wochen | Admin-Transparenz |
| **AutoMod Basics** | 2-3 Wochen | Skalierung der Moderation |
| **Video & Screenshare** | 4-8 Wochen | Erwartetes Feature |
| **Custom Emoji** | 1-2 Wochen | Community-Identität |
| **Embeds / Link Preview** | 1-2 Wochen | UX-Qualität |
| **Gruppen-DMs** | 1 Woche | Kleine-Gruppen-Kommunikation |
| **Notification Preferences** | 1-2 Wochen | Gegen Notification Fatigue |

### Phase 3: Scale & Polish

| Feature | Aufwand | Begründung |
|---------|---------|------------|
| **Forum Channels** | 3-4 Wochen | Asynchrone Diskussionen |
| **Stage Channels** | 3-4 Wochen | Events |
| **Server Discovery** | 4-6 Wochen | Growth |
| **Bot/Integration Platform** | 6-12 Wochen | Ökosystem |
| **OAuth2 Provider** | 2-4 Wochen | Third-Party-Integration |
| **Onboarding Flows** | 2-3 Wochen | Retention |
| **Content Moderation (ML)** | 8-16 Wochen | Safety at Scale |
| **Skalierung auf >100K CCU** | Ongoing | Infra-Arbeit |
| **i18n (Mehrsprachigkeit)** | 4-8 Wochen | Globale Nutzung |
| **Accessibility** | 4-8 Wochen | Inklusivität und Compliance |

---

## 6.4 Kritische technische Risiken

### Risiko 1: Realtime-Skalierung

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **WebSocket-Verbindungen** | >10K CCU erfordert Sharding-Strategie | Frühzeitig Sharding-Architektur planen; Erlang/Elixir oder Go |
| **Event-Fanout** | @everyone in 100K-Member-Server = 100K Events | Lazy Guilds, Batching, Rate Limits auf @everyone |
| **State-Synchronisation** | Konsistenz über Gateway-Nodes | Sequence Numbers, Resume-Mechanismus |
| **Thundering Herd** | Massenhafte Reconnects nach Outage | Jitter, Exponential Backoff, Rolling Restart |

### Risiko 2: Voice/Video

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **SFU-Entwicklung** | Eigene SFU extrem komplex | Existierende SFU nutzen: LiveKit, mediasoup, Janus |
| **NAT Traversal** | UDP in vielen Netzwerken blockiert | TURN-Server, TCP-Fallback |
| **Audio-Qualität** | Echo, Noise, Latenz | Proven Libraries (WebRTC, Opus), Krisp-Integration |
| **Skalierung** | CPU-intensive Media-Verarbeitung | SFU statt MCU, Simulcast, Edge-Deployment |

### Risiko 3: Rechte-/Rollenmodell

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **Komplexität** | Hierarchische Vererbung + Overrides = viele Edge Cases | Umfangreiches Testing, formale Spezifikation |
| **Performance** | Permission-Check bei JEDEM Request | Aggressive Caching, Invalidierungsstrategie |
| **UX** | Komplexes Modell = Admin-Verwirrung | Gute UI-Abstraktion, Presets |

### Risiko 4: Datenkonsistenz

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **Message Ordering** | Nachrichten erscheinen in falscher Reihenfolge | Snowflake IDs (timestamp-basiert), Server-side Ordering |
| **Eventual Consistency** | Lesen vor Schreiben abgeschlossen | Quorum Reads wo nötig, Read-your-own-Writes |
| **Split Brain** | Netzwerk-Partition zwischen Nodes | Leader Election, Conflict Resolution |

### Risiko 5: Moderation & Abuse

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **Spam/Raid** | Automatisierte Mass-Join/Message-Angriffe | Rate Limits, Captcha, Verification Gates |
| **CSAM/Illegal Content** | Rechtliche Verpflichtung zum Erkennen/Entfernen | PhotoDNA/Hash-basierte Erkennung, Reporting |
| **Bot-Armies** | Automatisierte Accounts | Phone Verification, Behavioral Analysis |

### Risiko 6: Mobile-Komplexität

| Aspekt | Risiko | Mitigation |
|--------|--------|------------|
| **Background Audio** | OS killt Background-Prozesse | Native Module, Foreground Service (Android), Audio Session (iOS) |
| **Push Reliability** | FCM/APNs nicht 100% zuverlässig | Fallback-Mechanismen, Polling bei Reconnect |
| **Battery/Data** | Voice/Video = hoher Verbrauch | Adaptive Bitrate, Effiziente Codecs |

---

## 6.5 Teamzuschnitt

### Kernrollen

| Rolle | Anzahl (MVP) | Anzahl (Prod) | Skills |
|-------|-------------|--------------|--------|
| **Tech Lead / Architect** | 1 | 1 | System Design, Distributed Systems, Trade-off-Entscheidungen |
| **Backend Engineer** | 1-2 | 3-5 | REST APIs, WebSocket, PostgreSQL, Redis, Event-Systeme |
| **Frontend Engineer (Web)** | 1-2 | 2-3 | React/TypeScript, WebSocket-Client, State Management, Virtualisierung |
| **Voice/Media Engineer** | 1 | 1-2 | WebRTC, SFU (mediasoup/LiveKit), Opus, UDP, Audio DSP |
| **Mobile Engineer** | 0 | 1-2 | React Native oder Swift/Kotlin, Push, Background Audio |
| **DevOps/SRE** | 0-1 | 1-2 | Kubernetes, Monitoring, CI/CD, Load Testing |
| **Product/UX** | 0-1 | 1 | Informationsarchitektur, UI Design, User Research |
| **Security Engineer** | 0 | 1 | Auth, Abuse Prevention, Penetration Testing |
| **QA Engineer** | 0 | 1-2 | E2E Testing, Performance Testing, Mobile Testing |

### Spezialwissen-Bereiche

| Bereich | Warum speziell | Wo Expertise finden |
|---------|---------------|-------------------|
| **Realtime Gateway (Erlang/Elixir)** | BEAM VM Concurrency, OTP Patterns | Elixir-Community, Ex-WhatsApp/Discord Engineers |
| **SFU/Voice Engineering** | Codec-Expertise, Audio DSP, NAT Traversal | WebRTC-Community, Telekommunikation |
| **Distributed Systems** | Consistency Models, Partitioning, Fanout | Backend-Engineers mit Scale-Erfahrung |
| **Information Security** | Auth-Flows, Abuse Patterns, Compliance | Security-Engineers, Pentest-Background |

---

## 6.6 Empfohlene Build-Reihenfolge

### Phase 0: Foundation (Woche 1-2)

```
- Projekt-Setup (Monorepo, CI/CD, Linting)
- Datenbank-Schema (User, Guild, Channel, Message)
- Auth Service (Register, Login, Token)
- Grundlegendes REST API Framework
- WebSocket Gateway Grundgerüst (Connect, Heartbeat, Identify)
```

### Phase 1: Text-Chat MVP (Woche 3-6)

```
- Guild CRUD + Mitgliedschaft
- Channel CRUD + Kategorien
- Messaging: Senden, Empfangen, Bearbeiten, Löschen
- Realtime: MESSAGE_CREATE/UPDATE/DELETE über Gateway
- Basis-Permissions (@everyone + 1-2 Rollen)
- Einladungslinks
- Web Client: Server-Liste, Channel-Sidebar, Chat-View, Composer
- Typing Indicators
- Unread State
```

### Phase 2: Social & DMs (Woche 7-8)

```
- Direktnachrichten
- Freundeslisten
- User-Profile (Avatar, Displayname)
- Presence (Online/Offline/Idle)
- Reaktionen (Emoji)
- File Upload (Bilder)
```

### Phase 3: Voice (Woche 9-12)

```
- Voice Channel Integration
- SFU Setup (LiveKit oder mediasoup)
- Voice State Management (Join/Leave/Mute/Deafen)
- Audio-Pipeline (Capture → Encode → Send → Receive → Decode → Play)
- Push-to-Talk + Voice Activity
- Voice Connected Bar UI
```

### Phase 4: Polish & Moderation (Woche 13-16)

```
- Kick, Ban, Timeout
- Audit Log
- Replies & Threads
- Embeds / Link Preview
- Suche (Elasticsearch)
- Desktop Notifications
- Markdown Rendering
- Error Handling & Reconnect Logic
```

### Phase 5: Video & Scale (Woche 17-24)

```
- Video in Voice Channels
- Screen Share
- Desktop Client (Electron)
- Mobile Client (React Native)
- Push Notifications
- AutoMod Basics
- Performance Optimization
- Load Testing & Scaling
```

### Phase 6: Platform & Ecosystem (Woche 25+)

```
- Bot API + Webhooks
- OAuth2 Provider
- Forum Channels
- Stage Channels
- Server Discovery
- Custom Emoji
- Onboarding Flows
- Internationalisierung
- Accessibility Audit
- Content Moderation Pipeline
```
