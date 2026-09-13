import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { tonPegel } from '@/lib/themeSound';
import {
  ladeKuerbis, lichtSetzen, kerzenSchein, kuerbisFreigeben, VORNE,
} from '@/components/pumpkin/kuerbis';

/**
 * Der Kürbis auf der Startseite — im Halloween anstelle der Figur.
 *
 * Er steht an derselben Stelle wie sie, in derselben Sektion, und tut
 * dasselbe: sich zeigen und dabei nett aussehen. Nur brennt in ihm eine
 * Kerze.
 *
 * WARUM EINE EIGENE DATEI UND NICHT EIN ZWEIG IN `HeroBot`
 * Weil fast nichts gleich ist. Die Figur hat ein Skelett, eine Ruhebewegung
 * und ein Tablet in der Hand; der Kürbis hat Texturen und eine Kerze.
 * Zusammengelegt wäre das eine Datei mit zwei Hälften, die einander nichts
 * angehen — und jede Änderung an der einen ein Risiko für die andere.
 * Nachgeladen werden beide ohnehin einzeln (`React.lazy` im Aufrufer): Wer im
 * Halloween ist, lädt die Figur nie.
 *
 * Modell, Material und Licht stehen in `components/pumpkin/kuerbis.js` — sie
 * sind dieselben wie im Assistentenknopf.
 */

const GRUNDLICHT = 3.2;

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
    renderer.toneMappingExposure = 1.18;
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

    const kerze = lichtSetzen(scene, { kerzenStaerke: GRUNDLICHT, schattenkarte: 512 });

    /* KEIN Boden.
     *
     * Bei der Figur fängt eine unsichtbare Scheibe deren Schatten auf und
     * stellt sie damit auf die helle Seite. Hier war das ein Fehler: Die
     * Kerze steht ÜBER der Scheibe und wirft, seit sie Schatten wirft, die
     * ganze Scheibe in ihren eigenen — auf dem Bild lag ein dunkler Fleck
     * unter dem Kürbis, so gross wie die Scheibe. Er braucht auch keinen:
     * Der Lichtschein auf der Nacht kommt aus dem CSS der Bühne, und ein
     * Kürbis in der Dunkelheit steht ohnehin nirgends auf.
     */

    let disposed = false;
    let kuerbis = null;

    ladeKuerbis()
      .then((modell) => {
        if (disposed) return;
        kuerbis = modell;
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
           * Wartezeit. Also wiegt er sich jetzt um die Vorderansicht, knapp
           * dreizehn Grad nach jeder Seite: Man sieht ihn von schräg links
           * und schräg rechts, nie von hinten. Der zweite Anlauf nahm die
           * doppelte Weite — da stand er die halbe Zeit im Profil.
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

      kerze.intensity = kerzenSchein(t, GRUNDLICHT, takt);

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
      kuerbisFreigeben(scene);
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
