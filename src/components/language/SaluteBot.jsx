import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Die grüßende Figur beim Sprachwechsel.
 *
 * Herkunft der Bewegung: Mixamo-Animation "Salute" (FBX, 2,2 MB). Im Bundle
 * steckt weder die FBX noch ein FBX-Loader — die Animationsspuren wurden
 * einmalig zu JSON umgerechnet (146 KB, gepackt 27 KB). Das Skelett ist
 * dasselbe wie im vorhandenen `xbot.glb`, alle 52 Knochen passen ohne
 * Umbenennung. Deshalb reicht die Bewegung; das Modell liegt schon da und
 * kommt in der Regel aus dem Browser-Zwischenspeicher.
 *
 * Zwei Meldungen gehen nach außen:
 *   onPeak — der Gruß steht (gemessen: die Hand hält von 0,76 s bis 1,48 s
 *            oben, Mitte 1,12 s). Genau dann wird die Sprache umgestellt.
 *   onDone — die Bewegung ist zu Ende, die Einblendung darf verschwinden.
 *
 * Schlägt WebGL oder das Laden fehl, meldet die Komponente `onFail`. Ein
 * Sprachwechsel darf nie daran scheitern, dass eine Verzierung nicht lädt.
 */

const MODEL_URL = '/models/xbot.glb';
const CLIP_URL = '/models/salute.clip.json';

/** Vorab holen, damit der Klick später nicht auf den Download wartet. */
export function prefetchSaluteAssets() {
  if (typeof window === 'undefined') return;
  [MODEL_URL, CLIP_URL].forEach((url) => {
    fetch(url, { cache: 'force-cache' }).catch(() => {});
  });
}

export default function SaluteBot({ onPeak, onDone, onFail }) {
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

    const scene = new THREE.Scene();
    // Enger Ausschnitt auf Kopf und Hand — der Gruß ist die Aussage,
    // die Füße sind es nicht.
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0.45, 1.5, 2.3);
    const lookAt = new THREE.Vector3(0, 1.25, 0);
    camera.lookAt(lookAt);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdadada, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1ea, 1.3);
    rim.position.set(-3, 2.5, -2.5);
    scene.add(rim);

    let mixer = null;
    let action = null;
    let peak = 1.12;
    let duration = 2.833;
    let firedPeak = false;
    let firedDone = false;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const loadModel = new Promise((resolve, reject) => {
      loader.load(MODEL_URL, resolve, undefined, reject);
    });
    const loadClip = fetch(CLIP_URL).then((r) => {
      if (!r.ok) throw new Error(`Clip ${r.status}`);
      return r.json();
    });

    Promise.all([loadModel, loadClip])
      .then(([gltf, data]) => {
        if (disposed) return;
        const model = gltf.scene;
        model.scale.setScalar(0.01);      // Mixamo liefert Zentimeter
        model.rotation.y = -0.3;
        model.traverse((o) => {
          if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false;
        });
        scene.add(model);

        const clip = THREE.AnimationClip.parse(data.clip);
        duration = data.duration || clip.duration;
        peak = typeof data.peak === 'number' ? data.peak : duration * 0.4;

        mixer = new THREE.AnimationMixer(model);
        action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;   // stehen bleiben statt zurückschnappen
        action.play();

        setReady(true);
      })
      .catch((err) => {
        console.error('[SaluteBot] konnte nicht laden', err);
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

        // Der Gruß steht: jetzt die Sprache umstellen, die Bewegung
        // läuft danach in Ruhe aus.
        if (!firedPeak && elapsed >= peak) {
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
  }, []);

  return (
    <div
      ref={mountRef}
      className={`w-full h-full transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    />
  );
}
