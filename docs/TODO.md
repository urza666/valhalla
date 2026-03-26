# Valhalla — Fehlende Features (Gap-Analyse)

Vergleich: Dokumentation (docs/) vs. tatsaechliche Implementierung.
Stand: 2026-03-26

---

## Phase A: Kritisch (Chat benutzbar machen)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| A1 | Message Context Menu (Edit, Delete, Reply, Pin) | Vorhanden | FEHLT | TODO |
| A2 | Message Reply/Reference UI | Endpoint da | FEHLT | TODO |
| A3 | File Upload im Composer (Bilder/Dateien) | Endpoint da | FEHLT | TODO |
| A4 | Embed/Link Preview Rendering | Service da | FEHLT | TODO |
| A5 | Vollstaendiger Emoji Picker (Unicode DB) | — | Nur 16 Quick-Emojis | TODO |
| A6 | Mention Autocomplete (@user, @role) | Parsing fehlt | FEHLT | TODO |
| A7 | Pinned Messages Panel | DB/API da | FEHLT | TODO |
| A8 | Message Edit Mode (inline) | API da | FEHLT | TODO |
| A9 | Reactions UI (Hover = Nutzer anzeigen) | API da | Nur Basic | TODO |
| A10 | Unread Badges in Server/Channel Liste | API da | FEHLT | TODO |

## Phase B: User-Verwaltung & Profil

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| B1 | User Settings Screen | Teilweise | FEHLT | TODO |
| B2 | Profil Editor (Avatar, Display Name, Bio) | PATCH fehlt | FEHLT | TODO |
| B3 | Passwort aendern | FEHLT | FEHLT | TODO |
| B4 | E-Mail Verifizierung | FEHLT | FEHLT | TODO |
| B5 | Passwort Reset Flow | FEHLT | FEHLT | TODO |
| B6 | Session-Liste & Remote Revoke | DB da | FEHLT | TODO |

## Phase C: Server-Verwaltung & Moderation

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| C1 | Rollen erstellen/bearbeiten/loeschen | FEHLT | FEHLT | TODO |
| C2 | Permission Matrix UI | Engine da | FEHLT | TODO |
| C3 | Channel Permission Overrides UI | DB da | FEHLT | TODO |
| C4 | Ban/Unban (API wiring + UI) | Service da | FEHLT | TODO |
| C5 | Timeout (temporaere Stummschaltung) | DB da | FEHLT | TODO |
| C6 | Audit Log Viewer | Service da | FEHLT | TODO |
| C7 | Slow Mode pro Channel | DB-Feld da | FEHLT | TODO |
| C8 | Server Icon/Banner Upload | FEHLT | FEHLT | TODO |

## Phase D: Social Features

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| D1 | Freundschaftsanfragen | Relationship-Tabelle da | FEHLT | TODO |
| D2 | Friends List (Online/Offline/Pending/Blocked) | FEHLT | FEHLT | TODO |
| D3 | User Profile Popout (Klick auf Avatar) | FEHLT | FEHLT | TODO |
| D4 | Block User | DB da | FEHLT | TODO |
| D5 | DM List in Sidebar | API da | FEHLT | TODO |

## Phase E: Differenzierungs-Features (UI)

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| E1 | Kanban Board UI | API komplett | FEHLT | TODO |
| E2 | Wiki UI (Seiten lesen/schreiben) | API komplett | FEHLT | TODO |
| E3 | Polls UI (erstellen/abstimmen) | API komplett | FEHLT | TODO |
| E4 | Thread View/Panel | API teilweise | FEHLT | TODO |
| E5 | Search UI mit Filtern | API da | Nur Basic | TODO |

## Phase F: Notifications & Einstellungen

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| F1 | Desktop Notifications | — | FEHLT | TODO |
| F2 | Notification Preferences pro Channel | FEHLT | FEHLT | TODO |
| F3 | Appearance Settings (Theme, Font Size) | — | FEHLT | TODO |
| F4 | Keybind Settings | — | FEHLT | TODO |
| F5 | Voice & Video Settings (Input/Output) | — | FEHLT | TODO |

## Phase G: Erweitert

| # | Feature | Backend | Frontend | Status |
|---|---------|---------|----------|--------|
| G1 | GIF Picker (Tenor API) | FEHLT | FEHLT | TODO |
| G2 | Custom Server Emoji | DB da | FEHLT | TODO |
| G3 | 2FA/MFA (TOTP) | FEHLT | FEHLT | TODO |
| G4 | AutoMod Regeln | FEHLT | FEHLT | TODO |
| G5 | Report System | FEHLT | FEHLT | TODO |
