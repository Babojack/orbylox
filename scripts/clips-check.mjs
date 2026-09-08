/**
 * Passen die Bewegungen der Figur auf das Modell — und bewegen sie sich?
 *
 *   npm run check:clips
 *
 * Drei Fehlerarten, die eine Datei stumm kaputt machen:
 *
 *   1. Eine Spur trifft keinen Knochen in `xbot.glb`. Dann meckert der Mischer
 *      bei JEDEM Auftritt in die Konsole und der Knochen bleibt stehen. Die
 *      neuen Mixamo-Dateien stammen von einer Figur mit Umhang und brachten
 *      sieben zusätzliche Knochen mit (`Neck1`, `Cloak1`–`Cloak6`).
 *
 *   2. Der Clip verändert sich nicht über die Zeit — etwa wenn beim Ausdünnen
 *      zu grob gerechnet wurde. Die Datei ist gültig, die Figur steht still.
 *
 *   3. Und einer, der wirklich passiert ist: Spuren mit weniger als drei
 *      Bildern kamen aus dem Umrechner als three-Objekt zurück statt als
 *      schlichtes JSON. Deren `type` ist ein berechneter Zugriff und fiel beim
 *      Serialisieren weg. Die Datei sah tadellos aus und ließ sich im Browser
 *      nicht laden: "track type undefined, can not parse".
 */

/* --------------------------------------------------------------------------
 * Node hat kein DOM. Der GLTF-Loader will trotzdem eines: für Blob-URLs und
 * für die Bilder, auf deren `load`-Ereignis er wartet. Bleibt das aus, wird
 * sein Versprechen nie eingelöst und die Prüfung hängt STILL — ohne Fehler,
 * ohne Ausgabe. Die Pixel interessieren hier nicht, nur die Verdrahtung.
 * -------------------------------------------------------------------------- */
globalThis.self = globalThis;
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.URL.revokeObjectURL = () => {};
globalThis.createImageBitmap = undefined;
const stubBild = () => {
  const hoerer = {};
  return {
    style: {}, width: 1, height: 1,
    setAttribute() {}, getContext: () => null,
    addEventListener(n, f) { (hoerer[n] ||= []).push(f); },
    removeEventListener() {},
    set src(_) { queueMicrotask(() => (hoerer.load || []).forEach((f) => f({ target: this }))); },
    get src() { return 'stub'; },
  };
};
globalThis.document = globalThis.document || { createElement: stubBild, createElementNS: stubBild };

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelle = path.join(wurzel, 'public', 'models');

/* --- Knochennamen direkt aus dem GLB-Behälter lesen ---------------------- */

/**
 * ZWEI Modelle, nicht eines.
 *
 * Im normalen Design tritt der Roboter auf, im Retro die Figur mit Umhang. Ihre
 * Skelette sind NICHT gleich: Sie hat sieben Knochen mehr. Deshalb wird jeder
 * Clip gegen das Modell geprüft, mit dem er auch wirklich läuft — sonst geht
 * genau die Verwechslung durch, die hier verhindert werden soll.
 */
function knochenVon(datei) {
  const glb = fs.readFileSync(path.join(modelle, datei));
  const laenge = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.slice(20, 20 + laenge).toString('utf8'));
  return new Set((gltf.nodes || []).map((n) => n.name).filter(Boolean));
}

const MODELLE = {
  normal: { datei: 'xbot.glb', knochen: knochenVon('xbot.glb') },
  retro: { datei: 'retro-figure.glb', knochen: knochenVon('retro-figure.glb') },
};
for (const [name, m] of Object.entries(MODELLE)) {
  const kb = (fs.statSync(path.join(modelle, m.datei)).size / 1024).toFixed(0);
  console.log(`Modell ${name.padEnd(7)} ${m.datei.padEnd(18)} ${m.knochen.size} Knoten  ${kb} KB`);
}
console.log();

const CLIPS = [
  ['dance.clip.json', 'Erledigt (normal)', 'normal'],
  ['run.clip.json', 'Abmelden (normal)', 'normal'],
  ['salute.clip.json', 'Sprache (normal)', 'normal'],
  ['dance-retro.clip.json', 'Erledigt (retro)', 'retro'],
  ['run-retro.clip.json', 'Abmelden (retro)', 'retro'],
  ['salute-retro.clip.json', 'Sprache (retro)', 'retro'],
  ['nod-retro.clip.json', 'Themewechsel (retro)', 'retro'],
];

let fehler = 0;

