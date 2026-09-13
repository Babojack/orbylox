import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Check, Pause, Play, Plus, Send, ListChecks, MessageSquare } from 'lucide-react';
import { api } from '@/api/apiClient';
import { startTimer, stopTimer, getActiveTimer, formatDuration } from '@/lib/projectTimer';
import { DAUER, KURVE, SCHLEIER, VOLLBILD, VON_UNTEN, uebergang } from '@/components/motion/bewegung';

/**
 * Eine Aufgabe, ein Bildschirm.
 *
 * WARUM VOLLBILD
 * Fokus heisst nicht "diese Aufgabe ist wichtig", sondern "alles andere ist
 * jetzt nicht da". Ein hervorgehobenes Kärtchen auf dem Brett kann das nicht
 * leisten — daneben stehen weiter dreissig andere. Deshalb deckt diese
 * Ansicht wirklich alles zu.
 *
 * WAS SICH GEÄNDERT HAT, UND WARUM
 * Anfangs stand hier fast nichts: eine grosse Uhr, darunter die Beschreibung.
 * Das war ein Timer mit Überschrift, kein Arbeitsplatz — wer im Fokus merkte,
 * dass eine Teilaufgabe fehlt oder etwas anzumerken war, musste heraus, den
 * Ticket-Dialog öffnen und danach wieder hinein. Jetzt liegt links, was zu
 * tun ist (Beschreibung und Teilaufgaben zum Abhaken und Anlegen), rechts,
 * was dazu gesagt wurde (Kommentare, mit Eingabe). Die Uhr ist in die
 * Kopfzeile gerückt: Sie soll mitlaufen, nicht die Ansicht sein.
 *
 * DIESELBEN DATEN WIE IM TICKET-DIALOG
 * Die Abfrageschlüssel sind Zeichen für Zeichen dieselben (`subtasks`,
 * `taskComments`). Das ist kein Zufall, sondern der Punkt: Wer im Fokus eine
 * Teilaufgabe abhakt und danach das Ticket öffnet, sieht sie abgehakt — ohne
 * Neuladen, ohne zweite Wahrheit. Die Zähler auf dem Brett hängen an eigenen
 * Schlüsseln und werden nach jeder Änderung mit angestossen.
 *
 * WARUM DIE UHR MITLÄUFT
 * Weil die Zeiterfassung schon da ist und pro Projekt zählt. Der Fokus
 * startet sie mit einem Vermerk, welche Aufgabe gemeint war; beim Beenden
 * wird sie gestoppt und die Zeit landet wie gewohnt beim Projekt.
 *
 * WAS BEIM SCHLIESSEN PASSIERT
 * Die Uhr wird gestoppt. Wer den Fokus verlässt, arbeitet nicht mehr
 * konzentriert an dieser Aufgabe — eine Uhr, die unsichtbar weiterläuft,
 * misst irgendwann den Feierabend mit.
 */

const URL_IM_TEXT = /(https?:\/\/[^\s]+)/gi;

/** Text mit anklickbaren Adressen — und ohne dass eine lange Adresse die Spalte sprengt. */
function TextMitLinks({ text }) {
  if (!text) return null;
  return String(text).split(URL_IM_TEXT).map((teil, i) =>
    teil.match(/^https?:\/\//i) ? (
      <a
        key={i}
        href={teil}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#ef5a24] underline underline-offset-2 break-all"
      >
        {teil}
      </a>
    ) : (
      <span key={i}>{teil}</span>
    ),
  );
}

/** "vor 3 Min." — kurz, ohne eine Datumsbibliothek in dieses Bündel zu ziehen. */
function vorWieLange(iso, de) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t) || !t) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return de ? 'gerade eben' : 'just now';
  if (min < 60) return de ? `vor ${min} Min.` : `${min} min ago`;
  const std = Math.floor(min / 60);
  if (std < 24) return de ? `vor ${std} Std.` : `${std} h ago`;
  const tage = Math.floor(std / 24);
  if (tage < 7) return de ? `vor ${tage} Tg.` : `${tage} d ago`;
  return new Date(t).toLocaleDateString(de ? 'de-DE' : 'en-US');
}

/** Überschrift einer Spalte. Klein, damit sie ordnet statt zu rufen. */
function Spaltentitel({ icon: Icon, children, rechts }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {children}
      </h3>
      {rechts}
    </div>
  );
}

