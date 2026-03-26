# Discord Berechtigungssystem -- Umfassendes technisches Referenzdokument

---

## 1. Uebersicht: Bitfeld-Kodierung von Berechtigungen

Discord speichert Berechtigungen als Ganzzahlen variabler Laenge, die als Zeichenketten serialisiert werden. Seit API v8 werden alle Berechtigungswerte (einschliesslich der `allow`- und `deny`-Felder in Ueberschreibungen) als Strings uebertragen.

### Bitweise Operationen

- **Kombinieren** von Berechtigungen: `gesamtBerechtigungen = berechtigung1 | berechtigung2` (bitweises ODER)
- **Pruefen** einer Berechtigung: `(berechtigungen & flag) == flag` (bitweises UND)
- **Entfernen** einer Berechtigung: `berechtigungen & ~flag` (bitweises UND mit Negation)

Jede Position im Bitfeld repraesentiert ein einzelnes Berechtigungs-Flag. Der Zustand 1 bedeutet "gewaehrt", der Zustand 0 bedeutet "nicht gewaehrt".

---

## 2. Vollstaendige Liste aller Discord-Berechtigungs-Flags

Kanaltyp-Abkuerzungen: **T** = Text, **V** = Voice (Sprache), **S** = Stage (Buehne)

| Berechtigungsname | Hex-Wert | Bit-Position | Dezimalwert | Beschreibung | Kanaltyp |
|---|---|---|---|---|---|
| `CREATE_INSTANT_INVITE` | `0x0000000000000001` | 1 << 0 | 1 | Erlaubt das Erstellen von Sofort-Einladungen | T, V, S |
| `KICK_MEMBERS` | `0x0000000000000002` | 1 << 1 | 2 | Erlaubt das Kicken von Mitgliedern (*) | -- |
| `BAN_MEMBERS` | `0x0000000000000004` | 1 << 2 | 4 | Erlaubt das Bannen von Mitgliedern (*) | -- |
| `ADMINISTRATOR` | `0x0000000000000008` | 1 << 3 | 8 | Gewaehrt alle Berechtigungen und umgeht Kanal-Ueberschreibungen (*) | -- |
| `MANAGE_CHANNELS` | `0x0000000000000010` | 1 << 4 | 16 | Erlaubt das Verwalten und Bearbeiten von Kanaelen (*) | T, V, S |
| `MANAGE_GUILD` | `0x0000000000000020` | 1 << 5 | 32 | Erlaubt das Verwalten und Bearbeiten des Servers (*) | -- |
| `ADD_REACTIONS` | `0x0000000000000040` | 1 << 6 | 64 | Erlaubt das Hinzufuegen von Reaktionen zu Nachrichten | T, V, S |
| `VIEW_AUDIT_LOG` | `0x0000000000000080` | 1 << 7 | 128 | Erlaubt das Einsehen des Audit-Logs | -- |
| `PRIORITY_SPEAKER` | `0x0000000000000100` | 1 << 8 | 256 | Erlaubt die Nutzung als priorisierter Sprecher in Sprachkanaelen | V |
| `STREAM` | `0x0000000000000200` | 1 << 9 | 512 | Erlaubt dem Benutzer, live zu streamen (Go Live) | V, S |
| `VIEW_CHANNEL` | `0x0000000000000400` | 1 << 10 | 1024 | Erlaubt das Sehen von Kanaelen und Lesen von Nachrichten | T, V, S |
| `SEND_MESSAGES` | `0x0000000000000800` | 1 << 11 | 2048 | Erlaubt das Senden von Nachrichten und Erstellen von Threads | T, V, S |
| `SEND_TTS_MESSAGES` | `0x0000000000001000` | 1 << 12 | 4096 | Erlaubt das Senden von Text-zu-Sprache-Nachrichten | T, V, S |
| `MANAGE_MESSAGES` | `0x0000000000002000` | 1 << 13 | 8192 | Erlaubt das Loeschen und Anheften von Nachrichten anderer Benutzer (*) | T, V, S |
| `EMBED_LINKS` | `0x0000000000004000` | 1 << 14 | 16384 | Gesendete Links werden automatisch eingebettet | T, V, S |
| `ATTACH_FILES` | `0x0000000000008000` | 1 << 15 | 32768 | Erlaubt das Hochladen von Bildern und Dateien | T, V, S |
| `READ_MESSAGE_HISTORY` | `0x0000000000010000` | 1 << 16 | 65536 | Erlaubt das Lesen des Nachrichtenverlaufs | T, V, S |
| `MENTION_EVERYONE` | `0x0000000000020000` | 1 << 17 | 131072 | Erlaubt die Verwendung von @everyone und @here | T, V, S |
| `USE_EXTERNAL_EMOJIS` | `0x0000000000040000` | 1 << 18 | 262144 | Erlaubt die Verwendung benutzerdefinierter Emojis anderer Server | T, V, S |
| `VIEW_GUILD_INSIGHTS` | `0x0000000000080000` | 1 << 19 | 524288 | Erlaubt das Einsehen von Server-Statistiken | -- |
| `CONNECT` | `0x0000000000100000` | 1 << 20 | 1048576 | Erlaubt das Beitreten zu Sprachkanaelen | V, S |
| `SPEAK` | `0x0000000000200000` | 1 << 21 | 2097152 | Erlaubt das Sprechen in Sprachkanaelen | V |
| `MUTE_MEMBERS` | `0x0000000000400000` | 1 << 22 | 4194304 | Erlaubt das Stummschalten von Mitgliedern in Sprachkanaelen | V, S |
| `DEAFEN_MEMBERS` | `0x0000000000800000` | 1 << 23 | 8388608 | Erlaubt das Taub-Schalten von Mitgliedern in Sprachkanaelen | V |
| `MOVE_MEMBERS` | `0x0000000001000000` | 1 << 24 | 16777216 | Erlaubt das Verschieben von Mitgliedern zwischen Sprachkanaelen | V, S |
| `USE_VAD` | `0x0000000002000000` | 1 << 25 | 33554432 | Erlaubt die Nutzung von Sprachaktivitaetserkennung (Voice Activity Detection) | V |
| `CHANGE_NICKNAME` | `0x0000000004000000` | 1 << 26 | 67108864 | Erlaubt das Aendern des eigenen Spitznamens | -- |
| `MANAGE_NICKNAMES` | `0x0000000008000000` | 1 << 27 | 134217728 | Erlaubt das Aendern der Spitznamen anderer Mitglieder | -- |
| `MANAGE_ROLES` | `0x0000000010000000` | 1 << 28 | 268435456 | Erlaubt das Verwalten und Bearbeiten von Rollen (*) | T, V, S |
| `MANAGE_WEBHOOKS` | `0x0000000020000000` | 1 << 29 | 536870912 | Erlaubt das Verwalten und Bearbeiten von Webhooks (*) | T, V, S |
| `MANAGE_GUILD_EXPRESSIONS` | `0x0000000040000000` | 1 << 30 | 1073741824 | Erlaubt das Bearbeiten/Loeschen von Emojis, Stickern und Sounds (*) | -- |
| `USE_APPLICATION_COMMANDS` | `0x0000000080000000` | 1 << 31 | 2147483648 | Erlaubt die Nutzung von Slash- und Kontextmenue-Befehlen | T, V, S |
| `REQUEST_TO_SPEAK` | `0x0000000100000000` | 1 << 32 | 4294967296 | Erlaubt das Bitten um Sprechrecht in Buehnen-Kanaelen | S |
| `MANAGE_EVENTS` | `0x0000000200000000` | 1 << 33 | 8589934592 | Erlaubt das Bearbeiten und Loeschen geplanter Events (*) | V, S |
| `MANAGE_THREADS` | `0x0000000400000000` | 1 << 34 | 17179869184 | Erlaubt das Loeschen und Archivieren von Threads (*) | T |
| `CREATE_PUBLIC_THREADS` | `0x0000000800000000` | 1 << 35 | 34359738368 | Erlaubt das Erstellen oeffentlicher und Ankuendigungs-Threads | T |
| `CREATE_PRIVATE_THREADS` | `0x0000001000000000` | 1 << 36 | 68719476736 | Erlaubt das Erstellen privater Threads | T |
| `USE_EXTERNAL_STICKERS` | `0x0000002000000000` | 1 << 37 | 137438953472 | Erlaubt die Verwendung benutzerdefinierter Sticker anderer Server | T, V, S |
| `SEND_MESSAGES_IN_THREADS` | `0x0000004000000000` | 1 << 38 | 274877906944 | Erlaubt das Senden von Nachrichten in Threads | T |
| `USE_EMBEDDED_ACTIVITIES` | `0x0000008000000000` | 1 << 39 | 549755813888 | Erlaubt die Nutzung eingebetteter Aktivitaeten (Activities) | V |
| `MODERATE_MEMBERS` | `0x0000010000000000` | 1 << 40 | 1099511627776 | Erlaubt das Timeout-Setzen von Benutzern (*) | -- |
| `VIEW_CREATOR_MONETIZATION_ANALYTICS` | `0x0000020000000000` | 1 << 41 | 2199023255552 | Erlaubt das Einsehen von Rollen-Abonnement-Statistiken | -- |
| `USE_SOUNDBOARD` | `0x0000040000000000` | 1 << 42 | 4398046511104 | Erlaubt die Nutzung des Soundboards in Sprachkanaelen | V |
| `CREATE_GUILD_EXPRESSIONS` | `0x0000080000000000` | 1 << 43 | 8796093022208 | Erlaubt das Erstellen von Emojis, Stickern und Sounds | -- |
| `CREATE_EVENTS` | `0x0000100000000000` | 1 << 44 | 17592186044416 | Erlaubt das Erstellen geplanter Events | V, S |
| `USE_EXTERNAL_SOUNDS` | `0x0000200000000000` | 1 << 45 | 35184372088832 | Erlaubt die Nutzung benutzerdefinierter Sounds anderer Server | V |
| `SEND_VOICE_MESSAGES` | `0x0000400000000000` | 1 << 46 | 70368744177664 | Erlaubt das Senden von Sprachnachrichten | T, V, S |
| `SEND_POLLS` | `0x0002000000000000` | 1 << 49 | 562949953421312 | Erlaubt das Senden von Umfragen | T, V, S |
| `USE_EXTERNAL_APPS` | `0x0004000000000000` | 1 << 50 | 1125899906842624 | Erlaubt benutzerinstallierten Apps das Senden von Antworten | T, V, S |
| `PIN_MESSAGES` | `0x0008000000000000` | 1 << 51 | 2251799813685248 | Erlaubt das Anpinnen und Entpinnen von Nachrichten | T |
| `BYPASS_SLOWMODE` | `0x0010000000000000` | 1 << 52 | 4503599627370496 | Erlaubt das Umgehen von Slowmode-Einschraenkungen | T, V, S |

