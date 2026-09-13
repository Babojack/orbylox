/**
 * Aus den Entwürfen die Bilder für das Halloween-Aussehen rechnen.
 *
 *   node scripts/halloween-bilder.mjs <entwurf-hero.png> <logo.png> [ziel]
 *
 * Ergebnis in src/assets/halloween/:
 *   halloween-szene.webp      die Szene OHNE Oberfläche, randlos als Hintergrund
 *   halloween-wortmarke.webp  der geschnitzte Schriftzug
 *
 * WIE AUS DEM ENTWURF EIN HINTERGRUND WIRD
 * Der Entwurf zeigt die fertige Seite: Nacht, Kürbisse, Burg — und darüber
 * Schriftzug, Überschrift, Knöpfe, Laptop und Telefone. Als Hintergrund
 * darf davon nur die Nacht bleiben; die echte Oberfläche liegt später
 * darüber. Also muss die gemalte Oberfläche heraus.
 *
 * Zwei Verfahren, je nach Fläche:
 *
 *   1. TEXT UND KNÖPFE (links). Sie stehen auf fast gleichmässiger Nacht
 *      (Rauschen unter 2 Stufen). Maske = alles Helle in den bekannten
 *      Rechtecken, breit aufgeweitet; gefüllt wird mit einer Inpainting-
 *      Rechnung auf einem Viertel der Auflösung — auf voller Auflösung
 *      zieht das Verfahren Streifen durch dünne Buchstaben. Das Logo-Quadrat
 *      wird samt seinem Schein als Ganzes maskiert: sein Schein liegt unter
 *      jeder Schwelle und färbt sonst die Füllung orange.
 *
 *   2. DIE GERÄTE (rechts). Das ist fast die halbe Bildbreite und liegt
 *      vor Nebel und Strasse, nicht vor glatter Nacht — Inpainting schmiert
 *      dort nur. Stattdessen kommt der gesäuberte linke Teil gespiegelt
 *      hinein (leicht gestreckt, damit die Quelle links vor Spinne und
 *      Netz endet). Zeilen bleiben Zeilen: Horizont, Nebelkante und Strasse
 *      laufen durch. Der Schein des Laptops reicht weit in den Himmel; die
 *      Maske ist entsprechend hoch und weich.
 *
 * Nichts davon erfindet Bildinhalt — jeder Punkt stammt aus dem Entwurf.
 *
 * Braucht Python mit OpenCV (cv2), numpy und Pillow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entwurf = process.argv[2];
const logo = process.argv[3];
const ziel = process.argv[4] || path.join(wurzel, 'src', 'assets', 'halloween');

if (!entwurf || !fs.existsSync(entwurf) || !logo || !fs.existsSync(logo)) {
  console.error('Aufruf: node scripts/halloween-bilder.mjs <entwurf-hero.png> <logo.png> [ziel]');
  process.exit(2);
}
fs.mkdirSync(ziel, { recursive: true });

const python = `
import cv2, numpy as np, os, sys
from PIL import Image

entwurf, logo, z = sys.argv[1], sys.argv[2], sys.argv[3]

im = cv2.imread(entwurf)
H, W = im.shape[:2]
if (W, H) != (2170, 725):
    # Die Masken unten sind für diesen Entwurf gemessen. Ein anderes Bild
    # braucht andere Zahlen — lieber laut scheitern als leise falsch schneiden.
    sys.exit('Entwurf ist %dx%d, erwartet 2170x725' % (W, H))
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)

# --- 1. Text und Knöpfe links ----------------------------------------------
m = np.zeros((H, W), np.uint8)
m[95:255, 160:360] = 255                      # Logo-Quadrat samt Schein
for x0, y0, x1, y1, thr in [
    (340, 105, 720, 245, 18),                 # Schriftzug
    (180, 245, 850, 322, 18),                 # Überschrift
    (180, 322, 1035, 415, 16),                # Untertitel
    (180, 425, 730, 550, 16),                 # Knöpfe
    (180, 565, 910, 625, 16),                 # Häkchen-Zeile
]:
    sub = g[y0:y1, x0:x1]
    m[y0:y1, x0:x1] = np.maximum(m[y0:y1, x0:x1], np.where(sub > thr, 255, 0).astype(np.uint8))
m = cv2.dilate(m, np.ones((21, 21), np.uint8))

s = 4
ims = cv2.resize(im, (W // s, H // s), interpolation=cv2.INTER_AREA)
ms = cv2.dilate(cv2.resize(m, (W // s, H // s), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
fill = cv2.resize(cv2.inpaint(ims, ms, 10, cv2.INPAINT_TELEA), (W, H), interpolation=cv2.INTER_CUBIC)
fill = cv2.GaussianBlur(fill, (0, 0), 3)
mf = (cv2.GaussianBlur(m, (0, 0), 4).astype(np.float32) / 255)[..., None]
clean = (im * (1 - mf) + fill * mf).astype(np.uint8)

# --- 2. Die Geräte rechts: gespiegelte, gesäuberte linke Seite ---------------
x0, x1 = 1040, 2010
xs = np.arange(W, dtype=np.float32); ys = np.arange(H, dtype=np.float32)
mapx = np.tile(xs, (H, 1)); mapy = np.tile(ys[:, None], (1, W))
mapx[:, :] = np.where((xs >= x0 - 100) & (xs <= x1 + 100), 1030 - (xs - x0) * (760.0 / (x1 - x0)), xs)[None, :]
mirror = cv2.remap(clean, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
a = np.zeros((H, W), np.float32); a[125:665, 1060:1720] = 1; a = cv2.GaussianBlur(a, (0, 0), 28)   # Laptop + Schein
b = np.zeros((H, W), np.float32); b[168:665, 1590:2000] = 1; b = cv2.GaussianBlur(b, (0, 0), 16)   # Telefone
fm = np.maximum(a, b)[..., None]
out = (clean * (1 - fm) + mirror * fm).astype(np.uint8)

szene = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
BREITE = 1920
if szene.width > BREITE:
    szene = szene.resize((BREITE, round(szene.height * BREITE / szene.width)), Image.LANCZOS)
p = os.path.join(z, 'halloween-szene.webp')
szene.save(p, 'WEBP', quality=80, method=6)
print('  halloween-szene.webp  %dx%d  %.1f KB' % (szene.width, szene.height, os.path.getsize(p) / 1024))

# --- 3. Der Schriftzug -------------------------------------------------------
# Das Bild bringt bereits einen Alphakanal mit (Werte 0..253), es muss also
# nichts freigestellt werden. Nur der leere Rand kommt weg, sonst richtet
# sich der Schriftzug im Layout nach Luft statt nach Buchstaben.
l = Image.open(logo).convert('RGBA')
kasten = l.split()[-1].getbbox()
l = l.crop(kasten)
if l.width > 1000:
    l = l.resize((1000, round(l.height * 1000 / l.width)), Image.LANCZOS)
p = os.path.join(z, 'halloween-wortmarke.webp')
l.save(p, 'WEBP', quality=88, method=6)
print('  halloween-wortmarke.webp  %dx%d  %.1f KB' % (l.width, l.height, os.path.getsize(p) / 1024))
`;

execFileSync('python3', ['-c', python, entwurf, logo, ziel], { stdio: 'inherit' });
