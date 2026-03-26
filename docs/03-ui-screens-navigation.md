# 3. UI-Liste / Screens / Navigationsstruktur

> Alle Angaben **[BEOBACHTBAR]** sofern nicht anders markiert.

---

## 3.1 Hauptnavigation

### Informationsarchitektur

Discord verwendet ein **3-Panel-Layout** als Grundstruktur:

```
┌──────┬─────────────┬──────────────────────────┬──────────┐
│      │             │                          │          │
│ SVR  │  CHANNEL    │     CONTENT AREA         │ MEMBER   │
│ LIST │  SIDEBAR    │     (Chat/Voice/Video)   │ LIST     │
│      │             │                          │          │
│ 72px │  240px      │     flex                 │  240px   │
│      │             │                          │          │
│      │             │  ┌────────────────────┐  │          │
│      │             │  │   COMPOSER          │  │          │
│      │             │  └────────────────────┘  │          │
└──────┴─────────────┴──────────────────────────┴──────────┘
```

### Navigationsebenen

| Ebene | Element | Funktion | Position |
|-------|---------|----------|----------|
| L1 | Server-Liste (Guild Sidebar) | Serverwechsel, DMs, Discover | Äußerst links, vertikal |
| L2 | Channel-Sidebar | Channels, Kategorien, Voice | Links neben Content |
| L3 | Content Area | Chat, Thread, Voice-Panel | Mitte, flexibel |
| L4 | Member/Detail Panel | Mitglieder, Thread-Liste, Suche | Rechts, ein-/ausblendbar |
| L5 | Modals/Overlays | Settings, Profile, Popups | Zentriert über Content |

### Mobile Navigation

```
┌────────────────────────────┐
│  ← Header mit Kontext      │
│                            │
│    CONTENT AREA            │
│    (Chat/Voice)            │
│                            │
│  ┌──────────────────────┐  │
│  │  COMPOSER             │  │
│  └──────────────────────┘  │
│                            │
│  [Servers] [DMs] [Search]  │  ← Bottom Tab Bar
│  [Notifications] [Profile] │
└────────────────────────────┘
```

**Mobile:** Drawer-Navigation (Swipe links → Server/Channel-Liste, Swipe rechts → Mitgliederliste). **[BEOBACHTBAR]**

---

## 3.2 Wichtige Screens und Views

### 3.2.1 Authentifizierung

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **Login** | Anmeldung | E-Mail/Passwort-Felder, QR-Code, OAuth-Buttons | Login, Passwort vergessen, Registrierung | Credentials | Nein |
| **Registrierung** | Kontenerstellung | E-Mail, Username, Passwort, Geburtsdatum, Captcha | Account anlegen | Formular-Validierung | Nein |
| **2FA-Eingabe** | MFA-Verifizierung | Code-Feld, Backup-Code-Option | Code eingeben | Session-Token | Nein |
| **Passwort-Reset** | Recovery | E-Mail-Feld, Bestätigungscode | Reset anfordern/bestätigen | E-Mail | Nein |

### 3.2.2 Hauptansichten

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **Server-Liste** | Server-Überblick | Runde Server-Icons, Unread-Badges, DM-Button, Add/Discover | Server wechseln, erstellen, beitreten | Guild-Liste, Unread-States | Ja: Unread Counts, Presence |
| **Channel-Sidebar** | Navigation innerhalb Server | Kategorien (collapsible), Channel-Items mit Icons, Voice-Users | Channel wechseln, erstellen, sortieren | Channel-Liste, Voice-States | Ja: Voice-Users, Unread |
| **User Panel (unten links)** | Eigener Status | Avatar, Username, Status, Mute/Deafen/Settings Buttons | Stummschalten, Einstellungen | Eigenes Profil, Voice-State | Ja: Voice-State |

### 3.2.3 Chat & Messaging

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **Text-Channel-Chat** | Hauptkommunikation | Message-Liste (virtualisiert), Composer, Channel-Header mit Topic | Nachrichten senden/bearbeiten/löschen, Dateien hochladen, Reagieren | Nachrichten, Attachments, Reactions | Ja: Neue Nachrichten, Typing, Reactions |
| **Thread-View** | Nebendiskussion | Thread-Header, Message-Liste, Mini-Composer | Thread-Nachrichten senden | Thread-Messages | Ja: Neue Thread-Messages |
| **Thread-Liste** | Alle Threads eines Channels | Thread-Titel, Letzte Aktivität, Unread-Badge | Thread öffnen, archivieren | Thread-Metadaten | Ja: Unread-Updates |
| **Forum-Channel** | Strukturierte Diskussionen | Post-Liste mit Tags, Sortierung, Post-Detail | Post erstellen, taggen, sortieren | Forum-Posts, Tags | Ja: Neue Posts |
| **Pinned Messages** | Angeheftete Nachrichten | Overlay-Panel mit Pin-Liste | Pin anzeigen, zu Nachricht springen | Pinned Messages | Nein (selten geändert) |
| **Search Results** | Suchergebnisse | Suchfeld mit Filtern, Ergebnis-Liste mit Kontext | Suchen, filtern, zu Ergebnis springen | Such-Index | Nein |
| **DM-Liste** | Privatnachrichten-Übersicht | Nutzer-Avatare, letzte Nachricht, Unread-Badge | DM öffnen, schließen, Gruppe erstellen | DM-Channels, Last Messages | Ja: Unread, Presence |

