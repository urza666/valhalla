# 13. RBAC-Rollenmatrix — Discord Rechtestruktur & Ableitung für Valhalla

> **Quellen:** [O] = Discord Developer Documentation | [B] = Beobachtbar | [H] = Herleitung
> **Verknüpft mit:** `12-discord-rechtestruktur.md` (vollständige Bitfeld-Referenz)

---

## 1. Discord's Berechtigungsmodell — Architektonische Einordnung

### 1.1 Modell-Typ: Hierarchisches RBAC mit Channel-Overrides

Discord implementiert kein reines RBAC (Role-Based Access Control), sondern ein **hybrides Modell**:

```
┌────────────────────────────────────────────────────────────────┐
│                    DISCORD PERMISSION MODEL                     │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  LAYER 1: RBAC (Role-Based Access Control)              │  │
│  │  → Rollen mit Permission-Bitfeld auf Server-Ebene       │  │
│  │  → Hierarchisch nach Position (Rang)                    │  │
│  │  → OR-Verknüpfung aller Rollen eines Users              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  LAYER 2: ABAC-ähnliche Channel Overrides               │  │
│  │  → Per-Channel Overwrites für Rollen UND User           │  │
│  │  → Drei-Zustands-Logik: Allow / Deny / Inherit          │  │
│  │  → Kaskadierung: @everyone → Rollen → User              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  LAYER 3: Implizite Regeln & Overrides                  │  │
│  │  → Owner = ALL (immer, unumgehbar)                      │  │
│  │  → ADMINISTRATOR = ALL (umgeht Channel Overrides)       │  │
│  │  → Timeout = nur VIEW + READ_HISTORY                    │  │
│  │  → Implicit Deny: VIEW_CHANNEL fehlt → alles blockiert  │  │
│  │  → Hierarchie-Constraint: Nur niedrigere Rollen ändern  │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Warum kein reines RBAC?

| Aspekt | Reines RBAC | Discord's Modell |
|--------|-------------|-----------------|
| **Rechte-Zuweisung** | Nur über Rollen | Rollen + Channel-Overrides + User-Overrides |
| **Granularität** | Global (pro Rolle) | Global + Per-Channel + Per-User |
| **Override-Logik** | Keine | Allow/Deny/Inherit mit Kaskadierung |
| **Kontextabhängig** | Nein | Ja (Channel-Typ, Timeout, Kategorie) |
| **Implizite Regeln** | Selten | Viele (Owner, Admin, Dependencies, Timeout) |

**Korrekter Modellname:** Discord implementiert ein **Hierarchisches RBAC mit Attribut-basiertem Channel-Override-System (HRBAC+CO)** [H]

---

## 2. Rollen-Taxonomie

### 2.1 Systemrollen (nicht löschbar)

| Rolle | Typ | Zuweisung | Löschbar | Besonderheiten |
|-------|-----|-----------|----------|---------------|
| **@everyone** | System | Automatisch (alle Mitglieder) | Nein | ID = Guild-ID; Position = 0 (niedrigste); Basis für Permission-Berechnung |
| **Server Owner** | Implizit | Automatisch (Server-Ersteller) | Nein (nur Transfer) | Hat ALLE Permissions, überschreibt alles, immun gegen Timeout/Kick/Ban |

### 2.2 Administrative Rollen (benutzerdefiniert)

| Typische Rolle | Kern-Permissions | Hierarchie-Position | Zweck |
|---------------|-----------------|--------------------|----|
| **Administrator** | `ADMINISTRATOR` (Bit 3) | Hoch (unter Owner) | Voller Server-Zugriff, umgeht alle Overrides |
| **Moderator** | KICK, BAN, MANAGE_MESSAGES, MODERATE_MEMBERS, MANAGE_THREADS | Mittel-Hoch | Community-Moderation |
| **Channel-Manager** | MANAGE_CHANNELS, MANAGE_ROLES | Mittel | Kanal-Verwaltung ohne Moderationsrechte |

### 2.3 Verwaltete Rollen (managed = true) [O]

| Rollentyp | Erstellt durch | Zuweisung | Erkennungsmerkmal |
|-----------|---------------|-----------|-------------------|
| **Bot-Rolle** | Bot-Installation via OAuth2 | Automatisch an Bot-User | `tags.bot_id` vorhanden |
| **Integrations-Rolle** | Server-Integration (Twitch, YouTube) | Automatisch basierend auf Status | `tags.integration_id` vorhanden |
| **Premium/Booster-Rolle** | Server-Boost | Automatisch bei Boost/Un-Boost | `tags.premium_subscriber: null` |
| **Linked Role** | App Role Connection | Automatisch via externe API | `tags.subscription_listing_id` |

### 2.4 Benutzerdefinierte Rollen

| Eigenschaft | Detail |
|------------|--------|
| **Erstellt von** | Server-Admin/Moderator mit MANAGE_ROLES |
| **Anzahl** | Max. 250 Rollen pro Server [O] |
| **Hierarchie** | Position bestimmt Rang (höher = mehr Macht) |
| **Farbe** | Optional, zeigt höchste farbige Rolle in Mitgliederliste |
| **Hoist** | Optional, zeigt Rolle als separate Gruppe in Mitgliederliste |
| **Icon** | Optional, nur mit Server-Level 2+ Boost |
| **Mentionable** | Optional, erlaubt @rolle Erwähnung |

---

## 3. Vollständige RBAC-Rollenmatrix

### 3.1 Permission-Kategorien

Die 49 Discord-Permissions lassen sich in **7 funktionale Kategorien** gruppieren:

#### Kategorie A: Server-Administration

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `ADMINISTRATOR` | 3 | ✅ impl. | ✅ | ❌ | ❌ | ⚠️ selten |
| `MANAGE_GUILD` | 5 | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MANAGE_CHANNELS` | 4 | ✅ | ✅ | ⚠️ opt. | ❌ | ⚠️ |
| `MANAGE_ROLES` | 28 | ✅ | ✅ | ⚠️ opt. | ❌ | ✅ |
| `MANAGE_WEBHOOKS` | 29 | ✅ | ✅ | ❌ | ❌ | ✅ |
| `MANAGE_GUILD_EXPRESSIONS` | 30 | ✅ | ✅ | ❌ | ❌ | ❌ |
| `CREATE_GUILD_EXPRESSIONS` | 43 | ✅ | ✅ | ⚠️ opt. | ❌ | ❌ |
| `VIEW_AUDIT_LOG` | 7 | ✅ | ✅ | ✅ | ❌ | ❌ |
| `VIEW_GUILD_INSIGHTS` | 19 | ✅ | ✅ | ❌ | ❌ | ❌ |
| `VIEW_CREATOR_MONETIZATION_ANALYTICS` | 41 | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Kategorie B: Mitglieder-Moderation

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `KICK_MEMBERS` | 1 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `BAN_MEMBERS` | 2 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `MODERATE_MEMBERS` (Timeout) | 40 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `MANAGE_NICKNAMES` | 27 | ✅ | ✅ | ✅ | ❌ | ❌ |
| `CHANGE_NICKNAME` | 26 | ✅ | ✅ | ✅ | ✅ | ❌ |

