# Deadline-E-Mail-Erinnerungen für Tickets

Status: Approved (Design), Stand 2026-08-19

## Problem

Tickets (Kanban-Tasks) haben ein `due_date`-Feld, aber niemand wird
benachrichtigt, wenn eine Deadline näher rückt. Nutzer merken es erst,
wenn sie zufällig ins Board schauen.

## Ziel

Assignees eines Tickets bekommen automatisch eine E-Mail, wenn dessen
Deadline (`due_date`) am nächsten Tag erreicht ist — ohne dass jemand
in der App eingeloggt sein oder etwas anstoßen muss.

## Nicht-Ziele

- Keine konfigurierbare Vorlaufzeit (fest: 1 Tag vorher).
- Keine Erinnerungen an Ersteller oder sonstige Projektmitglieder,
  nur an `assignees`.
- Keine In-App-Benachrichtigung (existiert bereits separat über die
  Notification-Glocke) — nur E-Mail.
- Keine Nutzer-Spracheinstellung serverseitig — E-Mails sind fix
  zweisprachig (DE + EN im selben Body).

## Kontext (Ist-Zustand)

- Frontend: React-SPA (Vite), Firestore als primärer Datenspeicher,
  `localStorage`-Fallback ohne Firebase-Config.
- Tasks liegen flach in der Firestore-Collection `Task`
  (`src/api/apiClient.js`), Felder u.a. `due_date` (reines Datum,
  `<input type="date">`), `assignees` (Array von E-Mail-Adressen),
  `status` (`todo` / `in_progress` / `review` / `done`).
- Backend: PHP auf Hostinger-Shared-Hosting (`public/api/*.php`,
  landet über den Build in `dist/` und wird deployed). Bestehende
  Endpunkte (`send-invite.php`, `upload.php`, `backup.php`) sind alle
  **nutzerausgelöst** über HTTP, mit Firebase-ID-Token-Verifikation
  (`firebase-auth.php`) — kein Nutzerkontext heißt kein Zugriff.
- Es existiert kein zeitgesteuerter Prozess (kein Cron, keine Firebase
  Functions) und kein Service-Account mit erweiterten Firestore-Rechten.
- SMTP-Versand ist bereits vorhanden (`public/api/smtp-mailer.php`,
  Zugangsdaten in `public/api/invite-config.php`, gitignored).
