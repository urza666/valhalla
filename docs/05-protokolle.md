# 5. Protokoll-Liste

> **Quellenhinweise:** [O] = Offiziell | [H] = Herleitung | [A] = Annahme

---

## 5.1 Client ↔ Backend

### HTTPS / REST API

| Aspekt | Detail |
|--------|--------|
| **Zweck** | CRUD-Operationen, Datenabruf, Settings, Auth, File Upload |
| **Warum geeignet** | Request/Response passt für atomare Operationen; cachebare GETs; Standardisiert |
| **Daten** | User/Guild/Channel CRUD, Message History, Search, File Upload, Auth Flows |
| **Base URL** | `https://discord.com/api/v10/` **[O]** |
| **Format** | JSON (Request/Response), Multipart für Uploads |
| **Auth** | `Authorization: Bot <token>` oder `Authorization: Bearer <token>` **[O]** |
| **Rate Limiting** | Per-Route + Global, Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` **[O]** |
| **Typische Probleme** | Rate Limits bei hohem Durchsatz, Versionierung, Breaking Changes |
| **Implementierungsaufwand** | K2 — Standard REST-API, aber mit komplexem Rate-Limiting |

### WebSocket Gateway

| Aspekt | Detail |
|--------|--------|
| **Zweck** | Bidirektionale Echtzeit-Kommunikation für Events |
| **Warum geeignet** | Persistente Verbindung für Push-Events; geringerer Overhead als Polling |
| **Daten** | Alle Realtime-Events (Messages, Presence, Voice State, Guild Updates) |
| **URL** | `wss://gateway.discord.gg/?v=10&encoding=json` **[O]** |
| **Encoding** | JSON oder ETF (Erlang Term Format) **[O]** |
| **Compression** | zlib-stream (optional, empfohlen) **[O]** |
| **Typische Probleme** | Connection-Management, Resume-Logik, Sharding, Thundering Herd bei Reconnect |
| **Implementierungsaufwand** | K4 — Hochkomplex bei Skalierung |

### gRPC (intern) [A]

| Aspekt | Detail |
|--------|--------|
| **Zweck** | Inter-Service-Kommunikation im Backend |
| **Warum geeignet** | Typisiert (Protobuf), effizient, Streaming-fähig, niedrige Latenz |
| **Daten** | Service-zu-Service Calls (Permission-Checks, User-Lookups, etc.) |
| **Typische Probleme** | Schema-Evolution, Debugging (binäres Format) |
| **Implementierungsaufwand** | K2 — Gute Tooling-Unterstützung |

> **[A]** Discord verwendet wahrscheinlich gRPC oder ein ähnliches RPC-Framework intern. Elixir hat gute gRPC-Unterstützung, und es passt zum Microservice-Ansatz.

---

## 5.2 Realtime / Messaging

### Gateway-Protokoll im Detail [O]

#### Opcodes

| Opcode | Name | Richtung | Beschreibung |
|--------|------|----------|-------------|
| 0 | Dispatch | S→C | Event mit Payload (+ sequence number) |
| 1 | Heartbeat | Bidirektional | Keep-Alive |
| 2 | Identify | C→S | Auth + Session-Start |
| 3 | Presence Update | C→S | Eigenen Status setzen |
| 4 | Voice State Update | C→S | Voice Channel Join/Leave |
| 6 | Resume | C→S | Session wiederaufnehmen |
| 7 | Reconnect | S→C | Server fordert Reconnect |
| 8 | Request Guild Members | C→S | Lazy-Loading von Member-Listen |
| 9 | Invalid Session | S→C | Session ungültig |
| 10 | Hello | S→C | Heartbeat-Intervall |
| 11 | Heartbeat ACK | S→C | Heartbeat bestätigt |

#### Verbindungs-Lifecycle