#### Kategorie C: Text-Channel-Kommunikation

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `VIEW_CHANNEL` | 10 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SEND_MESSAGES` | 11 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SEND_TTS_MESSAGES` | 12 | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MANAGE_MESSAGES` | 13 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `EMBED_LINKS` | 14 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ATTACH_FILES` | 15 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `READ_MESSAGE_HISTORY` | 16 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MENTION_EVERYONE` | 17 | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| `USE_EXTERNAL_EMOJIS` | 18 | ✅ | ✅ | ✅ | ✅* | ✅ |
| `USE_EXTERNAL_STICKERS` | 37 | ✅ | ✅ | ✅ | ✅* | ❌ |
| `ADD_REACTIONS` | 6 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `USE_APPLICATION_COMMANDS` | 31 | ✅ | ✅ | ✅ | ✅ | — |
| `SEND_VOICE_MESSAGES` | 46 | ✅ | ✅ | ✅ | ✅ | ❌ |
| `SEND_POLLS` | 49 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `USE_EXTERNAL_APPS` | 50 | ✅ | ✅ | ✅ | ✅ | — |
| `PIN_MESSAGES` | 51 | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| `BYPASS_SLOWMODE` | 52 | ✅ | ✅ | ✅ | ❌ | ✅ |

*) = Erfordert Nitro für serverübergreifende Nutzung

#### Kategorie D: Thread-Management

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `MANAGE_THREADS` | 34 | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| `CREATE_PUBLIC_THREADS` | 35 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CREATE_PRIVATE_THREADS` | 36 | ✅ | ✅ | ✅ | ⚠️ opt. | ❌ |
| `SEND_MESSAGES_IN_THREADS` | 38 | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Kategorie E: Voice-Channel

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `CONNECT` | 20 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SPEAK` | 21 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MUTE_MEMBERS` | 22 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `DEAFEN_MEMBERS` | 23 | ✅ | ✅ | ✅ | ❌ | ❌ |
| `MOVE_MEMBERS` | 24 | ✅ | ✅ | ✅ | ❌ | ✅ |
| `USE_VAD` | 25 | ✅ | ✅ | ✅ | ✅ | — |
| `PRIORITY_SPEAKER` | 8 | ✅ | ✅ | ⚠️ opt. | ❌ | ❌ |
| `STREAM` (Go Live) | 9 | ✅ | ✅ | ✅ | ✅ | ❌ |
| `USE_SOUNDBOARD` | 42 | ✅ | ✅ | ✅ | ✅ | ❌ |
| `USE_EXTERNAL_SOUNDS` | 45 | ✅ | ✅ | ✅ | ✅ | ❌ |
| `USE_EMBEDDED_ACTIVITIES` | 39 | ✅ | ✅ | ✅ | ✅ | — |

