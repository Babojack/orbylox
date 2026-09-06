import { Suspense, lazy, useEffect, useRef, useState } from 'react';

const SaluteBot = lazy(() => import('./SaluteBot'));

/**
 * Einblendung beim Sprachwechsel: die Figur grüßt, und genau in dem Moment,
 * in dem die Hand oben steht, springt die Sprache um.
 *
 * Der wichtigste Teil dieser Datei ist nicht die Animation, sondern die
 * Reißleine. Ein Sprachwechsel muss stattfinden — auch ohne WebGL, auf einem
 * langsamen Anschluss oder wenn das Modell fehlt. Deshalb läuft parallel ein
 * Zeitgeber: meldet die Figur bis dahin keinen Gruß, wird ohne sie
 * umgeschaltet und die Einblendung verschwindet.
 */

const FAILSAFE_MS = 1600;   // so lange warten wir höchstens auf die Figur
const TAIL_MS = 1750;       // Rest der Bewegung nach dem Gruß (2,83 s − 1,12 s)

export default function LanguageSalute({ to, onApply, onClose }) {
  const [applied, setApplied] = useState(false);
  const appliedRef = useRef(false);
  const timers = useRef([]);

  const apply = () => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    setApplied(true);
    onApply?.();
  };

  const finish = () => {
    apply();                       // nie schließen, ohne umgestellt zu haben
    onClose?.();
  };

  useEffect(() => {
    const add = (fn, ms) => timers.current.push(window.setTimeout(fn, ms));

    // Reißleine: Wenn die Figur nicht rechtzeitig loslegt, geht es ohne sie
    // weiter. Lieber eine Animation verpassen als eine Einstellung.
    add(() => {
      if (!appliedRef.current) {
        apply();
        add(finish, 250);
      }
    }, FAILSAFE_MS);

    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, []);

  const handlePeak = () => {
    apply();
    // Falls die Figur ihr Ende nicht meldet (Tab im Hintergrund pausiert
    // requestAnimationFrame), schließen wir nach der Restlaufzeit selbst.
    timers.current.push(window.setTimeout(finish, TAIL_MS + 400));
  };

  const caption = to === 'en' ? 'Switching to English' : 'Wechsle auf Deutsch';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] px-6 pt-4 pb-5">
        <div className="w-[210px] h-[210px] sm:w-[250px] sm:h-[250px]">
          <Suspense fallback={null}>
            <SaluteBot onPeak={handlePeak} onDone={finish} onFail={finish} />
          </Suspense>
        </div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-900">
          {caption}
        </p>
        <div className="mt-2 h-1 w-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-[#ef5a24] transition-[width] ease-out"
            style={{ width: applied ? '100%' : '35%', transitionDuration: applied ? '600ms' : '1100ms' }}
          />
        </div>
      </div>
    </div>
  );
}
