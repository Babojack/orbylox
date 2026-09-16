/**
 * Kleine Fassungen der Bildschirmfotos für schmale Geräte.
 *
 *   npm run assets:screens
 *
 * WARUM
 * Die Bilder sind 1600 bis 1800 Punkte breit. Auf einem Handy mit 412 Punkten
 * Fensterbreite und doppelter Auflösung braucht es davon 824 — der Rest wird
 * heruntergerechnet und weggeworfen. Lighthouse rechnete auf der Startseite
 * 190 KB vor, die nur deshalb über die Leitung gehen.
 *
 * Also liegt neben jedem Bild eine 900er Fassung, und `srcset` lässt den
 * Browser wählen. Er kennt Fensterbreite und Auflösung, das Skript nicht.
 *
 * ZWEI FASSUNGEN, NICHT FÜNF
 * 900 deckt jedes Handy ab (auch mit doppelter Auflösung bis 450 Punkte
 * Fensterbreite), das Original jeden Laptop. Dazwischen liegt nichts, was den
 * dritten Satz Dateien und die dritte Zeile im `srcset` rechtfertigen würde.
 *
 * Braucht Python mit Pillow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Was verkleinert wird: die Bildschirmfotos der Startseite. */
const QUELLEN = [
  'public/screens/tasks.webp',
  'public/screens/feed.webp',
  'public/screens/canvas.webp',
  'public/screens/files.webp',
  'src/assets/hero-devices.webp',
];

const python = `
from PIL import Image
import sys, os

BREITE = 900
for rel in sys.argv[1:]:
    if not os.path.isfile(rel):
        print('  fehlt: %s' % rel); continue
    im = Image.open(rel)
    if im.width <= BREITE:
        print('  schon klein genug: %s' % rel); continue
    klein = im.resize((BREITE, round(im.height * BREITE / im.width)), Image.LANCZOS)
    stamm, endung = os.path.splitext(rel)
    ziel = stamm + '-900' + endung
    # method=6 rechnet länger und packt dichter — das Skript läuft von Hand,
    # nicht bei jedem Bauen.
    klein.save(ziel, 'WEBP', quality=78, method=6)
    print('  %-38s %4dx%-4d %6.1f KB  ->  %6.1f KB'
          % (os.path.basename(ziel), klein.width, klein.height,
             os.path.getsize(rel) / 1024, os.path.getsize(ziel) / 1024))
`;

const vorhanden = QUELLEN.filter((q) => fs.existsSync(path.join(wurzel, q)));
if (!vorhanden.length) {
  console.error('Keine Quellbilder gefunden.');
  process.exit(2);
}
execFileSync('python3', ['-c', python, ...vorhanden.map((q) => path.join(wurzel, q))], {
  stdio: 'inherit',
  cwd: wurzel,
});
