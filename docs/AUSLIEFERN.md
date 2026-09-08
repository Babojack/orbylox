# Ausliefern nach Hostinger

Seit `.github/workflows/deploy.yml` gibt es passiert bei jedem Push auf `main`
automatisch: bauen, prüfen, hochladen. Kein `npm run build`, kein Dateimanager,
kein Ziehen von Ordnern mehr.

Einmalig sind fünf Angaben in GitHub zu hinterlegen und ein Schlüssel zu
erzeugen. **Das machst du selbst** — ich sehe deine Zugangsdaten nie und soll
sie auch nicht sehen.

---

## 1. Schlüsselpaar erzeugen

Auf deinem Rechner, im Terminal:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/orbylox-deploy -C "orbylox deploy" -N ""
```

Das erzeugt zwei Dateien:

- `~/.ssh/orbylox-deploy` — der **private** Schlüssel. Gehört zu GitHub, sonst
  nirgendwohin.
- `~/.ssh/orbylox-deploy.pub` — der **öffentliche**. Gehört zu Hostinger.

`-N ""` heisst: ohne Passwort. Das muss so sein, weil GitHub den Schlüssel
unbeaufsichtigt benutzt. Deshalb ist es ein eigener Schlüssel nur für diesen
Zweck und nicht der, mit dem du dich sonst anmeldest — wird er kompromittiert,
sperrst du genau ihn und sonst nichts.

## 2. Öffentlichen Schlüssel bei Hostinger eintragen

hPanel → **Erweitert → SSH-Zugang**. Dort SSH einschalten und den Inhalt von
`~/.ssh/orbylox-deploy.pub` als neuen Schlüssel einfügen:

```bash
cat ~/.ssh/orbylox-deploy.pub
```

Auf derselben Seite stehen **Host**, **Port** und **Benutzername**. Der Port ist
bei Hostinger typischerweise nicht 22 — schreib dir auf, was dort steht.

## 3. Fünf Geheimnisse in GitHub anlegen

GitHub → dein Repository → **Settings → Secrets and variables → Actions → New
repository secret**. Genau diese Namen:

| Name | Wert | Beispiel |
|---|---|---|
| `SSH_HOST` | Host aus dem hPanel | `12.34.56.78` |
| `SSH_PORT` | Port aus dem hPanel | `65002` |
| `SSH_USER` | Benutzername aus dem hPanel | `u123456789` |
| `SSH_KEY` | **kompletter Inhalt** von `~/.ssh/orbylox-deploy` | `-----BEGIN OPENSSH PRIVATE KEY----- …` |
| `DEPLOY_PATH` | absoluter Pfad zu `public_html` | `/home/u123456789/domains/orbylox.de/public_html` |

Den privaten Schlüssel so einfügen, wie er ist — mit erster und letzter Zeile
und ohne etwas wegzulassen:

```bash
cat ~/.ssh/orbylox-deploy
```

Den genauen Pfad findest du über SSH mit:

```bash
ssh -p <PORT> <USER>@<HOST> "ls -d ~/domains/*/public_html"
```

## 4. Ausprobieren

GitHub → **Actions → Ausliefern → Run workflow**. Der erste Lauf sollte durch
alle Schritte gehen und am Ende den Namen des ausgelieferten Bündels zeigen.

Danach genügt `git push`.

---

## Was der Ablauf tut — und was ausdrücklich nicht

**Er schreibt nur nach `public_html`.** Die Zugangsdaten (`invite-config.php`)
und die Daten des Blogs (`orbylox-data/`) liegen eine Ebene darüber. Sie sind
damit ausser Reichweite, egal was schiefgeht. Genau dafür haben wir sie damals
dorthin verschoben.

**Er löscht nichts.** Kein `--delete`. Der Grund steht in `public_html/uploads`:
Dort liegen die Dateien, die Nutzerinnen hochgeladen haben. Sie stehen in
keinem Build, ein Abgleich mit Löschen würde sie beim ersten Lauf restlos
entfernen. Stattdessen wird überschrieben und ergänzt.

**Alte Bündel räumt er nach 30 Tagen weg.** Sie tragen einen Inhaltsstempel im
Namen (`index-ef9A5ABf.js`) und sind nach der nächsten Auslieferung
unerreichbar — bis auf Seiten, die jemand noch offen hat. Die Frist ist die
Schonzeit für genau diese Seiten.

**Er liefert nur aus, was durch die Prüfungen kommt.** `check:theme` und
`check:clips` laufen zwischen Bauen und Hochladen. Schlägt eine fehl, bricht
der Ablauf ab und auf dem Server bleibt der vorige Stand stehen. Ein kaputtes
Theme kommt so gar nicht erst live.

---

## Wenn es klemmt

**`Permission denied (publickey)`** — der öffentliche Schlüssel liegt nicht (oder
nicht vollständig) bei Hostinger, oder `SSH_USER` stimmt nicht. Zum Nachsehen
lokal:

```bash
ssh -p <PORT> -i ~/.ssh/orbylox-deploy <USER>@<HOST> "echo geht"
```

Klappt das lokal nicht, klappt es in GitHub auch nicht — dann liegt es nicht am
Ablauf.

**`Host key verification failed`** — Hostinger hat den Serverschlüssel getauscht.
Der Ablauf holt ihn bei jedem Lauf frisch; tritt es trotzdem auf, einmal von
Hand anstossen.

**Die Prüfung schlägt fehl** — dann ist es kein Auslieferungsproblem. In den
Actions-Protokollen steht, welche Zusicherung gerissen ist; dieselbe Prüfung
läuft bei dir lokal mit `npm run check:theme` beziehungsweise
`npm run check:clips`.

**Es ist hochgeladen, aber im Browser passiert nichts** — zuerst nachsehen, was
wirklich live ist:

```bash
curl -s https://orbylox.de/ | grep -o 'assets/index-[^"]*'
```

Steht dort ein anderer Name als im Protokoll des Ablaufs, hat der Server oder
ein Zwischenspeicher noch die alte Fassung. Bei Dateien aus `public/` (Modelle,
Schriften) gibt es keinen Inhaltsstempel im Namen — dort hilft nur ein
erzwungenes Neuladen.