```
Client                          Gateway Server
  │                                  │
  │──── WSS Connect ────────────────►│
  │◄──── HELLO (heartbeat_interval) ─│
  │                                  │
  │──── IDENTIFY (token, intents) ──►│
  │◄──── READY (guilds, user, ...)  ─│
  │◄──── GUILD_CREATE (per guild)   ─│
  │                                  │
  │◄──── DISPATCH (events) ─────────►│
  │──── HEARTBEAT ──────────────────►│
  │◄──── HEARTBEAT_ACK ─────────────│
  │      (alle ~41.25s)              │
  │                                  │
  │ ··· Verbindung bricht ab ···     │
  │                                  │
  │──── WSS Reconnect ─────────────►│
  │◄──── HELLO ──────────────────── │
  │──── RESUME (session_id, seq) ──►│
  │◄──── Missed Events (Replay) ───│
  │◄──── RESUMED ──────────────────│
```

#### Event-Payloads (Beispiele)

**MESSAGE_CREATE:**
```json
{
  "op": 0,
  "s": 42,
  "t": "MESSAGE_CREATE",
  "d": {
    "id": "123456789",
    "channel_id": "987654321",
    "author": { "id": "111", "username": "user", "avatar": "abc" },
    "content": "Hello!",
    "timestamp": "2024-01-01T00:00:00.000000+00:00",
    "attachments": [],
    "embeds": [],
    "mentions": [],
    "mention_roles": [],
    "pinned": false,
    "type": 0
  }
}
```

**PRESENCE_UPDATE:**
```json
{
  "op": 0,
  "s": 43,
  "t": "PRESENCE_UPDATE",
  "d": {
    "user": { "id": "111" },
    "guild_id": "999",
    "status": "online",
    "activities": [
      { "name": "Visual Studio Code", "type": 0 }
    ],
    "client_status": { "desktop": "online" }
  }
}
```

**TYPING_START:**
```json
{
  "op": 0,
  "s": 44,
  "t": "TYPING_START",
  "d": {
    "channel_id": "987654321",
    "guild_id": "999",
    "user_id": "111",
    "timestamp": 1704067200,
    "member": { "roles": ["222"], "nick": "Nickname" }
  }
}
```

### Heartbeat-Mechanismus [O]

```
1. Server sendet HELLO mit heartbeat_interval (z.B. 41250ms)
2. Client sendet HEARTBEAT (op:1) im Intervall
   - Erstes Heartbeat: nach random(0, heartbeat_interval)
   - Danach: alle heartbeat_interval ms
3. Server antwortet mit HEARTBEAT_ACK (op:11)
4. Kein ACK nach Heartbeat → Verbindung tot → Reconnect
5. Server kann auch HEARTBEAT anfordern → Client muss sofort antworten
```

### Session Resume [O]

```
Voraussetzungen:
- session_id (aus READY Event)
- resume_gateway_url (aus READY Event)
- Letzter sequence_number (s-Feld aus letztem Dispatch)

Resume-Flow:
1. Connect zu resume_gateway_url
2. Sende RESUME { token, session_id, seq }
3. Server replayed alle Events seit seq
4. Bei Erfolg: RESUMED Event
5. Bei Fehler: INVALID_SESSION → neues IDENTIFY nötig

Timeout: Sessions bleiben ~30s aktiv nach Disconnect [H]
```

### Notification-Events [H]

```
Notification-Logik (Client-seitig):
1. MESSAGE_CREATE empfangen
2. Prüfe: Bin ich erwähnt? (@user, @role, @everyone)
3. Prüfe: Notification-Settings für diesen Channel/Server
4. Prüfe: Bin ich aktuell in diesem Channel? (→ Suppress)
5. Prüfe: Status = DND? (→ Suppress)
6. → Desktop Notification / Sound / Badge Update

Server-seitig (Push):
- Wenn Client KEINE aktive Gateway-Verbindung hat
- → Push-Notification via FCM/APNs
- Delay: ~15s nach Nachricht (falls Client sich wieder verbindet)
```

---

## 5.3 Voice / Video / Streaming

### Signaling-Ablauf [O]

