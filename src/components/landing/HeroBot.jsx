import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Die animierte Figur auf der Startseite.
 *
 * Herkunft: Mixamo "X Bot" mit der Animation "Happy Idle", aus zwei FBX-Dateien
 * (3,7 MB) in eine GLB (325 KB) gewandelt — Dreiecke halbiert, Koordinaten
 * quantisiert, Meshopt-komprimiert. Die Farben sind eingebrannt: Koerper hell,
 * Gelenke im Markenorange.
 *
 * In der Hand haelt er ein kleines Tablet mit dem ORBYLOX-Zeichen. Es haengt
 * nicht als Kind am Handknochen (deren Achsen sind je nach Rig anders), sondern
 * folgt jedem Frame der Weltposition der Hand und dreht sich zum Betrachter —
 * das liest sich als "zeigt dir etwas" und ist unabhaengig von der Knochenlage.
 *
 * Diese Datei wird nur geladen, wenn die Sektion sichtbar wird (React.lazy im
 * Aufrufer) — Three.js kostet sonst 600 KB beim ersten Seitenaufruf.
 */

const MODEL_URL = '/models/xbot.glb';
const ORANGE = 0xef5a24;

function buildTablet() {
  const group = new THREE.Group();

  // Tablet-Koerper: abgerundete Platte in Orange
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.22, 0.014, 4, 0.02),
    new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.15, roughness: 0.5 }),
  );
  group.add(body);

  // Weisser Ring als Logo — das "O" aus dem Zeichen
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.038, 0.011, 16, 48),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  );
  ring.position.z = 0.009;
  group.add(ring);

  return group;
}

export default function HeroBot({ className = '' }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // --- Renderer ---
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // --- Szene & Kamera ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0.35, 1.45, 3.6);
    const lookAt = new THREE.Vector3(0, 1.0, 0);
    camera.lookAt(lookAt);

    // --- Licht: weich von vorn oben, Kante von hinten, Boden hell ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2; key.shadow.camera.right = 2;
    key.shadow.camera.top = 3; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff1ea, 1.4);
    rim.position.set(-3, 2.5, -2.5);
    scene.add(rim);

    // Boden: nimmt nur den Schatten an, sonst unsichtbar — die Figur steht
    // damit auf der weissen Seite, nicht in einer Kiste.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Tablet in der Hand ---
    const tablet = buildTablet();
    tablet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    tablet.visible = false;
    scene.add(tablet);

    // --- Modell ---
    let mixer = null;
    let hand = null;
    let disposed = false;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // Mixamo liefert Zentimeter
        model.scale.setScalar(0.01);
        model.traverse((o) => {
          if (o.isMesh || o.isSkinnedMesh) {
            o.castShadow = true;
            o.frustumCulled = false; // Skinning bewegt die Huelle — sonst blinkt es beim Rand
          }
          if (o.isBone && o.name === 'mixamorigRightHand') hand = o;
        });
        // Leicht zum Betrachter gedreht — frontal wirkt wie ein Passfoto
        model.rotation.y = -0.35;
        scene.add(model);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          if (reduceMotion) {
            // Eine ruhige Pose statt Dauerbewegung
            mixer.update(1.2);
            action.paused = true;
          }
        }
        tablet.visible = !!hand;
        setReady(true);
      },
      undefined,
      (err) => {
        console.error('[HeroBot] Modell konnte nicht geladen werden', err);
        setFailed(true);
      },
    );

    // --- Groesse ---
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

    // --- Maus: die Figur schaut ein wenig mit ---
    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!reduceMotion) window.addEventListener('pointermove', onMove, { passive: true });

    // --- Nur rendern, wenn sichtbar ---
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 });
    io.observe(mount);

    const clock = new THREE.Clock();
    const handPos = new THREE.Vector3();
    const forward = new THREE.Vector3();
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (mixer && !reduceMotion) mixer.update(dt);

      // Kamera driftet weich zur Mausposition
      const cx = 0.35 + target.x * 0.25;
      const cy = 1.45 - target.y * 0.12;
      camera.position.x += (cx - camera.position.x) * 0.05;
      camera.position.y += (cy - camera.position.y) * 0.05;
      camera.lookAt(lookAt);

      // Tablet an die Hand, Vorderseite zum Betrachter
      if (hand) {
        hand.getWorldPosition(handPos);
        forward.subVectors(camera.position, handPos).normalize();
        tablet.position.copy(handPos).addScaledVector(forward, 0.06);
        tablet.position.y += 0.03;
        tablet.lookAt(camera.position);
        tablet.rotateX(-0.15);
      }

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
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

  if (failed) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mountRef}
        className={`w-full h-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-end justify-center pb-8" aria-hidden="true">
          <div className="w-40 h-3 bg-slate-200/70 animate-pulse" />
        </div>
      )}
    </div>
  );
}