### 3.2.4 Voice & Video

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **Voice Connected Bar** | Voice-Status | Channel-Name, Verbindungsqualität, Mute/Deafen/Disconnect Buttons | Stummschalten, Trennen, Channel wechseln | Voice-State, Connection-Info | Ja: Voice-State |
| **Voice Channel Overlay** | Aktive Voice-Session | User-Kacheln mit Speaking-Indicator, Video-Grid | Kamera an/aus, Screenshare, Disconnect | Voice/Video-Streams, Participants | Ja: Audio/Video-Streams, Speaking |
| **Video Grid** | Video-Call-Ansicht | Kamera-Kacheln (Grid/Fokus-Layout), Screenshare-View | Layout wechseln, Nutzer fokussieren | Video-Streams | Ja: Video-Frames |
| **Screen Share View** | Bildschirmfreigabe anschauen | Stream-Fenster, PiP-Option, Quality-Controls | Stream anschauen, PiP, Qualität ändern | Screen-Share-Stream | Ja: Streaming-Daten |
| **Stage Channel** | Audio-Event | Speaker-Bereich, Audience, Hand-Raise | Sprechen anfragen, zuhören, Hand heben | Stage-Participants, Roles | Ja: Speaker-State |

### 3.2.5 Profil & Social

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **User Profile Popout** | Schnellansicht | Avatar, Banner, Bio, Rollen, Mutual Servers/Friends, Activity | Nachricht senden, Freund hinzufügen, Blockieren | User-Profil, Presence, Activity | Ja: Presence, Activity |
| **User Profile Modal** | Detailansicht | Tabs: About, Mutual Servers, Mutual Friends, Activity | Interaktionen | Erweiterte Profildaten | Ja: Presence |
| **Friends List** | Beziehungsmanagement | Tabs: Alle/Online/Ausstehend/Blockiert, Nutzer-Liste | Freund hinzufügen/entfernen, DM starten | Friend-Relations, Presence | Ja: Presence |

### 3.2.6 Einstellungen

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **User Settings** | Persönliche Einstellungen | Linke Sidebar mit Kategorien, Content-Bereich | Einstellungen ändern | User-Preferences | Nein |
| ↳ My Account | Kontodaten | Username, E-Mail, Passwort, 2FA | Konto verwalten | Account-Daten | Nein |
| ↳ Profiles | Profilgestaltung | Avatar, Banner, Bio, Farbe | Profil anpassen | Profil-Daten | Nein |
| ↳ Privacy & Safety | Datenschutz | DM-Filter, Daten-Sharing | Privacy konfigurieren | Privacy-Settings | Nein |
| ↳ Authorized Apps | OAuth-Apps | App-Liste mit Revoke | Apps verwalten | OAuth-Grants | Nein |
| ↳ Connections | Verbundene Dienste | Service-Liste (Spotify, GitHub...) | Verbinden/Trennen | Service-Tokens | Nein |
| ↳ Voice & Video | Medieneinstellungen | Input/Output-Auswahl, Noise Supp., Echo | Audio/Video konfigurieren | Device-Settings | Nein |
| ↳ Notifications | Benachrichtigungen | Desktop/Mobile/E-Mail Prefs | Notifications konfigurieren | Notification-Prefs | Nein |
| ↳ Keybinds | Tastenkürzel | Keybind-Liste, Custom Keybinds | Shortcuts anpassen | Keybind-Config | Nein |
| ↳ Appearance | Darstellung | Theme, Font Size, Compact/Cozy | Aussehen anpassen | UI-Preferences | Nein |
| ↳ Accessibility | Barrierefreiheit | Reduced Motion, Saturation, Contrast | A11y anpassen | A11y-Settings | Nein |
| **Server Settings** | Server-Verwaltung | Sidebar mit Server-Einstellungs-Kategorien | Server konfigurieren | Guild-Settings | Nein |
| ↳ Overview | Grundeinstellungen | Name, Icon, Region, Features | Server anpassen | Guild-Data | Nein |
| ↳ Roles | Rollen-Management | Rollen-Liste, Permission-Matrix | Rollen erstellen/bearbeiten | Roles, Permissions | Nein |
| ↳ Channels | Channel-Verwaltung | Channel-Liste, Drag-to-Reorder | Channels verwalten | Channels | Nein |
| ↳ Emoji/Sticker | Custom Assets | Upload, Verwalten | Emojis/Sticker verwalten | Custom-Assets | Nein |
| ↳ Moderation | AutoMod & Safety | AutoMod-Regeln, Verification Level | Moderation konfigurieren | Mod-Config | Nein |
| ↳ Audit Log | Protokoll | Filterbares Log aller Admin-Aktionen | Log durchsuchen | Audit-Events | Nein |
| ↳ Integrations | Bots & Webhooks | Bot-Liste, Webhook-Verwaltung | Integrationen verwalten | Integrations | Nein |
| ↳ Members | Mitgliederverwaltung | Mitglieder-Liste mit Rollen-Zuweisung | Mitglieder verwalten | Members, Roles | Nein |
| ↳ Invites | Einladungen | Aktive Einladungen mit Stats | Einladungen verwalten | Invites | Nein |
| ↳ Bans | Sperren | Ban-Liste mit Gründen | Bans verwalten | Bans | Nein |