```
Client                Gateway             Voice Server
  │                      │                      │
  │── VOICE_STATE_UPDATE ►                      │
  │   (guild, channel)   │                      │
  │                      │── Assign Voice ──────►
  │                      │   Server              │
  │◄─ VOICE_STATE_UPDATE │                      │
  │   (session_id)       │                      │
  │◄─ VOICE_SERVER_UPDATE│                      │
  │   (endpoint, token)  │                      │
  │                      │                      │
  │──── WSS Connect ───────────────────────────►│
  │◄─── HELLO (ssrc, ip, port, modes) ─────────│
  │                                             │
  │──── IP Discovery (UDP) ────────────────────►│
  │◄─── IP Discovery Response ─────────────────│
  │                                             │
  │──── SELECT_PROTOCOL (UDP, encryption) ─────►│
  │◄─── SESSION_DESCRIPTION (mode, secret_key) │
  │                                             │
  │──── UDP Audio (Opus/SRTP) ────────────────►│
  │◄─── UDP Audio (Opus/SRTP) from others ─────│
```

### WebRTC vs. Custom Protocol [O/H]

| Aspekt | Discord's Ansatz |
|--------|-----------------|
| **Signaling** | Eigenes WebSocket-Protokoll (NICHT SDP/ICE Offer/Answer) **[O]** |
| **Media Transport** | UDP mit eigenem Framing (NICHT Standard WebRTC SRTP) **[H]** |
| **NAT Traversal** | Eigene IP Discovery + TURN-ähnliche Relay **[H]** |
| **Encryption** | xsalsa20_poly1305 oder aes256_gcm **[O]** |
| **Codec Audio** | Opus (48kHz, Stereo-fähig) **[O]** |
| **Codec Video** | VP8/VP9/H.264 (SVC für Simulcast) **[H]** |
| **Web Client** | Nutzt WebRTC API des Browsers für Media-Zugriff **[B]** |
| **Desktop/Mobile** | Eigener UDP-Stack **[H]** |

> **Warum eigenes Protokoll?** Discord nutzt bewusst KEIN Standard-WebRTC Peer-to-Peer. Stattdessen verbinden sich alle Clients zu einem zentralen Voice-Server (SFU-Modell). Dies ermöglicht: Server-seitige Kontrolle, einfacheres Scaling, keine O(n²) Peer-Verbindungen, server-seitige Aufnahme möglich. **[H]**

### SFU-Architektur (Selective Forwarding Unit) [H]

```
┌──────────┐     ┌──────────────────────┐     ┌──────────┐
│ Client A ├────►│                      ├────►│ Client B │
│ (sendet  │     │    Voice Server      │     │ (empfängt│
│  1 Stream)     │    (SFU)             │     │  N-1     │
└──────────┘     │                      │     │  Streams)│
                 │  - Empfängt N Streams│     └──────────┘
┌──────────┐     │  - Forwarded N-1 an  │     ┌──────────┐
│ Client C ├────►│    jeden Client      ├────►│ Client D │
│          │     │  - Kein Transcoding  │     │          │
└──────────┘     │  - Kein Mixing       │     └──────────┘
                 │  - Bandwidth-optimiert│
                 └──────────────────────┘

Vorteile SFU vs. MCU:
+ Geringere Server-CPU (kein Mixing/Transcoding)
+ Geringere Latenz (kein Processing)
+ Jeder Client kann individuelle Streams empfangen
- Mehr Client-Bandwidth nötig (empfängt N-1 Streams)
- Client muss N-1 Streams decodieren
```

### Audio Pipeline [H]

```
Mikrofon → Capture → VAD/Gate → Noise Suppression →
Opus Encode → Encrypt (xsalsa20) → UDP Packet →
Network → Voice Server (SFU) → Forward →
UDP Packet → Decrypt → Opus Decode →
Jitter Buffer → Audio Mixing → Speaker Output

Timing:
- Opus Frame: 20ms (Standard)
- Packets pro Sekunde: 50
- Bitrate: 8-384 kbps (konfigurierbar pro Channel)
- Jitter Buffer: ~40-200ms adaptive
```

