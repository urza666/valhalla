# Valhalla

**Open-Source Kommunikationsplattform fur Text, Voice und Video**

Valhalla ist eine selbst-hostbare Alternative zu Discord, Slack und Microsoft Teams. Du kannst damit deinen eigenen Kommunikationsserver betreiben -- fur deine Community, dein Team oder dein Unternehmen. Komplett kostenlos, komplett unter deiner Kontrolle.

> Dieses Projekt ist der Open-Source-Community gewidmet. Danke fur die grossartigen Tools, Bibliotheken und die Inspiration der letzten Jahre. Valhalla ist mein Beitrag zuruck.

---

## Was kann Valhalla?

### Kommunikation
- **Textkanale** mit Formatierung (Markdown), Reaktionen, Antworten und Threads
- **Sprachkanale** mit einem Klick beitreten -- wie bei Discord
- **Videoanrufe und Bildschirmfreigabe** mit automatischer Qualitatsanpassung
- **Direktnachrichten** zwischen zwei Personen
- **Schreibanzeige** ("Max tippt gerade...") und **Online-Status**

### Community-Verwaltung
- **Server (Guilds)** erstellen mit Kategorien und Kanalen
- **Rollen und Berechtigungen** -- du bestimmst wer was darf, bis auf Kanal-Ebene
- **Einladungssystem** mit Ablaufdatum und maximaler Nutzung
- **Moderation** -- Mitglieder kicken, bannen, temporar stummschalten

### Business-Features (was Discord nicht hat)
- **Kanban-Boards** -- Aufgaben direkt im Kanal verwalten (To Do / In Arbeit / Fertig)
- **Wiki** -- Dokumentation pro Server mit Versionshistorie
- **Umfragen** -- nativ, mit Mehrfachauswahl und Ablaufdatum
- **Bot-API** -- eigene Integrationen bauen mit Slash-Commands und Webhooks
- **SSO (SAML/OIDC)** -- Mitarbeiter melden sich mit dem Firmenkonto an
- **Compliance** -- Aufbewahrungsfristen, Legal Hold, Audit-Export

---

## Schnellstart: Valhalla in 3 Minuten starten

### Voraussetzungen

Du brauchst nur **zwei Dinge** auf deinem Computer:

