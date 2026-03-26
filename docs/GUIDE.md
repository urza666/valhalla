# Valhalla -- Komplette Dokumentation

Diese Dokumentation erklaert alles was du uber Valhalla wissen musst: wie es aufgebaut ist, wie die Berechtigungen funktionieren, wie die einzelnen Funktionen zusammenspielen und wie du die API nutzen kannst.

---

## Inhaltsverzeichnis

1. [Was ist Valhalla?](#1-was-ist-valhalla)
2. [Architektur-Ubersicht](#2-architektur-ubersicht)
3. [Benutzerflache (UI)](#3-benutzeroberflache)
4. [Rollen und Berechtigungen (RBAC)](#4-rollen-und-berechtigungen)
5. [Workflows -- Wie Dinge funktionieren](#5-workflows)
6. [API-Referenz](#6-api-referenz)
7. [WebSocket-Protokoll](#7-websocket-protokoll)
8. [Datenbank-Modell](#8-datenbank-modell)
9. [Voice und Video](#9-voice-und-video)
10. [Business-Features](#10-business-features)
11. [Selbst hosten](#11-selbst-hosten)
12. [Glossar](#12-glossar)

---

## 1. Was ist Valhalla?

Valhalla ist eine Kommunikationsplattform -- ahnlich wie Discord, aber selbst-hostbar und mit zusatzlichen Business-Features.

### Kernkonzepte

| Konzept | Erklarung | Vergleich |
|---------|-----------|-----------|
| **Server (Guild)** | Ein eigener Bereich fur deine Gruppe. Hat Kanale, Rollen, Mitglieder. | Wie ein Discord-Server |
| **Kanal (Channel)** | Ein Ort fur Gesprache. Kann Text, Voice oder Video sein. | Wie ein Chat-Raum |
| **Kategorie** | Eine Uberschrift die Kanale gruppiert (z.B. "Allgemein", "Projekte") | Wie ein Ordner fur Kanale |
| **Rolle** | Ein Satz von Berechtigungen der Mitgliedern zugewiesen wird | Wie eine Gruppe mit Rechten |
| **Mitglied** | Ein Benutzer der einem Server beigetreten ist | -- |
| **Nachricht** | Ein Text, Bild oder Datei in einem Kanal | -- |
| **Thread** | Eine Unter-Diskussion die von einer Nachricht abzweigt | Wie ein Sub-Thema |
| **Direktnachricht (DM)** | Private Nachricht zwischen zwei Personen | Wie WhatsApp 1:1 |

### Was Valhalla besonders macht

Gegenuber Discord bietet Valhalla:
- **Kanban-Boards**: Aufgabenverwaltung direkt im Kanal
- **Wiki**: Dokumentation mit Versionsverlauf
- **Umfragen**: Nativ, ohne Bots
- **SSO**: Firmenkonto-Anmeldung (SAML/OIDC)
- **Compliance**: Aufbewahrungsfristen, juristische Aufbewahrungspflicht
- **Selbst-Hosting**: Deine Daten auf deinem Server

---

## 2. Architektur-Ubersicht

### Fur Nicht-Techniker

Stell dir Valhalla wie ein Restaurant vor:

- **Nginx (web)** = Der Empfang. Leitet Gaste (Browser) an den richtigen Tisch.
- **Go API (api)** = Die Kuche. Hier wird alles verarbeitet.
- **PostgreSQL** = Das Rezeptbuch. Speichert alle Daten dauerhaft.
- **Redis** = Die Notizzettel. Merkt sich kurzfristige Dinge (wer ist online, wer tippt gerade).
- **NATS** = Der Kellner. Tragt Informationen zwischen den Stationen hin und her.
- **LiveKit** = Das Telefon. Ermoglicht Gesprache in Echtzeit.
- **MinIO** = Der Aktenschrank. Speichert hochgeladene Dateien.
- **Meilisearch** = Das Inhaltsverzeichnis. Ermoglicht schnelles Suchen.

### Fur Techniker

```
Browser/App
    |
    | HTTP/WebSocket
    v
+-- Nginx (Port 80) --+
|                      |
| /api/*, /ws -> api   |  Reverse Proxy + Static Files
| /*        -> SPA     |
+-----------+----------+
            |
            v
+-- Go API (Port 8080) -+
|                        |
| REST API               |  57 Endpoints
| WebSocket Gateway      |  Echtzeit-Events
| Auth Middleware         |  Token-Validierung
| Permission Engine      |  53-Bit Berechtigungsprufung
|                        |
+---+---+---+---+---+---+
    |   |   |   |   |
    v   v   v   v   v
  PG  Redis NATS LK  MinIO  Meili
```

### Datenfluss einer Nachricht

```
1. Du tippst "Hallo" und druckst Enter

2. Browser sendet:
   POST /api/v1/channels/123/messages
   { "content": "Hallo" }

3. API-Server:
   a) Token prufen --> Benutzer identifiziert
   b) Mitgliedschaft prufen --> Ist Mitglied des Servers
   c) Berechtigung prufen --> Hat "Nachrichten senden" in Kanal 123
   d) Nachricht in PostgreSQL speichern (Snowflake-ID generieren)
   e) Nachricht an Meilisearch-Index senden (fur Suche)
   f) Event auf NATS publizieren

4. WebSocket Gateway:
   a) Event von NATS empfangen
   b) Alle verbundenen Clients finden die Kanal 123 abonniert haben
   c) Event an jeden Client senden: MESSAGE_CREATE

5. Alle Browsers die den Kanal offen haben:
   - Empfangen das Event uber WebSocket
   - Nachricht erscheint sofort im Chat (ohne Seite neu zu laden)

Gesamtdauer: < 100 Millisekunden
```

---

## 3. Benutzeroberflache

### Das 3-Panel-Layout

Valhalla hat das gleiche Layout wie Discord:

```
+-------+-------------+---------------------------+-----------+
|       |             |                           |           |
| Server| Kanal-      |    Chat-Bereich           | Mitglieder|
| Liste | Seitenleiste|    (Nachrichten)          | Liste     |
|       |             |                           |           |
| [S1]  | # allgemein | Max: Hallo!               | -- Online |
| [S2]  | # projekte  | Lisa: Hi Max!             | Max       |
| [S3]  | # hilfe     |                           | Lisa      |
| [+]   |             | [Nachricht eingeben...  ] | -- Offline|
|       | 🔊 Voice    |                           | Tom       |
|       | [Du] Online |                           |           |
+-------+-------------+---------------------------+-----------+
  72px      240px            flexibel                 240px
```

### Die Bereiche im Detail

**Server-Liste (ganz links)**
- Runde Icons fur jeden Server
- "+" Button zum Erstellen eines neuen Servers
- Rote Punkte zeigen ungelesene Nachrichten

**Kanal-Seitenleiste**
- Server-Name oben
- Kategorien mit aufklappbaren Kanalen
- `#` = Textkanal, `🔊` = Sprachkanal
- Unten: Dein Benutzername + Online-Status + Stummschalten

**Chat-Bereich (Mitte)**
- Kanal-Name und Thema oben
- Nachrichten mit Avataren, Namen und Zeitstempel
- Eingabefeld unten
- Schreibanzeige ("Max tippt gerade...")

**Mitglieder-Liste (rechts)**
- Gruppiert nach Online/Offline
- Zeigt Rollen-Farben
- Klick offnet Profil-Karte

### Wichtige Bildschirme

| Bildschirm | Zweck |
|-----------|-------|
| Login/Registrierung | Konto erstellen oder anmelden |
| Server erstellen | Name eingeben, Server wird mit Standard-Kanalen erstellt |
| Server beitreten | Einladungslink eingeben |
| Kanal-Chat | Nachrichten lesen und schreiben |
| Sprachkanal | Beitreten, Stummschalten, Verlassen |
| Einstellungen | Profil, Benachrichtigungen, Sicherheit |
| Server-Einstellungen | Kanale, Rollen, Mitglieder verwalten |

---

## 4. Rollen und Berechtigungen

### Grundidee

Jeder Server hat **Rollen**. Rollen bestimmen was ein Mitglied tun darf.

Beispiel:
```
Server "Mein Team"
  |
  +-- Rolle "Admin" (Position 3)
  |     Kann: Alles
  |
  +-- Rolle "Moderator" (Position 2)
  |     Kann: Nachrichten loschen, Mitglieder kicken
  |
  +-- Rolle "Mitglied" (Position 1)
  |     Kann: Nachrichten senden, Dateien hochladen
  |
  +-- Rolle "@everyone" (Position 0)
        Kann: Kanale sehen, Nachrichten lesen
        (Jeder hat diese Rolle automatisch)
```

### Die drei Regeln

1. **Besitzer hat immer alle Rechte** -- egal welche Rollen er hat
2. **"Administrator" umgeht alles** -- wenn eine Rolle "Administrator" hat, gelten keine Einschrankungen
3. **Hohere Rolle = mehr Macht** -- du kannst nur Mitglieder verwalten die eine niedrigere Rolle haben als du

### Kanal-Uberschreibungen

Du kannst Berechtigungen pro Kanal anpassen:

```
Server-Berechtigung:  @everyone kann "Nachrichten senden" ✓

Kanal #ankündigungen:
  @everyone: "Nachrichten senden" = VERWEIGERT  ✗
  Moderator: "Nachrichten senden" = ERLAUBT     ✓

Ergebnis:
  - Normale Mitglieder konnen in #ankündigungen NICHT schreiben
  - Moderatoren KONNEN in #ankündigungen schreiben
```

Jede Uberschreibung hat drei Zustande:
- **Erlaubt** (gruner Haken) -- Recht wird explizit gegeben
- **Verweigert** (rotes X) -- Recht wird explizit entzogen
- **Neutral** (grau) -- Erbt von der Server-Ebene

### Berechtigungs-Gruppen

**Server-Verwaltung:**
| Recht | Beschreibung |
|-------|-------------|
| Administrator | Alle Rechte, umgeht Kanal-Einschrankungen |
| Server verwalten | Name, Bild, Einstellungen andern |
| Kanale verwalten | Kanale erstellen, bearbeiten, loschen |
| Rollen verwalten | Rollen erstellen, Rechte vergeben |
| Audit-Log einsehen | Alle Admin-Aktionen nachverfolgen |

**Moderation:**
| Recht | Beschreibung |
|-------|-------------|
| Mitglieder kicken | Vom Server entfernen (kann wieder beitreten) |
| Mitglieder bannen | Permanent sperren |
| Timeout setzen | Temporar stummschalten |
| Nachrichten verwalten | Fremde Nachrichten loschen, Nachrichten anpinnen |
| @everyone erwahnen | Alle Mitglieder benachrichtigen |

**Kommunikation (Text):**
| Recht | Beschreibung |
|-------|-------------|
| Kanal sehen | Kanal in der Liste sehen und lesen |
| Nachrichten senden | Textnachrichten schreiben |
| Dateien anhangen | Bilder und Dateien hochladen |
| Links einbetten | Gesendete Links zeigen Vorschau |
| Reaktionen hinzufugen | Emoji-Reaktionen auf Nachrichten |
| Nachrichtenverlauf lesen | Altere Nachrichten durchscrollen |
| Threads erstellen | Unter-Diskussionen starten |

**Kommunikation (Voice):**
| Recht | Beschreibung |
|-------|-------------|
| Verbinden | Sprachkanal beitreten |
| Sprechen | Im Sprachkanal reden |
| Streamen | Kamera oder Bildschirm teilen |
| Mitglieder stummschalten | Andere Mitglieder muten |
| Mitglieder verschieben | Andere in anderen Sprachkanal ziehen |

**Business (Valhalla-exklusiv):**
| Recht | Beschreibung |
|-------|-------------|
| Kanban verwalten | Boards und Aufgaben erstellen |
| Wiki verwalten | Wiki-Seiten erstellen und bearbeiten |
| Kalender verwalten | Events erstellen |
| Analytics einsehen | Server-Statistiken sehen |

---

## 5. Workflows

### Konto erstellen

```
1. Offne http://localhost im Browser
2. Klicke "Register"
3. Gib ein: Benutzername, E-Mail, Passwort (min. 8 Zeichen)
4. Klicke "Register"
5. Du bist eingeloggt und siehst die leere Server-Liste
```

Was im Hintergrund passiert:
- Passwort wird mit Argon2id gehasht (modernster Algorithmus)
- Ein Opaque Token wird generiert (zufalliger 64-Zeichen-String)
- Token wird in Redis gespeichert und an dich gesendet
- Der Browser speichert den Token im LocalStorage

### Server erstellen

```
1. Klicke "+" in der Server-Liste
2. Gib einen Namen ein (z.B. "Mein Team")
3. Klicke "Create"
```

Was passiert:
- Server wird erstellt mit einer einzigartigen Snowflake-ID
- @everyone-Rolle wird automatisch erstellt mit Standard-Rechten
- Standard-Kanale werden erstellt:
  - Kategorie "Text Channels" mit Kanal #general
  - Kategorie "Voice Channels" mit Kanal "General"
- Du wirst als Besitzer und erstes Mitglied hinzugefugt

### Jemanden einladen

```
1. Rechtsklick auf einen Kanal -> "Einladung erstellen"
   Oder: POST /api/v1/channels/:id/invites
2. Du bekommst einen Code (z.B. "a1b2c3d4e5")
3. Teile den Link: http://localhost/invite/a1b2c3d4e5
4. Der Eingeladene klickt den Link und tritt bei
```

### Nachricht mit Formatierung senden

Valhalla unterstutzt Markdown:

```
**fett**                     --> fett
*kursiv*                     --> kursiv
~~durchgestrichen~~          --> durchgestrichen
`inline code`                --> inline code
> Zitat                      --> eingerucktes Zitat
||Spoiler||                  --> versteckter Text (Klick zum aufdecken)
@benutzername                --> Erwahnung (wird hervorgehoben)
https://example.com          --> klickbarer Link mit Vorschau
```

Code-Blocke:
````
```javascript
function hello() {
  console.log("Hallo Welt!");
}
```
````

### Sprachkanal nutzen

```
1. Klicke auf einen Voice-Kanal (🔊) in der Seitenleiste
2. Dein Browser fragt nach Mikrofon-Zugriff -> "Erlauben"
3. Du bist verbunden und kannst sprechen
4. Steuerung unten links:
   🎙️ = Stummschalten
   🔊 = Taubschalten (du horst nichts)
   📞 = Verbindung trennen
5. Andere sehen deinen Namen unter dem Voice-Kanal
```

### Kanban-Board nutzen

```
1. In einem Textkanal: Klicke "Boards"
2. Erstelle ein Board (z.B. "Sprint 1")
3. Drei Standard-Spalten werden erstellt:
   [To Do] [In Progress] [Done]
4. Klicke "+" um eine Aufgabe zu erstellen
5. Ziehe Aufgaben per Drag-and-Drop zwischen Spalten
6. Klicke auf eine Aufgabe fur Details (Beschreibung, Zustandig, Frist)
```

### Wiki nutzen

```
1. Gehe zu Server-Einstellungen -> Wiki
2. Klicke "Neue Seite"
3. Gib Titel und Inhalt ein (Markdown)
4. Klicke "Speichern"
5. Jede Bearbeitung wird als Revision gespeichert
6. Du kannst altere Versionen jederzeit einsehen
```

---

## 6. API-Referenz

### Authentifizierung

Jeder API-Aufruf (ausser Login/Register) braucht einen Token im Header:

```
Authorization: Bearer dein-token-hier
```

### Antwort-Format

Erfolg:
```json
{
  "id": "123456789",
  "name": "Mein Server",
  "owner_id": "987654321"
}
```

Fehler:
```json
{
  "code": 50013,
  "message": "Missing Permissions"
}
```

### Fehler-Codes

| HTTP Status | Code | Bedeutung |
|------------|------|-----------|
| 400 | 50035 | Ungultiger Request-Body |
| 401 | 40001 | Nicht eingeloggt / Token ungultig |
| 403 | 50013 | Keine Berechtigung |
| 404 | 10003 | Ressource nicht gefunden |
| 409 | 40002 | Bereits vorhanden (z.B. E-Mail schon registriert) |
| 429 | 40029 | Zu viele Anfragen (Rate Limit) |

### Rate Limiting

- **Global:** Maximal 50 Anfragen pro Sekunde pro Benutzer
- **Pro Route:** Variiert (z.B. Nachrichten senden: 5 pro 5 Sekunden)
- Bei Uberschreitung: HTTP 429 mit `Retry-After` Header

### Paginierung

Nachrichten werden seitenweise geladen:

```
GET /api/v1/channels/123/messages?limit=50
GET /api/v1/channels/123/messages?before=456&limit=50   (altere Nachrichten)
GET /api/v1/channels/123/messages?after=789&limit=50    (neuere Nachrichten)
```

### IDs (Snowflakes)

Alle IDs in Valhalla sind **Snowflake-IDs**:
- 64-Bit Ganzzahlen (als String im JSON)
- Zeitlich sortierbar (grossere ID = spater erstellt)
- Enthalten den Erstellungszeitpunkt
- Beispiel: `"172839456789012345"`

---

## 7. WebSocket-Protokoll

### Verbindung herstellen

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  // Warte auf HELLO vom Server
};

ws.onmessage = (event) => {
  const payload = JSON.parse(event.data);

  if (payload.op === 10) {
    // HELLO erhalten -- starte Heartbeat und sende IDENTIFY
    const interval = payload.d.heartbeat_interval;

    setInterval(() => {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }, interval);

    ws.send(JSON.stringify({
      op: 2,
      d: { token: "dein-login-token" }
    }));
  }

  if (payload.op === 0) {
    // Dispatch-Event
    console.log('Event:', payload.t, payload.d);
    // z.B. payload.t = "MESSAGE_CREATE"
    //      payload.d = { id: "123", content: "Hallo!", author: {...} }
  }
};
```

### Echtzeit-Events die du empfangst

| Event | Wann | Daten |
|-------|------|-------|
| `READY` | Nach dem Einloggen | Dein Profil, deine Server |
| `MESSAGE_CREATE` | Jemand sendet eine Nachricht | Nachricht mit Autor |
| `MESSAGE_UPDATE` | Nachricht wurde bearbeitet | Aktualisierte Nachricht |
| `MESSAGE_DELETE` | Nachricht wurde geloscht | Nachrichten-ID |
| `TYPING_START` | Jemand tippt | Kanal-ID, Benutzer-ID |
| `PRESENCE_UPDATE` | Jemand geht online/offline | Benutzer-ID, neuer Status |
| `VOICE_STATE_UPDATE` | Jemand tritt Voice bei/verlasst | Benutzer, Kanal, Mute-Status |
| `GUILD_CREATE` | Du trittst einem Server bei | Komplette Server-Daten |
| `GUILD_MEMBER_ADD` | Neues Mitglied | Mitglieds-Daten |
| `CHANNEL_CREATE` | Neuer Kanal erstellt | Kanal-Daten |
| `GUILD_ROLE_UPDATE` | Rolle geandert | Aktualisierte Rolle |

### Heartbeat (Lebenszeichen)

```
Alle 41,25 Sekunden:
  Client sendet:  { "op": 1, "d": null }
  Server antwortet: { "op": 11 }

Wenn der Server nicht antwortet:
  --> Verbindung ist tot, neu verbinden
```

---

## 8. Datenbank-Modell

### Die wichtigsten Tabellen

**users** -- Benutzerkonten
```
id            BIGINT     Snowflake-ID
username      VARCHAR    Eindeutiger Benutzername
email         VARCHAR    E-Mail-Adresse (verschlusselt)
password_hash VARCHAR    Argon2id-Hash des Passworts
avatar_hash   VARCHAR    Profilbild-Referenz
```

**guilds** -- Server
```
id            BIGINT     Snowflake-ID
name          VARCHAR    Server-Name
owner_id      BIGINT     Besitzer (Benutzer-ID)
icon_hash     VARCHAR    Server-Bild
```

**channels** -- Kanale
```
id            BIGINT     Snowflake-ID
guild_id      BIGINT     Zu welchem Server gehort der Kanal
type          SMALLINT   0=Text, 2=Voice, 4=Kategorie, 11=Thread, 15=Forum
name          VARCHAR    Kanal-Name
parent_id     BIGINT     Kategorie (oder null)
position      INT        Reihenfolge in der Seitenleiste
```

**messages** -- Nachrichten
```
id            BIGINT     Snowflake-ID (enthalt Zeitstempel)
channel_id    BIGINT     In welchem Kanal
author_id     BIGINT     Wer hat sie geschrieben
content       VARCHAR    Text der Nachricht (max. 4000 Zeichen)
type          SMALLINT   0=Normal, 19=Antwort
```

**roles** -- Rollen
```
id            BIGINT     Snowflake-ID
guild_id      BIGINT     Zu welchem Server
name          VARCHAR    Rollen-Name
position      INT        Rang (hoher = machtiger)
permissions   BIGINT     53-Bit Berechtigungs-Bitfeld
color         INT        Farbe (fur Anzeige im Chat)
```

**members** -- Server-Mitgliedschaften
```
user_id       BIGINT     Welcher Benutzer
guild_id      BIGINT     In welchem Server
nickname      VARCHAR    Spitzname (optional, nur in diesem Server)
joined_at     TIMESTAMP  Wann beigetreten
```

### Gesamtubersicht (39 Tabellen)

**Kern:** users, sessions, relationships, guilds, roles, members, member_roles, channels, channel_overwrites, messages, attachments, reactions, invites, bans, audit_log_entries, webhooks, read_states, pinned_messages, dm_participants

**Business:** kanban_boards, kanban_buckets, kanban_tasks, wiki_pages, wiki_revisions, polls, poll_options, poll_votes, applications, slash_commands

**Enterprise:** sso_providers, sso_user_links, retention_policies, legal_holds, audit_exports, platform_settings, platform_admins, usage_stats

---

## 9. Voice und Video

### Wie Sprache funktioniert

Valhalla nutzt **LiveKit** als Voice-Server. LiveKit ist ein Open-Source WebRTC SFU (Selective Forwarding Unit).

```
Dein Mikrofon
     |
     v
Dein Browser (WebRTC)
     |
     | UDP Audio-Stream (verschlusselt)
     v
+-- LiveKit Server --+
|                    |
| Empfangt deinen    |
| Audio-Stream und   |
| leitet ihn an alle |
| anderen weiter     |
|                    |
+----+----+----+-----+
     |    |    |
     v    v    v
  Lisa  Tom  Max
  (ihre Browser empfangen deinen Audio-Stream)
```

### Warum SFU und nicht direkt?

Bei 4 Personen im Sprachkanal:
- **Direkt (Peer-to-Peer):** Jeder sendet an jeden = 12 Verbindungen
- **SFU (LiveKit):** Jeder sendet 1x an Server, Server verteilt = 4+4 = 8 Verbindungen

Bei 20 Personen:
- Direkt: 380 Verbindungen (unmoglich)
- SFU: 40 Verbindungen (funktioniert gut)

### Video und Bildschirmfreigabe

Genau wie Audio, aber mit Video-Stream:
- **Kamera:** VP9 Codec, adaptive Qualitat je nach Bandbreite
- **Bildschirm:** Hohere Auflosung, niedrigere Bildrate
- **Simulcast:** Dein Browser sendet mehrere Qualitaten gleichzeitig, LiveKit wahlt die passende fur jeden Empfanger

---

## 10. Business-Features

### Kanban-Boards

Jeder Textkanal kann ein oder mehrere Kanban-Boards haben:

```
Board "Sprint 23"
+------------------+------------------+------------------+
|     To Do        |   In Progress    |      Done        |
+------------------+------------------+------------------+
| Login-Seite      | API-Endpunkte    | Datenbank-Schema |
| gestalten        | implementieren   | ✓                |
| [Prio: Hoch]     | [Zustandig: Max] |                  |
| [Frist: Fr]      |                  | Docker Setup     |
|                  | Voice-Integration| ✓                |
| Suche            | [Zustandig: Lisa]|                  |
| implementieren   |                  |                  |
+------------------+------------------+------------------+
```

Jede Aufgabe hat:
- Titel und Beschreibung
- Zustandige Person
- Prioritat (Dringend/Hoch/Mittel/Niedrig)
- Falligkeitsdatum
- Labels (frei wahlbar)
- Status (offen/erledigt)

### Wiki / Wissensdatenbank

Jeder Server hat eine Wiki:
- Seiten mit Markdown-Formatierung
- Hierarchische Struktur (Seiten konnen Unterseiten haben)
- Jede Anderung wird als Revision gespeichert
- Versionsvergleich moglich
- Kann an einzelne Kanale gebunden werden

### Umfragen

Direkt in Nachrichten eingebettet:
```
📊 Wann sollen wir das nachste Meeting machen?
   ☐ Montag 10:00     ████████░░  8 Stimmen
   ☐ Dienstag 14:00   ██████████  10 Stimmen
   ☐ Mittwoch 09:00   ████░░░░░░  4 Stimmen

   Mehrfachauswahl: Ja | Lauft ab in: 23 Stunden
```

### SSO (Single Sign-On)

Fur Unternehmen: Mitarbeiter melden sich mit ihrem Firmenkonto an.

Unterstutzt:
- **SAML 2.0** (Okta, Azure AD, ADFS)
- **OIDC** (Google Workspace, Auth0, Keycloak)

Konfiguration pro Server -- verschiedene Server konnen verschiedene Identity Provider nutzen.

### Compliance

- **Aufbewahrungsfristen:** Nachrichten automatisch nach X Tagen loschen
- **Legal Hold:** Bestimmte Nachrichten vor Loschung schutzen (z.B. bei laufendem Rechtsstreit)
- **Audit-Export:** Alle Nachrichten eines Zeitraums als Datei exportieren

---

## 11. Selbst hosten

### Minimale Anforderungen

| | Minimum | Empfohlen |
|---|---------|-----------|
| **RAM** | 2 GB | 4 GB |
| **CPU** | 2 Kerne | 4 Kerne |
| **Festplatte** | 20 GB | 50 GB+ |
| **Betriebssystem** | Linux, macOS, Windows (mit Docker) | Linux (Ubuntu 22.04+) |
| **Software** | Docker + Docker Compose | -- |

### Installation

```bash
git clone https://dgit01p.infra.ip413.de/bot_athene/valhalla.git
cd valhalla
./setup.sh
```

Fertig. Offne http://localhost im Browser.

### Mit eigener Domain und HTTPS

1. Bearbeite `deployments/Caddyfile`:
   ```
   meine-domain.de {
       reverse_proxy /api/* api:8080
       reverse_proxy /ws api:8080
       root * /srv/web
       try_files {path} /index.html
       file_server
   }
   ```

2. Starte mit der Produktions-Compose-Datei:
   ```bash
   docker compose -f deployments/docker-compose.prod.yml up -d
   ```

3. Caddy holt automatisch ein SSL-Zertifikat von Let's Encrypt.

### Backup und Wiederherstellung

```bash
# Backup erstellen
docker compose exec postgres pg_dump -U valhalla valhalla > backup_$(date +%Y%m%d).sql

# Backup wiederherstellen
cat backup_20260326.sql | docker compose exec -T postgres psql -U valhalla valhalla
```

### Updates

```bash
git pull                          # Neuesten Code holen
docker compose build              # Neu bauen
docker compose up -d              # Neu starten (Migrationen laufen automatisch)
```

---

## 12. Glossar

| Begriff | Erklarung |
|---------|-----------|
| **API** | Schnittstelle uber die Programme miteinander kommunizieren (hier: HTTP REST) |
| **Argon2id** | Moderner Algorithmus zum sicheren Speichern von Passwortern |
| **Channel** | Ein Kanal fur Gesprache (Text oder Voice) |
| **Docker** | Software die Anwendungen in isolierten "Containern" ausfuhrt |
| **Docker Compose** | Werkzeug um mehrere Docker-Container zusammen zu starten |
| **Gateway** | WebSocket-Verbindung fur Echtzeit-Events |
| **Guild** | Anderer Name fur "Server" -- eine Gemeinschaft mit Kanalen und Mitgliedern |
| **Heartbeat** | Regelmassiges Signal um zu prufen ob die Verbindung noch lebt |
| **JWT** | JSON Web Token -- ein verschlusselter Login-Nachweis |
| **LiveKit** | Open-Source Server fur Sprach- und Videokommunikation |
| **Markdown** | Einfache Textformatierung (**fett**, *kursiv*, `code`) |
| **Meilisearch** | Schnelle Open-Source Volltextsuchmaschine |
| **MinIO** | Selbst-hostbarer Dateispeicher (kompatibel mit Amazon S3) |
| **NATS** | Nachrichtenbus -- leitet Nachrichten zwischen Diensten weiter |
| **Nginx** | Webserver der als Reverse Proxy dient |
| **OAuth/OIDC** | Standard fur Login uber Drittanbieter (z.B. "Mit Google anmelden") |
| **Opaque Token** | Zufalliger String als Login-Nachweis (im Gegensatz zu JWT) |
| **PostgreSQL** | Relationale Datenbank -- speichert alle Daten dauerhaft |
| **RBAC** | Role-Based Access Control -- Berechtigungen uber Rollen steuern |
| **Redis** | Sehr schneller Zwischenspeicher (Cache) |
| **REST** | Architekturstil fur APIs (GET, POST, PATCH, DELETE) |
| **SAML** | Standard fur Enterprise Single Sign-On |
| **SFU** | Selective Forwarding Unit -- Server der Audio/Video-Streams weiterleitet |
| **Snowflake** | 64-Bit ID die den Erstellungszeitpunkt enthalt |
| **SSO** | Single Sign-On -- einmal anmelden, uberall eingeloggt |
| **Tauri** | Framework fur leichtgewichtige Desktop-Apps (Alternative zu Electron) |
| **WebRTC** | Webtechnologie fur Echtzeit-Audio/Video direkt im Browser |
| **WebSocket** | Persistente bidirektionale Verbindung zwischen Browser und Server |

---

*Erstellt von Christian Schmitt -- schmiddy83@gmail.com*