### Video/Screen Share [H]

```
Zusätzlich zum Audio-Stream:
- Separater UDP-Stream für Video
- Simulcast: Multiple Qualitätsstufen gleichzeitig senden
  (z.B. 720p + 360p + 180p)
- SFU wählt passende Qualität pro Empfänger
- Screen Share: Höhere Auflösung, niedrigere FPS
  (1080p/1440p @ 15-30fps vs. Kamera 720p @ 30fps)

Video-Codecs:
- VP8/VP9: Royalty-free, gute Qualität
- H.264: Hardware-Beschleunigung auf vielen Geräten
- AV1: Zukunft (noch nicht bei Discord bestätigt)
```

### NAT Traversal [O/H]

```
Discord's IP Discovery:
1. Client sendet UDP-Paket an Voice Server mit eigener SSRC
2. Voice Server antwortet mit der beobachteten IP:Port des Clients
3. Client nutzt diese Info im SELECT_PROTOCOL
→ Einfacher als STUN, da der Voice Server der Relay-Endpunkt ist

Fallback:
- Wenn UDP nicht möglich → TCP fallback möglich [H]
- Discord betreibt eigene Relay-Server weltweit [O]
- Voice Regions: Brazil, Hong Kong, India, Japan, Rotterdam,
  Russia, Singapore, South Africa, Sydney, US Central/East/South/West [O]
```

### Typische Probleme Voice/Video

| Problem | Beschreibung | Lösungsansatz |
|---------|-------------|---------------|
| **NAT/Firewall** | UDP blockiert | TCP-Fallback, TURN Relay |
| **Packet Loss** | Audio-Aussetzer | FEC (Forward Error Correction), Jitter Buffer |
| **Jitter** | Ungleichmäßige Paket-Ankunft | Adaptive Jitter Buffer |
| **Latenz** | Verzögerung >200ms | Edge-Server nahe am User, UDP, kein Transcoding |
| **Echo** | Feedback-Schleifen | AEC (Acoustic Echo Cancellation) |
| **Bandwidth** | Schwankende Bandbreite | Adaptive Bitrate, Simulcast Layer-Switching |
| **Codec Compatibility** | Verschiedene Geräte | Fallback-Codecs, Server-Transcoding als letzter Ausweg |

---

## 5.4 Sicherheit

### TLS

