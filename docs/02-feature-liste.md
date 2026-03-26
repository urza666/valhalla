# 2. Vollständige Feature-Liste

> **Legende Quellentyp:** [B] = Beobachtbar | [O] = Offiziell dokumentiert | [H] = Herleitung
> **Legende Priorität:** P1 = MVP-kritisch | P2 = Produktionsreife | P3 = Nice-to-have
> **Legende Komplexität:** K1 = Niedrig | K2 = Mittel | K3 = Hoch | K4 = Sehr hoch

---

## 2.1 Konto und Identität

### Registrierung & Login

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| E-Mail-Registrierung [B] | Konto mit E-Mail + Passwort erstellen | Grundzugang | K1 | P1 | P1 |
| E-Mail-Verifizierung [B] | Bestätigungsmail nach Registrierung | Anti-Spam, Trust | K1 | P1 | P1 |
| Login mit E-Mail/Passwort [B] | Standard-Authentifizierung | Grundzugang | K1 | P1 | P1 |
| Phone-Verifizierung [B] | SMS-basierte Verifizierung | Anti-Abuse, Vertrauensstufe | K2 | P3 | P2 |
| QR-Code Login [B] | Desktop/Web Login via Mobile-Scan | Convenience, Sicherheit | K2 | P3 | P2 |
| Captcha bei Login [B] | hCaptcha-Integration | Bot-Prevention | K1 | P2 | P1 |
| Passwort-Reset [B] | E-Mail-basierter Reset-Flow | Standard | K1 | P1 | P1 |
| Account Deactivation/Deletion [B] | DSGVO-konform Konto löschen | Compliance | K2 | P2 | P1 |

### Session Management

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Multi-Device Sessions [B] | Gleichzeitige Logins auf mehreren Geräten | Flexibilität | K2 | P1 | P1 |
| Session-Liste [B] | Anzeige aktiver Sessions in Einstellungen | Sicherheit | K1 | P2 | P1 |
| Remote Session Revoke [B] | Einzelne Sessions aus Ferne beenden | Sicherheit | K1 | P2 | P1 |
| Token-basierte Auth [O] | Bearer Token für API-Zugriff | Technisch nötig | K2 | P1 | P1 |
| Token Refresh [H] | Automatische Token-Erneuerung | Session-Persistenz | K2 | P1 | P1 |

### Multi-Faktor-Authentifizierung

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| TOTP (Authenticator App) [B] | 6-stelliger Code via Google Auth etc. | Kontosicherheit | K2 | P2 | P1 |
| SMS-basierte 2FA [B] | Code via SMS | Fallback-2FA | K2 | P3 | P2 |
| Backup Codes [B] | Einmal-Codes für Notfallzugang | Recovery | K1 | P2 | P1 |
| Security Keys (WebAuthn) [B] | Hardware-Keys (YubiKey etc.) | High-Security | K3 | P3 | P2 |

### Profilverwaltung

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Username (unique handle) [B] | Globaler @username (seit 2023: ohne Discriminator) | Identifikation | K1 | P1 | P1 |
| Display Name [B] | Angezeigter Name (pro Server überschreibbar) | Personalisierung | K1 | P1 | P1 |
| Avatar [B] | Profilbild-Upload mit Crop | Personalisierung | K2 | P1 | P1 |
| Banner [B] | Profilbanner (Nitro) | Monetarisierung | K1 | P3 | P3 |
| Bio/About Me [B] | Freitext-Profilbeschreibung | Personalisierung | K1 | P2 | P2 |
| Custom Status [B] | Frei wählbarer Status-Text + Emoji | Kommunikation | K1 | P2 | P2 |
| Pronomen-Feld [B] | Pronomen im Profil | Inklusivität | K1 | P3 | P2 |
| Server-spezifisches Profil [B] | Nickname + Avatar pro Server | Kontextuelle Identität | K2 | P2 | P2 |
| Verbundene Accounts [B] | Spotify, GitHub, Twitter etc. | Social Proof | K2 | P3 | P3 |