### 3.2.7 Spezial-Flows

| Screen | Zweck | Zentrale UI-Elemente | Benutzeraktionen | Daten | Realtime |
|--------|-------|---------------------|------------------|-------|----------|
| **Server Creation** | Server erstellen | Template-Auswahl, Name/Icon, Customize | Server anlegen | Templates | Nein |
| **Invite Accept** | Einladung annehmen | Server-Preview, Join-Button | Server beitreten | Invite-Data, Guild-Preview | Nein |
| **Onboarding** | Neues Mitglied | Fragen, Channel-Empfehlungen, Regeln | Onboarding abschließen | Onboarding-Config | Nein |
| **Server Discovery** | Server entdecken | Kategorien, Suchfeld, Server-Karten | Server durchsuchen/beitreten | Discovery-Index | Nein |
| **Nitro/Shop** | Monetarisierung | Abo-Optionen, Shop-Items, Profile Themes | Kaufen/Abonnieren | Billing, Inventory | Nein |

---

## 3.3 Wiederverwendbare UI-Komponenten

### Navigation & Layout

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **GuildSidebar** | Server-Liste anzeigen | Default, Unread, Selected, Hover, Dragging | Klick (Switch), Drag (Reorder), Right-Click (Context Menu) | Guilds[], Unread-States, DM-Unreads | K2 |
| **GuildIcon** | Einzelner Server | Default, Hover (Rund→Eckig), Selected, Unread-Pill, Notification-Badge | Klick, Right-Click | Guild-Info, Unread-Count | K1 |
| **ChannelSidebar** | Channel-Navigation | Expanded/Collapsed Kategorien, Selected Channel, Voice-Participants | Klick, Collapse, Right-Click, Drag (Reorder) | Channels[], Categories[], Voice-States | K2 |
| **ChannelItem** | Einzelner Channel | Default, Hover, Selected, Unread, Muted, Locked | Klick, Right-Click | Channel-Info, Unread-Bool, Permission-State | K1 |
| **CategoryItem** | Channel-Gruppe | Expanded/Collapsed, Hover | Klick (Toggle), Right-Click | Category-Info, Children | K1 |
| **UserPanel** | Eigener Status unten links | Online/Idle/DND/Invisible, Voice-Connected | Mute/Deafen/Settings Klick, Status ändern | User-Self, Voice-State | K2 |

### Messaging

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **MessageItem** | Einzelne Nachricht | Default, Hover (Actions sichtbar), Editing, Highlighted (Mention), System-Message, Reply-Chain | Reply, React, Edit, Delete, Pin, Thread, Context Menu | Message, Author, Attachments, Embeds, Reactions | K3 |
| **MessageGroup** | Nachrichten-Cluster | Grouped (gleicher Autor <7min), New-Day-Divider | - | Messages[], Author | K2 |
| **Composer** | Nachrichten-Eingabe | Default, Typing, Upload-Preview, Reply-Mode, Thread-Mode, Slowmode-Cooldown, Disabled (no permission) | Tippen, Senden, Upload, Emoji/GIF/Sticker Picker, Slash Command, Mention Autocomplete | Draft, Attachments, Reply-Ref | K3 |
| **ReactionBar** | Emoji-Reaktionen | Default, Hover (Tooltip mit Nutzern), Own-Reacted (hervorgehoben) | Klick (Toggle), Hover (User-List), Add Reaction | Reactions[], Own-Reaction-State | K2 |
| **EmbedCard** | Link-/Rich-Vorschau | Image, Video, Article, Provider-Branded | Klick (Open), Video Play | Embed-Data (OG/oEmbed) | K2 |
| **AttachmentItem** | Datei-Anhang | Image (Inline), Video (Player), Audio (Player), File (Download-Card), Spoiler | Klick (Lightbox/Download), Spoiler-Reveal | Attachment-URL, Metadata | K2 |
| **MentionBadge** | @-Erwähnung | User-Mention, Role-Mention, Channel-Mention, Everyone/Here | Klick (Navigate/Profile) | Mentioned Entity | K1 |