#### Kategorie F: Stage-Channel (zusätzlich zu Voice)

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `REQUEST_TO_SPEAK` | 32 | ✅ | ✅ | ✅ | ✅ | ❌ |

**Stage-Moderator wird automatisch** bei: MANAGE_CHANNELS, MUTE_MEMBERS oder MOVE_MEMBERS

#### Kategorie G: Einladungen & Events

| Permission | Bit | Owner | Admin | Mod | Member | Bot (typ.) |
|-----------|-----|-------|-------|-----|--------|------------|
| `CREATE_INSTANT_INVITE` | 0 | ✅ | ✅ | ✅ | ✅ | ❌ |
| `MANAGE_EVENTS` | 33 | ✅ | ✅ | ⚠️ opt. | ❌ | ⚠️ |
| `CREATE_EVENTS` | 44 | ✅ | ✅ | ✅ | ⚠️ opt. | ⚠️ |

**Legende:** ✅ = Standardmäßig gewährt | ❌ = Standardmäßig verweigert | ⚠️ = Situationsabhängig | — = Nicht anwendbar

---

## 4. Permission-Berechnungskette — Visuelle Darstellung

### 4.1 Gesamtfluss

```
                    ┌─────────────────────┐
                    │   Server Owner?      │
                    └──────────┬──────────┘
                         JA  / \ NEIN
                            /   \
                    ┌──────▼┐   ┌▼──────────────────────────┐
                    │ALL    │   │ @everyone.permissions      │
                    │PERMS  │   │ |= rolle1.permissions      │
                    │(Ende) │   │ |= rolle2.permissions      │
                    └───────┘   │ |= rolleN.permissions      │
                                │ = base_permissions         │
                                └──────────┬────────────────┘
                                           │
                                ┌──────────▼────────────────┐
                                │ ADMINISTRATOR gesetzt?     │
                                └──────────┬────────────────┘
                                     JA  / \ NEIN
                                        /   \
                                ┌──────▼┐   ┌▼──────────────────────┐
                                │ALL    │   │ Channel Overwrites     │
                                │PERMS  │   │ anwenden (7 Schritte)  │
                                │(Ende) │   └──────────┬────────────┘
                                └───────┘              │
                                           ┌───────────▼──────────┐
                                           │ Schritt 1:           │
                                           │ @everyone deny       │
                                           │ p &= ~everyone.deny  │
                                           └───────────┬──────────┘
                                           ┌───────────▼──────────┐
                                           │ Schritt 2:           │
                                           │ @everyone allow      │
                                           │ p |= everyone.allow  │
                                           └───────────┬──────────┘
                                           ┌───────────▼──────────┐
                                           │ Schritt 3+4:         │
                                           │ Alle Rollen-Overwr.  │
                                           │ deny sammeln (OR)    │
                                           │ allow sammeln (OR)   │
                                           │ p &= ~deny_total     │
                                           │ p |= allow_total     │
                                           └───────────┬──────────┘
                                           ┌───────────▼──────────┐
                                           │ Schritt 5+6:         │
                                           │ User-Overwrite       │
                                           │ p &= ~user.deny      │
                                           │ p |= user.allow      │
                                           └───────────┬──────────┘
                                           ┌───────────▼──────────┐
                                           │ Implizite Regeln:    │
                                           │ VIEW_CHANNEL fehlt?  │
                                           │ → p = 0              │
                                           │ Timeout aktiv?       │
                                           │ → p = VIEW|READ_HIST │
                                           └───────────┬──────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ FINALE           │
                                              │ PERMISSIONS      │
                                              └─────────────────┘
```