### Freundesliste & Beziehungen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Freundschaftsanfrage [B] | Request → Accept/Deny Flow | Soziale Verbindung | K1 | P1 | P1 |
| Freundesliste [B] | Übersicht mit Online-Status | Soziales Netzwerk | K1 | P1 | P1 |
| Blockieren [B] | Nutzer vollständig ausblenden | Safety | K2 | P1 | P1 |
| DM-Einschränkungen [B] | Nur Freunde / Server-Mitglieder können DMs senden | Privacy | K1 | P2 | P1 |
| Nutzer melden [B] | Abuse-Report an Trust & Safety | Moderation | K2 | P2 | P1 |

### Privacy-Einstellungen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| DM-Filter (Server-Mitglieder) [B] | Wer darf DMs senden | Spam-Schutz | K1 | P2 | P1 |
| Aktivitätsstatus ein/aus [B] | "Spielt gerade..." verbergen | Privacy | K1 | P2 | P2 |
| Server Discovery Opt-out [B] | Nicht in Mitglieder-Suche | Privacy | K1 | P3 | P2 |
| Daten-Export [B] | DSGVO-Datenpaket anfordern | Compliance | K2 | P3 | P1 |
| Explicit Content Filter [B] | Auto-Scan von Medien in DMs | Safety | K3 | P3 | P2 |

---

## 2.2 Soziale und Community-Funktionen

### Server/Guild-Konzept

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Server erstellen [B] | Neue Community mit Name/Icon anlegen | Kern-Feature | K1 | P1 | P1 |
| Server-Templates [B] | Vordefinierte Channel-Strukturen | Schnellstart | K2 | P3 | P2 |
| Server Icon/Banner/Splash [B] | Visuelle Anpassung | Branding | K1 | P2 | P2 |
| Server Discovery [B] | Öffentliche Server durchsuchen | Community Growth | K3 | P3 | P2 |
| Vanity URL [B] | discord.gg/customname | Branding | K1 | P3 | P2 |
| Server Kategorien [B] | Channel-Gruppierung in Ordner | Organisation | K1 | P1 | P1 |
| Server Boost System [B] | Mitglieder-Investition für Perks | Monetarisierung | K2 | P3 | P3 |
| Community-Modus [B] | Erweiterte Moderation-Features aktiviert | Large-Scale | K2 | P3 | P2 |

### Einladungssystem

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Einladungslinks generieren [B] | Unique Links mit Ablauf + Max. Uses | Wachstum | K1 | P1 | P1 |
| Permanente Einladungen [B] | Links ohne Ablauf | Convenience | K1 | P1 | P1 |
| Einladung mit Rolle [B] | Automatische Rollenvergabe beim Join | Onboarding | K2 | P3 | P2 |
| Invite Tracker [B] | Wer hat wen eingeladen | Analytics | K2 | P3 | P2 |

### Rollen & Berechtigungen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Rollen erstellen/bearbeiten [B] | Name, Farbe, Icon, Position | Organisation | K2 | P1 | P1 |
| Rollen-Hierarchie [B] | Höhere Rollen überschreiben niedrigere | Kontrollstruktur | K3 | P1 | P1 |
| ~40 granulare Permissions [O] | Einzelne Rechte wie SEND_MESSAGES, MANAGE_ROLES etc. | Feingranulare Kontrolle | K3 | P1 | P1 |
| Channel Permission Overrides [B] | Pro-Channel Rollen-/User-Overrides | Flexible Rechte | K4 | P1 | P1 |
| @everyone Rolle [B] | Standard-Rolle für alle Mitglieder | Basis-Rechte | K1 | P1 | P1 |
| Bot-Rollen [B] | Automatisch vergebene Rollen für Bots | Integration | K1 | P2 | P2 |
| Role Mentioning [B] | Rollen via @rolle erwähnen | Kommunikation | K1 | P2 | P1 |

