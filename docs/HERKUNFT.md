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
| `src/assets/halloween/halloween-szene.webp` | Entwurf der Halloween-Startseite | die gemalte Oberfläche herausgenommen, 1920 px, WebP — 40 KB |
| `src/assets/halloween/halloween-wortmarke.webp` | Entwurf des Halloween-Schriftzugs | Rand abgeschnitten, 1000 px, Alphakanal war bereits vorhanden — 86 KB |

`npm run assets:halloween <entwurf.png> <logo.png>` rechnet beide.

### Kleine Fassungen fuer schmale Geraete

`npm run assets:screens` legt neben jedes Bildschirmfoto eine 900er Fassung
(`*-900.webp`). Die Seiten binden beide per `srcset` ein; der Browser waehlt.
Auf einem Handy sind das 79 statt 198 KB — die Bilder sind 1600 bis 1800 Punkte
breit, gebraucht werden dort hoechstens 900.

Wer ein Bildschirmfoto austauscht, muss das Skript einmal laufen lassen; sonst
zeigt das Handy weiter das alte.

**Wie aus dem Entwurf ein Hintergrund wird.** Der Entwurf zeigt die fertige
Seite: Nacht, Kürbisse, Burg — und darüber Schriftzug, Überschrift, Knöpfe,
Laptop und Telefone. Als Hintergrund darf davon nur die Nacht bleiben; die
echte Oberfläche liegt später an denselben Stellen darüber. Das Skript nimmt
die gemalte Oberfläche heraus, ohne Bildinhalt zu erfinden:

- **Text und Knöpfe** stehen auf fast gleichmässiger Nacht (Rauschen unter
  zwei Stufen). Alles Helle in den bekannten Rechtecken wird maskiert und mit
  einer Inpainting-Rechnung auf einem Viertel der Auflösung aufgefüllt — auf
  voller Auflösung zieht das Verfahren Streifen durch dünne Buchstaben. Das
  Logo-Quadrat wird samt Schein als Ganzes maskiert; sein Schein liegt unter
  jeder Schwelle und färbte beim ersten Anlauf die Füllung orange.
- **Die Geräte** decken fast die halbe Bildbreite und stehen vor Nebel und
  Strasse; Inpainting schmiert dort nur. Stattdessen kommt die gesäuberte
  linke Seite gespiegelt und leicht gestreckt hinein: Zeilen bleiben Zeilen,
  Horizont, Nebelkante und Strasse laufen durch.

Ein erster Anlauf hatte nur zwei Streifen ohne Oberfläche geschnitten (Himmel
oben, Kürbisse unten) und dazwischen die violette Nacht des Themes gezeichnet.
Auf dem Bild war das kein Hintergrund, sondern ein violetter Block mit zwei
Rändern. Die Streifen gibt es nicht mehr.

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

## Demodaten

`src/lib/demoDaten.js` ist erfunden — ein Café, das es nicht gibt, mit
Mitarbeitern, die es nicht gibt (`lena@beispiel.de`, `tom@beispiel.de`; die
Domain `beispiel.de` ist für genau das gedacht). Kein echter Name, keine echte
Adresse, kein fremdes Bild. Die Zeiten rechnen vom heutigen Tag aus, damit das
Projekt nicht altert.

`npm run check:demo` hält fest, dass die Daten zur Anwendung passen — dass es
die Sammlungen wirklich gibt, dass alle vier Spalten des Boards besetzt sind
und dass kein Verweis ins Leere zeigt. Das scheitert sonst leise: Eine falsche
Kennung wirft keinen Fehler, sie zeigt nur nichts an.

## Warum das CSS in drei Dateien liegt

`index.css` wird beim Seitenaufbau geladen und haelt ihn an, bis es da ist.
Retro und Halloween standen bis September als feste Importe in `main.jsx` und
landeten damit in genau dieser Datei: 73 und 82 von 283 Kilobyte, also 55
Prozent, fuer ein Aussehen, das die allermeisten Besucher nie einschalten.

Jetzt holt sie `lib/theme.js` per `import()`, sobald ein Theme wirklich gilt.
Der kritische Pfad ist damit 127 statt 283 KB. `main.jsx` wartet beim Start auf
das Versprechen aus `initTheme()` — sonst blitzte bei Retro und Halloween kurz
die weisse Voreinstellung auf.

`npm run check:theme` legt die drei gebauten Dateien wieder zusammen, so wie
sie im Browser nebeneinander liegen, und haelt zusaetzlich fest, dass der feste
Import nicht zurueckkommt.