### 4.2 Channel Override Kaskade — Beispiel

```
Szenario: User "Alice" hat Rollen [@everyone, Mod, VIP]
          Channel #announcements hat Overrides:

┌────────────────────────────────────────────────────────────┐
│ BASE PERMISSIONS (Server-Ebene)                            │
│                                                            │
│ @everyone:  VIEW | READ_HISTORY | ADD_REACTIONS            │
│ Mod:        KICK | BAN | MANAGE_MSG | SEND_MSG             │
│ VIP:        EMBED_LINKS | ATTACH_FILES                     │
│                                                            │
│ base = VIEW | READ_HISTORY | ADD_REACTIONS | KICK | BAN    │
│      | MANAGE_MSG | SEND_MSG | EMBED_LINKS | ATTACH_FILES  │
└────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────┐
│ CHANNEL OVERRIDES für #announcements                        │
│                                                            │
│ @everyone:  deny=SEND_MESSAGES  allow=⊘                   │
│ Mod-Rolle:  deny=⊘              allow=SEND_MESSAGES        │
│ VIP-Rolle:  deny=⊘              allow=⊘  (erbt alles)     │
│ Alice:      (kein User-Override)                           │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ BERECHNUNG:                                                │
│                                                            │
│ 1. p = base                                                │
│ 2. p &= ~SEND_MSG  (everyone deny)    → SEND_MSG entfernt │
│ 3. p |= ⊘          (everyone allow)   → keine Änderung    │
│ 4. deny_roles = ⊘                                          │
│    allow_roles = SEND_MSG (von Mod)                        │
│    p &= ~⊘                             → keine Änderung   │
│    p |= SEND_MSG                       → SEND_MSG zurück! │
│ 5. kein User-Override                                      │
│                                                            │
│ ERGEBNIS: Alice (Mod) kann in #announcements schreiben.    │
│ Normale Member ohne Mod-Rolle können NICHT schreiben.      │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Kategorie-Vererbung und Sync-Mechanismus

```
┌───────────────────────────────────────────────────────────┐
│ Kategorie "Moderation"                                    │
│ Overrides:                                                │
│   @everyone: deny=VIEW_CHANNEL                            │
│   Mod:       allow=VIEW_CHANNEL                           │
│                                                           │
│ ┌─────────────────────────────┐  ┌─────────────────────┐ │
│ │ #mod-chat [SYNCED ✓]        │  │ #mod-logs [SYNCED ✓] │ │
│ │ Overrides: (= Kategorie)   │  │ Overrides: (= Kat.) │ │
│ │ → Erbt automatisch         │  │ → Erbt automatisch  │ │
│ └─────────────────────────────┘  └─────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────┐                          │
│ │ #mod-voice [DE-SYNCED ✗]    │                          │
│ │ Overrides: wie Kategorie    │                          │
│ │ + VIP: allow=VIEW_CHANNEL   │  ← Manuell hinzugefügt  │
│ │ → Erbt NICHT mehr           │                          │
│ └─────────────────────────────┘                          │
└───────────────────────────────────────────────────────────┘