### Moderation

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Kick [B] | Mitglied entfernen (kann wieder beitreten) | Moderation | K1 | P1 | P1 |
| Ban [B] | Mitglied permanent sperren + Nachrichten löschen | Moderation | K2 | P1 | P1 |
| Timeout [B] | Temporäre Stummschaltung | Sanfte Moderation | K2 | P2 | P1 |
| AutoMod [B] | Regelbasierte automatische Moderation | Skalierung | K3 | P3 | P1 |
| Slow Mode [B] | Rate Limit pro Channel | Spam-Schutz | K1 | P2 | P1 |
| Verification Levels [B] | E-Mail/Phone/Wartezeit-Stufen | Anti-Raid | K2 | P2 | P1 |
| Audit Log [B] | Protokoll aller Admin-Aktionen | Transparenz | K2 | P2 | P1 |

### Onboarding

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Welcome Screen [B] | Begrüßungsbildschirm mit Channel-Empfehlungen | Orientierung | K2 | P3 | P2 |
| Onboarding Customization [B] | Fragen → automatische Rollenvergabe | Personalisierung | K3 | P3 | P2 |
| Rules Screening [B] | Regelakzeptanz vor Zugang | Compliance | K1 | P2 | P1 |
| Membership Screening [B] | Formular vor Server-Beitritt | Qualitätskontrolle | K2 | P3 | P2 |

---

## 2.3 Messaging-Funktionen

### Direktnachrichten & Gruppen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| 1:1 Direktnachrichten [B] | Private Kommunikation zwischen zwei Nutzern | Kern-Feature | K2 | P1 | P1 |
| Gruppen-DMs [B] | Bis zu 10 Teilnehmer ohne Server | Kleine Gruppen | K2 | P1 | P1 |
| DM-Benachrichtigungen [B] | Push + Badge für neue DMs | Engagement | K2 | P1 | P1 |

### Channel-basierter Chat

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Text Channels [B] | Persistente Chat-Räume in Servern | Kern-Feature | K2 | P1 | P1 |
| Channel-Kategorien [B] | Gruppierung von Channels | Organisation | K1 | P1 | P1 |
| Channel-Beschreibung/Topic [B] | Zweck des Channels anzeigen | Orientierung | K1 | P1 | P1 |
| Announcement Channels [B] | Nachrichten können in andere Server "followed" werden | Cross-Server-Kommunikation | K3 | P3 | P2 |
| Forum Channels [B] | Thread-basierte Diskussionen mit Tags | Asynchrone Kommunikation | K3 | P3 | P2 |
| Stage Channels [B] | Audio-Event-Räume mit Sprecher/Zuhörer | Events | K3 | P3 | P2 |
| NSFW Channel Flag [B] | Altersverifizierung für Zugang | Content Safety | K1 | P2 | P1 |

### Nachrichten-Features

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Text senden [B] | Markdown-formatierte Textnachrichten | Kern-Feature | K1 | P1 | P1 |
| Nachricht bearbeiten [B] | Eigene Nachrichten nachträglich ändern | Korrektur | K1 | P1 | P1 |
| Nachricht löschen [B] | Eigene oder (mit Rechten) fremde Nachrichten löschen | Moderation | K1 | P1 | P1 |
| Antworten (Reply) [B] | Referenz auf bestehende Nachricht | Kontext | K2 | P1 | P1 |
| Threads [B] | Abzweigende Diskussionen aus Nachrichten | Übersichtlichkeit | K3 | P2 | P1 |
| Erwähnungen (@user, @role, @everyone) [B] | Direkte Benachrichtigung | Aufmerksamkeit | K2 | P1 | P1 |
| Reaktionen (Emoji) [B] | Emoji-Reaktionen auf Nachrichten | Schnelles Feedback | K2 | P1 | P1 |
| Pinnen [B] | Wichtige Nachrichten anheften | Referenz | K1 | P2 | P1 |
| Embeds [B] | Rich-Content-Vorschau (Links, Videos) | Medien-Erlebnis | K3 | P2 | P1 |
| Datei-Upload [B] | Bilder, Videos, Dokumente anhängen | Content Sharing | K2 | P1 | P1 |
| Sticker [B] | Animierte/statische Sticker | Ausdruck | K2 | P3 | P3 |
| Custom Emoji [B] | Server-eigene Emoji | Community-Identität | K2 | P3 | P2 |
| Markdown-Formatierung [B] | Bold, Italic, Code, Spoiler, Listen etc. | Textgestaltung | K2 | P1 | P1 |
| Code Blocks [B] | Syntax-Highlighting | Developer-Zielgruppe | K2 | P2 | P2 |
| Spoiler Tags [B] | Verbergen von Content bis Klick | Content Control | K1 | P3 | P2 |
| Bulk Message Delete [B] | Bis zu 100 Nachrichten gleichzeitig löschen | Moderation | K2 | P2 | P1 |
| Systemnachrichten [B] | Join, Boost, Pin-Benachrichtigungen | Community-Feedback | K1 | P2 | P2 |