**Hinweis zu (*):** Berechtigungen, die mit (*) markiert sind, erfordern bei aktivierter serverweiter Zwei-Faktor-Authentifizierung (2FA) auch beim ausfuehrenden Benutzer aktivierte 2FA. Diese werden als "gefaehrliche Berechtigungen" eingestuft.

**Hinweis zu Bit 47 und 48:** Das Flag `USE_CLYDE_AI` (1 << 47) wurde als veraltet entfernt. Bit 48 ist derzeit unbelegt.

### Benennung im Discord-Client vs. API

Einige Berechtigungen tragen im Client andere Namen:
- "Berechtigungen verwalten" = `MANAGE_ROLES`
- "Sprachaktivitaet verwenden" = `USE_VAD`
- "Mitglieder in Timeout setzen" = `MODERATE_MEMBERS`

---

## 3. Rollenrangordnung (Rollenhierarchie)

### Positionsbasiertes System

Rollen in Discord sind nach Position geordnet. Je hoeher die Positionsnummer, desto hoeher der Rang der Rolle. Die @everyone-Rolle hat immer die niedrigste Position (Position 0).

### Hierarchieregeln

Die Rollenhierarchie bestimmt folgende Einschraenkungen:

1. **Rollen vergeben:** Ein Benutzer (oder Bot) kann nur Rollen vergeben, die niedriger positioniert sind als seine eigene hoechste Rolle.
2. **Rollen bearbeiten:** Nur Rollen unterhalb der eigenen hoechsten Rolle koennen bearbeitet werden, und es koennen dabei nur Berechtigungen vergeben werden, die der bearbeitende Benutzer selbst besitzt.
3. **Rollen sortieren:** Nur Rollen unterhalb der eigenen hoechsten Rolle koennen umsortiert werden.
4. **Kicken/Bannen:** Benutzer koennen nur Mitglieder kicken oder bannen, deren hoechste Rolle niedriger positioniert ist als die eigene hoechste Rolle.
5. **Spitznamen bearbeiten:** Nur bei Mitgliedern moeglich, deren hoechste Rolle niedriger ist als die eigene.