Sync-Regeln:
1. Neuer Channel in Kategorie → Overwrites werden kopiert (synced)
2. Manueller Override am Channel → De-synced
3. Kategorie-Override geändert → Nur synced Channels aktualisiert
4. Channel in andere Kategorie verschoben → Optionale Re-Synchronisierung
```

---

## 6. Hierarchie-Constraints — Was die Rollenhöhe einschränkt

```
┌─────────────────────────────────────────────────────────┐
│ ROLLEN-HIERARCHIE (Position bestimmt Rang)              │
│                                                         │
│ Position 5: ──── Owner (implizit höchste Autorität) ──  │
│ Position 4: ──── Admin-Rolle ──────────────────────     │
│ Position 3: ──── Moderator-Rolle ──────────────────     │
│ Position 2: ──── VIP-Rolle ────────────────────────     │
│ Position 1: ──── Bot-Rolle ────────────────────────     │
│ Position 0: ──── @everyone ────────────────────────     │
│                                                         │
│ EINSCHRÄNKUNGEN (basierend auf höchster eigener Rolle): │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Moderator (Pos. 3) kann:                            │ │
│ │ ✅ Kick/Ban: User mit Pos. 0, 1, 2                 │ │
│ │ ✅ Rollen zuweisen: Nur Pos. 0, 1, 2               │ │
│ │ ✅ Rollen bearbeiten: Nur Pos. 0, 1, 2             │ │
│ │ ✅ Nickname ändern: Nur bei Pos. 0, 1, 2 Usern     │ │
│ │ ❌ Kick/Ban: User mit Pos. 3, 4, 5                 │ │
│ │ ❌ Rollen zuweisen: Pos. 3, 4 (gleich oder höher)  │ │
│ │ ❌ Admin-Rolle bearbeiten: Pos. 4 (höher)          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ WICHTIG: Die Hierarchie gilt NUR für:                   │
│ - Kick/Ban/Timeout-Aktionen                             │
│ - Rollenvergabe und -bearbeitung                        │
│ - Nickname-Änderung anderer User                        │
│                                                         │
│ Die Hierarchie gilt NICHT für:                          │
│ - Permission-Berechnung bei Channel Overwrites          │
│ - Widersprüchliche Rollen-Overwrites (Allow gewinnt!)  │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Kritische Design-Entscheidung: Allow gewinnt über Deny bei Rollen

Dies ist der **kontraintuitivste Aspekt** von Discord's Berechtigungssystem:

```
SZENARIO:
  User hat Rolle A (Pos. 5) und Rolle B (Pos. 1)
  Channel Override für Rolle A: deny=SEND_MESSAGES
  Channel Override für Rolle B: allow=SEND_MESSAGES

INTUITIVE ERWARTUNG (falsch):
  "Rolle A ist höher → Deny sollte gewinnen"

TATSÄCHLICHES VERHALTEN [O]:
  deny_total  = rolleA.deny  | rolleB.deny  = SEND_MESSAGES | 0 = SEND_MESSAGES
  allow_total = rolleA.allow | rolleB.allow = 0 | SEND_MESSAGES = SEND_MESSAGES

  p &= ~deny_total   → SEND_MESSAGES entfernt
  p |= allow_total    → SEND_MESSAGES zurück!

  → User KANN schreiben, weil Allow NACH Deny angewandt wird.

KONSEQUENZ FÜR EIGENE PLATTFORM:
  → Dieses Verhalten ist verwirrend für Admins
  → Alternative: "Höchste Rolle gewinnt bei Konflikten"
  → Oder: Explizites UI das Konflikte aufzeigt
```

---

## 8. Permission-Abhängigkeitsbaum