### Suche

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Volltextsuche [B] | Nachrichten durchsuchen | Information Retrieval | K3 | P2 | P1 |
| Suchfilter [B] | from:, mentions:, has:, before:, after:, in: | Präzision | K3 | P2 | P1 |
| Such-Vorschau [B] | Inline-Ergebnisse mit Kontext | UX | K2 | P2 | P1 |
| Berechtigungsgefilterter Zugriff [H] | Nur Ergebnisse aus zugänglichen Channels | Security | K3 | P2 | P1 |

---

## 2.4 Voice- und Video-Funktionen

### Voice Channels

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Persistente Voice Channels [B] | Join/Leave ohne "Anruf"-Konzept | Spontane Kommunikation | K4 | P1 | P1 |
| Voice State (Join/Leave) [B] | Sichtbar wer in welchem Channel ist | Awareness | K2 | P1 | P1 |
| Stummschalten (Self-Mute) [B] | Eigenes Mikrofon aus | Kontrolle | K1 | P1 | P1 |
| Taubschalten (Self-Deafen) [B] | Eigenes Audio aus | Kontrolle | K1 | P1 | P1 |
| Server-Mute/Deafen [B] | Admin schaltet andere stumm | Moderation | K2 | P1 | P1 |
| Push-to-Talk [B] | Mikrofon nur bei Tastendruck | Kontrollierte Kommunikation | K2 | P2 | P1 |
| Voice Activity Detection [B] | Automatische Spracherkennung | Standard-Modus | K2 | P1 | P1 |
| User Limit pro Channel [B] | Max. Teilnehmerzahl | Kontrolle | K1 | P2 | P1 |
| Channel-Bitrate [B] | Konfigurierbare Audio-Qualität (8-384kbps) | Quality Control | K1 | P2 | P2 |
| Voice Region Override [B] | Server-Region für Voice manuell wählen | Latenz-Optimierung | K2 | P3 | P2 |

### Video & Screenshare

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Video-Call in Voice Channel [B] | Kamera aktivieren im Voice Channel | Face-to-Face | K4 | P2 | P1 |
| 1:1 Video in DM [B] | Direkter Video-Anruf | Privat-Kommunikation | K3 | P2 | P1 |
| Bildschirmfreigabe [B] | Ganzer Bildschirm oder Fenster teilen | Collaboration | K4 | P2 | P1 |
| Application Streaming [B] | Einzelne App streamen mit Audio | Gaming/Demo | K4 | P3 | P2 |
| Go Live (Server Stream) [B] | Stream in Voice Channel für alle | Entertainment | K4 | P3 | P2 |
| Stream-Vorschau [B] | Thumbnail des laufenden Streams | Entdeckung | K2 | P3 | P2 |
| Auflösung/FPS-Einstellungen [B] | 720p/1080p/1440p, 15/30/60fps | Quality Control | K2 | P3 | P2 |
| Noise Suppression [B] | AI-basierte Geräuschunterdrückung (Krisp) | Audio-Qualität | K4 | P3 | P2 |
| Echo Cancellation [B] | Automatische Echo-Unterdrückung | Audio-Qualität | K3 | P1 | P1 |

