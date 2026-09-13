import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { setBotAvatar } from '@/lib/botAvatar';
import { idleFor, modelFor } from '@/lib/botClips';
import { useTheme } from '@/lib/useTheme';
import {
  ladeKuerbis, lichtSetzen, kerzenSchein, kuerbisFreigeben, VORNE,
} from '@/components/pumpkin/kuerbis';

/**
 * Wer im runden Knopf sitzt — und im Chat neben jeder Antwort steht.
 *
 * Im normalen Design der Roboter, im Retro die Figur mit Umhang, im Halloween
 * der Kürbis. Das ist keine Spielerei: Wer das Aussehen der Anwendung
 * wechselt, wechselt ihren Tonfall mit, und ein Roboter in einer Nacht voller
 * Spinnweben ist ein Fremdkörper.
 *
 * DER AUSSCHNITT
 * Bei den Figuren eng auf Kopf und Schultern — auf 56 Pixeln erkennt man von
 * einer ganzen Person nichts. Beim Kürbis genau umgekehrt: Er IST ein Kopf.
 * Ihn anzuschneiden nähme ihm das Gesicht, also steht er ganz im Bild.
 *
 * Die Entfernung ist gerechnet, nicht geraten: Der Knopf ist RUND, es zählt
 * also der eingeschriebene Kreis. Der Kürbis misst quer 1,24 und hoch 1,0;
 * vom Blickpunkt aus liegt sein fernster Punkt 0,80 entfernt. Bei 30 Grad
 * Bildwinkel braucht es dafür 0,80/tan(15°) ≈ 3,0 Einheiten. 2,7 lässt die
 * Ränder eine Spur überstehen — dafür füllt er den Knopf, statt darin zu
 * schwimmen. Der erste Anlauf stand bei 1,95: Da sah man nur den Mund.
 *
 * DAS PROFILBILD IM CHAT
 * Entsteht hier nebenbei. Sobald das Modell ein paar Bilder gelaufen ist,
 * wird ein Standbild aus der Leinwand gezogen und geteilt (`setBotAvatar`);
 * die Antworten zeigen dieses Bild. Ein Browser gibt nur eine Handvoll
 * WebGL-Kontexte gleichzeitig heraus — bekäme jede Antwort ihre eigene Szene,
 * wären nach zehn Nachrichten die oberen Avatare schwarz.
 *
 * Dafür braucht der Renderer `preserveDrawingBuffer`: Ohne das liefert
 * `toDataURL` je nach Browser eine leere Fläche, weil der Puffer nach dem
 * Zeichnen verworfen wird.
 */

/**
 * Wann das Standbild gezogen wird.
 *
 * Vorher stand hier "nach 12 Bildern". Das war eine Annahme über die
 * Geschwindigkeit des Geräts, nicht über die Szene: Auf einem Rechner ohne
 * Grafikbeschleunigung — gemessen im Prüflauf, zwei Szenen mit
 * schattenwerfender Kerze — lief die Schleife mit zwei Bildern je Sekunde.
 * Nach fünf Sekunden waren es elf, und im Chat stand neben jeder Antwort
 * weiter ein leerer Kreis.
 *
 * Jetzt zählt die ZEIT, und die Bilder sind nur die Untergrenze: Zwei
 * gerenderte Bilder, damit nichts Halbfertiges abgelichtet wird, und eine
 * Viertelsekunde, damit die Ruhebewegung der Figur eine natürliche Haltung
 * erreicht hat. Auf schnellen Geräten ist das dasselbe wie vorher (bei 60
 * Bildern je Sekunde sind 250 ms fünfzehn Bilder), auf langsamen kommt das
 * Bild überhaupt.
 */
const BILDER_MINDESTENS = 2;
const MS_BIS_STANDBILD = 250;

/** Grundhelligkeit der Kerze im kleinen Knopf. Etwas mehr als gross: Auf 56
 *  Pixeln geht ein zartes Glimmen im Rand unter. */
const KERZE_KLEIN = 3.6;