- Das Projekt vermeidet bewusst eine Composer/`vendor`-Abhängigkeit auf
  dem Server (`smtp-mailer.php`-Kommentar: "kein Composer-Schritt
  nötig"); `firebase-auth.php` verifiziert RS256-JWTs bereits von Hand.

## Entscheidungen

1. **Empfänger:** nur `assignees` des Tickets.
2. **Vorlaufzeit:** exakt 1 Tag vor `due_date`, einmalig.
3. **Trigger:** täglicher Hostinger-cPanel-Cron-Job, der ein PHP-CLI-
   Skript aufruft (kein HTTP-Endpoint, keine Exposition nötig).
4. **Firestore-Zugriff:** selbst gebauter Service-Account-JWT +
   Firestore-REST-API (Ansatz A), konsistent mit dem bestehenden
   No-Composer-Stil — statt des offiziellen `google/cloud-firestore`-
   SDKs (Ansatz B, verworfen wegen Composer-Abhängigkeit).
5. **Sprache:** eine E-Mail, Deutsch zuerst dann Englisch im selben
   Body — analog zum bestehenden zweisprachigen Legal-Notice-Muster.
   Kein neues Sprachfeld im Nutzerprofil.
6. **Bündelung:** eine Sammel-E-Mail pro Assignee und Lauf (nicht pro
   Ticket), mit allen für diese Person morgen fälligen Tickets.

## Architektur

```
cPanel Cron (täglich, z.B. 08:00)
        │
        ▼
public/api/send-deadline-reminders.php   (PHP CLI, kein HTTP-Route)
        │
        ├─► public/api/firestore-service-account.php
        │     signiert JWT (RS256, openssl) mit Service-Account-Key
        │     tauscht es bei https://oauth2.googleapis.com/token
        │     gegen Access-Token (Scope: datastore) ─────► Google OAuth
        │
        ├─► Firestore REST API: runQuery auf Collection "Task"
        │     WHERE due_date IN {heute, morgen}
        │     (Nachfilterung in PHP: status != done,
        │      deadline_reminder_sent_at leer)
        │
        ├─► Gruppierung der Treffer nach assignee-E-Mail
        │
        ├─► public/api/smtp-mailer.php  → SMTP-Versand je Assignee
        │
        └─► Firestore REST API: PATCH deadline_reminder_sent_at
              je erfolgreich benachrichtigtem Ticket
```

### Datenmodell

Neues optionales Feld auf `Task`-Dokumenten:

- `deadline_reminder_sent_at` (string, ISO-8601-Timestamp) — gesetzt,
  sobald die Erinnerung für dieses Ticket verschickt wurde. Fehlt das
  Feld, gilt das Ticket als noch nicht erinnert. Kein Migrations-
  schritt nötig (Firestore ist schemalos, bestehende Tasks haben das
  Feld einfach nicht).

`firestore.rules` bleibt unverändert: Der Service Account greift mit
Admin-Rechten zu und ist von den Client-Regeln nicht betroffen.

### Query-Logik

Zeitfenster bewusst **heute ODER morgen** (nicht nur morgen), damit ein
ausgefallener Cron-Lauf nicht dazu führt, dass eine Deadline komplett
ohne Erinnerung durchrutscht. `deadline_reminder_sent_at` verhindert
doppelten Versand, auch über mehrere Läufe hinweg.

Reihenfolge pro Lauf:

1. Firestore-Query: `Task` wo `due_date` == heute ODER `due_date` ==
   morgen (zwei einfache Gleichheits-Queries statt einer Bereichs-
   Query — vermeidet zusammengesetzte Indizes).
2. In PHP filtern: `status != 'done'`, `deadline_reminder_sent_at` ist
   leer/nicht gesetzt, `assignees` nicht leer.
3. Nach Assignee-E-Mail gruppieren.
4. Je Assignee eine Sammel-Mail bauen und senden.
5. Bei Erfolg: für jedes in der Mail enthaltene Ticket
   `deadline_reminder_sent_at` per PATCH setzen.
6. Bei Fehlschlag (SMTP-Fehler) für eine Person: nichts markieren,
   Fehler loggen, mit der nächsten Person weitermachen (kein Abbruch
   des gesamten Laufs).

### E-Mail-Inhalt

- Betreff zweisprachig, z.B. "Fällige Tickets morgen / Tickets due
  tomorrow".
- Body: erst deutscher Abschnitt, dann englischer Abschnitt.
- Je Ticket: Titel, Projektname, Fälligkeitsdatum, direkter Link ins
  Board (gleiches URL-Muster wie bestehende Invite-Mails/App-Links).
- Versand über das bestehende `smtp-mailer.php` mit den SMTP-
  Zugangsdaten aus `invite-config.php` (gleiches Postfach wie Invite-
  Mails, z.B. `invite@orbylox.de`, oder optional ein eigenes Feld für
  eine abweichende Absenderadresse — Implementierungsdetail).

### Konfiguration & Setup (einmalig, manuell)

- Firebase-Service-Account-Key aus der Firebase Console
  (Projekteinstellungen → Dienstkonten) herunterladen, als
  `firestore-service-account.json` außerhalb von `public_html`
  ablegen (gleiches Schutzmuster wie `invite-config.php`: gitignored,
  per `.htaccess` gegen direkten Browser-Zugriff gesperrt).
- Neue Doku-Datei `public/api/DEADLINE-REMINDERS-SETUP.txt` (Muster:
  `HOSTINGER-SETUP.txt`) beschreibt:
  - wo der Service-Account-Key abzulegen ist,
  - wie der cPanel-Cron-Job eingerichtet wird (Kommando, Zeitplan),
  - den Schnelltest nach dem Einrichten.
- Der Cron-Job selbst wird **nicht** von diesem Vorhaben automatisiert
  eingerichtet — das muss einmalig manuell in Hostinger passieren
  (kein programmatischer Zugriff auf cPanel).

### Logging

Ergebnisse jedes Laufs (Anzahl gefundene Tickets, verschickte Mails,
Fehler je Empfänger) werden an `public/api/logs/deadline-reminders.log`
angehängt — zum Nachvollziehen, falls ein Lauf fehlschlägt oder
niemand eine Mail bekommt. Kein Rotationsmechanismus (kleine Menge an
Log-Zeilen, ein Eintrag pro Tag).

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Service-Account-Token-Exchange schlägt fehl | Lauf bricht komplett ab, Fehler geloggt, nichts verschickt/markiert |
| Firestore-Query schlägt fehl | Lauf bricht ab, Fehler geloggt |
| SMTP-Versand für einen Assignee schlägt fehl | Diese Person wird übersprungen (nicht markiert, nächster Lauf versucht erneut), andere Empfänger werden trotzdem bedient |
| Ticket hat leeres `assignees`-Array | Wird ignoriert, keine Mail, kein Markieren |
| Cron-Lauf fällt komplett aus (Server-Wartung etc.) | Nächster Lauf fängt es über das heute-ODER-morgen-Fenster ab, solange die Deadline nicht mehr als 1 Tag zurückliegt |
| Deadline liegt bereits mehr als 1 Tag in der Vergangenheit beim nächsten Lauf | Keine Erinnerung mehr (bewusst kein unbegrenztes Nachholen alter Deadlines) |

## Testen

Kein automatisiertes Test-Setup für die PHP-Endpoints in diesem
Projekt (Precedent: auch die bestehenden Endpoints haben keine Tests).
Manueller Testablauf:

1. Test-Ticket in Firestore anlegen mit `due_date` = morgen und
   `assignees` = [eigene Test-Mailadresse].
2. Skript lokal/auf dem Server per CLI ausführen:
   `php public/api/send-deadline-reminders.php`.
3. Prüfen: Mail kommt an, Inhalt korrekt (DE+EN, richtiges Ticket),
   `deadline_reminder_sent_at` ist am Task-Dokument gesetzt.
4. Skript erneut ausführen: keine zweite Mail (Idempotenz).
5. Log-Datei prüfen auf plausible Einträge.

## Offene Punkte für die Implementierung (kein Blocker für die Spec)

- Genaue Absenderadresse/Betreffzeilen-Wortlaut der E-Mail.
- Exakte Uhrzeit des Cron-Laufs (Vorschlag: 08:00 Europe/Berlin).
