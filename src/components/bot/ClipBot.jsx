import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Die ORBYLOX-Figur, die eine mitgegebene Bewegung einmal abspielt.
 *
 * Ein Bauteil für alle Anlässe: der Gruß beim Sprachwechsel, der Tanz beim
 * erledigten Ticket, und was später dazukommt. Unterschiedlich sind nur die
 * Bewegungsdatei und der Bildausschnitt.
 *
 * Herkunft der Bewegungen: Mixamo-FBX-Dateien. Im Bundle liegt weder eine FBX
 * noch ein FBX-Loader — die Spuren wurden einmalig zu JSON umgerechnet und
 * fehlerbegrenzt ausgedünnt. Das Skelett ist dasselbe wie in `xbot.glb`, alle
 * 52 Knochen passen ohne Umbenennung; das Modell liegt also nur einmal da und
 * kommt beim zweiten Anlass aus dem Zwischenspeicher.
 *
 * Meldungen nach außen:
 *   onPeak — der Höhepunkt der Bewegung (nur wenn die Datei einen nennt)
 *   onDone — die Bewegung ist durch
 *   onFail — WebGL fehlt oder etwas ließ sich nicht laden
 *
 * `onFail` ist keine Nebensache: Was am Ende der Bewegung passieren soll,
 * muss auch dann passieren, wenn es die Bewegung gar nicht gibt.
 */

const MODEL_URL = '/models/xbot.glb';

/**
 * Bildausschnitte. `spin` dreht die Figur um die Hochachse.
 *
 * `exit` dreht sie um 180°, damit sie vom Betrachter WEG läuft statt auf ihn
 * zu. Die Bewegung "Run Look Back" trägt sich über vier Meter nach vorn; ohne
 * die Drehung liefe die Figur an der Kamera vorbei aus dem Bild. So läuft sie
 * stattdessen in die Tiefe und schaut dabei über die Schulter zurück — was
 * beim Abmelden genau die richtige Geste ist.
 */
const FRAMING = {
  bust: { pos: [0.45, 1.5, 2.3], look: [0, 1.25, 0], fov: 30, spin: -0.3 },
  full: { pos: [0.3, 1.35, 3.6], look: [0, 0.95, 0], fov: 34, spin: -0.3 },
  exit: { pos: [0.3, 1.45, 3.2], look: [0, 0.95, -0.9], fov: 38, spin: Math.PI - 0.3 },
};

/** Vorab holen, damit der Klick später nicht auf den Download wartet. */
export function prefetchClip(clipUrl) {
  if (typeof window === 'undefined') return;
  [MODEL_URL, clipUrl].filter(Boolean).forEach((url) => {
    fetch(url, { cache: 'force-cache' }).catch(() => {});
  });
}

export default function ClipBot({ clipUrl, framing = 'bust', onPeak, onDone, onFail }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Über Refs, damit ein neuer Render die Szene nicht neu aufbaut.
  const cb = useRef({ onPeak, onDone, onFail });
  cb.current = { onPeak, onDone, onFail };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      cb.current.onFail?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const view = FRAMING[framing] || FRAMING.bust;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.1, 50);
    camera.position.set(...view.pos);
    const lookAt = new THREE.Vector3(...view.look);
    camera.lookAt(lookAt);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdadada, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1ea, 1.3);
    rim.position.set(-3, 2.5, -2.5);
    scene.add(rim);

    let mixer = null;
    let peak = null;
    let duration = 3;
    let firedPeak = false;
    let firedDone = false;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const loadModel = new Promise((resolve, reject) => {
      loader.load(MODEL_URL, resolve, undefined, reject);
    });
    const loadClip = fetch(clipUrl).then((r) => {
      if (!r.ok) throw new Error(`Clip ${r.status}`);
      return r.json();
    });

    Promise.all([loadModel, loadClip])
      .then(([gltf, data]) => {
        if (disposed) return;
        const model = gltf.scene;
        model.scale.setScalar(0.01);      // Mixamo liefert Zentimeter
        model.rotation.y = view.spin ?? -0.3;
        model.traverse((o) => {
          if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false;
        });
        scene.add(model);

        const clip = THREE.AnimationClip.parse(data.clip);
        duration = data.duration || clip.duration;
        peak = typeof data.peak === 'number' ? data.peak : null;

        mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;   // stehen bleiben statt zurückschnappen
        action.play();

        setReady(true);
      })
      .catch((err) => {
        console.error('[ClipBot] konnte nicht laden', clipUrl, err);
        if (!disposed) cb.current.onFail?.();
      });

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (mixer) {
        mixer.update(dt);
        elapsed += dt;
        if (!firedPeak && peak !== null && elapsed >= peak) {
          firedPeak = true;
          cb.current.onPeak?.();
        }
        if (!firedDone && elapsed >= duration) {
          firedDone = true;
          cb.current.onDone?.();
        }
      }
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [clipUrl, framing]);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    />
  );
}
