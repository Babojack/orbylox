# Woher die Modelle, Bewegungen und die Musik kommen

Damit man nach einem Jahr noch weiss, was hier fremdes Material ist, unter
welchen Bedingungen es benutzt wird — und wie aus dem Rohmaterial das wurde,
was ausgeliefert wird.

## 3D

| Datei | Herkunft | Verarbeitung |
|---|---|---|
| `public/models/xbot.glb` | Mixamo "X Bot" mit der Bewegung "Happy Idle" | Zwei FBX (3,7 MB) zu einer GLB (325 KB): Dreiecke halbiert, Koordinaten quantisiert, Meshopt-komprimiert. Farben eingebrannt. |
| `public/models/retro-figure.glb` | Figur mit Umhang aus denselben Mixamo-Paketen | Vier Skelette zu einem zusammengelegt (sonst tanzt nur der Körper), sieben Umhangknochen entfernt. |
| `public/models/*.clip.json` | Mixamo-FBX | Einmalig zu JSON umgerechnet und fehlerbegrenzt ausgedünnt. Es liegt weder eine FBX noch ein FBX-Loader im Bündel. |
| `src/assets/pumpkin/*` | "Halloween Pumpkin LP", CC-Modell | `npm run assets:pumpkin <halloween_pumpkin.glb>` — siehe unten. |

### Der Kürbis im Einzelnen

Quelle ist die **GLB** des Pakets (42 MB: eine Geometrie und vier eingebettete
4096er Texturen). Ausgeliefert werden 344 KB.

`scripts/pumpkin-build.mjs` macht daraus:

- die Knotenkette eingebacken, auf den Ursprung gestellt, auf 1 Meter normiert,
- Positionen und **Tangenten** als normierte Int16, Normalen als Int8,
  UV als Uint16, Index von 32 auf 16 Bit (471 → 92 KB),
- Albedo, Emissive, Normal und ORM auf 1024 Pixel als WebP (252 KB).

**Nicht mehr aus der FBX.** Der erste Anlauf las die FBX aus demselben Paket.
Das Ergebnis sah plastisch aus, aber nicht echt — aus zwei Gründen, die man
dem Bild nicht ansieht:

1. Die FBX hat **keine Tangenten**. Ohne sie rät die Grafikkarte für die
   Normal-Map je Bildpunkt ein Koordinatensystem aus den Ableitungen; die
   Rippen bleiben weich und die UV-Nähte unruhig. Die GLB bringt genau die
   Tangenten mit, für die die Map gebacken wurde.
2. Die GLB sagt **`doubleSided`**. Ein Kürbis ist hohl: Wer durch die
   geschnitzten Augen sieht, schaut auf die Rückseite der Schale.

Dazu kamen die Texturen von 512 auf 1024 — der Unterschied steckt fast ganz in
der Normal-Map (50 → 151 KB) und ist genau das, woran ein Auge "echt"
festmacht.

Die Bilder bleiben absichtlich **ausserhalb** der GLB: So lässt sich ihre Grösse
ändern, ohne das Modell neu zu rechnen, und der Browser lädt sie parallel.

**Sie liegen unter `src/assets/`, nicht in `public/`.** In `public/` behalten
Dateien ihren Namen, und `public/htaccess` sagt für Bilder "access plus 1 year".
Als die Texturen von 512 auf 1024 wuchsen, blieb bei jedem, der die Seite vorher
gesehen hatte, der alte Stand im Zwischenspeicher — altes Modell ohne Tangenten,
alte flaue Normal-Map, dazu das neue Licht. Das sah aus wie glänzendes Plastik,
und zwar ein Jahr lang. Über `src/assets` hängt Vite einen Inhaltsstempel an:
Ändert sich eine Datei, ändert sich ihre Adresse.

**Die Albedo wird beim Bauen aufgehellt** (Gamma 0,55, Mittelwert #965124 →
#be8856) und **die Rauheit nach unten begrenzt** (Grünkanal ab 0,46). Beides
gehört zusammen: Die Textur ist für eine helle HDR-Umgebung gebacken, die es
hier nicht gibt. Der erste Versuch, die Dunkelheit mit dreifachem Licht zu
erschlagen, machte es schlimmer — starkes Licht auf einer Fläche mit Rauheit
0,31 ist Plastik, kein Kürbis.

`npm run check:bundle` hält drei Dinge fest: die Obergrenze von 400 KB, dass die
Tangenten da sind und dass die Dateien einen Inhaltsstempel tragen. Alle drei
lassen sich verlieren, ohne dass etwas kaputtgeht — man sieht dann nur ein
schlechteres Bild.

Das Skript braucht `jsdom` (Entwicklungsabhängigkeit) und Python mit Pillow.

## Bilder

| Datei | Herkunft | Verarbeitung |
|---|---|---|
| `src/assets/halloween/halloween-himmel.webp` | Entwurf der Halloween-Startseite | oberer Streifen (Netze, Fledermäuse, Mond, Burg), 1600 px, WebP — 9 KB |
| `src/assets/halloween/halloween-boden.webp` | derselbe Entwurf | unterer Streifen (Kürbisse, Kerzen, Nebel), 1600 px — 13 KB |
| `src/assets/halloween/halloween-wortmarke.webp` | Entwurf des Halloween-Schriftzugs | Rand abgeschnitten, 1000 px, Alphakanal war bereits vorhanden — 86 KB |

`npm run assets:halloween <entwurf.png> <logo.png>` schneidet sie.

**Warum nur Streifen und nicht das ganze Bild.** Die Entwürfe zeigen
Hintergrund UND Oberfläche in einem Bild — Überschrift, Karten, Knöpfe,
Geräte. Als Vollbild sähe man die gemalte Oberfläche hinter der echten.
Herausretuschieren ginge nicht ehrlich: Hinter den Karten liegen Zaun, Bäume
und Nebel, die müsste man erfinden. Nachgemessen wurde auch, ob sich die
beiden Entwürfe zu einer sauberen Platte verrechnen lassen — sie stammen aus
zwei verschiedenen Bildgenerationen und weichen selbst in den
oberflächenfreien Ecken um 17 bis 44 Helligkeitsstufen voneinander ab.

Die Streifen sind der Teil ohne Oberfläche: kein einziger erfundener
Bildpunkt. Dazwischen liegt die Nacht aus `theme-halloween.css`. Nebenbei ist
das die robustere Lösung — ein Vollbild hätte ein festes Seitenverhältnis,
die Streifen sitzen an jeder Abschnittshöhe richtig.

**Gäbe es den Entwurf ohne Oberfläche**, wäre er die bessere Quelle: dieselbe
Szene ohne Text, Karten und Geräte. Dann kann das Bild randlos hinter die
ganze Seite.

## Musik

| Datei | Herkunft | Verarbeitung |
|---|---|---|
| `src/assets/retro-theme.mp3` | "The Traveler's Hearth" | auf 96 kbit/s |
| `src/assets/halloween-theme.mp3` | Halloween-Stück von Sound Gallery / Dmitry Taras | von 256 auf 96 kbit/s (4,3 MB → 1,6 MB) |

Beide Stücke sind Hintergrund, keine Vorführung: Sie laufen mit Lautstärke 0,32,
starten **nur** beim Klick auf den Design-Umschalter (Browser lassen Ton ohne
Nutzerhandlung nicht zu) und werden erst dann geladen. Wer nie ins Retro oder ins
Halloween geht, lädt keine einzige Note.

Welches Aussehen welches Stück hat, steht an genau einer Stelle:
`STUECKE` in `src/lib/themeSound.js`.
