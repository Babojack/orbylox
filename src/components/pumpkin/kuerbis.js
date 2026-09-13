import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Der Kürbis: Modell, Material, Kerzenlicht — einmal beschrieben.
 *
 * Er tritt an zwei Stellen auf: gross in der Figuren-Sektion der Startseite
 * und klein im runden Knopf des Assistenten. Beide brauchen dasselbe Modell,
 * dasselbe Material und dasselbe Licht; unterschiedlich sind nur Ausschnitt
 * und Bewegung. Ohne diese Datei stünde die Materialbeschreibung zweimal da,
 * und beim nächsten Nachjustieren wäre eine der beiden vergessen worden.
 *
 * WOHER DAS MODELL KOMMT
 * Ein CC-Modell ("Halloween Pumpkin LP"), aus 42 MB auf 344 KB gerechnet —
 * `scripts/pumpkin-build.mjs` macht das und schreibt auf, warum so. Das
 * Modell ist genau einen Meter hoch und steht mit dem Fuss auf y=0; hier
 * stehen deshalb keine Zauberzahlen.
 */

const MODELL = '/models/pumpkin.glb';
const TEXTUREN = {
  albedo: '/models/pumpkin-albedo.webp',
  emissive: '/models/pumpkin-emissive.webp',
  normal: '/models/pumpkin-normal.webp',
  orm: '/models/pumpkin-orm.webp',
};

/* Aus `theme-halloween.css`, damit die Szene zur Seite passt. */
export const KERZE = 0xffb03a;
export const MOND = 0xbda9e0;

/**
 * KEIN Farbton auf der Textur.
 *
 * Zwei Anläufe lang stand hier der Kürbiston des Themes und danach ein
 * hellerer. Beide waren falsch, und zwar grundsätzlich: `color` wird mit der
 * Albedo MULTIPLIZIERT, und deren Mittelwert ist #965124 — ein dunkles
 * Rotbraun. Multiplizieren kann nur dunkler machen. Der Kürbis sah aus wie
 * eine verkohlte Rübe, und je "oranger" der Ton, desto dunkler das Ergebnis.
 *
 * Die Textur ist gebacken, wie sie ist; hell wird sie durch LICHT, nicht
 * durch Färben. Deshalb Weiss — und dafür ein kräftigerer Streifer.
 */
export const KUERBIS_TON = 0xffffff;

/** Die Drehung, bei der das Gesicht zur Kamera zeigt. Am Modell abgelesen. */
export const VORNE = 0.6;

/**
 * Texturen laden.
 *
 * `flipY = false` ist bei glTF Pflicht: Dort läuft die V-Achse anders herum
 * als in den Bildformaten, und `TextureLoader` dreht von sich aus um. Ohne
 * diese Zeile sässe das Gesicht auf dem Kopf.
 *
 * Farbe oder Zahlen — das ist der Unterschied zwischen `SRGBColorSpace` und
 * `NoColorSpace`: Albedo und Emissive sind Farben, Normale und ORM sind
 * Messwerte und dürfen nicht durch die Gamma-Kurve.
 */
function holeTextur(lader, url, alsFarbe) {
  return new Promise((res, rej) => {
    lader.load(url, (t) => {
      t.flipY = false;
      t.colorSpace = alsFarbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 4;
      res(t);
    }, undefined, rej);
  });
}

/**
 * Modell und Texturen holen und zusammensetzen.
 *
 * WAS DAS MATERIAL RICHTIG MACHT, UND WARUM ES DARAUF ANKOMMT
 *
 *   `side: DoubleSide` — ein Kürbis ist hohl. Wer durch die geschnitzten
 *   Augen sieht, schaut auf die RÜCKSEITE der Schale. Einseitig fehlen dort
 *   Dreiecke, und man sieht durch den Kürbis hindurch ins Nichts.
 *
 *   Die Tangenten stecken im Modell. Three.js benutzt sie von selbst, sobald
 *   eine Normal-Map da ist — ohne sie müsste die Grafikkarte je Bildpunkt
 *   raten, und die Rippen blieben weich. Das war der sichtbare Unterschied
 *   zwischen "plastisch" und "echt".
 *
 *   Verdeckung liest den ZWEITEN UV-Satz. Das Modell hat nur einen — also
 *   denselben noch einmal anmelden, sonst bleibt `aoMap` ohne jede Wirkung
 *   und niemand sieht, warum.
 */