export default function TaskFocus({ task, projectId, offen, onClose, onDone, de = true }) {
  const reduziert = useReducedMotion();
  const queryClient = useQueryClient();
  const [laeuft, setLaeuft] = React.useState(false);
  const [msGesamt, setMsGesamt] = React.useState(0);
  const [neueTeilaufgabe, setNeueTeilaufgabe] = React.useState('');
  const [neuerKommentar, setNeuerKommentar] = React.useState('');
  const startRef = React.useRef(null);

  const taskId = task?.id;

  /* --- Die Uhr ------------------------------------------------------------
   * Gerechnet wird aus dem Startzeitpunkt, nicht hochgezählt: Ein Zähler,
   * der jede Sekunde eins addiert, geht falsch, sobald der Bildschirm
   * schläft oder der Reiter im Hintergrund gedrosselt wird.
   */
  React.useEffect(() => {
    if (!offen) return undefined;
    const aktiv = getActiveTimer();
    const schon = aktiv?.meta?.taskId === taskId && aktiv?.startedAt;
    startRef.current = schon ? aktiv.startedAt : Date.now();
    if (!schon && projectId) {
      startTimer(projectId, { source: 'task_focus', taskId, title: task?.title });
    }
    setLaeuft(true);
    return undefined;
  }, [offen, projectId, taskId, task?.title]);

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

  /**
   * Esc beendet — aber nicht mitten im Satz.
   *
   * Vorher schloss jede Escape-Taste den Fokus. Jetzt gibt es hier
   * Eingabefelder: Wer einen Kommentar tippt und Escape drückt, meint "Feld
   * verlassen", nicht "alles zu und Uhr aus". Also erst das Feld, dann der
   * Fokus.
   */
  React.useEffect(() => {
    if (!offen) return undefined;
    const auf = (e) => {
      if (e.key !== 'Escape') return;
      const ziel = e.target;
      if (ziel instanceof HTMLElement && ziel.matches('input, textarea')) {
        ziel.blur();
        return;
      }
      beenden(false);
    };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, [offen, beenden]);

  /* --- Wer schreibt --------------------------------------------------- */

  const { data: nutzer } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    enabled: !!offen,
    staleTime: 5 * 60 * 1000,
  });

  /* --- Teilaufgaben und Kommentare -------------------------------------
   *
   * Dieselben Schlüssel wie im Ticket-Dialog. `enabled` haengt am Offenstehen:
   * Der Fokus wird nachgeladen, aber die Komponente bleibt danach im Baum —
   * ohne diese Bedingung liefe für jede angesehene Aufgabe eine Abfrage
   * weiter, auch wenn längst niemand mehr hinsieht.
   */
  const { data: teilaufgaben = [] } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const alle = await api.entities.Subtask.list('-created_date', 100);
      return alle
        .filter((s) => s.task_id === taskId)
        .sort((a, b) => Number(a.sort_order ?? 1e9) - Number(b.sort_order ?? 1e9));
    },
    enabled: !!taskId && !!offen,
  });

  const { data: kommentare = [] } = useQuery({
    queryKey: ['taskComments', taskId],
    queryFn: async () => {
      const alle = await api.entities.TaskComment.list('-created_date', 100);
      return alle.filter((c) => c.task_id === taskId);
    },
    enabled: !!taskId && !!offen,
  });

  /** Die Zähler auf den Karten des Bretts hängen an eigenen Schlüsseln. */
  const brettAnstossen = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['allSubtasks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['allComments', projectId] });
  }, [queryClient, projectId]);

  const teilaufgabeAnlegen = useMutation({
    mutationFn: (titel) => api.entities.Subtask.create({
      task_id: taskId,
      project_id: projectId,
      title: titel,
      completed: false,
      sort_order: teilaufgaben.length,
    }),
    /* Sofort anzeigen, nicht auf die Antwort warten: Im Fokus tippt man
       Teilaufgaben in Serie, und eine halbe Sekunde Verzögerung je Zeile
       reisst genau den Faden ab, um den es hier geht. */
    onMutate: async (titel) => {
      await queryClient.cancelQueries({ queryKey: ['subtasks', taskId] });
      const vorher = queryClient.getQueryData(['subtasks', taskId]);
      queryClient.setQueryData(['subtasks', taskId], (alt) => [
        ...(alt || []),
        { id: `temp_${Date.now()}`, task_id: taskId, project_id: projectId, title: titel, completed: false, sort_order: (alt || []).length },
      ]);
      setNeueTeilaufgabe('');
      return { vorher };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['subtasks', taskId], ctx?.vorher),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      brettAnstossen();
    },
  });

  const teilaufgabeUmschalten = useMutation({
    mutationFn: ({ id, completed }) => api.entities.Subtask.update(id, { completed }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['subtasks', taskId] });
      const vorher = queryClient.getQueryData(['subtasks', taskId]);
      queryClient.setQueryData(['subtasks', taskId], (alt) =>
        (alt || []).map((s) => (s.id === id ? { ...s, completed } : s)));
      return { vorher };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['subtasks', taskId], ctx?.vorher),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
      brettAnstossen();
    },
  });

  const kommentarAnlegen = useMutation({
    mutationFn: (inhalt) => api.entities.TaskComment.create({
      task_id: taskId,
      project_id: projectId,
      content: inhalt,
      author_email: nutzer?.email,
    }),
    onMutate: async (inhalt) => {
      await queryClient.cancelQueries({ queryKey: ['taskComments', taskId] });
      const vorher = queryClient.getQueryData(['taskComments', taskId]);
      queryClient.setQueryData(['taskComments', taskId], (alt) => [
        { id: `temp_${Date.now()}`, task_id: taskId, project_id: projectId, content: inhalt, author_email: nutzer?.email, created_date: new Date().toISOString() },
        ...(alt || []),
      ]);
      setNeuerKommentar('');
      return { vorher };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['taskComments', taskId], ctx?.vorher),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['taskComments', taskId] });
      brettAnstossen();
    },
  });

  const fertig = teilaufgaben.filter((s) => s.completed).length;
  const gesamt = teilaufgaben.length;
  const anteil = gesamt ? Math.round((fertig / gesamt) * 100) : 0;

  const teilaufgabeAbschicken = (e) => {
    e.preventDefault();
    const titel = neueTeilaufgabe.trim();
    if (titel) teilaufgabeAnlegen.mutate(titel);
  };

  const kommentarAbschicken = (e) => {
    e.preventDefault();
    const inhalt = neuerKommentar.trim();
    if (inhalt) kommentarAnlegen.mutate(inhalt);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {offen && task && (
        <motion.div
          {...SCHLEIER}
          transition={uebergang(DAUER.flaeche, reduziert)}
          className="fixed inset-0 h-[100dvh] z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={de ? 'Fokus' : 'Focus'}
        >
          <motion.div
            {...VOLLBILD}
            transition={{ duration: reduziert ? 0.01 : DAUER.vollbild, ease: KURVE }}
            data-task-focus=""
            className="w-full max-w-5xl h-full sm:h-auto sm:max-h-[92vh] bg-white border-2 border-black
              shadow-[10px_10px_0_0_rgba(10,10,10,0.9)] flex flex-col overflow-hidden"
          >
            {/* ---------------------------------------------------- Kopf */}
            <header className="shrink-0 border-b-2 border-black">
              <div className="flex items-start gap-3 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef5a24]">
                    {de ? 'Fokus' : 'Focus'}
                  </p>
                  <h2 className="text-lg sm:text-2xl font-black leading-tight break-words">
                    {task.title}
                  </h2>
                </div>

                {/**
                 * Die Uhr sitzt jetzt hier statt in einem eigenen Block.
                 *
                 * `tabular-nums` ist nicht Kosmetik: Ohne feste Ziffernbreite
                 * wackelt die Zeile bei jedem Sekundenwechsel, und ein
                 * zuckender Zähler zieht genau die Aufmerksamkeit, die dieser
                 * Bildschirm eigentlich woandershin lenken soll.
                 */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-xl sm:text-3xl font-black tabular-nums leading-none" aria-live="off">
                      {formatDuration(msGesamt)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                      {laeuft ? (de ? 'läuft' : 'running') : (de ? 'angehalten' : 'paused')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Anhalten heisst hier: die Uhr steht, der Bildschirm bleibt.
                      if (laeuft) {
                        stopTimer({ reason: 'task_focus_pause' });
                        setLaeuft(false);
                      } else {
                        startRef.current = Date.now() - msGesamt;
                        if (projectId) startTimer(projectId, { source: 'task_focus', taskId, title: task?.title });
                        setLaeuft(true);
                      }
                    }}
                    aria-label={laeuft ? (de ? 'Anhalten' : 'Pause') : (de ? 'Weiter' : 'Resume')}
                    title={laeuft ? (de ? 'Anhalten' : 'Pause') : (de ? 'Weiter' : 'Resume')}
                    className="h-10 w-10 grid place-items-center border-2 border-black bg-white hover:bg-black hover:text-white transition-colors"
                  >
                    {laeuft ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => beenden(false)}
                    aria-label={de ? 'Fokus beenden' : 'End focus'}
                    className="h-10 w-10 grid place-items-center border-2 border-black bg-white hover:bg-black hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Der Fortschritt als Balken, direkt unter dem Kopf: Man sieht
                  beim Hereinkommen, wie weit die Aufgabe ist, ohne zu zählen. */}
              {gesamt > 0 && (
                <div className="px-3 sm:px-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 border-2 border-black bg-white overflow-hidden">
                      <motion.div
                        className="h-full bg-[#ef5a24]"
                        initial={false}
                        animate={{ width: `${anteil}%` }}
                        transition={uebergang(DAUER.klein, reduziert)}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-slate-600 shrink-0">
                      {fertig}/{gesamt}
                    </span>
                  </div>
                </div>
              )}
            </header>

            {/* --------------------------------------------------- Inhalt
                Zwei Spalten ab `lg`, darunter untereinander.

                AB `lg` scrollt jede Spalte für sich: Wer viele Kommentare
                hat, soll dabei nicht die Teilaufgaben aus dem Bild schieben.

                DARUNTER scrollt das GANZE Fenster, und die Spalten scrollen
                gar nicht. Der erste Anlauf liess sie auch auf dem Handy für
                sich scrollen — dort steht aber keine Höhe zur Verfügung, die
                man aufteilen könnte: Die Beschreibung füllte den Kasten, und
                die Teilaufgaben lagen unsichtbar darunter. Auf dem Bild war
                schlicht keine einzige zu sehen. Deshalb hängt jedes
                `overflow` und jedes `min-h-0` hier an `lg:`. */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 lg:divide-x-2 divide-black overflow-y-auto lg:overflow-hidden">

              {/* ----------------------------------------- Was zu tun ist */}
              <section className="flex flex-col lg:min-h-0 border-b-2 lg:border-b-0 border-black">
                <div className="p-3 sm:p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <Spaltentitel icon={ListChecks}>
                    {de ? 'Was zu tun ist' : 'What to do'}
                  </Spaltentitel>

                  {task.description ? (
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words mb-5">
                      <TextMitLinks text={task.description} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-5">
                      {de ? 'Keine Beschreibung.' : 'No description.'}
                    </p>
                  )}

                  {/* Eigene Zwischenzeile: Ohne sie klebten die Kästchen
                      direkt unter dem letzten Satz der Beschreibung und sahen
                      aus, als gehörten sie noch dazu. */}
                  <p className="flex items-baseline justify-between gap-2 pb-1.5 mb-1.5 border-b-2 border-black
                    text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    <span>{de ? 'Teilaufgaben' : 'Subtasks'}</span>
                    {gesamt > 0 && <span className="tabular-nums">{fertig}/{gesamt}</span>}
                  </p>

                  <ul className="space-y-1.5">
                    <AnimatePresence initial={false}>
                      {teilaufgaben.map((s) => (
                        <motion.li
                          key={s.id}
                          {...VON_UNTEN}
                          transition={uebergang(DAUER.klein, reduziert)}
                          layout={!reduziert}
                        >
                          {/* Die ganze Zeile ist die Schaltfläche — auf dem
                              Handy ist ein 16-Pixel-Kästchen kein Ziel. */}
                          <button
                            type="button"
                            onClick={() => teilaufgabeUmschalten.mutate({ id: s.id, completed: !s.completed })}
                            aria-pressed={!!s.completed}
                            className="w-full flex items-start gap-3 text-left p-2 min-h-[44px] border-2 border-transparent
                              hover:border-black hover:bg-slate-50 transition-colors"
                          >
                            <span
                              className={`mt-0.5 w-5 h-5 shrink-0 grid place-items-center border-2 border-black transition-colors
                                ${s.completed ? 'bg-[#ef5a24] text-white' : 'bg-white'}`}
                              aria-hidden="true"
                            >
                              {s.completed && <Check className="w-3.5 h-3.5" />}
                            </span>
                            <span className={`text-sm leading-snug break-words ${s.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {s.title}
                            </span>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>

                  {gesamt === 0 && (
                    <p className="text-sm text-slate-400 py-2">
                      {de ? 'Noch keine Teilaufgaben. Zerleg die Aufgabe in Schritte.' : 'No subtasks yet. Break the task into steps.'}
                    </p>
                  )}
                </div>

                {/* Die Eingabe steht unten und bleibt stehen: Man legt
                    Teilaufgaben an, während man die Liste ansieht. */}
                <form onSubmit={teilaufgabeAbschicken} className="shrink-0 border-t-2 border-black p-2 flex gap-2">
                  <input
                    value={neueTeilaufgabe}
                    onChange={(e) => setNeueTeilaufgabe(e.target.value)}
                    placeholder={de ? 'Teilaufgabe hinzufügen …' : 'Add a subtask …'}
                    aria-label={de ? 'Teilaufgabe hinzufügen' : 'Add a subtask'}
                    className="flex-1 min-w-0 h-11 px-3 border-2 border-black bg-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#ef5a24] focus:ring-offset-0"
                  />
                  <button
                    type="submit"
                    disabled={!neueTeilaufgabe.trim()}
                    aria-label={de ? 'Teilaufgabe anlegen' : 'Create subtask'}
                    className="h-11 w-11 shrink-0 grid place-items-center border-2 border-black bg-white
                      hover:bg-black hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-current transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </section>

              {/* --------------------------------------------- Kommentare */}
              <section className="flex flex-col lg:min-h-0">
                <div className="p-3 sm:p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <Spaltentitel
                    icon={MessageSquare}
                    rechts={kommentare.length > 0 && (
                      <span className="text-[11px] font-bold tabular-nums text-slate-500">{kommentare.length}</span>
                    )}
                  >
                    {de ? 'Kommentare' : 'Comments'}
                  </Spaltentitel>

                  {kommentare.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">
                      {de ? 'Noch nichts gesagt.' : 'Nothing said yet.'}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      <AnimatePresence initial={false}>
                        {kommentare.map((k) => (
                          <motion.li
                            key={k.id}
                            {...VON_UNTEN}
                            transition={uebergang(DAUER.klein, reduziert)}
                            layout={!reduziert}
                            className="flex gap-2.5 min-w-0"
                          >
                            <span
                              className="mt-0.5 w-7 h-7 shrink-0 grid place-items-center border-2 border-black bg-[#ef5a24] text-white text-[11px] font-bold"
                              aria-hidden="true"
                            >
                              {(k.author_email?.[0] || '?').toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-baseline gap-2 min-w-0">
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {k.author_email?.split('@')[0] || (de ? 'Unbekannt' : 'Unknown')}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {vorWieLange(k.created_date, de)}
                                </span>
                              </p>
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                                <TextMitLinks text={k.content} />
                              </div>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                <form onSubmit={kommentarAbschicken} className="shrink-0 border-t-2 border-black p-2 flex gap-2 items-end">
                  <textarea
                    value={neuerKommentar}
                    onChange={(e) => setNeuerKommentar(e.target.value)}
                    /* Enter schickt ab, Umschalt+Enter macht einen Absatz —
                       so herum, weil Kommentare fast immer eine Zeile sind. */
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) kommentarAbschicken(e);
                    }}
                    rows={1}
                    placeholder={de ? 'Kommentar schreiben …' : 'Write a comment …'}
                    aria-label={de ? 'Kommentar schreiben' : 'Write a comment'}
                    className="flex-1 min-w-0 min-h-[44px] max-h-32 px-3 py-2.5 border-2 border-black bg-white text-sm resize-y
                      focus:outline-none focus:ring-2 focus:ring-[#ef5a24]"
                  />
                  <button
                    type="submit"
                    disabled={!neuerKommentar.trim()}
                    aria-label={de ? 'Kommentar abschicken' : 'Send comment'}
                    className="h-11 w-11 shrink-0 grid place-items-center border-2 border-black bg-white
                      hover:bg-black hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-current transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </section>
            </div>

            {/* ---------------------------------------------------- Fuss */}
            <div className="shrink-0 p-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => beenden(true)}
                className="w-full h-12 inline-flex items-center justify-center gap-2 border-2 border-[#ef5a24]
                  bg-[#ef5a24] text-white text-sm font-bold uppercase tracking-wide"
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
