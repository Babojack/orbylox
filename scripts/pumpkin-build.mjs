/**
 * Aus 31 MB Rohmaterial werden 155 KB Kürbis.
 *
 *   node scripts/pumpkin-build.mjs <entpacktes-Paket> [ziel]
 *
 * Das Paket ist "Halloween Pumpkin LP" (CC-Modell, entpackt: `source/*.fbx`
 * und `textures/*`). So wie es kommt, ist es für eine Webseite unbrauchbar:
 * allein die Normal-Map ist ein 4096er PNG mit 24 MB. Dieses Skript macht
 * daraus, was der Browser wirklich braucht.
 *
 * WARUM DAS ALS SKRIPT IM PAKET STEHT UND NICHT NUR EINMAL LIEF
 * Weil sonst in einem Jahr niemand mehr weiss, wie aus der FBX die GLB wurde
 * — und ein neues Modell (oder eine korrigierte Textur) hiesse: alles noch
 * einmal von Hand herausfinden. Die Zahlen unten sind die Entscheidungen,
 * und sie stehen hier zum Nachlesen.
 *
 * WAS ES TUT
 *   1. FBX einlesen, das eine Mesh herausziehen, Transformationen einbacken.
 *   2. Auf den Ursprung stellen (Fuss auf y=0) und auf 1 Meter Höhe normieren.
 *      Danach braucht die Anzeige keine Zauberzahlen mehr.
 *   3. Punkte zusammenlegen: Die FBX liefert jeden Punkt so oft, wie Dreiecke
 *      ihn berühren — 15.024 statt 2.602.
 *   4. Quantisieren: Positionen als normierte Int16, Normalen als Int8, UV als
 *      Uint16. glTF kennt genau diese Formate. Aus 471 KB werden 71 KB, und
 *      der Fehler liegt bei einem Kürbis von einem Meter unter einem
 *      Zehntelmillimeter.
 *   5. Texturen auf 512 verkleinern und als WebP ablegen. AO, Rauheit und
 *      Metall wandern in die drei Kanäle EINER Datei — genau die Belegung,
 *      die glTF für occlusion/roughness/metalness vorsieht.
 *
 * Die Bilder bleiben ausserhalb der GLB: So lässt sich ihre Grösse ändern,
 * ohne das Modell neu zu rechnen, und der Browser lädt sie parallel.
 *
 * Braucht `jsdom` (Entwicklungsabhängigkeit) und für die Bilder Python mit
 * Pillow — beides ist auch sonst im Einsatz.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = process.argv[2];
const ziel = process.argv[3] || path.join(wurzel, 'public', 'models');

if (!quelle || !fs.existsSync(quelle)) {
  console.error('Aufruf: node scripts/pumpkin-build.mjs <entpacktes-Paket> [ziel]');
  process.exit(2);
}

/* --- Umgebung: Three.js erwartet einen Browser ---------------------------
 *
 * FBXLoader und GLTFExporter greifen auf `TextDecoder`, `Blob` und
 * `FileReader` zu. Die ersten beiden bringt Node mit, `FileReader` nicht —
 * der kommt aus jsdom. Ohne ihn bricht der Export mit
 * "FileReader is not defined" ab, an einer Stelle, die nicht danach aussieht.
 */
globalThis.TextDecoder ||= TextDecoder;
globalThis.TextEncoder ||= TextEncoder;
globalThis.self ||= globalThis;
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html></html>');
globalThis.window ||= dom.window;
globalThis.document ||= dom.window.document;
globalThis.Blob = dom.window.Blob;
globalThis.FileReader = dom.window.FileReader;
globalThis.URL ||= dom.window.URL;

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const BGU = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

/* ------------------------------------------------------------- Geometrie */

const fbxDatei = fs.readdirSync(path.join(quelle, 'source')).find((f) => /\.fbx$/i.test(f));
if (!fbxDatei) { console.error('Keine .fbx in source/'); process.exit(2); }

const roh = fs.readFileSync(path.join(quelle, 'source', fbxDatei));
const gruppe = new FBXLoader().parse(
  roh.buffer.slice(roh.byteOffset, roh.byteOffset + roh.byteLength),
  path.join(quelle, 'source') + path.sep,
);

let mesh = null;
gruppe.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
if (!mesh) { console.error('Kein Mesh in der FBX.'); process.exit(2); }
gruppe.updateMatrixWorld(true);

const geo = mesh.geometry.clone();
geo.applyMatrix4(mesh.matrixWorld);

// Fuss auf y=0, waagerecht mittig, Höhe genau 1.
geo.computeBoundingBox();
const grob = geo.boundingBox;
const groesse = grob.getSize(new THREE.Vector3());
const mitteGrob = grob.getCenter(new THREE.Vector3());
geo.translate(-mitteGrob.x, -grob.min.y, -mitteGrob.z);
geo.scale(1 / groesse.y, 1 / groesse.y, 1 / groesse.y);

