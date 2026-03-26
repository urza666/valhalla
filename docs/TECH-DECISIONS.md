# Valhalla — Finale Technologie-Entscheidungen

> **Status:** FINAL — Entschieden am 2026-03-26
> **Entscheidungsträger:** Architektur-Lead

---

## Zusammenfassung

| Bereich | Entscheidung | Begründung |
|---------|-------------|------------|
| **Backend-Sprache** | **Go 1.22+** | Ein Stack, riesiger Talentpool, LiveKit-kompatibel, exzellente Concurrency |
| **HTTP Framework** | **net/http + chi router** | Stdlib-nah, kein Framework-Lock-in, chi ist leichtgewichtig und composable |
| **WebSocket** | **gorilla/websocket** (oder nhooyr bei Bedarf) | Bewährt, stabil, volle Kontrolle |
| **DB (relational)** | **PostgreSQL 16** | ACID, bewährt, Partitioning für Messages |
| **DB (messages MVP)** | **PostgreSQL** (partitioniert) | Kein Over-Engineering; Migration zu ScyllaDB wenn >100M Messages |
| **Cache/Sessions/Presence** | **Redis 7 (Valkey)** | <1ms Lookups, Pub/Sub, Streams |
| **Message Broker** | **NATS + JetStream** | Go-nativ, einfach, schnell, Persistenz via JetStream |
| **Search** | **Meilisearch** (MVP) → Elasticsearch (Scale) | Einfacher Betrieb, Rust-basiert, schnell |
| **Object Storage** | **MinIO** (Dev/Self-Host) / **S3** (Cloud) | S3-kompatibel, self-hostable |
| **Auth-Strategie** | **Opaque Token + Redis** | Sofort revozierbar, einfach, <1ms Lookup |
| **ID-Strategie** | **Snowflake (64-Bit, Custom Epoch)** | Zeitlich sortierbar, dezentral generierbar |
| **API-Versionierung** | **URL-basiert: `/api/v1/`** | Einfach, klar, wie Discord |
| **Frontend** | **React 19 + TypeScript + Vite** | Größtes Ökosystem, schnellste Entwicklung |
| **State Management** | **Zustand + TanStack Query** | Leichtgewichtig, Server-State getrennt |
| **Voice/SFU** | **LiveKit** | Go, Open Source, production-ready, WebRTC |
| **Monorepo** | **Go Monorepo** (`cmd/` + `internal/`) | Ein `go.mod`, klare Struktur |
| **Desktop (Phase 5)** | **Tauri 2.0** | 10x weniger RAM als Electron |
| **Mobile (Phase 5)** | **React Native / Expo** | Code-Sharing mit Web |
| **Reverse Proxy** | **Caddy** | Auto-TLS, HTTP/3, einfache Config |
| **Containerisierung** | **Docker + Docker Compose** (Dev) | Standard, später K8s |
| **CI/CD** | **GitHub Actions** | Standard, gut integriert |
| **Monitoring** | **Prometheus + Grafana + Loki** | Open Source, Standard |
| **DB Migrations** | **golang-migrate** | SQL-basiert, versioniert, CLI + Library |
| **SQL Access** | **sqlc** | Typesafe SQL → Go Code Generation |
| **Password Hashing** | **Argon2id** | Aktuell stärkster Algorithmus |
| **Config** | **envconfig + .env** | 12-Factor App konform |

---

## Begründung der Schlüsselentscheidungen

### Warum Go statt Elixir?

1. **Ein Stack** für API + Gateway + Worker = schnellere Entwicklung, einfacheres Hiring
2. **Goroutines** skalieren bis ~1M gleichzeitige WebSocket-Verbindungen pro Server
3. **LiveKit** (unser SFU) ist in Go geschrieben → gleiche Sprache, einfacheres Debugging
4. **Talentpool** ist 5-10x größer als Elixir
5. **Deployment** ist trivial: Single Binary, kein Runtime nötig
6. Wenn Gateway irgendwann Bottleneck wird (>1M CCU), kann dieser EINE Service in Elixir/Rust umgeschrieben werden