export default function AssistantBot({ size = 44 }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  // Beim Themewechsel muss die Szene neu aufgebaut werden — es ist ein anderes
  // Modell, nicht bloß eine andere Farbe.
  const theme = useTheme();

  useEffect(() => {
    setReady(false);
    const mount = mountRef.current;
    if (!mount) return undefined;

    const istKuerbis = theme === 'halloween';

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
        preserveDrawingBuffer: true,
      });
    } catch {
      return undefined;              // kein WebGL: der Aufrufer zeigt den Platzhalter
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (istKuerbis) {
      // Die Kerze muss drinbleiben, sonst leuchtet die Schale mit.
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(istKuerbis ? 30 : 26, 1, 0.1, 20);
    const blick = istKuerbis
      ? new THREE.Vector3(0, 0.5, 0)
      : new THREE.Vector3(0, 1.36, 0);
    camera.position.set(...(istKuerbis ? [0.10, 0.55, 2.70] : [0.28, 1.52, 1.62]));
    camera.lookAt(blick);

    let kerze = null;
    if (istKuerbis) {
      kerze = lichtSetzen(scene, { kerzenStaerke: KERZE_KLEIN, schattenkarte: 256 });
    } else {
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.3);
      key.position.set(2, 3, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xfff1ea, 1.4);
      rim.position.set(-2.5, 2, -2);
      scene.add(rim);
    }

    let mixer = null;
    let kuerbis = null;
    let disposed = false;
    let frames = 0;
    let daSeit = 0;               // wann zuerst etwas in der Szene stand
    let standbildGemacht = false;

    if (istKuerbis) {
      ladeKuerbis()
        .then((modell) => {
          if (disposed) return;
          kuerbis = modell;
          kuerbis.rotation.y = VORNE;
          scene.add(kuerbis);
          setReady(true);
        })
        .catch((err) => console.error('[AssistantBot] Kürbis konnte nicht laden', err));
    } else {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);

      const ruheUrl = idleFor(theme);
      const ladeModell = new Promise((res, rej) => loader.load(modelFor(theme), res, undefined, rej));
      const ladeRuhe = ruheUrl
        ? fetch(ruheUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Clip ${r.status}`))))
        : Promise.resolve(null);

      Promise.all([ladeModell, ladeRuhe])
        .then(([gltf, ruhe]) => {
          if (disposed) return;
          const model = gltf.scene;
          model.scale.setScalar(0.01);       // Mixamo liefert Zentimeter
          model.rotation.y = -0.35;          // leicht zum Betrachter, wie im Hauptbild
          model.traverse((o) => {
            if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false;
          });
          scene.add(model);

          const clip = ruhe
            ? THREE.AnimationClip.parse(ruhe.clip)
            : gltf.animations?.[0];          // beim Roboter im Modell eingebacken
          if (clip) {
            mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
          }
          setReady(true);
        })
        .catch((err) => console.error('[AssistantBot] konnte nicht laden', err));
    }

    const clock = new THREE.Clock();
    let t = 0;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;

      if (mixer) mixer.update(dt);
      if (kuerbis) {
        // Ein leises Wiegen, kein Kreisel: Der Knopf steht auf jeder Seite
        // im Blickfeld, und etwas, das dort dauernd rotiert, zieht den Blick
        // von der Arbeit weg.
        kuerbis.rotation.y = VORNE + Math.sin(t * 0.5) * 0.16;
        kuerbis.rotation.z = Math.sin(t * 1.7) * 0.015;
        kerze.intensity = kerzenSchein(t, KERZE_KLEIN);
      }

      renderer.render(scene, camera);

      /**
       * Das Standbild.
       *
       * Gezählt wird erst, wenn wirklich etwas dasteht — vorher wäre es ein
       * leerer Kreis. Beim Roboter war die Bedingung `mixer`; der Kürbis hat
       * keinen, deshalb fragt sie jetzt nach dem, worauf es ankommt: Ist
       * jemand in der Szene?
       */
      if (mixer || kuerbis) {
        frames += 1;
        if (!daSeit) daSeit = performance.now();
        const reif = frames >= BILDER_MINDESTENS && performance.now() - daSeit >= MS_BIS_STANDBILD;
        if (!standbildGemacht && reif) {
          standbildGemacht = true;
          /* Kein stilles Verschlucken: Wenn das Standbild nicht entsteht,
             bleibt im Chat neben jeder Antwort ein leerer Kreis — und
             niemand käme auf die Idee, das hier zu suchen. */
          try {
            setBotAvatar(renderer.domElement.toDataURL('image/png'));
          } catch (err) {
            console.warn('[AssistantBot] kein Standbild', err?.message || err);
          }
        }
      }
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (istKuerbis) {
        kuerbisFreigeben(scene);
      } else {
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
          }
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [size, theme]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    />
  );
}