### Wichtige Ausnahme: Erlauben gewinnt ueber Verweigern

Ein kritischer Aspekt des Discord-Berechtigungssystems: **Berechtigungen folgen NICHT der Rollenhierarchie bei der Berechnung.** Wenn ein Benutzer zwei Rollen hat -- eine, die eine Berechtigung verweigert, und eine, die sie erlaubt -- erhaelt der Benutzer die Berechtigung, unabhaengig von der Rollenposition. Dies gilt fuer die Berechnung auf Kanalebene bei Rollen-Ueberschreibungen.

---

## 4. Kanal-Berechtigungsueberschreibungen (Permission Overwrites)

### Struktur eines Overwrite-Objekts

```
Overwrite-Objekt:
  id        : Snowflake    (Rollen-ID oder Benutzer-ID)
  type      : Integer      (0 = Rolle, 1 = Mitglied)
  allow     : String       (Bitfeld erlaubter Berechtigungen)
  deny      : String       (Bitfeld verweigerter Berechtigungen)
```

### Drei Zustaende pro Berechtigung

Fuer jede Berechtigung in einer Ueberschreibung gibt es drei moegliche Zustaende:

1. **Erlaubt (Allow):** Das Bit ist im `allow`-Feld gesetzt -- die Berechtigung wird explizit gewaehrt.
2. **Verweigert (Deny):** Das Bit ist im `deny`-Feld gesetzt -- die Berechtigung wird explizit verweigert.
3. **Vererbt/Neutral (Inherit):** Das Bit ist weder in `allow` noch in `deny` gesetzt -- die Berechtigung wird von der naechsthoeeheren Ebene uebernommen (Server-Berechtigung oder Kategorie).

### Anwendungsreihenfolge der Ueberschreibungen

Die Ueberschreibungen werden in folgender strikter Reihenfolge angewandt:

1. Server-Basis-Berechtigungen (alle Rollen-Berechtigungen ODER-verknuepft)
2. @everyone-Kanal-Ueberschreibung: `deny` wird angewandt
3. @everyone-Kanal-Ueberschreibung: `allow` wird angewandt
4. Rollen-spezifische Kanal-Ueberschreibungen: alle `deny` werden ODER-verknuepft und angewandt
5. Rollen-spezifische Kanal-Ueberschreibungen: alle `allow` werden ODER-verknuepft und angewandt
6. Mitglieder-spezifische Kanal-Ueberschreibung: `deny` wird angewandt
7. Mitglieder-spezifische Kanal-Ueberschreibung: `allow` wird angewandt

Spaetere Schritte ueberschreiben fruehere. Mitglieder-spezifische Ueberschreibungen haben daher die hoechste Prioritaet.

---

