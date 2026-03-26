# Valhalla — Projekt-Dokumentation

> **Echtzeit-Kommunikationsplattform für Communities und Business-Teams**
> Erstellt: 2026-03-26

---

## Dokumentationsübersicht

| # | Dokument | Inhalt | Seiten |
|---|----------|--------|--------|
| 1 | [Executive Summary](01-executive-summary.md) | Produktübersicht, Hauptsysteme, technisch anspruchsvollste Bereiche | ~ |
| 2 | [Feature-Liste](02-feature-liste.md) | Vollständige Feature-Liste mit MVP/Prod-Priorisierung und Komplexität | ~ |
| 3 | [UI / Screens / Navigation](03-ui-screens-navigation.md) | Alle Screens, Navigationsstruktur, wiederverwendbare Komponenten | ~ |
| 4 | [Architektur](04-architektur.md) | Backend-Services, Datenmodell, Infrastruktur, Realtime, Client-Architektur | ~ |
| 5 | [Protokolle](05-protokolle.md) | REST, WebSocket, Voice/Video, Sicherheitsprotokolle | ~ |
| 6 | [Schlussfolgerungen](06-schlussfolgerungen.md) | MVP-Scope, Build-Reihenfolge, Team, Risiken | ~ |
| 7 | [Abschlussmatrix](07-abschlussmatrix.md) | 50-Punkte-Matrix: MVP/Prod/Komplexität/Risiko | ~ |
| 8 | [Stärken & Schwächen](08-staerken-schwaechen.md) | Discord-Analyse, MS Teams Vergleich, Differenzierungspotenziale | ~ |
| 9 | [Zukunfts-Features](09-zukunfts-features.md) | Nutzer-Feedback, Business-Features, AI-Features, Roadmap | ~ |
| 10 | [Design, Workflows & Comm-Stack](10-design-workflows.md) | Design System, Kern-Workflows, Communication Stack, Event-Katalog, API-Routes | ~ |
| 11 | [Discord Nutzerfeedback (Recherche)](11-discord-nutzerfeedback-recherche.md) | 100+ Beschwerden/Wünsche aus Reddit, Trustpilot, G2, Feedback-Foren | ~ |
| 12 | [MS Teams Business-Features](02-ms-teams-business-features-analyse.md) | 10 Business-Module im Detail, Adaptions-Empfehlungen, Build-Aufwand | ~ |
| 13 | [Discord Rechtestruktur (Bitfeld-Referenz)](12-discord-rechtestruktur.md) | Alle 49 Permission Flags, Berechnungsalgorithmus, Spezialrollen, Edge Cases | ~ |
| 14 | [RBAC-Rollenmatrix](13-rbac-rollenmatrix.md) | Vollständige Rollenmatrix, Hierarchie, Override-Kaskade, Verbesserungen für Valhalla | ~ |
| K | [Kernkonzept](kernkonzept.md) | Gesamtkonzept, Technologie-Stack, Architektur-Entscheidungen, Roadmap | ~ |

---

## Quick Reference

### Tech-Stack (Empfohlen)

| Layer | Technologie |
|-------|-------------|
| Web Client | React + TypeScript + Zustand |
| Desktop | Tauri (Rust + Web) |
| Mobile | React Native / Expo |
| API | Go oder Rust oder Elixir |
| Gateway | Elixir/BEAM oder Go |
| Voice/SFU | LiveKit |
| Primary DB | PostgreSQL |
| Message DB | PostgreSQL (MVP) → ScyllaDB (Scale) |
| Cache | Redis |
| Search | Meilisearch (MVP) → Elasticsearch |
| Broker | NATS JetStream |
| Storage | MinIO / S3 |
| CDN | Cloudflare |
| Monitoring | Prometheus + Grafana + Loki |

### Build-Phasen

```
Phase 0: Foundation           [Woche 1-2]    — Setup, Schema, Auth
Phase 1: Text-Chat MVP        [Woche 3-6]    — Guilds, Channels, Messaging
Phase 2: Social & DMs         [Woche 7-8]    — DMs, Freunde, Presence
Phase 3: Voice                [Woche 9-12]   — LiveKit, Voice Channels
Phase 4: Polish               [Woche 13-16]  — Moderation, Threads, Suche
Phase 5: Video & Platforms    [Woche 17-24]  — Video, Desktop, Mobile
Phase 6: Differenzierung      [Woche 25-36]  — Kanban, Wiki, AI, Bot API
Phase 7: Enterprise           [Woche 37+]    — SSO, Compliance, Self-Host
```

### Top-Differenzierungsmerkmale vs. Discord

1. Integriertes Task/Kanban-Board pro Channel
2. AI-basierte Channel-Zusammenfassungen & Transkription
3. Self-Hosting / On-Premise Option
4. Bessere Thread-UX (dediziertes Panel, Inbox)
5. Nativer Dateibrowser pro Channel
6. SSO/SAML + Enterprise Admin
7. Intelligente Notification-Bündelung
8. Leichtgewichtiger Desktop-Client (Tauri statt Electron)
9. Native Polls & Forms
10. Visual Workflow Builder (No-Code)
