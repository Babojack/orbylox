import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Crosshair, Users, MessageSquare, Layers, Unlock } from 'lucide-react';
import { msUntilMidnight } from '@/lib/focusDay';

/**
 * Fokus: ein Projekt für heute, sonst nichts.
 *
 * Der Fokus ist kein Blick, sondern eine Entscheidung. Deshalb ist das hier
 * keine Überlagerung, die beim nächsten Klick wieder weg ist, sondern der
 * Zustand der Liste: Wer heute dieses Projekt gewählt hat, sieht bis
 * Mitternacht die Liste nicht mehr — auch nach dem Neuladen und auf jedem
 * anderen Gerät.
 *
 * Die Sperre endet von selbst. Ein Fokus, den man aktiv wieder abstellen muss,
 * wäre nach zwei Wochen ein vergessener Filter, über den sich jemand wundert.
 * Trotzdem gibt es den Weg zurück — eine Sperre ohne Schlüssel ist eine Falle,
 * und Tage ändern sich.
 */

function fmtTime(iso, de) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtRest(ms, de) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return de ? `noch ${m} Min.` : `${m} min left`;
  return de ? `noch ${h} Std. ${m} Min.` : `${h} h ${m} min left`;
}

export default function FocusToday({
  project,
  since,
  stats,
  onOpen,
  onLeave,
  de = true,
  reduceMotion = false,
}) {
  // Einmal pro Minute nachrechnen — der Rest des Tages schrumpft sichtbar,
  // und um Mitternacht meldet der Elternteil ohnehin das Ende der Sperre.
  const [rest, setRest] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setRest(msUntilMidnight()), 60000);
    return () => window.clearInterval(t);
  }, []);

  if (!project) return null;

  const started = fmtTime(since, de);
  const members = (project.members || []).length;
  const feed = stats?.posts || 0;
  const modules = stats?.activeModules || 0;

  const enter = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, scale: 0.94, y: 28 },
        animate: { opacity: 1, scale: 1, y: 0 },
      };

  return (
    <motion.div
      key="focus-today"
      data-testid="focus-today"
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      {/* Die Bande: sagt, warum die Liste weg ist. Ohne diesen Satz wirkt eine
          leere Projektliste wie ein Fehler. */}
      <motion.div
        className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#ef5a24] text-white px-4 py-3"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]">
          <Crosshair className="w-4 h-4" />
          {de ? 'Fokus für heute' : 'Focus for today'}
        </span>
        <span className="text-[11px] opacity-90" data-testid="focus-until">
          {started
            ? (de ? `seit ${started} · ${fmtRest(rest, de)}` : `since ${started} · ${fmtRest(rest, de)}`)
            : fmtRest(rest, de)}
        </span>
      </motion.div>

      <motion.div
        className="border-2 border-t-0 border-black bg-white shadow-[10px_10px_0_0_rgba(0,0,0,1)]"
        initial={enter.initial}
        animate={enter.animate}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 240, damping: 24, delay: 0.08 }
        }
      >
        {project.cover_image && (
          <div className="h-44 sm:h-56 border-b-2 border-black overflow-hidden bg-slate-100">
            <img src={project.cover_image} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight [overflow-wrap:anywhere]">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-3 text-slate-600 [overflow-wrap:anywhere]">{project.description}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
            {members > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {members} {de ? 'Mitglieder' : 'members'}
              </span>
            )}
            {modules > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {modules} {de ? 'Module aktiv' : 'modules active'}
              </span>
            )}
            {feed > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                {feed} {de ? 'Beiträge' : 'posts'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpen?.(project)}
            data-testid="focus-open"
            className="mt-8 w-full h-14 inline-flex items-center justify-center gap-2 bg-[#ef5a24] text-white text-sm font-bold uppercase tracking-wide border-2 border-[#ef5a24] hover:bg-black hover:border-black"
          >
            {de ? 'Ins Projekt' : 'Open project'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={onLeave}
              data-testid="focus-leave"
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-black underline underline-offset-4"
            >
              <Unlock className="w-3.5 h-3.5" />
              {de ? 'Fokus beenden und alle Projekte zeigen' : 'End focus and show all projects'}
            </button>
          </div>
        </div>
      </motion.div>

      <p className="mt-4 text-center text-xs text-slate-500">
        {de
          ? 'Die Sperre endet um Mitternacht von selbst.'
          : 'The lock ends by itself at midnight.'}
      </p>
    </motion.div>
  );
}