## 5. Exakter Algorithmus zur Berechtigungsberechnung

### Schritt 1: Basisberechtigungen berechnen

```python
def compute_base_permissions(member, guild):
    # Servereigentuemer erhaelt IMMER alle Berechtigungen
    if guild.is_owner(member):
        return ALL   # Alle Bits gesetzt

    # Starte mit den Berechtigungen der @everyone-Rolle
    role_everyone = guild.get_role(guild.id)  # @everyone hat dieselbe ID wie der Server
    permissions = role_everyone.permissions

    # ODER-Verknuepfung aller Rollen-Berechtigungen des Mitglieds
    for role in member.roles:
        permissions |= role.permissions

    # Wenn ADMINISTRATOR gesetzt ist, gewaehre alle Berechtigungen
    if permissions & ADMINISTRATOR == ADMINISTRATOR:
        return ALL

    return permissions
```

### Schritt 2: Kanal-Ueberschreibungen anwenden

```python
def compute_overwrites(base_permissions, member, channel):
    # ADMINISTRATOR umgeht ALLE Kanal-Ueberschreibungen
    if base_permissions & ADMINISTRATOR == ADMINISTRATOR:
        return ALL

    permissions = base_permissions

    # 1. @everyone-Ueberschreibung anwenden
    overwrite_everyone = channel.overwrites.get(channel.guild_id)
    if overwrite_everyone:
        permissions &= ~overwrite_everyone.deny    # Verweigerungen entfernen
        permissions |= overwrite_everyone.allow     # Erlaubnisse hinzufuegen

    # 2. Alle Rollen-Ueberschreibungen sammeln und anwenden
    allow = NONE  # 0
    deny = NONE   # 0
    for role_id in member.roles:
        overwrite_role = channel.overwrites.get(role_id)
        if overwrite_role:
            allow |= overwrite_role.allow
            deny |= overwrite_role.deny

    permissions &= ~deny    # Alle Rollen-Verweigerungen entfernen
    permissions |= allow    # Alle Rollen-Erlaubnisse hinzufuegen

    # 3. Mitglieder-spezifische Ueberschreibung anwenden (hoechste Prioritaet)
    overwrite_member = channel.overwrites.get(member.user_id)
    if overwrite_member:
        permissions &= ~overwrite_member.deny
        permissions |= overwrite_member.allow

    return permissions
```

### Zentrale Formel

Die grundlegende Formel fuer jede Ueberschreibungsebene lautet:

```
neue_berechtigungen = (aktuelle_berechtigungen & ~deny) | allow
```

Das bedeutet:
1. Entferne alle verweigerten Bits aus den aktuellen Berechtigungen
2. Fuege alle erlaubten Bits hinzu

---

## 6. Spezielle Rollen

### 6.1 Die @everyone-Rolle

- Jeder Server hat genau eine @everyone-Rolle.
- Ihre Snowflake-ID ist identisch mit der Server-ID.
- Jedes Mitglied hat automatisch die @everyone-Rolle (sie kann nicht entfernt werden).
- Sie bildet die Grundlage (Basis) fuer die Berechtigungsberechnung.
- Sie hat immer die niedrigste Position (Position 0) in der Rollenhierarchie.
- Kanal-Ueberschreibungen fuer @everyone werden zuerst angewandt (vor rollenspezifischen Ueberschreibungen).

### 6.2 Bot-verwaltete Rollen (Managed Roles)

- Wenn ein Bot einem Server hinzugefuegt wird, erstellt Discord automatisch eine verwaltete Rolle fuer diesen Bot.
- Diese Rolle hat das Feld `managed: true` im Rollen-Objekt.
- Das Feld `tags` im Rollen-Objekt enthaelt ein `bot_id`-Feld mit der Anwendungs-ID des Bots.
- Verwaltete Rollen koennen nicht manuell durch Benutzer zugewiesen oder entfernt werden.
- Die Position der verwalteten Rolle bestimmt, welche Aktionen der Bot ausfuehren kann (Rollenhierarchie).
- Bots koennen die Anzeigeeigenschaften ihrer eigenen verwalteten Rolle nicht direkt aendern, es sei denn, sie haben eine hoeherrangige Rolle.

### 6.3 Integrations-Rollen

- Rollen, die durch Server-Integrationen (z.B. Twitch, YouTube) erstellt werden.
- Ebenfalls `managed: true` mit einem `integration_id`-Tag.
- Koennen nicht manuell zugewiesen werden; sie werden automatisch basierend auf dem Integrationsstatus vergeben.

### 6.4 Premium-Abonnenten-Rolle (Booster-Rolle)

- Automatisch erstellte Rolle fuer Server-Booster.
- Gekennzeichnet durch das Tag `premium_subscriber: null` (das Vorhandensein des Schluessels genuegt).
- Wird automatisch zugewiesen/entfernt, wenn ein Mitglied den Server boostet/aufhoert zu boosten.

### 6.5 Verknuepfte Rollen (Linked Roles)

- Rollen, die ueber Application Role Connections konfiguriert werden.
- Ermoeglichen es Apps, Rollen basierend auf externen Plattform-Metadaten zuzuweisen.

---

## 7. Kategorie-Berechtigungen und Vererbung an Kindkanaele

### Berechtigungs-Synchronisation (Permission Syncing)

