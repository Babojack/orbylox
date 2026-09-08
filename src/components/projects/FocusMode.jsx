import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Users, Clock } from 'lucide-react';

/**
 * Fokus: alles andere weicht zurück, ein Projekt bleibt.
 *
 * Der Übergang ist bewusst kein Ein- und Ausblenden, sondern eine Bewegung:
 * Der Hintergrund weicht zurück (leicht kleiner, unscharf), die Karte wächst
 * aus der Mitte. Dadurch versteht man, dass man nicht woanders gelandet ist,
 * sondern näher herangetreten. Der Weg zurück ist derselbe rückwärts.
 *
 * Wer weniger Bewegung eingestellt hat, bekommt einen einfachen Wechsel —
 * die Aussage der Ansicht hängt nicht an der Animation.
 */

function fmtDate(iso, de) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const heute = new Date();
  const tage = Math.floor((heute - d) / 86400000);
  if (tage === 0) return de ? 'heute' : 'today';
  if (tage === 1) return de ? 'gestern' : 'yesterday';
  if (tage < 7) return de ? `vor ${tage} Tagen` : `${tage} days ago`;
  return d.toLocaleDateString(de ? 'de-DE' : 'en-GB',
    { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function FocusMode({ project, lastFocus, onClose, onOpen, de = true, reduceMotion = false }) {
  useEffect(() => {
    if (!project) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey, true);
    // Der Hintergrund darf nicht mitscrollen, sonst wirkt das Zurücktreten
    // wie ein Wackeln.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [project, onClose]);

  const seit = fmtDate(lastFocus, de);
  const mitglieder = (project?.members || []).length;

  return createPortal(
    <AnimatePresence>
      {project && (
        <motion.div
          key="focus"
          className="fixed inset-0 z-[9996] grid place-items-center p-4 sm:p-8"
          style={{ pointerEvents: 'auto' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28 }}
          onPointerDown={onClose}
          data-testid="focus-mode"
        >
          {/* Der Vorhang: dunkel und leicht unscharf, damit der Rest spürbar
              zurücktritt statt nur abgedeckt zu sein. */}
          <motion.div
            className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28 }}
          />

          <motion.div
            className="relative w-full max-w-2xl border-2 border-black bg-white shadow-[10px_10px_0_0_rgba(239,90,36,1)]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={de ? 'Fokus verlassen' : 'Leave focus'}
              data-testid="focus-close"
              className="absolute right-3 top-3 h-9 w-9 grid place-items-center border-2 border-black bg-white hover:bg-black hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            {project.cover_image && (
              <div className="h-40 sm:h-52 border-b-2 border-black overflow-hidden">
                <img src={project.cover_image} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ef5a24]">
                {de ? 'Fokus' : 'Focus'}
              </p>
              <h2 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight [overflow-wrap:anywhere]">
                {project.name}
              </h2>
              {project.description && (
                <p className="mt-3 text-slate-600 [overflow-wrap:anywhere]">{project.description}</p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                {mitglieder > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {mitglieder} {de ? 'Mitglieder' : 'members'}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5" data-testid="focus-last">
                  <Clock className="w-4 h-4" />
                  {seit
                    ? (de ? `Zuletzt im Fokus: ${seit}` : `Last focused: ${seit}`)
                    : (de ? 'Zum ersten Mal im Fokus' : 'In focus for the first time')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpen?.(project)}
                className="mt-8 w-full h-12 inline-flex items-center justify-center gap-2 bg-[#ef5a24] text-white text-sm font-bold uppercase tracking-wide border-2 border-[#ef5a24] hover:bg-black hover:border-black"
              >
                {de ? 'Ins Projekt' : 'Open project'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                {de ? 'Esc oder Klick daneben führt zurück' : 'Esc or a click outside returns'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
