import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

const ClipBot = lazy(() => import('./ClipBot'));

/**
 * Einblendung mit der ORBYLOX-Figur.
 *
 * Zwei Dinge sind hier wichtiger als die Animation selbst:
 *
 * 1. Man kommt immer raus. Esc beendet sie, ein Tipp auf den Hintergrund
 *    ebenso — auf dem Handy gibt es keine Esc-Taste, dort ist das Wegtippen
 *    der einzige Weg. Zusätzlich schließt sie sich von selbst.
 *
 * 2. Was danach passieren soll, passiert auch ohne sie. Fehlt WebGL, hängt
 *    das Laden oder bricht der Nutzer ab — `onFinish` läuft in jedem Fall
 *    genau einmal. Eine Verzierung darf nichts blockieren.
 */

export default function BotOverlay({
  clipUrl,
  framing = 'bust',
  caption = '',
  /** Läuft genau einmal: beim Höhepunkt, am Ende, bei Abbruch oder Fehler. */
  onFinish,
  /** Optionaler früher Zeitpunkt (z. B. wenn die Hand beim Gruß oben steht). */
  onPeak,
  /** Spätestens dann ist Schluss, egal was die Figur meldet. */
  failsafeMs = 6000,
}) {
  const [peaked, setPeaked] = useState(false);
  const finished = useRef(false);
  const peakedRef = useRef(false);
  const timers = useRef([]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (!peakedRef.current) {
      peakedRef.current = true;
      onPeak?.();          // nie schließen, ohne den Höhepunkt gemeldet zu haben
    }
    onFinish?.();
  }, [onFinish, onPeak]);

  const handlePeak = useCallback(() => {
    if (peakedRef.current) return;
    peakedRef.current = true;
    setPeaked(true);
    onPeak?.();
  }, [onPeak]);

  useEffect(() => {
    // Esc am Schreibtisch, Wegtippen auf dem Handy — und als letzte Instanz
    // ein Zeitgeber, falls die Figur sich nie meldet.
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(); }
    };
    window.addEventListener('keydown', onKey, true);
    timers.current.push(window.setTimeout(finish, failsafeMs));

    return () => {
      window.removeEventListener('keydown', onKey, true);
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [finish, failsafeMs]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      onPointerDown={finish}          // Wegtippen: irgendwo daneben reicht
    >
      <div
        className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] px-6 pt-4 pb-5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="w-[210px] h-[210px] sm:w-[250px] sm:h-[250px]">
          <Suspense fallback={null}>
            <ClipBot
              clipUrl={clipUrl}
              framing={framing}
              onPeak={handlePeak}
              onDone={finish}
              onFail={finish}
            />
          </Suspense>
        </div>

        {caption && (
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-900">
            {caption}
          </p>
        )}

        <div className="mt-2 h-1 w-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-[#ef5a24] transition-[width] ease-out"
            style={{ width: peaked ? '100%' : '35%', transitionDuration: peaked ? '600ms' : '1100ms' }}
          />
        </div>

        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); finish(); }}
          className="mt-3 w-full text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-900"
        >
          Esc
        </button>
      </div>
    </div>
  );
}
