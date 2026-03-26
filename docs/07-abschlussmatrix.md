# 7. Abschlussmatrix

---

## Gesamtübersicht aller Bereiche

| # | Bereich | MVP | Produktion | Komplexität | Risiko | Bemerkung |
|---|---------|-----|-----------|-------------|--------|-----------|
| 1 | **Auth & Identity** | ✅ Ja | ✅ Ja | K2 Mittel | Mittel | MFA erst für Produktion; Session-Mgmt sofort |
| 2 | **User Profiles** | ✅ Basis | ✅ Voll | K1 Niedrig | Niedrig | MVP: Username + Avatar reicht |
| 3 | **Relationships (Friends)** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | DMs setzen Freundes-/DM-Kanäle voraus |
| 4 | **Guild/Server CRUD** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | Kern-Organisationseinheit |
| 5 | **Einladungssystem** | ✅ Basis | ✅ Voll | K1 Niedrig | Niedrig | MVP: einfache Links; Prod: Ablauf, Limits, Tracking |
| 6 | **Rollen & Permissions** | ✅ Basis | ✅ Voll | K4 Sehr hoch | Hoch | MVP: Server-Level; Prod: Channel Overrides, Hierarchie |
| 7 | **Text Channels** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | Kern-Feature |
| 8 | **Kategorien** | ✅ Ja | ✅ Ja | K1 Niedrig | Niedrig | Einfache Gruppierung |
| 9 | **Messaging** | ✅ Ja | ✅ Ja | K3 Hoch | Mittel | Skalierung ist das Risiko, nicht die Grundfunktion |
| 10 | **Replies** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | Einfach: message_reference Feld |
| 11 | **Threads** | ❌ Nein | ✅ Ja | K3 Hoch | Mittel | Eigene Channel-Subentität, eigene Unread-Logik |
| 12 | **Forum Channels** | ❌ Nein | ✅ Ja | K3 Hoch | Mittel | Komplexe Sortierung, Tags, Post-Modell |
| 13 | **Reactions** | ✅ Basis | ✅ Voll | K2 Mittel | Niedrig | MVP: Unicode; Prod: Custom Emoji |
| 14 | **File Upload** | ✅ Basis | ✅ Voll | K2 Mittel | Niedrig | MVP: Bilder; Prod: Videos, Limits, Processing |
| 15 | **Embeds / Link Preview** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | OpenGraph-Parser, Security (SSRF-Schutz) |
| 16 | **Suche** | ❌ Nein | ✅ Ja | K3 Hoch | Mittel | Elasticsearch, Permission-Filtering |
| 17 | **Markdown Rendering** | ✅ Basis | ✅ Voll | K2 Mittel | Niedrig | MVP: Bold/Italic/Code; Prod: Vollständig |
| 18 | **DMs** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | Spezialfall: Channel ohne Guild |
| 19 | **Gruppen-DMs** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Erweiterung der DM-Logik |
| 20 | **Voice Channels** | ✅ Basis | ✅ Ja | K4 Sehr hoch | Sehr hoch | Kern-Differenzierung; SFU ist komplex |
| 21 | **Video** | ❌ Nein | ✅ Ja | K4 Sehr hoch | Hoch | Aufbauend auf Voice-Infrastruktur |
| 22 | **Screen Share** | ❌ Nein | ✅ Ja | K4 Sehr hoch | Hoch | Hohe Auflösung, Application Capture |
| 23 | **Stage Channels** | ❌ Nein | ⚠️ Optional | K3 Hoch | Mittel | Nice-to-have für Events |
| 24 | **Presence** | ✅ Basis | ✅ Voll | K3 Hoch | Hoch | MVP: Online/Offline; Prod: Activity, Multi-Device |
| 25 | **Typing Indicators** | ✅ Ja | ✅ Ja | K1 Niedrig | Niedrig | Einfach, aber Throttling nötig |
| 26 | **Unread State** | ✅ Ja | ✅ Ja | K2 Mittel | Mittel | Konsistenz über Clients/Gateway |
| 27 | **Push Notifications** | ❌ Nein | ✅ Ja | K2 Mittel | Mittel | FCM/APNs Integration, Preferences |
| 28 | **Kick / Ban** | ✅ Ja | ✅ Ja | K1 Niedrig | Niedrig | Basis-Moderation |
| 29 | **Timeout** | ❌ Nein | ✅ Ja | K1 Niedrig | Niedrig | Temporäre Einschränkung |
| 30 | **AutoMod** | ❌ Nein | ✅ Ja | K3 Hoch | Mittel | Regelbasiert, inline bei Messages |
| 31 | **Audit Log** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Append-only, Filter-UI |
| 32 | **Content Moderation** | ❌ Nein | ✅ Ja | K4 Sehr hoch | Hoch | ML-basiert, rechtliche Anforderungen |
| 33 | **Report System** | ❌ Nein | ✅ Ja | K2 Mittel | Mittel | Trust & Safety Pipeline |
| 34 | **Bot API** | ❌ Nein | ✅ Ja | K3 Hoch | Mittel | REST + Gateway + Interactions |
| 35 | **Webhooks** | ❌ Nein | ✅ Ja | K1 Niedrig | Niedrig | Eingehende Nachrichten |
| 36 | **OAuth2** | ❌ Nein | ✅ Ja | K2 Mittel | Mittel | Standard, aber korrekt implementieren |
| 37 | **Slash Commands** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Bot-Interaktion UX |
| 38 | **Web Client** | ✅ Ja | ✅ Ja | K3 Hoch | Mittel | React + WebSocket + WebRTC |
| 39 | **Desktop Client** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Electron-Wrapper um Web Client |
| 40 | **Mobile Client** | ❌ Nein | ✅ Ja | K4 Sehr hoch | Hoch | Eigene UI, Background Audio, Push |
| 41 | **WebSocket Gateway** | ✅ Ja | ✅ Ja | K4 Sehr hoch | Sehr hoch | Kern-Infrastruktur, Skalierung |
| 42 | **API Gateway** | ✅ Ja | ✅ Ja | K2 Mittel | Niedrig | Routing, Rate Limiting, Auth Middleware |
| 43 | **Rate Limiting** | ✅ Basis | ✅ Voll | K2 Mittel | Mittel | MVP: Global; Prod: Per-Route, Per-User |
| 44 | **CDN** | ⚠️ Basic | ✅ Ja | K1 Niedrig | Niedrig | MVP: S3 direkt; Prod: Cloudflare/CF |
| 45 | **Monitoring** | ⚠️ Basic | ✅ Ja | K2 Mittel | Mittel | MVP: Logs; Prod: Metrics, Tracing, Alerting |
| 46 | **i18n** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Strings externalisieren |
| 47 | **Accessibility** | ⚠️ Basis | ✅ Ja | K2 Mittel | Niedrig | MVP: Keyboard-Nav; Prod: WCAG 2.1 AA |
| 48 | **Themes (Dark/Light)** | ✅ Ja | ✅ Ja | K1 Niedrig | Niedrig | CSS Variables |
| 49 | **Server Onboarding** | ❌ Nein | ✅ Ja | K2 Mittel | Niedrig | Fragen → Rollen-Zuweisung |
| 50 | **Server Discovery** | ❌ Nein | ⚠️ Optional | K3 Hoch | Mittel | Such-Index, Kategorien, Ranking |

