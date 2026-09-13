/**
 * Aus 42 MB Rohmaterial werden rund 340 KB Kürbis.
 *
 *   node scripts/pumpkin-build.mjs <halloween_pumpkin.glb> [ziel]
 *
 * Die Quelle ist die GLB des CC-Modells "Halloween Pumpkin LP", so wie sie
 * heruntergeladen wird: eine Geometrie und vier 4096er Texturen, alles
 * eingebettet. So wie sie kommt, ist sie für eine Webseite unbrauchbar.
 *
 * WARUM DIE GLB UND NICHT MEHR DIE FBX
 * Der erste Anlauf las die FBX aus demselben Paket. Das Ergebnis sah
 * plastisch aus, aber nicht echt — und zwar aus zwei Gründen, die man dem
 * Bild nicht ansieht, dem Datensatz aber schon:
 *
 *   1. Die FBX hat keine TANGENTEN. Ohne sie muss die Grafikkarte für die
 *      Normal-Map je Bildpunkt ein Koordinatensystem aus den Ableitungen
 *      raten. Das Ergebnis ist weicher und an den UV-Nähten unruhig. Die GLB
 *      bringt die Tangenten mit, die beim Backen der Map verwendet wurden —
 *      also genau die, für die sie gerechnet ist.
 *   2. Die GLB sagt `doubleSided`. Ein Kürbis ist innen hohl; wer durch die
 *      geschnitzten Augen sieht, schaut auf die RÜCKSEITE der Schale. Ohne
 *      beidseitige Flächen fehlen dort Dreiecke.
 *
 * WAS ES TUT
 *   1. Nur die Geometrie einlesen. Dafür werden Materialien, Texturen und
 *      Bilder vorher aus dem JSON-Teil entfernt — sonst versucht der Lader
 *      im Node-Prozess, vier 4096er Bilder zu dekodieren, wozu es dort
 *      keinen Browser gibt.
 *   2. Die Knotenkette einbacken (die Datei kommt von Sketchfab und trägt
 *      drei ineinander verschachtelte Matrizen), auf den Ursprung stellen,
 *      auf 1 Meter Höhe normieren. Danach braucht die Anzeige keine
 *      Zauberzahlen.
 *   3. Quantisieren: Positionen und Tangenten als normierte Int16, Normalen
 *      als Int8, UV als Uint16. glTF kennt genau diese Formate.
 *   4. Texturen auf 1024 verkleinern und als WebP ablegen. Die zweite —
 *      Verdeckung, Rauheit und Metall in den drei Kanälen EINER Datei —
 *      liegt schon fertig gepackt vor; genau die Belegung, die glTF für
 *      occlusion/roughness/metalness vorsieht.
 *
 * WARUM 1024 UND NICHT 512
 * Bei 512 kostete alles zusammen 88 KB, bei 1024 sind es 252. Der
 * Unterschied liegt fast ganz an der Normal-Map, und man sieht ihn: Die
 * Rippen des Kürbis und die Schnittkanten am Gesicht sind das, woran ein
 * Auge "echt" festmacht. Zum Vergleich: Der Roboter im selben Knopf wiegt
 * 333 KB. Der Kürbis liegt mit 342 daneben, nicht darüber.
 *
 * WARUM DIE BILDER NEBEN DER GLB LIEGEN
 * So lässt sich ihre Grösse ändern, ohne das Modell neu zu rechnen, und der
 * Browser lädt sie parallel statt hintereinander aus einer Datei.
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
const ziel = process.argv[3] || path.join(wurzel, 'src', 'assets', 'pumpkin');

if (!quelle || !fs.existsSync(quelle)) {
  console.error('Aufruf: node scripts/pumpkin-build.mjs <halloween_pumpkin.glb> [ziel]');
  process.exit(2);
}

/* --- Umgebung: Three.js erwartet einen Browser ---------------------------
 *
 * GLTFLoader und GLTFExporter greifen auf `TextDecoder`, `Blob` und
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
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

/* ----------------------------------------------------------- Die GLB lesen */

const roh = fs.readFileSync(quelle);
if (roh.subarray(0, 4).toString() !== 'glTF') {
  console.error('Das ist keine .glb (die Datei beginnt nicht mit "glTF").');
  process.exit(2);
}

/** Die beiden Abschnitte einer GLB: JSON und Binärteil. */
function abschnitte(buf) {
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const laenge = buf.readUInt32LE(off);
    const art = buf.subarray(off + 4, off + 8).toString();
    const inhalt = buf.subarray(off + 8, off + 8 + laenge);
    if (art.startsWith('JSON')) json = JSON.parse(inhalt.toString('utf8'));
    if (art.startsWith('BIN')) bin = Buffer.from(inhalt);
    off += 8 + laenge;
  }
  return { json, bin };
}

const { json, bin } = abschnitte(roh);
const bilder = (json.images || []).map((im) => {
  const bv = json.bufferViews[im.bufferView];
  const von = bv.byteOffset || 0;
  return { mime: im.mimeType, daten: bin.subarray(von, von + bv.byteLength) };
});

