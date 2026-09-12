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
| `public/models/pumpkin.*`, `pumpkin-*.webp` | "Halloween Pumpkin LP", CC-Modell | `npm run assets:pumpkin <entpacktes-Paket>` — siehe unten. |

### Der Kürbis im Einzelnen

Das Paket kommt mit 31 MB: einer FBX und sechs Texturen, allein die Normal-Map
ein 4096er PNG mit 24 MB. Ausgeliefert werden 156 KB.

`scripts/pumpkin-build.mjs` macht daraus:

- die Geometrie indiziert (15.024 Punkte → 2.602, dieselben 5.008 Dreiecke),
- Positionen als normierte Int16, Normalen als Int8, UV als Uint16 (471 KB → 71 KB),
- Albedo, Emissive und Normal auf 512 Pixel als WebP,
- Verdeckung, Rauheit und Metall in die drei Kanäle **einer** Datei — die
  Belegung, die glTF für occlusion/roughness/metalness vorsieht.

Die Bilder bleiben absichtlich **ausserhalb** der GLB: So lässt sich ihre Grösse
ändern, ohne das Modell neu zu rechnen, und der Browser lädt sie parallel.

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
