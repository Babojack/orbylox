import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { setBotAvatar } from '@/lib/botAvatar';
import { idleFor, modelFor } from '@/lib/botClips';
import { useTheme } from '@/lib/useTheme';

/**
 * Die Figur im runden Knopf — dieselbe wie bei ihren Auftritten, dieselbe
 * Bewegung. Im normalen Design der Roboter, im Retro die Figur mit Umhang.
 *
 * Woher die Ruhebewegung kommt, ist je Figur verschieden: Der Roboter bringt
 * sein `idle` in `xbot.glb` mit, ihre Datei nicht — dort wird die Kopfgeste
 * geladen und in Schleife gelegt. `idleFor` weiß, welcher Fall gilt.
 *
 * Der Ausschnitt ist eng: Auf 44 Pixeln erkennt man von einer ganzen Figur
 * nichts, deshalb Kopf und Schultern. Beide sind fast gleich groß (Kopf bei
 * 1,60 bzw. 1,58 Einheiten), eine eigene Kameraeinstellung braucht es nicht.
 *
 * Nebenbei entsteht hier das Profilbild für den Chat: Sobald das Modell ein
 * paar Bilder gelaufen ist, wird ein Standbild aus der Leinwand gezogen und
 * geteilt. Dafür braucht der Renderer `preserveDrawingBuffer` — ohne das
 * liefert `toDataURL` je nach Browser eine leere Fläche, weil der Puffer nach
 * dem Zeichnen verworfen wird.
 */

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
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    // Enger Ausschnitt auf Kopf und Schultern.
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0.28, 1.52, 1.62);
    camera.lookAt(new THREE.Vector3(0, 1.36, 0));

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(2, 3, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1ea, 1.4);
    rim.position.set(-2.5, 2, -2);
    scene.add(rim);

    let mixer = null;
    let disposed = false;
    let frames = 0;

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

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (mixer) mixer.update(Math.min(clock.getDelta(), 0.05));
      renderer.render(scene, camera);

      // Nach ein paar Bildern steht die Figur ruhig genug für ein Standbild.
      if (mixer && frames === 12) {
        try { setBotAvatar(renderer.domElement.toDataURL('image/png')); } catch { /* egal */ }
      }
      frames += 1;
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
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