```
VIEW_CHANNEL (Gate-Permission)
├── SEND_MESSAGES
│   ├── MENTION_EVERYONE
│   ├── SEND_TTS_MESSAGES
│   ├── ATTACH_FILES
│   ├── EMBED_LINKS
│   ├── SEND_VOICE_MESSAGES
│   └── SEND_POLLS
├── ADD_REACTIONS
├── READ_MESSAGE_HISTORY
├── MANAGE_MESSAGES
│   └── (impliziert PIN_MESSAGES)
│   └── (impliziert BYPASS_SLOWMODE)
├── CREATE_PUBLIC_THREADS
├── CREATE_PRIVATE_THREADS
├── SEND_MESSAGES_IN_THREADS
├── MANAGE_THREADS
└── USE_APPLICATION_COMMANDS

CONNECT (Gate-Permission für Voice)
├── SPEAK
├── MUTE_MEMBERS
├── DEAFEN_MEMBERS
├── MOVE_MEMBERS
├── USE_VAD
├── PRIORITY_SPEAKER
├── STREAM
├── USE_SOUNDBOARD
│   └── USE_EXTERNAL_SOUNDS
├── USE_EMBEDDED_ACTIVITIES
└── REQUEST_TO_SPEAK (Stage)

MANAGE_CHANNELS (Gate-Permission für Admin)
├── (impliziert Kanal-Overwrite-Verwaltung)
└── (impliziert BYPASS_SLOWMODE)

MANAGE_ROLES
└── (eingeschränkt auf Rollen unterhalb eigener Position)
```

---

## 9. Ableitung: Empfohlenes Permission-Modell für Valhalla

### 9.1 Beibehaltene Konzepte (bewährt)

| Konzept | Begründung |
|---------|------------|
| **Bitfeld-basierte Permissions** | Effizient, schnell berechenbar, erweiterbar |
| **Hierarchische Rollen mit Position** | Intuitives Autoritätsmodell |
| **Channel Overwrites (Allow/Deny/Inherit)** | Maximale Flexibilität pro Channel |
| **@everyone als Basis** | Einfacher Default-Mechanismus |
| **Owner = ALL** | Unumgehbar, verhindert Lock-outs |
| **ADMINISTRATOR-Bypass** | Notwendig für effiziente Verwaltung |
| **Kategorie-Sync** | Spart enorm viel Konfigurationsarbeit |
| **Snowflake IDs** | Zeitlich sortierbar, effizient |

### 9.2 Verbesserungspotenziale

| Discord-Schwäche | Valhalla-Verbesserung | Aufwand |
|-----------------|----------------------|---------|
| **Allow gewinnt immer über Deny bei Rollen-Konflikten** | Option: "Höchste Rolle gewinnt" ODER visueller Konflikt-Warner in der UI | K2 |
| **Max 250 Rollen** | Höheres Limit oder dynamisch (nach Server-Tier) | K1 |
| **Kein Permission-Template-System** | Vordefinierte Rollen-Templates (Admin, Mod, Member, Guest) | K1 |
| **Kein Permission-Audit / -Simulation** | "Teste als User X" Funktion — zeigt berechnete Permissions | K2 |
| **Keine zeitbasierten Permissions** | Temporäre Rollen mit Ablaufdatum (z.B. "Gast für 7 Tage") | K2 |
| **Keine verschachtelten Kategorien** | 2-Level Kategorie-Hierarchie für große Server | K2 |
| **Kein visueller Permission-Debugger** | "Warum kann User X das nicht?" — zeigt Berechnungsschritte | K2 |
| **Keine Rollen-Gruppen** | Rollen in Gruppen organisieren (z.B. "Mod-Rollen", "Farb-Rollen") | K1 |
| **Keine Channel-Permission-Presets** | "Read-only", "Announcement", "Voice-only" als 1-Click-Setup | K1 |
| **Keine granulare Bot-Permission-Scope** | Bots auf bestimmte Channels/Kategorien beschränken (nicht nur über Overrides) | K2 |

### 9.3 Zusätzliche Permissions für Valhalla (Business-Features)

| Permission | Bit | Zweck |
|-----------|-----|-------|
| `MANAGE_KANBAN` | 53 | Kanban-Boards in Channels erstellen/bearbeiten |
| `MANAGE_WIKI` | 54 | Wiki-Seiten erstellen/bearbeiten/löschen |
| `CREATE_POLLS` | 55 | Erweiterte Umfragen erstellen |
| `MANAGE_CALENDAR` | 56 | Kalender-Events erstellen/bearbeiten |
| `VIEW_ANALYTICS` | 57 | Server-Analytics/Insights einsehen |
| `MANAGE_AUTOMATIONS` | 58 | No-Code Automatisierungen erstellen |
| `MANAGE_COMPLIANCE` | 59 | Compliance-/Retention-Policies verwalten |
| `INVITE_GUESTS` | 60 | Temporäre Gäste einladen |
| `RECORD_VOICE` | 61 | Voice-Sessions aufnehmen |
| `USE_AI_FEATURES` | 62 | AI-Zusammenfassungen, Transkription nutzen |