### Stage Channels

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Speaker/Audience Trennung [B] | Moderierte Audio-Events | Events/Talks | K3 | P3 | P2 |
| Hand Raise [B] | Zuhörer können sich melden | Partizipation | K1 | P3 | P2 |
| Stage Discovery [B] | Öffentliche Stages anzeigen | Reichweite | K2 | P3 | P3 |

---

## 2.5 Presence und Realtime

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Online/Offline Status [B] | Grüner/grauer Punkt | Erreichbarkeit | K2 | P1 | P1 |
| Idle-Erkennung [B] | Automatisch nach Inaktivität | Wahrheitsgemäß | K2 | P1 | P1 |
| Do Not Disturb [B] | Keine Benachrichtigungen | Fokus | K1 | P1 | P1 |
| Invisible Mode [B] | Offline erscheinen, aber online sein | Privacy | K2 | P2 | P1 |
| Custom Status [B] | Text + Emoji + Ablaufdatum | Kommunikation | K2 | P2 | P2 |
| Activity/Now Playing [B] | Zeigt aktuell laufendes Spiel/Spotify | Social Feature | K3 | P3 | P3 |
| Typing Indicator [B] | "User tippt..." Anzeige | Echtzeit-Feedback | K1 | P1 | P1 |
| Read/Unread State [B] | Ungelesene Nachrichten pro Channel | Navigation | K2 | P1 | P1 |
| Unread Badge Counter [B] | Anzahl ungelesener Mentions | Aufmerksamkeit | K2 | P1 | P1 |
| Multi-Device Presence [B] | Status über alle Geräte aggregiert | Konsistenz | K3 | P2 | P1 |
| Streaming Status [B] | Lila Status wenn Twitch/YouTube aktiv | Social Feature | K2 | P3 | P3 |

---

## 2.6 Admin-, Safety- und Moderationsfeatures

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Rollen-/Rechteverwaltung [B] | Granulare Permission-Matrix | Kontrolle | K3 | P1 | P1 |
| Audit Log [B] | Chronologische Admin-Aktionen mit Filter | Nachvollziehbarkeit | K2 | P2 | P1 |
| AutoMod Regeln [B] | Keyword-Filter, Spam-Detection, Mention-Limits | Automatisierung | K3 | P3 | P1 |
| Raid Protection [B] | Automatische Maßnahmen bei Mass-Joins | Anti-Abuse | K3 | P3 | P1 |
| Channel-Permissions [B] | Overrides pro Channel/Kategorie | Flexibilität | K3 | P1 | P1 |
| Server Insights [B] | Statistiken über Aktivität, Wachstum | Analytics | K2 | P3 | P2 |
| Content Filter [B] | Explicit Content Scanning | Safety | K4 | P3 | P1 |
| Report System [B] | Nutzer/Nachrichten melden | Trust & Safety | K2 | P2 | P1 |
| Ban-Liste [B] | Verwaltung aller Bans | Moderation | K1 | P1 | P1 |
| Invite Management [B] | Einladungen verwalten/widerrufen | Kontrolle | K1 | P2 | P1 |
| Webhook Management [B] | Server-Webhooks verwalten | Integration | K1 | P3 | P2 |

---

## 2.7 Erweiterbarkeit und Integrationen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Bot-Benutzer [O] | Programmierbare Bot-Accounts | Automatisierung | K3 | P2 | P1 |
| Bot-API (REST + Gateway) [O] | Vollständige API für Bot-Interaktion | Ökosystem | K3 | P2 | P1 |
| Slash Commands [O] | /-basierte Bot-Befehle mit UI | UX | K3 | P2 | P1 |
| Message Components [O] | Buttons, Select Menus in Nachrichten | Interaktive Bots | K3 | P3 | P2 |
| Modals [O] | Formular-Popups via Bots | Datenerfassung | K2 | P3 | P2 |
| Webhooks [O] | Eingehende Nachrichten von externen Diensten | Integration | K1 | P2 | P1 |
| OAuth2 [O] | Drittanbieter-Login + Berechtigungen | Ökosystem | K2 | P3 | P2 |
| Activities (Embedded Apps) [O] | In-Channel Mini-Apps/Spiele | Engagement | K4 | P3 | P3 |
| App Directory [B] | Verzeichnis aller verfügbaren Bots/Apps | Discovery | K2 | P3 | P2 |
| Rate Limits [O] | API Rate Limiting pro Route/Global | Stabilität | K2 | P1 | P1 |
| Gateway Intents [O] | Selektive Event-Subscription für Bots | Performance | K2 | P2 | P1 |