---

## Zusammenfassung nach Kategorien

| Kategorie | MVP-Features | Prod-Features | Größtes Risiko |
|-----------|-------------|--------------|----------------|
| **Identity & Auth** | 5 | 12 | Session Security |
| **Social** | 4 | 8 | Privacy-Compliance |
| **Community-Struktur** | 6 | 14 | Permission-Komplexität |
| **Messaging** | 8 | 18 | Skalierung (Milliarden Messages) |
| **Voice/Video** | 3 | 8 | SFU-Entwicklung, Latenz |
| **Realtime** | 5 | 9 | Gateway-Skalierung |
| **Moderation** | 2 | 10 | Abuse at Scale, Legal |
| **Integration** | 0 | 6 | API-Stabilität, Ecosystem |
| **Plattformen** | 1 | 4 | Mobile-Komplexität |
| **Infrastruktur** | 6 | 12 | Betrieb, Skalierung |

---

## Kritischer Pfad

```
Auth → User → Guild → Channel → Messaging → Gateway (Realtime)
                                                ↓
                                          Voice (parallel zu Messaging-Polish)
                                                ↓
                                          Video/Screenshare
                                                ↓
                                          Mobile + Desktop
                                                ↓
                                          Bot Platform + Scale
```

Die **fett markierten Bereiche** in der Matrix (Rollen & Permissions, Voice, Gateway, Mobile) sind gleichzeitig die **höchsten Risiken** und die **stärksten Differenzierungsmerkmale**. Sie verdienen die meiste Architektur-Aufmerksamkeit und die besten Engineers.