### 9.4 Empfohlene Default-Rollen-Templates

```
┌─────────────────────────────────────────────────────────┐
│ TEMPLATE: Community Server                               │
│                                                         │
│ @everyone:                                              │
│   VIEW_CHANNEL, SEND_MESSAGES, READ_MESSAGE_HISTORY,    │
│   ADD_REACTIONS, CONNECT, SPEAK, USE_VAD, STREAM,       │
│   CREATE_INSTANT_INVITE, CREATE_PUBLIC_THREADS,          │
│   SEND_MESSAGES_IN_THREADS, EMBED_LINKS, ATTACH_FILES,  │
│   USE_APPLICATION_COMMANDS, CHANGE_NICKNAME,             │
│   USE_EXTERNAL_EMOJIS, SEND_VOICE_MESSAGES, SEND_POLLS  │
│                                                         │
│ Moderator (Template):                                   │
│   + KICK_MEMBERS, BAN_MEMBERS, MODERATE_MEMBERS,        │
│   + MANAGE_MESSAGES, MANAGE_THREADS, MANAGE_NICKNAMES,  │
│   + MUTE_MEMBERS, DEAFEN_MEMBERS, MOVE_MEMBERS,         │
│   + MENTION_EVERYONE, VIEW_AUDIT_LOG, PIN_MESSAGES,     │
│   + BYPASS_SLOWMODE                                     │
│                                                         │
│ Administrator (Template):                               │
│   + ADMINISTRATOR                                       │
│   (alle Permissions, umgeht Channel Overwrites)         │
│                                                         │
│ Guest (Template — Valhalla-NEU):                        │
│   VIEW_CHANNEL (nur bestimmte Channels),                │
│   SEND_MESSAGES, READ_MESSAGE_HISTORY, ADD_REACTIONS,   │
│   CONNECT, SPEAK                                        │
│   (kein INVITE, kein THREAD, kein ATTACH, temporär)     │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Zusammenfassung: Kernpunkte für die Implementierung

| # | Kernpunkt | Priorität |
|---|-----------|-----------|
| 1 | **49 Permission Bits als int64/BigInt Bitfeld** — exakt wie Discord | MVP |
| 2 | **Rollen mit Position (Hierarchie)** — Position bestimmt Rang | MVP |
| 3 | **@everyone als Basis-Rolle** — ID = Guild-ID | MVP |
| 4 | **Channel Overwrites (Allow/Deny/Inherit)** — 3 Typen: everyone, role, member | MVP |
| 5 | **7-Schritt-Berechnungsalgorithmus** — exakt nachimplementieren | MVP |
| 6 | **ADMINISTRATOR-Bypass** — umgeht alles außer Hierarchie | MVP |
| 7 | **Owner = ALL** — immer, unumgehbar | MVP |
| 8 | **Hierarchie-Constraints** — Kick/Ban/Rolle nur nach unten | MVP |
| 9 | **Kategorie-Sync** — Channels erben Overwrites von Kategorie | MVP |
| 10 | **Implicit Dependencies** — VIEW_CHANNEL/CONNECT als Gate | MVP |
| 11 | **Timeout-Override** — nur VIEW + READ_HISTORY | Phase 2 |
| 12 | **Thread-Vererbung** — SEND_MESSAGES_IN_THREADS separat | Phase 2 |
| 13 | **Permission-Caching** — aggressiv cachen, bei Änderung invalidieren | MVP |
| 14 | **Permission-Templates** — Vordefinierte Rollen-Sets | Phase 2 |
| 15 | **Permission-Debugger** — "Teste als User X" | Phase 3 |
| 16 | **Business-Permissions** — Kanban, Wiki, Calendar etc. | Phase 6 |