/**
 * Alles Bildhafte aus dem JSON nehmen, bevor der Lader es sieht.
 *
 * Sonst bekommt `GLTFLoader.parse` vier eingebettete 4096er PNG/JPEG und
 * versucht, sie über `Blob`-Adressen zu dekodieren — in Node gibt es dafür
 * keinen Decoder, und der Aufruf endet mit einer Fehlermeldung über eine
 * Bilddatei, obwohl es hier um Geometrie geht. Die Bilder werden weiter oben
 * direkt aus dem Binärteil geholt; der Lader braucht sie nicht.
 */
const nurGeometrie = JSON.parse(JSON.stringify(json));
delete nurGeometrie.materials;
delete nurGeometrie.textures;
delete nurGeometrie.images;
delete nurGeometrie.samplers;
for (const m of nurGeometrie.meshes || []) {
  for (const p of m.primitives || []) delete p.material;
}

/** JSON und Binärteil wieder zu einer GLB zusammensetzen. */
function glbBauen(jsonTeil, binTeil) {
  const j = Buffer.from(JSON.stringify(jsonTeil), 'utf8');
  const jPad = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const bPad = Buffer.concat([binTeil, Buffer.alloc((4 - (binTeil.length % 4)) % 4, 0)]);
  const kopf = Buffer.alloc(12);
  kopf.write('glTF', 0);
  kopf.writeUInt32LE(2, 4);
  kopf.writeUInt32LE(12 + 8 + jPad.length + 8 + bPad.length, 8);
  const jk = Buffer.alloc(8); jk.writeUInt32LE(jPad.length, 0); jk.write('JSON', 4);
  const bk = Buffer.alloc(8); bk.writeUInt32LE(bPad.length, 0); bk.write('BIN\0', 4);
  return Buffer.concat([kopf, jk, jPad, bk, bPad]);
}

const schlank = glbBauen(nurGeometrie, bin);
const gltf = await new Promise((res, rej) => {
  new GLTFLoader().parse(
    schlank.buffer.slice(schlank.byteOffset, schlank.byteOffset + schlank.byteLength),
    '', res, rej,
  );
});

let mesh = null;
gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
if (!mesh) { console.error('Kein Mesh in der GLB.'); process.exit(2); }
gltf.scene.updateMatrixWorld(true);

const geo = mesh.geometry.clone();
/* `applyMatrix4` nimmt Positionen, Normalen UND Tangenten mit — letztere
   über `transformDirection`, das die Händigkeit im vierten Wert unangetastet
   lässt. Genau deshalb wird hier gebacken und nicht am Knoten skaliert. */
geo.applyMatrix4(mesh.matrixWorld);

// Fuss auf y=0, waagerecht mittig, Höhe genau 1.
geo.computeBoundingBox();
const grob = geo.boundingBox;
const groesse = grob.getSize(new THREE.Vector3());
const mitteGrob = grob.getCenter(new THREE.Vector3());
geo.translate(-mitteGrob.x, -grob.min.y, -mitteGrob.z);
geo.scale(1 / groesse.y, 1 / groesse.y, 1 / groesse.y);

/** Fliesskomma zu ganzen Zahlen. Mitte und Radius müssen am Knoten zurück. */
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

  const klemm8 = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127);
  const n = g.attributes.normal;
  const ni = new Int8Array(n.count * 3);
  for (let i = 0; i < n.count; i += 1) {
    ni[i * 3 + 0] = klemm8(n.getX(i));
    ni[i * 3 + 1] = klemm8(n.getY(i));
    ni[i * 3 + 2] = klemm8(n.getZ(i));
  }
  g.setAttribute('normal', new THREE.BufferAttribute(ni, 3, true));

  /**
   * Tangenten bekommen 16 Bit, nicht 8.
   *
   * Bei einer Normal-Map von 1024 Pixeln liegt der Winkelfehler von Int8
   * (rund 0,45°) sichtbar über dem, was die Map auflöst — es entstünde ein
   * Streifenmuster entlang der Rippen. Der vierte Wert ist die Händigkeit
   * und darf nur +1 oder -1 sein.
   */
  const t = g.attributes.tangent;
  if (t) {
    const klemm16 = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
    const ti = new Int16Array(t.count * 4);
    for (let i = 0; i < t.count; i += 1) {
      ti[i * 4 + 0] = klemm16(t.getX(i));
      ti[i * 4 + 1] = klemm16(t.getY(i));
      ti[i * 4 + 2] = klemm16(t.getZ(i));
      ti[i * 4 + 3] = t.getW(i) < 0 ? -32767 : 32767;
    }
    g.setAttribute('tangent', new THREE.BufferAttribute(ti, 4, true));
  }

  const uv = g.attributes.uv;
  const ui = new Uint16Array(uv.count * 2);
  for (let i = 0; i < uv.count; i += 1) {
    ui[i * 2 + 0] = Math.round(Math.max(0, Math.min(1, uv.getX(i))) * 65535);
    ui[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, uv.getY(i))) * 65535);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(ui, 2, true));

  return { mitte, radius };
}

const { mitte, radius } = quantisieren(geo);