export async function ladeKuerbis() {
  const tl = new THREE.TextureLoader();
  const [gltf, albedo, emissive, normal, orm] = await Promise.all([
    new GLTFLoader().loadAsync(MODELL),
    holeTextur(tl, TEXTUREN.albedo, true),
    holeTextur(tl, TEXTUREN.emissive, true),
    holeTextur(tl, TEXTUREN.normal, false),
    holeTextur(tl, TEXTUREN.orm, false),
  ]);

  const mesh = gltf.scene.getObjectByProperty('isMesh', true);
  if (!mesh) throw new Error('Kein Mesh in pumpkin.glb');

  const g = mesh.geometry;
  if (g.attributes.uv && !g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv);

  mesh.material.dispose();
  mesh.material = new THREE.MeshStandardMaterial({
    map: albedo,
    color: KUERBIS_TON,          // die Textur ist blass, das ist der Ton
    normalMap: normal,
    aoMap: orm,
    roughnessMap: orm,
    roughness: 1,                // die Stärke steht im Grünkanal
    metalness: 0,                // der Blaukanal ist überall null — ein Kürbis glänzt nicht
    emissiveMap: emissive,
    emissive: new THREE.Color(0xff8c1a),
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return gltf.scene;
}

/**
 * Das Licht einer Nacht: wenig von oben, ein warmer Streifer von vorn, eine
 * kühle Kante von hinten — und die Kerze im Inneren, die die eigentliche
 * Arbeit macht.
 *
 * WARUM DIE KERZE SCHATTEN WIRFT
 * Ohne `castShadow` scheint ein Punktlicht mitten im Kürbis einfach durch die
 * Schale: Beim ersten Rendern glühte er als Ganzes, wie eine Lampe in
 * Kürbisform. Mit Schatten bleibt das Licht drinnen und kommt nur dort
 * heraus, wo jemand geschnitzt hat — Augen, Nase, Mund. Genau das ist der
 * Kürbis.
 *
 * Ein Punktlicht braucht dafür sechs Schattenbilder (eine Würfelkarte). Bei
 * 5.008 Dreiecken ist das billig; im kleinen Knopf reichen 256 Pixel
 * Kantenlänge, weil das Licht ohnehin weich ist.
 */
export function lichtSetzen(scene, { kerzenStaerke = 3.2, schattenkarte = 512 } = {}) {
  scene.add(new THREE.HemisphereLight(MOND, 0x2a1a12, 0.7));

  const key = new THREE.DirectionalLight(0xffd9a0, 2.2);
  key.position.set(2, 3, 2.5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(MOND, 1.1);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);

  const kerze = new THREE.PointLight(KERZE, kerzenStaerke, 4, 2);
  kerze.position.set(0, 0.42, 0);
  kerze.castShadow = true;
  kerze.shadow.mapSize.set(schattenkarte, schattenkarte);
  kerze.shadow.camera.near = 0.02;
  kerze.shadow.camera.far = 3;
  kerze.shadow.bias = -0.004;
  scene.add(kerze);

  return kerze;
}

/**
 * Das Flackern.
 *
 * Zwei Sinus mit unrundem Verhältnis, damit kein Rhythmus erkennbar wird,
 * und ein Aufleuchten im Takt der Musik (`pegel`, 0 wenn nichts läuft).
 */
export function kerzenSchein(t, grund = 3.2, pegel = 0) {
  return grund
    + Math.sin(t * 7.3) * 0.22
    + Math.sin(t * 11.7) * 0.13
    + pegel * 2.2;
}

/** Alles freigeben, was am Grafikspeicher hängt — auch die vier Bilder. */
export function kuerbisFreigeben(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']
        .forEach((k) => m[k]?.dispose?.());
      m.dispose();
    });
  });
}
