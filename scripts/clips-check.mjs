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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelle = path.join(wurzel, 'public', 'models');

/* --- Knochennamen direkt aus dem GLB-Behälter lesen ---------------------- */
const glb = fs.readFileSync(path.join(modelle, 'xbot.glb'));
const jsonLaenge = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.slice(20, 20 + jsonLaenge).toString('utf8'));
const knochen = new Set((gltf.nodes || []).map((n) => n.name).filter(Boolean));
console.log(`Modell xbot.glb: ${knochen.size} benannte Knoten\n`);

const CLIPS = [
  ['dance.clip.json', 'Erledigt (normal)'],
  ['run.clip.json', 'Abmelden (normal)'],
  ['salute.clip.json', 'Sprache (normal)'],
  ['dance-retro.clip.json', 'Erledigt (retro)'],
  ['run-retro.clip.json', 'Abmelden (retro)'],
  ['salute-retro.clip.json', 'Sprache (retro)'],
  ['nod-retro.clip.json', 'Themewechsel (retro)'],
];

let fehler = 0;

for (const [datei, zweck] of CLIPS) {
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
for (const m of quelle.matchAll(/'(\/models\/[\w.-]+\.json)'/g)) {
  if (!fs.existsSync(path.join(wurzel, 'public', m[1]))) {
    console.log(`  FEHL  botClips verweist auf ${m[1]} — Datei fehlt`);
    fehler++;
  }
}

console.log(
  fehler === 0
    ? '\nAlle Bewegungen passen auf das Skelett und bewegen sich.'
    : `\n${fehler} Fehler.`,
);
process.exit(fehler ? 1 : 0);