### Interaktive Elemente

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **EmojiPicker** | Emoji-Auswahl | Categories, Search, Recent, Custom, Skin Tone | Suchen, Kategorie wechseln, Emoji auswählen | Emoji-Dataset, Custom-Emojis, Recent | K2 |
| **GifPicker** | GIF-Suche (Tenor) | Trending, Search Results, Categories | Suchen, Auswählen | Tenor-API Response | K2 |
| **MentionAutocomplete** | @-Vorschläge | User-Liste, Role-Liste, Channel-Liste | Tippen, Auswählen | Members, Roles, Channels mit Fuzzy-Match | K2 |
| **ContextMenu** | Rechtsklick-Menü | Positioniert, Nested Submenus, Conditional Items | Klick auf Item | Kontextabhängige Actions | K2 |
| **Modal** | Overlay-Dialog | Open/Closed, Multi-Step, Confirmation | Schließen (X, ESC, Outside-Click), Confirm/Cancel | Content-abhängig | K1 |
| **Tooltip** | Hover-Info | Positioned (top/bottom/left/right), Delay | Hover-In/Out | Text/Content | K1 |
| **Popout** | Schwebendes Panel | Positioned, Anchored to Trigger | Klick-Toggle, Outside-Click-Close | Content-abhängig | K2 |

### Voice & Media

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **VoiceConnectedBar** | Voice-Status-Anzeige | Connected, Connecting, Reconnecting, Disconnected | Mute, Deafen, Disconnect, Expand | Voice-State, Connection-Quality | K2 |
| **VoiceUserTile** | Teilnehmer im Voice | Speaking (grüner Ring), Muted, Deafened, Video-On, Streaming | Klick (Profil), Right-Click | User, Voice-State, Stream | K2 |
| **VideoGrid** | Video-Kachel-Layout | Grid (2x2, 3x3...), Focus+Sidebar, PiP | Layout-Switch, Fokus-User wählen | Video-Streams[] | K3 |
| **ScreenSharePanel** | Stream-Anzeige | Fullscreen, Windowed, PiP, Quality-Overlay | Quality ändern, PiP, Fullscreen | Stream, Quality-Options | K3 |
| **MediaControls** | Audio/Video-Steuerung | Mute, Deafen, Camera, Screen, Disconnect | Toggle-Buttons | Own Voice-State | K1 |

### Nutzer & Profile

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **MemberListItem** | Mitglied in Liste | Online/Offline, Typing, Streaming, Role-Color | Klick (Profile Popout), Right-Click | User, Presence, Top-Role | K1 |
| **PresenceBadge** | Online-Status | Online (grün), Idle (gelb), DND (rot), Offline (grau), Streaming (lila) | - | Presence-State | K1 |
| **RoleBadge** | Rollen-Anzeige | Farbig, Optional Icon | Klick (Mitglieder mit Rolle zeigen) | Role-Info | K1 |
| **UserProfilePopout** | Profilkarte | Loading, Loaded, With-Activity, With-Connections | Message, Friend, Block, Roles anzeigen | User-Profile, Mutual-Info | K2 |
| **AvatarComponent** | Benutzer-Avatar | Default, Status-Ring, Server-Specific, Animated (Nitro) | Klick (Profile) | Avatar-URL, Presence | K1 |

### System & Feedback

| Komponente | Aufgabe | States | Interaktionen | Daten | Komplexität |
|-----------|---------|--------|--------------|-------|-------------|
| **NotificationToast** | Benachrichtigung | Appearing, Visible, Dismissing | Klick (Navigate), Dismiss | Notification-Content | K1 |
| **UploadOverlay** | Datei-Upload | Drag-Over, Progress, Complete, Error | Drop, Cancel | File-Info, Progress | K2 |
| **SearchBar** | Suche | Collapsed, Expanded, With-Filters, Loading, Results | Tippen, Filter wählen, Navigate | Query, Filters, Results | K2 |
| **PermissionMatrix** | Rechte-Verwaltung | Per-Role, Per-Channel, Override-States (✓/✗/Inherit) | Toggle-Permissions | Permissions, Overrides | K3 |
| **InfiniteScrollList** | Virtuelle Liste | Loading-Top, Loading-Bottom, Jump-to-present | Scroll (lazy load), Jump | Paginated Data | K2 |
| **TypingIndicator** | "tippt gerade..." | Single User, Multiple Users (bis 3 Namen, dann "several") | - | Typing-Users[] | K1 |
