import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { tonPegel } from '@/lib/themeSound';

/**
 * Der Kürbis auf der Startseite — im Halloween anstelle der Figur.
 *
 * Er steht an derselben Stelle wie sie, in derselben Sektion, und tut
 * dasselbe: sich langsam drehen und dabei nett aussehen. Nur brennt in ihm
 * eine Kerze.
 *
 * WARUM EINE EIGENE DATEI UND NICHT EIN ZWEIG IN `HeroBot`
 * Weil fast nichts gleich ist. Die Figur hat ein Skelett, eine
 * Ruhebewegung, ein Tablet in der Hand und Licht für eine helle Seite; der
 * Kürbis hat Texturen, eine Kerze und Licht für eine Nacht. Zusammengelegt
 * wäre das eine Datei mit zwei Hälften, die einander nichts angehen — und
 * jede Änderung an der einen ein Risiko für die andere. Nachgeladen werden
 * beide ohnehin einzeln (`React.lazy` im Aufrufer): Wer im Halloween ist,
 * lädt die Figur nie.
 *
 * WOHER DAS MODELL KOMMT
 * Ein CC-Modell ("Halloween Pumpkin LP"), aus 31 MB Rohmaterial auf 155 KB
 * gerechnet — `scripts/pumpkin-build.mjs` macht das und schreibt auf, warum
 * so. Das Modell ist genau einen Meter hoch und steht mit dem Fuss auf y=0;
 * hier stehen deshalb keine Zauberzahlen.
 */

const MODELL = '/models/pumpkin.glb';
const TEXTUREN = {
  albedo: '/models/pumpkin-albedo.webp',
  emissive: '/models/pumpkin-emissive.webp',
  normal: '/models/pumpkin-normal.webp',
  orm: '/models/pumpkin-orm.webp',
};

/* Aus `theme-halloween.css`, damit die Szene zur Seite passt. */
const KERZE = 0xffb03a;
const MOND = 0xbda9e0;
const KUERBIS = 0xf2802a;

/** Die Drehung, bei der das Gesicht zur Kamera zeigt. Am Modell abgelesen. */
const VORNE = 0.6;