for (const [datei, zweck, welt] of CLIPS) {
  const pfad = path.join(modelle, datei);
  if (!fs.existsSync(pfad)) {
    console.log(`  FEHL  ${zweck.padEnd(22)} ${datei} fehlt`);
    fehler++;
    continue;
  }
  const d = JSON.parse(fs.readFileSync(pfad, 'utf8'));

  let clip;
  try {
    clip = THREE.AnimationClip.parse(d.clip);   // wirft bei fehlendem Spurtyp
  } catch (err) {
    console.log(`  FEHL  ${zweck.padEnd(22)} ${datei}: ${err.message}`);
    fehler++;
    continue;
  }

  const knochen = MODELLE[welt].knochen;
  const verwaist = [...new Set(clip.tracks.map((t) => t.name.split('.')[0]))]
    .filter((b) => !knochen.has(b));

  // Bewegt sich etwas? Größter Werteausschlag über alle Spuren.
  let spanne = 0;
  for (const t of clip.tracks) {
    const s = t.getValueSize();
    for (let k = 0; k < s; k++) {
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < t.times.length; i++) {
        const v = t.values[i * s + k];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      spanne = Math.max(spanne, mx - mn);
    }
  }

  const peakOk = d.peak == null || (d.peak > 0 && d.peak < d.duration);
  const ok = verwaist.length === 0 && spanne > 0.05 && peakOk && clip.duration > 0.2;
  if (!ok) fehler++;

  console.log(
    `  ${ok ? 'OK  ' : 'FEHL'}  ${zweck.padEnd(22)} ${datei.padEnd(23)}` +
    ` ${clip.duration.toFixed(2)}s  ${clip.tracks.length} Spuren  Ausschlag ${spanne.toFixed(1)}` +
    (d.peak ? `  Höhepunkt ${d.peak}s` : '') +
    (verwaist.length ? `  FREMDE KNOCHEN: ${verwaist.join(', ')}` : '') +
    (peakOk ? '' : '  HÖHEPUNKT AUSSERHALB DER DAUER'),
  );
}

/* --- Verweist die Zuordnung auf Dateien, die es gibt? -------------------- */
const quelle = fs.readFileSync(path.join(wurzel, 'src/lib/botClips.js'), 'utf8');
for (const m of quelle.matchAll(/'(\/models\/[\w.-]+\.(?:json|glb))'/g)) {
  if (!fs.existsSync(path.join(wurzel, 'public', m[1]))) {
    console.log(`  FEHL  botClips verweist auf ${m[1]} — Datei fehlt`);
    fehler++;
  }
}

/* --- Und jetzt wirklich laden und abspielen ------------------------------ */

/**
 * Die Prüfungen oben lesen Dateien. Diese hier baut die Szene tatsächlich auf:
 * Modell laden, Bewegung anwenden, nachsehen, ob sich die Knochen rühren —
 * ALLE, nicht nur die des Körpers. Genau daran wäre die Retro-Figur beinahe
 * gescheitert: Ihre FBX brachte vier Kopien desselben Skeletts mit, und der
 * Mischer hätte nur die erste bedient. Körper tanzt, Umhang steht.
 */
console.log('\n  — Szene tatsächlich aufbauen —');

async function ladeModell(datei) {
  const glb = fs.readFileSync(path.join(modelle, datei));
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(
    glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '', res, rej));
}

const warnungen = [];
const echtesWarn = console.warn;
console.warn = (...a) => warnungen.push(a.join(' '));

for (const [welt, clipDatei] of [['normal', 'dance.clip.json'], ['retro', 'dance-retro.clip.json']]) {
  const m = MODELLE[welt];
  let gltf;
  try {
    gltf = await ladeModell(m.datei);
  } catch (err) {
    console.log(`  FEHL  ${m.datei} lässt sich nicht laden: ${err.message}`);
    fehler++;
    continue;
  }
  const model = gltf.scene;
  const haeute = [];
  model.traverse((o) => { if (o.isSkinnedMesh) haeute.push(o); });

  const daten = JSON.parse(fs.readFileSync(path.join(modelle, clipDatei), 'utf8'));
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(THREE.AnimationClip.parse(daten.clip)).play();

  model.updateMatrixWorld(true);
  const vorher = new Map();
  const alleKnochen = [...new Set(haeute.flatMap((h) => h.skeleton.bones))];
  for (const b of alleKnochen) vorher.set(b, b.getWorldPosition(new THREE.Vector3()).clone());

  mixer.update(Math.min(1.4, daten.duration * 0.4));
  model.updateMatrixWorld(true);

  const bewegt = alleKnochen.filter(
    (b) => b.getWorldPosition(new THREE.Vector3()).distanceTo(vorher.get(b)) > 0.5).length;
  /**
   * Entscheidend ist NICHT, ob es ein Skelett-Objekt ist, sondern ob jeder
   * Knochen sich bewegt. Der Roboter hat zwei Skelette und läuft seit jeher
   * einwandfrei: Seine zweite Kette hängt unter der ersten und wird
   * mitgezogen. Die erste Fassung dieser Prüfung verlangte "genau ein
   * Skelett" und meldete deshalb den funktionierenden Roboter als Fehler —
   * eine Zusicherung, die die Umsetzung beschreibt statt das Ergebnis.
   */
  const skelette = new Set(haeute.map((h) => h.skeleton)).size;
  const ok = bewegt === alleKnochen.length;
  if (!ok) fehler++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${welt.padEnd(7)} ${haeute.length} Mesh(es),` +
              ` ${skelette} Skelett(e), bewegte Knochen ${bewegt}/${alleKnochen.length}`);
}

console.warn = echtesWarn;
const echteWarnungen = warnungen.filter((w) => !/deprecated|THREE.Material/i.test(w));
if (echteWarnungen.length) {
  console.log(`  FEHL  Warnungen beim Abspielen: ${echteWarnungen.slice(0, 3).join(' | ')}`);
  fehler++;
} else {
  console.log('  OK    keine Warnungen vom Mischer');
}

console.log(
  fehler === 0
    ? '\nAlle Bewegungen passen auf ihr Modell, laufen und bewegen jeden Knochen.'
    : `\n${fehler} Fehler.`,
);
process.exit(fehler ? 1 : 0);
