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
| `public/models/pumpkin.*`, `pumpkin-*.webp` | "Halloween Pumpkin LP", CC-Modell | `npm run assets:pumpkin <halloween_pumpkin.glb>` — siehe unten. |

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

`npm run check:bundle` hält beides fest: die Obergrenze von 400 KB und dass die
Tangenten da sind. Sie lassen sich verlieren, ohne dass etwas kaputtgeht — man
sieht dann nur ein schlechteres Bild.

Das Skript braucht `jsdom` (Entwicklungsabhängigkeit) und Python mit Pillow.

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