- Kategorien (Channel-Typ 4) koennen Berechtigungsueberschreibungen haben.
- Wenn ein Kanal unter einer Kategorie erstellt wird, uebernimmt er standardmaessig die Ueberschreibungen der Kategorie.
- Ein Kanal gilt als **synchronisiert**, wenn seine Berechtigungsueberschreibungen identisch mit denen der uebergeordneten Kategorie sind.

### Synchronisierungsverhalten

- **Synchronisierter Kanal:** Aenderungen an der Kategorie-Berechtigung werden automatisch an den Kanal weitergegeben.
- **De-Synchronisierung:** Sobald eine Berechtigungsueberschreibung eines synchronisierten Kanals manuell geaendert wird, ist der Kanal de-synchronisiert. Zukuenftige Aenderungen an der Kategorie wirken sich dann NICHT mehr auf diesen Kanal aus.
- **Re-Synchronisierung:** Ein Kanal kann durch Zuruecksetzen seiner Berechtigungen auf die der Kategorie wieder synchronisiert werden.

### Technisches Detail

- Die Synchronisierung ist rein clientseitig/serverseitig durch Vergleich der Overwrite-Arrays implementiert.
- Die API bietet kein explizites "synced"-Flag; der Synchronisierungsstatus wird durch Vergleich der Ueberschreibungen mit der Kategorie ermittelt.
- Bei Erstellung eines neuen Kanals in einer Kategorie kopiert Discord die Ueberschreibungen der Kategorie.

---

## 8. Thread-Berechtigungen und Vererbung vom Elternkanal

### Grundprinzip

Threads erben grundsaetzlich alle Berechtigungen von ihrem Elternkanal. Es gibt jedoch eine wichtige Abweichung:

### SEND_MESSAGES vs. SEND_MESSAGES_IN_THREADS

- Threads verwenden `SEND_MESSAGES_IN_THREADS` (1 << 38) anstelle von `SEND_MESSAGES` (1 << 11).
- Ein Benutzer benoetigt `SEND_MESSAGES_IN_THREADS`, um in einem Thread schreiben zu koennen -- selbst wenn er `SEND_MESSAGES` im Elternkanal hat.
- Dies ermoeglicht Szenarien wie Ankuendigungskanaele, in denen nur bestimmte Personen neue Nachrichten senden koennen, aber alle in den daraus erstellten Threads antworten duerfen.

### Sichtbarkeit

- `VIEW_CHANNEL` muss fuer den Elternkanal gewaehrt sein, damit ein Benutzer Threads sehen kann.
- Selbst wenn ein Benutzer direkt erwaehnt oder einem Thread hinzugefuegt wird, kann er den Thread NICHT sehen, wenn `VIEW_CHANNEL` fuer den Elternkanal verweigert ist.

### Kein eigenes Overwrite-System

- Threads haben KEINE eigenen Berechtigungsueberschreibungen.
- Die einzige thread-spezifische Einstellung ist Slowmode, die unabhaengig vom Elternkanal konfiguriert werden kann.
- Nur Moderatoren mit `MANAGE_THREADS` koennen die Thread-spezifische Slowmode anpassen.

### Relevante Thread-Berechtigungen

| Berechtigung | Funktion |
|---|---|
| `MANAGE_THREADS` | Loeschen, Archivieren, Bearbeiten von Threads |
| `CREATE_PUBLIC_THREADS` | Erstellen oeffentlicher und Ankuendigungs-Threads |
| `CREATE_PRIVATE_THREADS` | Erstellen privater Threads |
| `SEND_MESSAGES_IN_THREADS` | Nachrichten in Threads senden |

---

## 9. Forum-Kanal-Berechtigungen

Forum-Kanaele (thread-only channels) sind spezielle Kanaele, in denen jeder Beitrag automatisch einen Thread erstellt.

### Berechtigungsverhalten

- Forum-Kanaele verwenden dasselbe Berechtigungsmodell wie normale Textkanaele.
- Threads in Forum-Kanaelen erben alle Berechtigungen vom Forum-Kanal.
- `SEND_MESSAGES` im Forum-Kanal erlaubt das Erstellen neuer Forum-Beitraege (neue Threads).
- `SEND_MESSAGES_IN_THREADS` erlaubt das Antworten in bestehenden Forum-Beitraegen.

### Spezifische Konfigurationsmoeglichkeiten

- Standard-Slowmode fuer neue Threads kann auf Kanalebene festgelegt werden.
- Tags und Sortierungsoptionen sind Forum-spezifisch, aber nicht berechtigungsgesteuert (ausser `MANAGE_CHANNELS` fuer die Konfiguration).

---

## 10. Buehnenkanal-spezifische Berechtigungen (Stage Channel)

Buehnenkanale sind ein spezieller Sprachkanaltyp mit einer Sprecher/Publikum-Aufteilung.

### Rollenstruktur in Buehnenkanelen

| Rolle | Beschreibung |
|---|---|
| **Buehnen-Moderator** | Kann das Thema setzen, die Buehne oeffnen, Sprecher hinzufuegen/stummschalten/entfernen |
| **Sprecher** | Kann in der Buehne reden |
| **Publikum** | Kann nur zuhoeren; standardmaessig stummgeschaltet |

### Relevante Berechtigungen

