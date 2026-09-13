/**
 * Aus den Entwürfen die Bildteile schneiden, die wirklich benutzbar sind.
 *
 *   node scripts/halloween-bilder.mjs <entwurf-warum.png> <logo.png> [ziel]
 *
 * WARUM NUR TEILE UND NICHT DAS GANZE BILD
 * Die Entwürfe zeigen die fertige Seite: Hintergrund UND Oberfläche in einem
 * Bild — Überschrift, Karten, Knöpfe, Geräte. Als Seitenhintergrund taugt das
 * nicht: Man sähe die gemalte Oberfläche hinter der echten.
 *
 * Die naheliegende Idee, die Oberfläche aus dem Bild zu retuschieren, geht
 * hier nicht ehrlich: Hinter den Karten liegen Zaun, Bäume und Nebel, und die
 * müsste man erfinden. Nachgemessen wurde auch, ob sich die beiden Entwürfe
 * zu einer sauberen Platte verrechnen lassen — sie stammen aus zwei
 * verschiedenen Bildgenerationen und weichen selbst in den oberflächenfreien
 * Ecken um 17 bis 44 Helligkeitsstufen voneinander ab. Auch das fällt weg.
 *
 * Was bleibt, ist das, was ohne einen einzigen erfundenen Bildpunkt geht:
 * die beiden Bänder, in denen KEINE Oberfläche liegt.
 *
 *   oben   — Spinnweben, Spinne, Fledermäuse, Mond, Burg
 *   unten  — Kürbisse, Kerzen, Nebel, Boden
 *
 * Beide aus DEMSELBEN Entwurf, damit Farbe und Licht zusammenpassen.
 * Dazwischen liegt die Nacht, die das Theme ohnehin schon zeichnet
 * (`theme-halloween.css`). Nebenbei ist das die robustere Lösung: Ein
 * Vollbild hätte ein festes Seitenverhältnis, diese Bänder sitzen an jeder
 * Seitenhöhe richtig.
 *
 * WENN ES DEN ENTWURF OHNE OBERFLÄCHE GIBT
 * Dann ist er die bessere Quelle — dieselbe Szene, nur ohne Text, Karten und
 * Geräte. Dann kann das Bild randlos hinter die ganze Seite, und dieses
 * Skript schneidet nur noch zu.
 *
 * Braucht Python mit Pillow.
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
  console.error('Aufruf: node scripts/halloween-bilder.mjs <entwurf-warum.png> <logo.png> [ziel]');
  process.exit(2);
}
fs.mkdirSync(ziel, { recursive: true });

const python = `
from PIL import Image
import sys, os

entwurf, logo, z = sys.argv[1], sys.argv[2], sys.argv[3]

# --- Die beiden Bänder ---------------------------------------------------
#
# Die Grenzen sind gemessen, nicht geschätzt: Die weisse Schrift der
# Überschrift beginnt bei y=152, der obere Kartenrahmen liegt bei y=296, der
# untere bei y=566. Mit Sicherheitsabstand bleibt oben 0..138 und unten
# 574..725 vollständig frei von Oberfläche.
q = Image.open(entwurf).convert('RGB')
B, H = q.size

oben = q.crop((0, 0, B, 138))
unten = q.crop((0, 574, B, H))

# Auf 1600 Punkte Breite: Die Bänder sitzen als Hintergrund über die volle
# Fensterbreite, und mehr als 1600 sieht man auf einer gestreckten Fläche
# nicht mehr.
def schmaler(bild, breite=1600):
    if bild.width <= breite:
        return bild
    return bild.resize((breite, round(bild.height * breite / bild.width)), Image.LANCZOS)

for name, bild in (('himmel', oben), ('boden', unten)):
    s = schmaler(bild)
    p = os.path.join(z, 'halloween-%s.webp' % name)
    s.save(p, 'WEBP', quality=76, method=6)
    print('  halloween-%s.webp  %dx%d  %.1f KB' % (name, s.width, s.height, os.path.getsize(p) / 1024))

# --- Der Schriftzug ------------------------------------------------------
#
# Das Bild bringt bereits einen Alphakanal mit (nachgesehen: Werte von 0 bis
# 253), es muss also nichts freigestellt werden. Nur der leere Rand kommt
# weg, sonst richtet sich der Schriftzug im Layout nach Luft statt nach
# Buchstaben.
l = Image.open(logo).convert('RGBA')
kasten = l.split()[-1].getbbox()
l = l.crop(kasten)
BREITE = 1000
if l.width > BREITE:
    l = l.resize((BREITE, round(l.height * BREITE / l.width)), Image.LANCZOS)
p = os.path.join(z, 'halloween-wortmarke.webp')
l.save(p, 'WEBP', quality=88, method=6, lossless=False)
print('  halloween-wortmarke.webp  %dx%d  %.1f KB' % (l.width, l.height, os.path.getsize(p) / 1024))
print('  (Rand abgeschnitten: %s)' % (kasten,))
`;

execFileSync('python3', ['-c', python, entwurf, logo, ziel], { stdio: 'inherit' });