export default function HeroPumpkin({ className = '' }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const wenigerBewegung =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0.3, 0.86, 2.75);
    const lookAt = new THREE.Vector3(0, 0.5, 0);
    camera.lookAt(lookAt);

    /* Licht wie in einer Nacht: wenig von oben, ein warmer Streifer von
       vorn, eine kühle Kante von hinten — und die Kerze im Inneren, die die
       eigentliche Arbeit macht. */
    scene.add(new THREE.HemisphereLight(MOND, 0x2a1a12, 0.35));
    const key = new THREE.DirectionalLight(0xffd9a0, 0.7);
    key.position.set(2, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(MOND, 0.7);
    rim.position.set(-3, 2, -2.5);
    scene.add(rim);

    /**
     * Die Kerze im Bauch — und warum sie Schatten wirft.
     *
     * Ohne `castShadow` scheint ein Punktlicht mitten im Kürbis einfach
     * durch die Schale hindurch: Beim ersten Rendern glühte er als Ganzes,
     * wie eine Lampe in Kürbisform. Mit Schatten bleibt das Licht drinnen
     * und kommt nur dort heraus, wo jemand geschnitzt hat — Augen, Nase,
     * Mund. Genau das ist der Kürbis.
     *
     * Ein Punktlicht braucht dafür sechs Schattenbilder (eine Würfelkarte).
     * Bei 5008 Dreiecken und 512 Pixeln Kantenlänge ist das billig; mehr
     * Auflösung brächte hier nichts, weil das Licht ohnehin weich ist.
     */
    const kerze = new THREE.PointLight(KERZE, 3.2, 4, 2);
    kerze.position.set(0, 0.42, 0);
    kerze.castShadow = true;
    kerze.shadow.mapSize.set(512, 512);
    kerze.shadow.camera.near = 0.02;
    kerze.shadow.camera.far = 3;
    kerze.shadow.bias = -0.004;
    scene.add(kerze);

    /* KEIN Boden.
     *
     * Bei der Figur fängt eine unsichtbare Scheibe deren Schatten auf und
     * stellt sie damit auf die helle Seite. Hier war das ein Fehler: Die
     * Kerze steht ÜBER der Scheibe und wirft seit sie Schatten wirft die
     * ganze Scheibe in ihren eigenen — auf dem Bild lag ein dunkler Fleck
     * unter dem Kürbis, so gross wie die Scheibe. Er braucht auch keinen:
     * Der Lichtschein auf der Nacht kommt aus dem CSS der Bühne, und ein
     * Kürbis in der Dunkelheit steht ohnehin nirgends auf.
     */

    let disposed = false;
    let kuerbis = null;

    /**
     * Texturen laden.
     *
     * `flipY = false` ist bei glTF Pflicht: Dort läuft die V-Achse anders
     * herum als in den Bildformaten, und `TextureLoader` dreht von sich aus
     * um. Ohne diese Zeile sässe das Gesicht auf dem Kopf.
     *
     * Farbe oder Zahlen — das ist der Unterschied zwischen `SRGBColorSpace`
     * und `NoColorSpace`: Albedo und Emissive sind Farben, Normale und
     * ORM sind Messwerte und dürfen nicht durch die Gamma-Kurve.
     */
    const tl = new THREE.TextureLoader();
    const holeTextur = (url, alsFarbe) => new Promise((res, rej) => {
      tl.load(url, (t) => {
        t.flipY = false;
        t.colorSpace = alsFarbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        res(t);
      }, undefined, rej);
    });

    Promise.all([
      new GLTFLoader().loadAsync(MODELL),
      holeTextur(TEXTUREN.albedo, true),
      holeTextur(TEXTUREN.emissive, true),
      holeTextur(TEXTUREN.normal, false),
      holeTextur(TEXTUREN.orm, false),
    ])
      .then(([gltf, albedo, emissive, normal, orm]) => {
        if (disposed) return;
        const mesh = gltf.scene.getObjectByProperty('isMesh', true);
        if (!mesh) throw new Error('Kein Mesh in pumpkin.glb');

        /* Verdeckung liest den ZWEITEN UV-Satz. Das Modell hat nur einen —
           also denselben noch einmal anmelden, sonst bleibt `aoMap` ohne
           jede Wirkung und niemand sieht, warum. */
        const g = mesh.geometry;
        if (g.attributes.uv && !g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv);

        mesh.material.dispose();
        mesh.material = new THREE.MeshStandardMaterial({
          map: albedo,
          color: KUERBIS,               // die Textur ist blass, das ist der Ton
          normalMap: normal,
          aoMap: orm,
          roughnessMap: orm,
          metalnessMap: orm,
          roughness: 1,
          metalness: 1,                 // die Stärke steht in den Kanälen
          emissiveMap: emissive,
          emissive: new THREE.Color(0xff8c1a),
          emissiveIntensity: 1.5,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        kuerbis = gltf.scene;
        scene.add(kuerbis);
        setReady(true);
      })
      .catch((err) => {
        console.error('[HeroPumpkin] konnte nicht laden', err);
        if (!disposed) setFailed(true);
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

    // Die Kamera zieht ein wenig mit dem Zeiger — derselbe Kniff wie bei der
    // Figur, damit sich beide Aussehen gleich anfühlen.
    const ziel = { x: 0, y: 0 };
    const beiBewegung = (e) => {
      const r = mount.getBoundingClientRect();
      ziel.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ziel.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!wenigerBewegung) window.addEventListener('pointermove', beiBewegung, { passive: true });

    let sichtbar = true;
    const io = new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(mount);

    const uhr = new THREE.Clock();
    let t = 0;
    let takt = 0;         // geglätteter Pegel der Musik
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!sichtbar) return;
      const dt = Math.min(uhr.getDelta(), 0.05);
      t += dt;

      if (kuerbis) {
        if (wenigerBewegung) {
          kuerbis.rotation.set(0, VORNE, 0);
          kuerbis.position.y = 0;
          kuerbis.scale.setScalar(1);
        } else {
          /**
           * Wiegen, atmen, wippen — aber nicht durchdrehen.
           *
           * Der erste Versuch liess ihn sich um die eigene Achse drehen.
           * Die halbe Zeit sah man dann seinen Hinterkopf: einen glatten
           * orangen Ball. Das Gesicht IST der Kürbis, und ein Gesicht, das
           * alle neun Sekunden verschwindet, ist keine Zierde, sondern eine
           * Wartezeit. Also wiegt er sich jetzt um die Vorderansicht, gut
           * zwanzig Grad nach jeder Seite: Man sieht ihn von schräg links
           * und schräg rechts, nie von hinten.
           *
           * Das Wippen kommt nur dazu, wenn wirklich Musik läuft —
           * `tonPegel()` gibt sonst 0, und dann ist dieser Summand exakt
           * null. Kein Sonderfall, keine zweite Schleife.
           *
           * Geglättet wird trotzdem: Der Analysator springt von Bild zu
           * Bild, und ein Kürbis, der zappelt, sieht nach Fehler aus, nicht
           * nach Takt. `0.18` je Bild heisst rund eine Zehntelsekunde
           * Nachlauf — man sieht den Schlag, nicht das Flimmern.
           */
          const pegel = tonPegel();
          takt += (pegel - takt) * 0.18;

          kuerbis.rotation.y = VORNE + Math.sin(t * 0.3) * 0.22;
          const atem = Math.sin(t * 1.6) * 0.012;
          kuerbis.scale.setScalar(1 + atem + takt * 0.06);
          kuerbis.position.y = takt * 0.05;
          kuerbis.rotation.z = Math.sin(t * 2.3) * 0.012 + takt * 0.03;
        }
      }

      /* Die Kerze flackert — zwei Sinus mit unrundem Verhältnis, damit kein
         Rhythmus hörbar wird, und ein Aufleuchten im Takt. */
      kerze.intensity = 3.2
        + Math.sin(t * 7.3) * 0.22
        + Math.sin(t * 11.7) * 0.13
        + takt * 2.2;

      const cx = 0.35 + ziel.x * 0.22;
      const cy = 0.9 - ziel.y * 0.1;
      camera.position.x += (cx - camera.position.x) * 0.05;
      camera.position.y += (cy - camera.position.y) * 0.05;
      camera.lookAt(lookAt);

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', beiBewegung);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            // Auch die Bilder freigeben: Vier 512er hängen sonst am
            // Grafikspeicher, bis die Seite neu geladen wird.
            ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']
              .forEach((k) => m[k]?.dispose?.());
            m.dispose();
          });
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