const vorher = geo.attributes.position.count;
/* WICHTIG: zusammenlegen, OHNE vorher die Normalen neu zu rechnen. Auf einer
   nicht indizierten Geometrie ergibt `computeVertexNormals` je Dreieck eine
   eigene Normale — dann ist kein Punkt mehr wie der andere und
   `mergeVertices` legt nichts zusammen (gemessen: 15.024 -> 15.024). Die
   Normalen aus der Datei sind ohnehin die besseren: Sie tragen die weichen
   Übergänge, für die die Normal-Map gebacken wurde. */
const fein = BGU.mergeVertices(geo, 1e-5);

/** Fliesskomma zu ganzen Zahlen. Gibt Mitte und Radius zurück — beides muss
 *  am Knoten wieder herauskommen, sonst steht der Kürbis im Einheitswürfel. */
function quantisieren(g) {
  g.computeBoundingBox();
  const mitte = g.boundingBox.getCenter(new THREE.Vector3());
  const halb = g.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const radius = Math.max(halb.x, halb.y, halb.z);

  const p = g.attributes.position;
  const pi = new Int16Array(p.count * 3);
  for (let i = 0; i < p.count; i += 1) {
    pi[i * 3 + 0] = Math.round(((p.getX(i) - mitte.x) / radius) * 32767);
    pi[i * 3 + 1] = Math.round(((p.getY(i) - mitte.y) / radius) * 32767);
    pi[i * 3 + 2] = Math.round(((p.getZ(i) - mitte.z) / radius) * 32767);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pi, 3, true));

  const n = g.attributes.normal;
  const ni = new Int8Array(n.count * 3);
  const klemm = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127);
  for (let i = 0; i < n.count; i += 1) {
    ni[i * 3 + 0] = klemm(n.getX(i));
    ni[i * 3 + 1] = klemm(n.getY(i));
    ni[i * 3 + 2] = klemm(n.getZ(i));
  }
  g.setAttribute('normal', new THREE.BufferAttribute(ni, 3, true));

  const uv = g.attributes.uv;
  const ui = new Uint16Array(uv.count * 2);
  for (let i = 0; i < uv.count; i += 1) {
    ui[i * 2 + 0] = Math.round(Math.max(0, Math.min(1, uv.getX(i))) * 65535);
    ui[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, uv.getY(i))) * 65535);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(ui, 2, true));

  return { mitte, radius };
}

const { mitte, radius } = quantisieren(fein);
fein.computeBoundingBox();
fein.computeBoundingSphere();

const knoten = new THREE.Mesh(
  fein,
  new THREE.MeshStandardMaterial({ name: 'Kuerbis', color: 0xffffff, roughness: 0.8, metalness: 0 }),
);
knoten.name = 'Kuerbis';
knoten.position.copy(mitte);
knoten.scale.setScalar(radius);

const szene = new THREE.Group();
szene.add(knoten);

fs.mkdirSync(ziel, { recursive: true });
const glb = await new Promise((res, rej) => {
  new GLTFExporter().parse(szene, res, rej, { binary: true, onlyVisible: false });
});
const glbPfad = path.join(ziel, 'pumpkin.glb');
fs.writeFileSync(glbPfad, Buffer.from(glb));

/* --------------------------------------------------------------- Bilder */

const bilder = `
from PIL import Image
import os, sys
Image.MAX_IMAGE_PIXELS = None
q, z = sys.argv[1], sys.argv[2]
t = os.path.join(q, 'textures')
def hole(name):
    for f in os.listdir(t):
        if name.lower() in f.lower():
            return Image.open(os.path.join(t, f))
    raise SystemExit('Textur fehlt: ' + name)
G = 512
for name, quali, mod in (('albedo', 78, 'RGB'), ('emissive', 80, 'RGB'), ('normal', 88, 'RGB')):
    hole(name).convert(mod).resize((G, G), Image.LANCZOS).save(
        os.path.join(z, 'pumpkin-%s.webp' % name), 'WEBP', quality=quali, method=6)
# Rot = Verdeckung, Gruen = Rauheit, Blau = Metall. Eine Datei statt drei.
kanal = lambda n: hole(n).convert('L').resize((G, G), Image.LANCZOS)
Image.merge('RGB', (kanal('AO'), kanal('roughness'), kanal('metallic'))).save(
    os.path.join(z, 'pumpkin-orm.webp'), 'WEBP', quality=82, method=6)
`;
execFileSync('python3', ['-c', bilder, quelle, ziel], { stdio: 'inherit' });

/* ----------------------------------------------------------------- Bilanz */

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
const dateien = ['pumpkin.glb', 'pumpkin-albedo.webp', 'pumpkin-emissive.webp',
  'pumpkin-normal.webp', 'pumpkin-orm.webp'];
console.log(`Punkte:   ${vorher} -> ${fein.attributes.position.count}`);
console.log(`Dreiecke: ${fein.index.count / 3}`);
console.log('');
let summe = 0;
for (const d of dateien) {
  const p = path.join(ziel, d);
  summe += fs.statSync(p).size;
  console.log(`  ${d.padEnd(24)} ${kb(p).padStart(7)} KB`);
}
console.log(`  ${'zusammen'.padEnd(24)} ${(summe / 1024).toFixed(1).padStart(7)} KB`);