---

## 2.8 Plattformfunktionen

### Clients

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Web Client [B] | Browser-basierter Vollzugang | Universeller Zugang | K3 | P1 | P1 |
| Desktop Client (Win/Mac/Linux) [B] | Electron-basierte App | Native Features | K3 | P1 | P1 |
| Mobile Client (iOS/Android) [B] | Native/React Native App | Mobiler Zugang | K4 | P2 | P1 |
| Auto-Update [B] | Automatische Client-Updates | Wartung | K2 | P2 | P1 |
| Deep Links [B] | discord://links zu Channels/Servern | Navigation | K1 | P3 | P2 |

### Benachrichtigungen

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Push Notifications (Mobile) [B] | Firebase/APNs | Engagement | K2 | P2 | P1 |
| Desktop Notifications [B] | OS-Level Notifications | Aufmerksamkeit | K1 | P1 | P1 |
| Notification Preferences [B] | Pro Server/Channel einstellbar | Kontrolle | K2 | P2 | P1 |
| @mention Highlighting [B] | Visuelle Hervorhebung | Erkennung | K1 | P1 | P1 |
| Mute Server/Channel [B] | Alle Benachrichtigungen stumm | Focus | K1 | P1 | P1 |
| Notification Schedule [B] | Ruhezeiten konfigurieren | Work-Life-Balance | K1 | P3 | P2 |

### Medien & Darstellung

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Bild-/Video-Inline-Vorschau [B] | Medien direkt im Chat anzeigen | Medien-Erlebnis | K2 | P1 | P1 |
| GIF-Picker (Tenor/Giphy) [B] | GIF-Suche integriert | Ausdruck | K2 | P3 | P2 |
| Emoji Picker [B] | Unicode + Custom Emoji Auswahl | Ausdruck | K2 | P1 | P1 |
| Link Embeds [B] | OpenGraph-basierte Vorschau | Kontext | K2 | P2 | P1 |
| Datei-Download [B] | Angehängte Dateien herunterladen | Zugriff | K1 | P1 | P1 |
| Image Gallery Lightbox [B] | Vollbild-Bildansicht mit Navigation | Medien-Erlebnis | K2 | P2 | P2 |
| Video Player [B] | Inline-Video-Wiedergabe | Medien | K2 | P2 | P1 |

### Accessibility & i18n

| Feature | Beschreibung | Nutzen | Komplex. | MVP | Prod |
|---------|-------------|--------|----------|-----|------|
| Keyboard Navigation [B] | Vollständig per Tastatur bedienbar | Barrierefreiheit | K2 | P2 | P1 |
| Screen Reader Support [B] | ARIA-Labels, Semantik | Barrierefreiheit | K2 | P2 | P1 |
| Reduced Motion [B] | Animationen reduzieren | Barrierefreiheit | K1 | P3 | P2 |
| Mehrsprachigkeit [B] | ~30 Sprachen | Globale Nutzung | K2 | P3 | P1 |
| Themes (Dark/Light) [B] | Farbschema-Wechsel | Personalisierung | K1 | P2 | P1 |
| Font Scaling [B] | Schriftgrößenanpassung | Barrierefreiheit | K1 | P2 | P2 |
| Compact/Cozy Modus [B] | Nachrichtenanzeige-Dichte | Personalisierung | K1 | P3 | P2 |