/**
 * Der Index kommt als 32 Bit — bei 2.602 Punkten sind 16 genug.
 *
 * Die Quelldatei zählt so, weil sie nichts über die Grösse voraussetzt; 65.535
 * Punkte deckt ein `Uint16` ab, hier sind es vier Prozent davon. Die 15.024
 * Einträge kosten damit 30 statt 60 KB — ein Viertel der ganzen Datei, für
 * nichts.
 */
if (geo.index && geo.index.array.BYTES_PER_ELEMENT > 2 && geo.attributes.position.count <= 65535) {
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(geo.index.array), 1));
}

geo.computeBoundingBox();
geo.computeBoundingSphere();

const knoten = new THREE.Mesh(
  geo,
  new THREE.MeshStandardMaterial({ name: 'Kuerbis', color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
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
fs.writeFileSync(path.join(ziel, 'pumpkin.glb'), Buffer.from(glb));

/* --------------------------------------------------------------- Bilder */

const rollen = ['albedo', 'orm', 'emissive', 'normal'];   // Reihenfolge wie in der GLB
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'kuerbis-'));
bilder.forEach((b, i) => {
  const ext = b.mime === 'image/jpeg' ? 'jpg' : 'png';
  fs.writeFileSync(path.join(tmp, `${rollen[i]}.${ext}`), b.daten);
});

const verkleinern = `
from PIL import Image, ImageStat
import os, sys, glob
Image.MAX_IMAGE_PIXELS = None
q, z = sys.argv[1], sys.argv[2]
G = 1024
QUALI = {'albedo': 80, 'orm': 82, 'emissive': 82, 'normal': 88}

def hole(rolle):
    treffer = glob.glob(os.path.join(q, rolle + '.*'))
    if not treffer:
        raise SystemExit('Textur fehlt: ' + rolle)
    return Image.open(treffer[0]).convert('RGB').resize((G, G), Image.LANCZOS)

# --- Albedo aufhellen ---------------------------------------------------
#
# Die Textur ist fuer eine helle Umgebung gebacken (ein HDR-Panorama), die
# es hier nicht gibt: Ihr Mittelwert ist #965124, ein dunkles Rotbraun. In
# der Nacht der Startseite kam damit eine verkohlte Ruebe heraus. Der erste
# Versuch, das mit dreifachem Licht zu erschlagen, machte es schlimmer —
# starkes Licht auf einer teils glaenzenden Flaeche ist Plastik.
#
# Also wird die Textur selbst angehoben, und zwar mit einer Kurve, nicht mit
# einem Faktor: Ein Faktor wuerde die hellen Stellen abschneiden. Gamma 0,55
# hebt die Mitten und laesst die Spitzen, wo sie sind.
albedo = hole('albedo')
tabelle = [min(255, round(255 * ((i / 255) ** 0.55))) for i in range(256)] * 3
albedo = albedo.point(tabelle)
print('  Albedo-Mittel nach dem Anheben: #%02x%02x%02x'
      % tuple(round(x) for x in ImageStat.Stat(albedo).mean))
albedo.save(os.path.join(z, 'pumpkin-albedo.webp'), 'WEBP', quality=QUALI['albedo'], method=6)

# --- Rauheit nach unten begrenzen ---------------------------------------
#
# Der Gruenkanal der ORM-Datei geht bis 80 hinunter, also Rauheit 0,31 —
# das ist nasses Fruchtfleisch. Auf der ganzen Schale ergibt das im Licht
# harte Glanzlichter, und ein Kuerbis aus Plastik. Eine Kuerbisschale ist
# matt bis seidig; unter 0,55 geht sie hier nicht.
orm = hole('orm')
r, g, b = orm.split()
BODEN = 118                                   # 118/255 = 0,46 — matt, aber nicht staubig
g = g.point(lambda v: BODEN + round(v * (255 - BODEN) / 255))
Image.merge('RGB', (r, g, b)).save(
    os.path.join(z, 'pumpkin-orm.webp'), 'WEBP', quality=QUALI['orm'], method=6)

for rolle in ('emissive', 'normal'):
    hole(rolle).save(os.path.join(z, 'pumpkin-%s.webp' % rolle),
                     'WEBP', quality=QUALI[rolle], method=6)
`;
execFileSync('python3', ['-c', verkleinern, tmp, ziel], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });

/* ----------------------------------------------------------------- Bilanz */

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
const dateien = ['pumpkin.glb', ...rollen.map((r) => `pumpkin-${r}.webp`)];
console.log(`Punkte:   ${geo.attributes.position.count}`);
console.log(`Dreiecke: ${geo.index.count / 3}`);
console.log(`Tangenten: ${geo.attributes.tangent ? 'ja' : 'NEIN — die Normal-Map wird flau aussehen'}`);
console.log('');
let summe = 0;
for (const d of dateien) {
  const p = path.join(ziel, d);
  summe += fs.statSync(p).size;
  console.log(`  ${d.padEnd(24)} ${kb(p).padStart(7)} KB`);
}
console.log(`  ${'zusammen'.padEnd(24)} ${(summe / 1024).toFixed(1).padStart(7)} KB`);