| Aspekt | Detail |
|--------|--------|
| **Zweck** | Verschlüsselung aller HTTP/WSS-Verbindungen |
| **Warum geeignet** | Standard, PKI-basiert, von allen Clients unterstützt |
| **Daten** | Alles über HTTPS und WSS |
| **Version** | TLS 1.2+ (wahrscheinlich 1.3 bevorzugt) **[H]** |
| **Probleme** | Certificate Management, Performance (Handshake) |
| **Aufwand** | K1 — Standard, gut tooled (Let's Encrypt, Cloudflare) |

### Token-Strategie [O/H]

| Aspekt | Detail |
|--------|--------|
| **User Token** | Langlebiger Auth-Token nach Login, identifiziert User+Session |
| **Bot Token** | Permanenter Token pro Bot-Application **[O]** |
| **Bearer Token** | OAuth2 Bearer für Third-Party-Apps **[O]** |
| **Refresh** | Vermutlich Token-Rotation bei Verdacht **[H]** |
| **Storage** | Client: localStorage/Keychain; Server: Redis/DB **[H]** |
| **Invalidierung** | Password Change → alle Tokens invalidiert **[B]** |

```
Token-Flow:
1. Login (E-Mail + Passwort + optional MFA)
   → Token erhalten
2. Jeder API Request: Authorization: <token>
3. WebSocket IDENTIFY: token im Payload
4. Token-Invalidierung: Passwort-Änderung, Manual Revoke, Suspicious Activity
```

### OAuth2 [O]

| Aspekt | Detail |
|--------|--------|
| **Zweck** | Third-Party-App-Autorisierung, Bot-Installation |
| **Flows** | Authorization Code Grant, Implicit (deprecated) **[O]** |
| **Scopes** | `identify`, `guilds`, `email`, `connections`, `bot`, `messages.read`, etc. **[O]** |
| **Daten** | User-Info, Guild-Mitgliedschaften, E-Mail |
| **Probleme** | Scope-Creep, Token-Leaks |
| **Aufwand** | K2 — Standard OAuth2, gut dokumentiert |

### Rate Limiting [O]

```
Rate Limit Hierarchie:
1. Global Rate Limit: 50 Requests/Sekunde pro User
2. Per-Route Rate Limit: Variiert pro Endpoint
   - POST /channels/:id/messages: 5/5s
   - PATCH /channels/:id: 2/10s
   - DELETE /channels/:id/messages/:id: 5/1s
3. Shared Buckets: Einige Routes teilen sich ein Limit

Headers:
- X-RateLimit-Limit: Maximale Requests
- X-RateLimit-Remaining: Verbleibende Requests
- X-RateLimit-Reset: Timestamp des Resets
- X-RateLimit-Bucket: Bucket-ID
- Retry-After: Wartezeit bei 429

Response bei Limit:
HTTP 429 Too Many Requests
{ "message": "...", "retry_after": 1.5, "global": false }
```

### Berechtigungsprüfung [O/H]

```
Jeder API-Request:
1. Token validieren → User identifizieren
2. Route parsen → Resource identifizieren
3. Membership prüfen → User ist Member der Guild?
4. Permissions berechnen (siehe Permission-Engine in 4.2)
5. Aktion autorisieren

Beispiel: POST /channels/:id/messages
- User ist Member der Guild des Channels? ✓
- User hat SEND_MESSAGES Permission in diesem Channel? ✓
- User ist nicht getimet? ✓
- Channel ist nicht read-only? ✓
- Rate Limit nicht überschritten? ✓
→ Nachricht erstellen
```

### Missbrauchsschutz [B/H]

| Maßnahme | Beschreibung | Ebene |
|----------|-------------|-------|
| **Rate Limiting** | Per-User, Per-IP, Per-Route, Global | API |
| **Captcha** | hCaptcha bei verdächtigen Aktionen | Auth/API |
| **Phone Verification** | Pflicht bei verdächtigen Accounts | Account |
| **E-Mail Verification** | Pflicht für Server-Features | Account |
| **Account Age Gates** | Neue Accounts eingeschränkt | Server |
| **IP Banning** | Blockierung auf IP-Ebene | Infrastruktur |
| **Content Scanning** | Proaktives Scanning von Medien | Nachrichten |
| **AutoMod** | Keyword-Filter, Spam-Detection | Server |
| **Anti-Raid** | Erkennung von Mass-Joins | Server |
| **Cloudflare** | DDoS-Schutz, WAF | Edge |

### E2E-Verschlüsselung [B/H]

| Aspekt | Status |
|--------|--------|
| **Text-Nachrichten** | **Nicht E2E-verschlüsselt** — Server kann Nachrichten lesen (nötig für Suche, Moderation, AutoMod) **[B]** |
| **Voice/Video** | Verschlüsselt (xsalsa20_poly1305) zwischen Client und Voice Server, aber **nicht E2E** — Voice Server entschlüsselt zum Forwarding **[O/H]** |
| **DMs** | Ebenfalls nicht E2E — Discord hat Zugriff für Moderation/Safety **[B]** |

> **Wichtig für eigene Plattform:** E2E-Verschlüsselung steht in Konflikt mit Server-seitiger Suche, AutoMod und Content-Moderation. Dies ist eine fundamentale Architekturentscheidung.

### Replay-Schutz [H]

```
- Nonces in Message-Requests verhindern Doppel-Sends
- Sequence Numbers im Gateway verhindern Event-Replay
- CSRF-Token für State-ändernde Web-Requests
- Signed URLs für Attachment-Zugriff (zeitlich begrenzt)
```