### Warum chi statt Fiber/Echo/Gin?

1. **chi** baut auf `net/http` auf → kein eigener Context, kein Framework-Lock-in
2. Composable Middleware-Chain → Standard Go `http.Handler` Interface
3. Leichtgewichtig, keine Magie, volle Kontrolle
4. Discord-ähnliche Route-Struktur einfach abbildbar

### Warum Opaque Tokens statt JWT?

1. **Sofort revozierbar** — Passwort-Änderung → alle Tokens sofort ungültig
2. **Kein Token-Leak-Risiko** — Token allein verrät nichts (kein Payload)
3. **Redis-Lookup <1ms** — kein spürbarer Performance-Nachteil
4. **Einfacher** — kein Key-Management, kein Signing, kein Expiry-Handling

### Warum sqlc statt GORM/Ent?

1. **SQL bleibt SQL** — keine Abstraktion, volle Kontrolle, performant
2. **Typesafe Code-Generation** — Compiler fängt Fehler ab
3. **Kein N+1 Problem** — du schreibst die Queries explizit
4. **Performance** — kein Reflection, kein Runtime-Overhead

### Warum NATS statt Kafka/RabbitMQ?

1. **Go-nativ** — Client und Server in Go
2. **JetStream** für Persistenz wenn nötig (Notification-Queue etc.)
3. **Extrem einfach** zu betreiben — single binary, kein ZooKeeper
4. **Pub/Sub + Request/Reply + Queue Groups** — alles was wir brauchen
5. **Latenz**: <1ms (vs. Kafka 5-50ms)

---

## Snowflake ID Spezifikation

```
Valhalla Snowflake (64 Bit):
┌──────────────────────────────────────┬──────┬───────┬────────────┐
│  Timestamp (ms since Valhalla Epoch) │Worker│Process│ Increment  │
│            42 Bits                   │5 Bits│5 Bits │  12 Bits   │
└──────────────────────────────────────┴──────┴───────┴────────────┘

Valhalla Epoch: 2026-01-01T00:00:00.000Z (1735689600000 ms)

Kapazität:
- 42 Bit Timestamp: ~139 Jahre ab Epoch (bis 2165)
- 10 Bit Worker+Process: 1024 eindeutige Generator-Instanzen
- 12 Bit Increment: 4096 IDs pro Millisekunde pro Generator
- Gesamt: ~4M IDs/s pro Generator, ~4B IDs/s mit 1024 Generatoren
```

---

## Projektstruktur

```
valhalla/
├── cmd/
│   ├── api/main.go           # REST API Server
│   ├── gateway/main.go       # WebSocket Gateway
│   └── migrate/main.go       # DB Migration Runner
├── internal/
│   ├── auth/                  # Auth Domain
│   ├── user/                  # User Domain
│   ├── guild/                 # Guild Domain
│   ├── channel/               # Channel Domain
│   ├── message/               # Message Domain
│   ├── permission/            # Permission Engine
│   ├── presence/              # Presence Tracking
│   ├── gateway/               # WebSocket Gateway Logic
│   ├── notification/          # Notifications
│   ├── moderation/            # Moderation
│   └── config/                # App Configuration
├── pkg/
│   ├── snowflake/             # ID Generator
│   ├── middleware/             # HTTP Middleware
│   ├── events/                # Event Types
│   ├── permissions/           # Permission Bitfield
│   ├── apierror/              # Error Responses
│   └── validate/              # Validation
├── web/                       # React Frontend
├── migrations/                # SQL Migrations
├── deployments/               # Docker, Compose
├── docs/                      # Dokumentation
├── scripts/                   # Dev Scripts
├── go.mod
├── go.sum
├── Makefile
├── .env.example
├── .gitignore
└── README.md
```