| Berechtigung | Funktion im Buehnenkanal |
|---|---|
| `CONNECT` (1 << 20) | Dem Buehnenkanal als Publikum beitreten |
| `MUTE_MEMBERS` (1 << 22) | Mitglieder stummschalten; macht den Benutzer zum Buehnen-Moderator |
| `MOVE_MEMBERS` (1 << 24) | Mitglieder verschieben; macht den Benutzer zum Buehnen-Moderator |
| `REQUEST_TO_SPEAK` (1 << 32) | Hand heben und um Sprechrecht bitten |
| `STREAM` (1 << 9) | Live-Streaming im Buehnenkanal |
| `MANAGE_CHANNELS` (1 << 4) | Buehnenkanal-Thema setzen; macht den Benutzer zum Buehnen-Moderator |

### Buehnen-Moderator werden

Ein Benutzer wird automatisch Buehnen-Moderator, wenn er eine der folgenden Berechtigungen fuer den Buehnenkanal hat:
- `MANAGE_CHANNELS`
- `MUTE_MEMBERS`
- `MOVE_MEMBERS`

Buehnen-Moderatoren koennen sich selbst als Sprecher aufstellen, waehrend alle anderen Benutzer erst um Sprechrecht bitten muessen (und die Genehmigung eines Moderators benoetigen).

---

## 11. Sprachkanal-spezifische Berechtigungen (Voice Channel)

### Exklusive Sprachkanal-Berechtigungen

| Berechtigung | Funktion |
|---|---|
| `CONNECT` (1 << 20) | Dem Sprachkanal beitreten |
| `SPEAK` (1 << 21) | Im Sprachkanal sprechen |
| `MUTE_MEMBERS` (1 << 22) | Andere Mitglieder stummschalten |
| `DEAFEN_MEMBERS` (1 << 23) | Andere Mitglieder taub schalten |
| `MOVE_MEMBERS` (1 << 24) | Mitglieder in andere Sprachkanaele verschieben |
| `USE_VAD` (1 << 25) | Sprachaktivitaetserkennung statt Push-to-Talk verwenden |
| `PRIORITY_SPEAKER` (1 << 8) | Als priorisierter Sprecher agieren (andere werden leiser) |
| `STREAM` (1 << 9) | Bildschirm/Kamera teilen (Go Live) |
| `USE_EMBEDDED_ACTIVITIES` (1 << 39) | Eingebettete Aktivitaeten (Discord Activities) nutzen |
| `USE_SOUNDBOARD` (1 << 42) | Soundboard verwenden |
| `USE_EXTERNAL_SOUNDS` (1 << 45) | Sounds anderer Server im Soundboard verwenden |

### Sprachkanal-Textchat

Seit dem Update zu Textchat in Sprachkanaelen gelten auch textbasierte Berechtigungen (SEND_MESSAGES, EMBED_LINKS, etc.) fuer Sprachkanaele.

---

## 12. Berechtigungsstufen: Administrator, Moderator, Mitglied

### Stufe 1: Serverbesitzer (hoechste Autoritaet)

- Hat immer ALLE Berechtigungen, unabhaengig von Rollen oder Ueberschreibungen.
- Kann NICHT durch Berechtigungsueberschreibungen eingeschraenkt werden.
- Ist immun gegen Timeout.
- Einziger Benutzer, der den Server loeschen oder uebertragen kann.

### Stufe 2: Administrator (ADMINISTRATOR-Berechtigung)

- Erhaelt alle Berechtigungen (alle Bits gesetzt).
- Umgeht alle Kanal-Ueberschreibungen vollstaendig.
- Kann keine Aktionen gegen den Serverbesitzer oder Benutzer mit gleichrangigen/hoeherrangigen Rollen ausfuehren (Rollenhierarchie gilt weiterhin).
- Ist immun gegen Timeout.
- Bei serverweiter 2FA-Pflicht muss der Administrator selbst 2FA aktiviert haben.

### Stufe 3: Moderator (typische Berechtigungskombination)

Moderatoren haben typischerweise einige der folgenden Berechtigungen:
- `KICK_MEMBERS`, `BAN_MEMBERS`
- `MANAGE_MESSAGES`, `MANAGE_THREADS`
- `MODERATE_MEMBERS` (Timeout)
- `MANAGE_CHANNELS`, `MANAGE_ROLES`
- `MUTE_MEMBERS`, `DEAFEN_MEMBERS`, `MOVE_MEMBERS`

Moderatoren sind durch die Rollenhierarchie eingeschraenkt und koennen nur Mitglieder mit niedrigeren Rollen moderieren.

### Stufe 4: Mitglied (Standardberechtigungen)

- Erhaelt nur die Berechtigungen der @everyone-Rolle und eventueller zugewiesener Rollen.
- Unterliegt allen Kanal-Ueberschreibungen.
- Typische Berechtigungen: VIEW_CHANNEL, SEND_MESSAGES, ADD_REACTIONS, READ_MESSAGE_HISTORY, CONNECT, SPEAK.

---

## 13. Berechtigungsabhaengigkeiten (Permission Dependencies)

### Implizite Verweigerungen

Discord wendet bestimmte Berechtigungsabhaengigkeiten implizit an:

#### VIEW_CHANNEL verweigert -> Alles blockiert
Wenn `VIEW_CHANNEL` fuer einen Kanal verweigert ist, werden ALLE anderen kanalbezogenen Berechtigungen implizit verweigert. Der Benutzer kann den Kanal weder sehen noch in irgendeiner Weise damit interagieren.

#### SEND_MESSAGES verweigert -> Folgende Berechtigungen implizit blockiert:
- `MENTION_EVERYONE`
- `SEND_TTS_MESSAGES`
- `ATTACH_FILES`
- `EMBED_LINKS`

#### CONNECT verweigert (Sprach-/Buehnenkanal) -> Folgende Berechtigungen implizit blockiert:
- `SPEAK`
- `MUTE_MEMBERS`
- `DEAFEN_MEMBERS`
- `MOVE_MEMBERS`
- `USE_VAD`
- `PRIORITY_SPEAKER`
- `STREAM`
- `USE_SOUNDBOARD`
- `USE_EMBEDDED_ACTIVITIES`
- und weitere sprachbezogene Berechtigungen

### Logische Abhaengigkeiten (nicht automatisch erzwungen)

Einige Berechtigungen sind logisch voneinander abhaengig, werden aber nicht automatisch von Discord durchgesetzt:
- `MANAGE_ROLES` ist nur fuer Rollen unterhalb der eigenen hoechsten Rolle wirksam.
- `MANAGE_CHANNELS` ermoeglicht das Bearbeiten von Kanaelen, einschliesslich deren Berechtigungsueberschreibungen.

---

## 14. Implizite Berechtigungen

### Serverbesitzer

- Der Serverbesitzer hat IMMER alle Berechtigungen, unabhaengig von seinen Rollen.
- Im Algorithmus: `if guild.is_owner(member): return ALL`
- Dies kann durch keinerlei Ueberschreibungen ausser Kraft gesetzt werden.

### ADMINISTRATOR-Flag

- Benutzer mit `ADMINISTRATOR` (1 << 3) erhalten automatisch alle Berechtigungen.
- Der Algorithmus prueft dies auf zwei Ebenen:
  1. Bei Basisberechtigungen: Wenn ADMINISTRATOR gesetzt -> `return ALL`
  2. Bei Ueberschreibungen: Wenn Basisberechtigungen ADMINISTRATOR enthalten -> `return ALL` (Ueberschreibungen werden komplett uebersprungen)

### Timeout-Einschraenkung

- Mitglieder im Timeout verlieren temporaer ALLE Berechtigungen ausser:
  - `VIEW_CHANNEL`
  - `READ_MESSAGE_HISTORY`
- Ausnahmen: Serverbesitzer und Benutzer mit ADMINISTRATOR sind von Timeout-Einschraenkungen ausgenommen.

---

## 15. Bitfeld-Kodierung im Detail

### Speicherformat

```
Berechtigungswert (String): "1099511627775"
Binaerdarstellung: 1111111111111111111111111111111111111111
                   ^-- Bit 39                            ^-- Bit 0
```

### Beispielberechnungen

**Beispiel 1: Grundlegende Mitglieds-Berechtigungen berechnen**
```
@everyone-Berechtigungen:  VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY
                         = 0x400 | 0x800 | 0x10000
                         = 0x10C00
                         = 68608 (dezimal)

Moderator-Rolle:          KICK_MEMBERS | BAN_MEMBERS | MANAGE_MESSAGES
                         = 0x2 | 0x4 | 0x2000
                         = 0x2006
                         = 8198 (dezimal)

Basisberechtigungen:      68608 | 8198
                         = 76806 (dezimal)
                         = 0x12C06
```

**Beispiel 2: Kanal-Ueberschreibung anwenden**
```
Basisberechtigungen:      76806
@everyone deny:           SEND_MESSAGES = 0x800
@everyone allow:          (keine)
Rolle "Moderator" allow:  SEND_MESSAGES = 0x800

Schritt 1: basis & ~deny  = 76806 & ~2048 = 76806 & (-2049) = 74758
Schritt 2: | @everyone_allow = 74758 | 0 = 74758
Schritt 3: & ~role_deny = 74758 (keine Rollen-Verweigerungen)
Schritt 4: | role_allow = 74758 | 2048 = 76806

Ergebnis: Der Moderator kann trotz @everyone-Verweigerung weiterhin schreiben.
```

### BigInt-Verwendung

Da Berechtigungswerte ueber 2^31 hinausgehen koennen (z.B. 1 << 52 = 4503599627370496), muessen Programmiersprachen BigInt oder aehnliche Datentypen verwenden. JavaScript-Beispiel:

```javascript
const SEND_POLLS = 1n << 49n;  // BigInt-Notation
const permissions = BigInt("562949953421312");
const hatUmfragen = (permissions & SEND_POLLS) === SEND_POLLS;
```

---

## 16. Sonderfaelle und Randbedingungen (Edge Cases)

### 1. Leere Ueberschreibungen

Wenn sowohl `allow` als auch `deny` einer Ueberschreibung 0 sind, hat die Ueberschreibung keinen Effekt. Discord kann solche leeren Ueberschreibungen automatisch entfernen.

### 2. Widerspruechliche Rollen-Ueberschreibungen

