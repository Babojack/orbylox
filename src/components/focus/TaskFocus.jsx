import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Check, Pause, Play } from 'lucide-react';
import { startTimer, stopTimer, getActiveTimer, formatDuration } from '@/lib/projectTimer';
import { DAUER, KURVE, SCHLEIER, VOLLBILD, uebergang } from '@/components/motion/bewegung';

/**
 * Eine Aufgabe, ein Bildschirm, eine laufende Uhr.
 *
 * WARUM VOLLBILD
 * Fokus heisst nicht "diese Aufgabe ist wichtig", sondern "alles andere ist
 * jetzt nicht da". Ein hervorgehobenes Kärtchen auf dem Brett kann das nicht
 * leisten — daneben stehen weiter dreissig andere. Deshalb deckt diese
 * Ansicht wirklich alles zu.
 *
 * WARUM DIE UHR MITLÄUFT
 * Weil die Zeiterfassung schon da ist und pro Projekt zählt. Der Fokus
 * startet sie mit einem Vermerk, welche Aufgabe gemeint war; beim Beenden
 * wird sie gestoppt und die Zeit landet wie gewohnt beim Projekt. Eine
 * zweite, aufgabenweise Buchhaltung wäre ein eigenes Vorhaben — hier wird
 * nichts erfunden, was es noch nicht gibt.
 *
 * WAS BEIM SCHLIESSEN PASSIERT
 * Die Uhr wird gestoppt. Wer den Fokus verlässt, arbeitet nicht mehr
 * konzentriert an dieser Aufgabe — eine Uhr, die unsichtbar weiterläuft,
 * misst irgendwann den Feierabend mit.
 */
export default function TaskFocus({ task, projectId, offen, onClose, onDone, de = true }) {
  const reduziert = useReducedMotion();
  const [laeuft, setLaeuft] = React.useState(false);
  const [msGesamt, setMsGesamt] = React.useState(0);
  const startRef = React.useRef(null);

  /* --- Die Uhr ------------------------------------------------------------
   * Gerechnet wird aus dem Startzeitpunkt, nicht hochgezählt: Ein Zähler,
   * der jede Sekunde eins addiert, geht falsch, sobald der Bildschirm
   * schläft oder der Reiter im Hintergrund gedrosselt wird.
   */
  React.useEffect(() => {
    if (!offen) return undefined;
    const aktiv = getActiveTimer();
    const schon = aktiv?.meta?.taskId === task?.id && aktiv?.startedAt;
    startRef.current = schon ? aktiv.startedAt : Date.now();
    if (!schon && projectId) {
      startTimer(projectId, { source: 'task_focus', taskId: task?.id, title: task?.title });
    }
    setLaeuft(true);
    return undefined;
  }, [offen, projectId, task?.id, task?.title]);

  React.useEffect(() => {
    if (!offen || !laeuft) return undefined;
    const tick = () => setMsGesamt(Date.now() - (startRef.current || Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offen, laeuft]);

  const beenden = React.useCallback((auchErledigt) => {
    stopTimer({ reason: auchErledigt ? 'task_focus_done' : 'task_focus_close' });
    setLaeuft(false);
    if (auchErledigt) onDone?.(task);
    onClose?.();
  }, [onClose, onDone, task]);

  /** Esc beendet — dieselbe Taste wie ueberall sonst zum Schliessen. */
  React.useEffect(() => {
    if (!offen) return undefined;
    const auf = (e) => { if (e.key === 'Escape') beenden(false); };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, [offen, beenden]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {offen && task && (
        <motion.div
          {...SCHLEIER}
          transition={uebergang(DAUER.flaeche, reduziert)}
          className="fixed inset-0 h-[100dvh] z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={de ? 'Fokus' : 'Focus'}
        >
          <motion.div
            {...VOLLBILD}
            transition={{ duration: reduziert ? 0.01 : DAUER.vollbild, ease: KURVE }}
            className="w-full max-w-2xl bg-white border-2 border-black shadow-[10px_10px_0_0_rgba(10,10,10,0.9)] flex flex-col max-h-full"
          >
            <header className="flex items-start justify-between gap-3 border-b-2 border-black p-4 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef5a24]">
                  {de ? 'Fokus' : 'Focus'}
                </p>
                <h2 className="text-xl sm:text-2xl font-black leading-tight break-words">{task.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => beenden(false)}
                aria-label={de ? 'Fokus beenden' : 'End focus'}
                className="h-10 w-10 shrink-0 grid place-items-center border-2 border-black bg-white hover:bg-black hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Die Uhr. Gross genug, um sie aus zwei Metern Abstand zu lesen —
                sie ist der einzige Grund, warum dieser Bildschirm laeuft. */}
            <div className="p-6 text-center border-b-2 border-black shrink-0">
              <p
                className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight"
                aria-live="off"
              >
                {formatDuration(msGesamt)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {laeuft
                  ? (de ? 'läuft' : 'running')
                  : (de ? 'angehalten' : 'paused')}
              </p>
            </div>

            {task.description && (
              <div className="p-4 overflow-y-auto text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {task.description}
              </div>
            )}

            <div className="mt-auto p-4 border-t-2 border-black flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  // Anhalten heisst hier: die Uhr steht, der Bildschirm bleibt.
                  if (laeuft) {
                    stopTimer({ reason: 'task_focus_pause' });
                    setLaeuft(false);
                  } else {
                    startRef.current = Date.now() - msGesamt;
                    if (projectId) startTimer(projectId, { source: 'task_focus', taskId: task?.id, title: task?.title });
                    setLaeuft(true);
                  }
                }}
                className="flex-1 h-12 inline-flex items-center justify-center gap-2 border-2 border-black bg-white text-sm font-bold uppercase tracking-wide hover:bg-black hover:text-white"
              >
                {laeuft ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {laeuft ? (de ? 'Anhalten' : 'Pause') : (de ? 'Weiter' : 'Resume')}
              </button>
              <button
                type="button"
                onClick={() => beenden(true)}
                className="flex-1 h-12 inline-flex items-center justify-center gap-2 border-2 border-[#ef5a24] bg-[#ef5a24] text-white text-sm font-bold uppercase tracking-wide"
              >
                <Check className="w-4 h-4" /> {de ? 'Erledigt' : 'Done'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