1. **Docker** -- [Installation](https://docs.docker.com/get-docker/)
2. **Docker Compose** -- ist bei Docker Desktop bereits dabei

So prufst du ob alles installiert ist:
```bash
docker --version          # Sollte "Docker version 2x.x.x" zeigen
docker compose version    # Sollte "Docker Compose version v2.x.x" zeigen
```

### Installation

```bash
# 1. Projekt herunterladen
git clone https://dgit01p.infra.ip413.de/bot_athene/valhalla.git
cd valhalla

# 2. Automatisches Setup starten
#    (erstellt sichere Passworter, baut alles, startet alles)
./setup.sh
```

Das war's. Nach ca. 2-5 Minuten (je nach Internetgeschwindigkeit) ist alles fertig.

### Oder manuell Schritt fur Schritt:

```bash
# 1. Konfiguration erstellen
cp .env.example .env

# 2. (Optional) .env Datei anpassen -- Passworter andern etc.
nano .env

# 3. Alles bauen und starten
docker compose up -d

# 4. Warten bis alles lauft (ca. 1-2 Minuten)
docker compose ps
```

### Valhalla offnen

| Was | URL |
|-----|-----|
| **Web-App** | [http://localhost](http://localhost) |
| **API** | [http://localhost:8080/api/v1](http://localhost:8080/health) |
| **MinIO-Konsole** (Dateispeicher) | [http://localhost:9001](http://localhost:9001) |

### Ersten Account erstellen

1. Offne [http://localhost](http://localhost) im Browser
2. Klicke auf **"Register"**
3. Wahle einen Benutzernamen, E-Mail und Passwort
4. Erstelle deinen ersten Server uber den **"+"** Button
5. Fertig -- du kannst chatten!

---

## Nutzliche Befehle

```bash
# Status aller Services anzeigen
docker compose ps

# Logs anschauen (live)
docker compose logs -f

# Nur API-Logs
docker compose logs -f api

# Alles stoppen
docker compose down

# Alles stoppen UND Daten loschen (Achtung!)
docker compose down -v

# Neu bauen nach Code-Anderung
docker compose build && docker compose up -d
```

Oder mit dem Makefile:
```bash
make up          # Starten
make down        # Stoppen
make logs        # Logs anschauen
make rebuild     # Neu bauen
make ps          # Status
make help        # Alle verfugbaren Befehle
```

---

## Was lauft da eigentlich? (Services)

Valhalla besteht aus 8 Docker-Containern die zusammenarbeiten:

```
                      Du (Browser)
                          |
                      Port 80
                          |
                 +--------v--------+
                 |    web (Nginx)  |   Webseite + leitet API-Anfragen weiter
                 +---+--------+---+
                     |        |
              /api/* |        | /ws (WebSocket)
                     |        |
                 +---v--------v---+
                 |   api (Go)     |   Herzstuck: API + Echtzeit-Kommunikation
                 +--+--+--+--+---+
                    |  |  |  |
         +----------+  |  |  +----------+
         |          |  |  |             |
    +----v---+ +---v--++ +v-------+ +--v----------+
    |postgres| |redis | |livekit | |meilisearch  |
    |Datenbank| |Cache | |Voice/  | |Volltextsuche|
    +--------+ +------+ |Video   | +-------------+
                         +--------+
         +------+    +-----+
         | nats |    |minio|
         |Nachr.|    |Datei-|
         |broker|    |speich.|
         +------+    +------+
```

| Service | Was macht er? | Fur wen wichtig? |
|---------|--------------|------------------|
| **web** | Zeigt die Webseite an und leitet Anfragen an die API weiter | Jeder der die Web-App nutzt |
| **api** | Das Herzstuck -- verarbeitet alle Anfragen, verwaltet Nutzer, Nachrichten, Kanale | Alles lauft daruber |
| **postgres** | Speichert alle Daten (Nutzer, Server, Nachrichten, Rollen...) | Datenbank -- ohne geht nichts |
| **redis** | Schneller Zwischenspeicher fur Online-Status, Sitzungen, Schreibanzeigen | Macht alles schneller |
| **nats** | Leitet Echtzeit-Nachrichten zwischen Services weiter | Interne Kommunikation |
| **livekit** | Sprachkanale und Videoanrufe (WebRTC) | Wer Voice/Video nutzen will |
| **minio** | Speichert hochgeladene Dateien (Bilder, Dokumente...) | Datei-Uploads |
| **meilisearch** | Ermoglicht die Suche in Nachrichten | Suchfunktion |

---

## Konfiguration (.env Datei)

Die `.env` Datei enthalt alle Einstellungen. Die wichtigsten:

```bash
# === Ports ===
WEB_PORT=80          # Auf welchem Port die Webseite lauft
API_PORT=8080        # Auf welchem Port die API lauft

# === Datenbank ===
DB_USER=valhalla     # Datenbank-Benutzername
DB_PASSWORD=valhalla # Datenbank-Passwort (in Produktion andern!)
DB_NAME=valhalla     # Name der Datenbank

# === Sicherheit ===
TOKEN_SECRET=xxx     # Geheimer Schlussel fur Login-Tokens
                     # setup.sh generiert das automatisch

# === Sprach/Video ===
LIVEKIT_API_KEY=xxx     # Schlussel fur den Voice-Server
LIVEKIT_API_SECRET=xxx  # Geheimnis fur den Voice-Server
```

**Wichtig fur Produktion:** Fuhre `./setup.sh` aus -- das Script generiert automatisch sichere Zufallspassworter fur alle Services.

---

## Fur Entwickler: Lokale Entwicklung

Wenn du am Code arbeiten willst (ohne alles in Docker zu bauen):

```bash
# 1. Nur die Infrastruktur starten (Datenbanken etc.)
make dev-infra

# 2. Go-API lokal starten
cp .env.example .env
# In .env: DATABASE_URL auf localhost andern:
# DATABASE_URL=postgres://valhalla:valhalla@localhost:5432/valhalla?sslmode=disable
make migrate-up
make run-api

# 3. Web-Client lokal starten
cd web
npm install
npm run dev
# Offne http://localhost:3000
```

### Voraussetzungen fur Entwicklung
- Go 1.22+ ([Installation](https://go.dev/dl/))
- Node.js 20+ ([Installation](https://nodejs.org/))
- Docker + Docker Compose

---

## Projektstruktur

```
valhalla/
|
+-- docker-compose.yml      <-- Startet alles mit einem Befehl
+-- setup.sh                <-- Automatisches Setup-Script
+-- .env.example            <-- Konfigurations-Vorlage
+-- Makefile                <-- Nutzliche Kurzbefehle
|
+-- cmd/                    <-- Startpunkte der Go-Programme
|   +-- api/main.go         <-- API-Server
|   +-- gateway/main.go     <-- WebSocket-Server
|   +-- migrate/main.go     <-- Datenbank-Migrations-Tool
|
+-- internal/               <-- Geschaftslogik (23 Module)
|   +-- auth/               <-- Registrierung, Login, Passwort-Hashing
|   +-- guild/              <-- Server-Verwaltung
|   +-- channel/            <-- Kanal-Verwaltung
|   +-- message/            <-- Nachrichten senden/empfangen
|   +-- gateway/            <-- WebSocket Echtzeit-Verbindung
|   +-- voice/              <-- LiveKit Sprach/Video-Integration
|   +-- kanban/             <-- Aufgaben-Boards
|   +-- wiki/               <-- Wissensdatenbank
|   +-- poll/               <-- Umfragen
|   +-- bot/                <-- Bot-API und Webhooks
|   +-- sso/                <-- Enterprise Single Sign-On
|   +-- compliance/         <-- Aufbewahrungsfristen, Legal Hold
|   +-- admin/              <-- Plattform-Administration
|   +-- dm/                 <-- Direktnachrichten
|   +-- presence/           <-- Online-Status
|   +-- search/             <-- Meilisearch-Anbindung
|   +-- embed/              <-- Link-Vorschau (OpenGraph)
|   +-- thread/             <-- Diskussions-Threads
|   +-- notification/       <-- Benachrichtigungen / Ungelesen-Zahler
|   +-- permission/         <-- Berechtigungs-Engine
|   +-- config/             <-- Konfigurationsmanagement
|
+-- pkg/                    <-- Geteilte Bibliotheken
|   +-- snowflake/          <-- ID-Generator (zeitlich sortierbar)
|   +-- permissions/        <-- 53-Bit Berechtigungssystem
|   +-- events/             <-- WebSocket-Ereignistypen
|   +-- apierror/           <-- Standardisierte Fehlermeldungen
|   +-- middleware/         <-- HTTP-Middleware (Auth, Logging, Rate Limit)
|
+-- web/                    <-- React Web-Client
+-- mobile/                 <-- React Native Mobile-Client
+-- desktop/                <-- Tauri Desktop-Client
+-- migrations/             <-- SQL-Datenbankschema (39 Tabellen)
+-- deployments/            <-- Docker-Konfigurationen
+-- docs/                   <-- Ausfuhrliche technische Dokumentation
+-- website/                <-- Projekt-Webseite (Landing Page)
```

---

## Technologie-Stack

| Schicht | Technologie | Warum? |
|---------|-------------|--------|
| **Backend** | Go 1.22 | Schnell, einfach, perfekt fur Echtzeit-Anwendungen |
| **Web-Client** | React 19 + TypeScript | Grosstes Okosystem, schnelle Entwicklung |
| **Desktop** | Tauri 2.0 (Rust) | 10x weniger Speicherverbrauch als Electron |
| **Mobile** | React Native / Expo | Code-Sharing mit Web-Client |
| **Datenbank** | PostgreSQL 16 | Zuverlassig, leistungsstark, bewahrt |
| **Cache** | Redis 7 | Blitzschnell fur Sitzungen und Online-Status |
| **Voice/Video** | LiveKit (WebRTC) | Open Source, produktionsreif |
| **Suche** | Meilisearch | Einfach zu betreiben, extrem schnell |
| **Nachrichten-Bus** | NATS + JetStream | Leichtgewichtig, schnell, Go-nativ |
| **Dateispeicher** | MinIO (S3-kompatibel) | Selbst-hostbar, S3-kompatibel |

---

## API-Ubersicht

Valhalla bietet 57 REST-Endpunkte und einen WebSocket-Gateway.

### Authentifizierung
```
POST   /api/v1/auth/register          Neues Konto erstellen
POST   /api/v1/auth/login             Anmelden
POST   /api/v1/auth/logout            Abmelden
```

### Benutzer
```
GET    /api/v1/users/@me              Eigenes Profil abrufen
GET    /api/v1/users/@me/guilds       Meine Server auflisten
GET    /api/v1/users/@me/channels     Meine Direktnachrichten
POST   /api/v1/users/@me/channels     Direktnachricht starten
```

### Server (Guilds)
```
POST   /api/v1/guilds                 Server erstellen
GET    /api/v1/guilds/:id             Server-Details
PATCH  /api/v1/guilds/:id             Server bearbeiten
DELETE /api/v1/guilds/:id             Server loschen
GET    /api/v1/guilds/:id/channels    Kanale auflisten
POST   /api/v1/guilds/:id/channels    Kanal erstellen
GET    /api/v1/guilds/:id/members     Mitglieder auflisten
DELETE /api/v1/guilds/:id/members/:uid  Mitglied kicken
GET    /api/v1/guilds/:id/roles       Rollen auflisten
```

### Kanale und Nachrichten
```
GET    /api/v1/channels/:id           Kanal-Details
PATCH  /api/v1/channels/:id           Kanal bearbeiten
DELETE /api/v1/channels/:id           Kanal loschen
GET    /api/v1/channels/:id/messages  Nachrichten laden (mit Paginierung)
POST   /api/v1/channels/:id/messages  Nachricht senden
PATCH  /api/v1/channels/:id/messages/:mid  Nachricht bearbeiten
DELETE /api/v1/channels/:id/messages/:mid  Nachricht loschen
POST   /api/v1/channels/:id/typing    Schreibanzeige senden
```

### Reaktionen
```
PUT    /api/v1/channels/:id/messages/:mid/reactions/:emoji/@me   Reaktion hinzufugen
DELETE /api/v1/channels/:id/messages/:mid/reactions/:emoji/@me   Reaktion entfernen
```

### Voice/Video
```
POST   /api/v1/channels/:id/voice/join    Sprachkanal beitreten
POST   /api/v1/channels/:id/voice/leave   Sprachkanal verlassen
GET    /api/v1/channels/:id/voice/users   Teilnehmer im Sprachkanal
PATCH  /api/v1/voice/state                Stummschalten/Taubschalten
```

### Kanban-Boards
```
GET    /api/v1/channels/:id/boards    Boards eines Kanals
POST   /api/v1/channels/:id/boards    Board erstellen
GET    /api/v1/boards/:id             Board mit allen Aufgaben
POST   /api/v1/boards/:id/buckets     Spalte erstellen
POST   /api/v1/boards/:id/tasks       Aufgabe erstellen
PATCH  /api/v1/tasks/:id              Aufgabe bearbeiten
POST   /api/v1/tasks/:id/move         Aufgabe verschieben
DELETE /api/v1/tasks/:id              Aufgabe loschen
```

### Wiki
```
GET    /api/v1/guilds/:id/wiki        Alle Wiki-Seiten
POST   /api/v1/guilds/:id/wiki        Wiki-Seite erstellen
GET    /api/v1/wiki/:id               Seite lesen
PATCH  /api/v1/wiki/:id               Seite bearbeiten
DELETE /api/v1/wiki/:id               Seite loschen
GET    /api/v1/wiki/:id/revisions     Versionshistorie
```

### Umfragen
```
GET    /api/v1/polls/:id                          Umfrage anzeigen
PUT    /api/v1/polls/:id/options/:oid/vote        Abstimmen
DELETE /api/v1/polls/:id/options/:oid/vote        Stimme zurueckziehen
```

### Suche
```
GET    /api/v1/guilds/:id/messages/search?content=suchbegriff
```

### Einladungen
```
POST   /api/v1/channels/:id/invites              Einladung erstellen
POST   /api/v1/invites/:code/accept               Einladung annehmen
```

### WebSocket (Echtzeit)
```
GET    /ws                            WebSocket-Verbindung
```

---

## Echtzeit-Kommunikation (WebSocket)

Die Echtzeit-Verbindung funktioniert so:

```
1. Client verbindet sich:  ws://localhost:8080/ws

2. Server sendet HELLO:    { "op": 10, "d": { "heartbeat_interval": 41250 } }
                           (= "Schick mir alle 41 Sekunden ein Lebenszeichen")

3. Client sendet IDENTIFY: { "op": 2, "d": { "token": "dein-login-token" } }
                           (= "Ich bin eingeloggt, hier ist mein Token")

4. Server sendet READY:    { "op": 0, "t": "READY", "d": { "user": {...}, "guilds": [...] } }
                           (= "Willkommen! Hier sind deine Daten")

5. Ab jetzt: Echtzeit-Events
   - Neue Nachricht:     { "op": 0, "t": "MESSAGE_CREATE", "d": {...} }
   - Nachricht geloscht: { "op": 0, "t": "MESSAGE_DELETE", "d": {...} }
   - Jemand tippt:       { "op": 0, "t": "TYPING_START",   "d": {...} }
   - Status andert sich: { "op": 0, "t": "PRESENCE_UPDATE", "d": {...} }
   - Voice beigetreten:  { "op": 0, "t": "VOICE_STATE_UPDATE", "d": {...} }
```

### WebSocket Opcodes

| Code | Name | Richtung | Bedeutung |
|------|------|----------|-----------|
| 0 | Dispatch | Server an Client | Ein Ereignis ist passiert (Nachricht, Status...) |
| 1 | Heartbeat | Beide Richtungen | "Ich bin noch da" (Lebenszeichen) |
| 2 | Identify | Client an Server | "Hier ist mein Login-Token" |
| 3 | Presence Update | Client an Server | "Ich bin jetzt abwesend/nicht storen" |
| 4 | Voice State | Client an Server | "Ich trete einem Sprachkanal bei/verlasse ihn" |
| 6 | Resume | Client an Server | "Ich war kurz offline, bitte verpasste Events nachholen" |
| 7 | Reconnect | Server an Client | "Bitte verbinde dich neu" |
| 9 | Invalid Session | Server an Client | "Dein Token ist ungultig, bitte neu anmelden" |
| 10 | Hello | Server an Client | "Willkommen, hier ist das Heartbeat-Intervall" |
| 11 | Heartbeat ACK | Server an Client | "Lebenszeichen empfangen" |

---

## Rollen und Berechtigungen

Valhalla hat ein machtigtes Berechtigungssystem mit 53 einzelnen Rechten.

### Wie es funktioniert

```
Jeder Server hat Rollen.
Jede Rolle hat Berechtigungen (ein-/ausgeschaltet).
Jedes Mitglied hat eine oder mehrere Rollen.

Zusatzlich: Pro Kanal konnen Berechtigungen uberschrieben werden.
```

### Die drei Ebenen

```
Ebene 1: Server-Berechtigungen
    Jede Rolle hat ein Set von Berechtigungen.
    Ein Mitglied bekommt die SUMME aller seiner Rollen.

Ebene 2: Kanal-Uberschreibungen
    Pro Kanal kann man fur jede Rolle oder jeden Benutzer
    einzelne Berechtigungen erlauben oder verweigern.

Ebene 3: Sonderregeln
    - Server-Besitzer hat IMMER alle Rechte
    - "Administrator"-Recht umgeht ALLE Kanal-Uberschreibungen
    - Mitglieder im Timeout konnen nur lesen, nicht schreiben
```

### Berechtigungs-Berechnung (Schritt fur Schritt)

```
1. Ist der Benutzer Server-Besitzer?
   JA --> Alle Rechte (fertig)

2. Starte mit @everyone-Berechtigungen
3. Addiere Berechtigungen aller Rollen des Benutzers

4. Hat das Ergebnis "Administrator"?
   JA --> Alle Rechte (fertig)

5. Fur einen bestimmten Kanal:
   a) Wende @everyone Kanal-Uberschreibung an (erst verweigern, dann erlauben)
   b) Sammle alle Rollen-Uberschreibungen (erst verweigern, dann erlauben)
   c) Wende Benutzer-Uberschreibung an (erst verweigern, dann erlauben)

6. Implizite Regeln:
   - Ohne "Kanal sehen" --> gar keine Rechte im Kanal
   - Ohne "Nachrichten senden" --> auch keine Dateien, Erwohnungen etc.
   - Ohne "Verbinden" --> keine Sprach-Rechte
```

### Ubersicht der wichtigsten Berechtigungen

| Berechtigung | Was es erlaubt | Typisch fur |
|-------------|---------------|-------------|
| **Administrator** | Alles -- umgeht alle Einschrankungen | Server-Admins |
| **Server verwalten** | Name, Icon, Einstellungen andern | Admins |
| **Kanale verwalten** | Kanale erstellen, bearbeiten, loschen | Admins, Moderatoren |
| **Rollen verwalten** | Rollen erstellen und Rechte vergeben | Admins |
| **Mitglieder kicken** | Mitglieder vom Server entfernen | Moderatoren |
| **Mitglieder bannen** | Mitglieder dauerhaft sperren | Moderatoren |
| **Timeout setzen** | Mitglieder temporar stummschalten | Moderatoren |
| **Kanal sehen** | Kanal in der Liste sehen und lesen | Alle |
| **Nachrichten senden** | Textnachrichten schreiben | Alle |
| **Dateien anhangen** | Bilder und Dateien hochladen | Alle |
| **Reaktionen hinzufugen** | Emoji-Reaktionen auf Nachrichten | Alle |
| **Nachrichtenverlauf lesen** | Altere Nachrichten scrollen | Alle |
| **Erwahnen (@everyone)** | Alle Mitglieder benachrichtigen | Moderatoren |
| **Nachrichten verwalten** | Fremde Nachrichten loschen/pinnen | Moderatoren |
| **Threads verwalten** | Threads loschen und archivieren | Moderatoren |
| **Verbinden** | Sprachkanal beitreten | Alle |
| **Sprechen** | Im Sprachkanal reden | Alle |
| **Stummschalten** | Andere Mitglieder im Sprachkanal muten | Moderatoren |
| **Streamen** | Bildschirm/Kamera teilen | Alle |
| **Kanban verwalten** | Boards erstellen und bearbeiten | Team-Leads |
| **Wiki verwalten** | Wiki-Seiten erstellen und bearbeiten | Dokumentations-Team |

### Rollen-Hierarchie

```
Position 5:  Besitzer (hat immer alle Rechte)
Position 4:  Admin-Rolle
Position 3:  Moderator-Rolle
Position 2:  VIP-Rolle
Position 1:  Bot-Rolle
Position 0:  @everyone (jedes Mitglied)

Regel: Du kannst nur Mitglieder mit NIEDRIGERER Rolle kicken/bannen/bearbeiten.
       Ein Moderator kann keinen Admin kicken.
```

---

## Typische Workflows

### 1. Server erstellen und Freunde einladen

```
Du                                     Valhalla
 |                                        |
 |-- Klicke "+" in der Server-Liste ----->|
 |                                        |-- Erstellt Server mit Standard-Kanalen:
 |                                        |   #general (Text)
 |                                        |   General (Voice)
 |                                        |   + Kategorien
 |<-- Server erscheint in deiner Liste ---|
 |                                        |
 |-- Rechtsklick auf Kanal -> Einladen -->|
 |                                        |-- Erstellt Einladungslink
 |<-- Link kopiert (z.B. /invite/a1b2c3) -|
 |                                        |
 |   Link an Freunde schicken             |
 |                                        |
 Freund:                                  |
 |-- Klickt auf Einladungslink ---------->|
 |                                        |-- Pruft: gultig? Nicht gebannt?
 |                                        |-- Fugt als Mitglied hinzu
 |<-- Freund ist jetzt im Server ---------|
```

### 2. Nachricht senden (was intern passiert)

```
Du tippst "Hallo!"
 |
 |-- POST /channels/123/messages { content: "Hallo!" }
 |
 v
API-Server:
 1. Prufe: Bist du eingeloggt? (Token prufen)
 2. Prufe: Bist du Mitglied dieses Servers?
 3. Prufe: Hast du "Nachrichten senden" in diesem Kanal?
 4. Speichere Nachricht in der Datenbank
 5. Sende Event uber WebSocket an alle die den Kanal offen haben
 |
 v
Alle Clients in diesem Kanal:
 -- WebSocket Event: MESSAGE_CREATE { "content": "Hallo!", "author": "Du" }
 -- Nachricht erscheint sofort im Chat
```

### 3. Sprachkanal beitreten

```
Du klickst auf einen Voice-Kanal
 |
 |-- POST /channels/456/voice/join
 |
 v
API-Server:
 1. Prufe Berechtigung "Verbinden"
 2. Erstelle Raum auf LiveKit-Server
 3. Generiere Zugangs-Token fur dich
 |
 |<-- { token: "xxx", endpoint: "ws://livekit:7880" }
 |
 v
Dein Browser:
 1. Verbindet sich direkt mit LiveKit uber WebRTC
 2. Audio-Stream wird gestartet
 3. Du horst die anderen, die anderen horen dich
 |
 v
Alle anderen Mitglieder:
 -- WebSocket Event: VOICE_STATE_UPDATE
 -- Sehen dass du jetzt im Sprachkanal bist
```

---

## Datenbank-Schema (vereinfacht)

```
Benutzer (users)
  |-- hat viele --> Sitzungen (sessions)
  |-- hat viele --> Beziehungen (relationships / Freunde)
  |-- ist Mitglied in --> Server (guilds) [uber: members]
  |-- hat Rollen in --> Server [uber: member_roles]

Server (guilds)
  |-- hat einen --> Besitzer (owner)
  |-- hat viele --> Rollen (roles)
  |-- hat viele --> Kanale (channels)
  |-- hat viele --> Einladungen (invites)
  |-- hat viele --> Bans
  |-- hat viele --> Wiki-Seiten (wiki_pages)
  |-- hat viele --> Kanban-Boards (in Kanalen)

Kanale (channels)
  |-- gehort zu --> Server
  |-- hat optional --> Kategorie (parent_id)
  |-- hat viele --> Nachrichten (messages)
  |-- hat viele --> Berechtigungs-Uberschreibungen (channel_overwrites)
  |-- hat viele --> Threads

Nachrichten (messages)
  |-- hat einen --> Autor
  |-- hat optional --> Antwort-Referenz
  |-- hat viele --> Reaktionen (reactions)
  |-- hat viele --> Anhange (attachments)
  |-- hat optional --> Umfrage (poll)
```

**Insgesamt 39 Tabellen** verteilt auf 3 Migrationen.

---

## Fehlersuche (Troubleshooting)

### Container startet nicht

```bash
# Logs des problematischen Containers anschauen
docker compose logs api
docker compose logs postgres

# Haufigste Ursache: Ports bereits belegt
# Losung: In .env andere Ports setzen
WEB_PORT=3000
API_PORT=9080
```

### "Datenbank-Verbindung fehlgeschlagen"

```bash
# Ist PostgreSQL gesund?
docker compose ps postgres
# Sollte "healthy" zeigen

# Falls nicht: Neustart
docker compose restart postgres
# 10 Sekunden warten, dann:
docker compose restart api
```

### "Seite ladt nicht" / Weisser Bildschirm

```bash
# Web-Container lauft?
docker compose ps web

# Neu bauen
docker compose build web
docker compose up -d web
```

### Alles zurucksetzen (Neustart von Null)

```bash
docker compose down -v    # Stoppt alles, loscht alle Daten
docker compose up -d      # Startet frisch
```

---

## Fur Fortgeschrittene: Produktion / eigene Domain

### Mit eigener Domain und HTTPS

1. Passe die `deployments/Caddyfile` an:
```
meine-domain.de {
    reverse_proxy /api/* api:8080
    reverse_proxy /ws api:8080
    root * /srv/web
    try_files {path} /index.html
    file_server
}
```

2. Nutze `deployments/docker-compose.prod.yml` statt `docker-compose.yml`
3. Caddy holt automatisch ein Let's-Encrypt-Zertifikat

### Backup

```bash
# Datenbank sichern
docker compose exec postgres pg_dump -U valhalla valhalla > backup.sql

# Datenbank wiederherstellen
cat backup.sql | docker compose exec -T postgres psql -U valhalla valhalla
```

### Resourcen-Empfehlung

| Nutzeranzahl | RAM | CPU | Speicher |
|-------------|-----|-----|----------|
| 1-50 | 2 GB | 2 Kerne | 20 GB |
| 50-500 | 4 GB | 4 Kerne | 50 GB |
| 500-5000 | 8 GB | 8 Kerne | 100 GB |

---

## Lizenz

**AGPL-3.0 mit Commons Clause**

- **Nicht-kommerziell:** Frei nutzbar, modifizierbar, selbst-hostbar
- **Kommerziell:** Erfordert eine separate Lizenz -- Kontakt: schmiddy83@gmail.com
- **Beitrage:** Willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md)

Siehe [LICENSE](LICENSE) fur Details.

---

## Autor

**Christian Schmitt** -- schmiddy83@gmail.com

---

## Danksagung

Dieses Projekt steht auf den Schultern von Giganten:

- [Go](https://go.dev), [React](https://react.dev), [LiveKit](https://livekit.io), [PostgreSQL](https://postgresql.org), [Tauri](https://tauri.app), [Meilisearch](https://meilisearch.com), [NATS](https://nats.io), [Redis](https://redis.io), [Nginx](https://nginx.org), [MinIO](https://min.io), [Docker](https://docker.com)

Und unzahlige weitere Open-Source-Projekte die moderne Softwareentwicklung erst moglich machen.

**Danke, Open-Source-Community.**