Wenn zwei Rollen auf Kanalebene widerspruechliche Ueberschreibungen haben (eine erlaubt, eine verweigert), **gewinnt immer die Erlaubnis**, unabhaengig von der Rollenposition. Dies liegt daran, dass alle Rollen-`allow`-Werte ODER-verknuepft werden und nach den Rollen-`deny`-Werten angewandt werden.

```
deny  = rolleA.deny | rolleB.deny
allow = rolleA.allow | rolleB.allow
result = (permissions & ~deny) | allow  # allow wird NACH deny angewandt -> allow gewinnt
```

### 3. Mitglieder-Ueberschreibung hat hoechste Prioritaet

Eine mitglieder-spezifische Ueberschreibung (Typ 1) ueberschreibt immer alle Rollen-Ueberschreibungen, da sie als letztes im Algorithmus angewandt wird.

### 4. Maximaler Berechtigungswert

Der theoretische maximale Berechtigungswert waechst mit jedem neuen Permission-Flag. Derzeit (mit Bit 52 als hoechstem): Alle Bits von 0-52 gesetzt ergeben einen Wert von `2^53 - 1 = 9007199254740991` (abzueglich der Luecken bei Bit 47 und 48).

### 5. Berechtigungen fuer geloeschte Rollen

Wenn eine Rolle geloescht wird, werden ihre Ueberschreibungen in Kanaelen ebenfalls entfernt. Die Berechtigungen der betroffenen Benutzer werden sofort neu berechnet.

### 6. Neue Kanaele in Kategorien

Wenn ein neuer Kanal in einer Kategorie erstellt wird, kopiert Discord die Ueberschreibungen der Kategorie. Der Kanal ist dann anfaenglich synchronisiert.

### 7. Bot-Berechtigungen bei Einladung

Bei der OAuth2-Autorisierung werden die angeforderten Berechtigungen in der Bot-Rolle gespeichert. Diese Berechtigungen sind die Maximalberechtigungen -- sie koennen durch Kanal-Ueberschreibungen weiter eingeschraenkt werden.

### 8. Slowmode-Umgehung

Die Berechtigung `BYPASS_SLOWMODE` (1 << 52) ermoeglicht es, Slowmode-Einschraenkungen zu ignorieren. `MANAGE_CHANNELS` und `MANAGE_MESSAGES` gewaehren diese Umgehung ebenfalls implizit.

### 9. Gesperrte Kanaele (Locked Channels)

Es gibt keinen speziellen "gesperrt"-Status. Ein "gesperrter" Kanal wird typischerweise durch Verweigerung von `SEND_MESSAGES` fuer @everyone realisiert.

### 10. Berechtigungspruefung bei API-Aufrufen

Die Discord-API prueft Berechtigungen bei jedem API-Aufruf serverseitig. Fehlende Berechtigungen fuehren zu einem HTTP 403 Forbidden-Fehler mit dem Fehlercode 50013 ("Missing Permissions").

---

## Zusammenfassung der Berechtigungsberechnungskette

```
Serverbesitzer?
  |-- JA -> ALLE Berechtigungen (Ende)
  |-- NEIN:
      |
      Basisberechtigungen = @everyone.permissions
      Fuer jede Rolle des Mitglieds:
          Basisberechtigungen |= rolle.permissions
      |
      ADMINISTRATOR gesetzt?
      |-- JA -> ALLE Berechtigungen (Ende)
      |-- NEIN:
          |
          Kanalberechtigungen = Basisberechtigungen
          |
          @everyone-Ueberschreibung vorhanden?
          |-- JA -> Kanalberechtigungen = (Kanalberechtigungen & ~deny) | allow
          |
          Rollen-Ueberschreibungen sammeln:
              allow_gesamt |= rolle_overwrite.allow
              deny_gesamt  |= rolle_overwrite.deny
          Kanalberechtigungen = (Kanalberechtigungen & ~deny_gesamt) | allow_gesamt
          |
          Mitglieder-Ueberschreibung vorhanden?
          |-- JA -> Kanalberechtigungen = (Kanalberechtigungen & ~deny) | allow
          |
          Implizite Verweigerungen anwenden:
              VIEW_CHANNEL fehlt? -> Alle Kanalberechtigungen = 0
              SEND_MESSAGES fehlt? -> Abhaengige Berechtigungen entfernen
              CONNECT fehlt? -> Sprachberechtigungen entfernen
          |
          Timeout aktiv?
          |-- JA -> Nur VIEW_CHANNEL und READ_MESSAGE_HISTORY behalten
          |
          Ergebnis: Endgueltige Kanalberechtigungen
```

---

Quellen:
- [Discord Developer Documentation - Permissions](https://docs.discord.com/developers/topics/permissions)
- [Discord Permissions Calculator](https://discordapi.com/permissions.html)
- [Discord Roles and Permissions Support](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions)
- [Discord Stage Channels FAQ](https://support.discord.com/hc/en-us/articles/1500005513722-Stage-Channels-FAQ)
- [Discord Threads FAQ](https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ)
- [Discord Forum Channels FAQ](https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ)
- [Discord Permission Hierarchy Support](https://support.discord.com/hc/en-us/articles/206141927-How-is-the-permission-hierarchy-structured)
- [Discord Channel Permissions Settings 101](https://support.discord.com/hc/en-us/articles/10543994968087-Channel-Permissions-Settings-101)
