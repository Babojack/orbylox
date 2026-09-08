import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { dependencyGraph, storyPointsOf, DONE_STATUS } from '@/lib/taskDependencies';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Abhängigkeiten als Organigramm.
 *
 * Die Tickets stehen in Stufen: Stufe 1 wartet auf nichts und kann sofort
 * beginnen, Stufe 2 erst danach. Das ist keine Zeitachse — innerhalb einer
 * Stufe lässt sich alles parallel bearbeiten. Genau das ist die Frage, die
 * man beim Planen hat: Was kann heute jemand anfangen, und was hat keinen
 * Sinn, bevor anderes fertig ist.
 *
 * Die Linien werden nach dem Layout gemessen statt gerechnet: Kartenhöhen
 * hängen vom Titel ab, und eine geschätzte Höhe säße immer daneben. Deshalb
 * ein Durchgang mit `getBoundingClientRect`, wiederholt bei jeder
 * Größenänderung.
 */

const STATUS_COLOR = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#a855f7',
  done: '#22c55e',
};

export default function DependencyGraph({ tasks = [], subtasksById = null, onOpenTask }) {
  const { language } = useLanguage();
  const de = language === 'de';
  const wrapRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [boxes, setBoxes] = useState(null);

  const graph = useMemo(
    () => dependencyGraph(tasks, subtasksById),
    [tasks, subtasksById],
  );

  /** Kartenmitten relativ zur Zeichenfläche — Grundlage für die Linien. */
  const measure = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const base = wrap.getBoundingClientRect();
    const next = new Map();
    for (const [id, el] of cardRefs.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next.set(id, {
        left: r.left - base.left,
        right: r.right - base.left,
        top: r.top - base.top + wrap.scrollTop,
        middle: r.top - base.top + wrap.scrollTop + r.height / 2,
      });
    }
    setBoxes(next);
  };

  useLayoutEffect(measure, [graph, tasks]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tasks.length) {
    return (
      <p className="text-sm text-slate-500 p-6">
        {de ? 'Noch keine Tickets in diesem Board.' : 'No tickets on this board yet.'}
      </p>
    );
  }

  const ready = graph.layers[0] || [];
  const withDeps = graph.edges.length;

  return (
    <div className="space-y-4">
      {/* Kurzfassung: die drei Zahlen, wegen derer man herkommt */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={de ? 'Sofort machbar' : 'Ready now'} value={ready.length} accent />
        <Stat label={de ? 'Längste Kette' : 'Longest chain'}
              value={de ? `${graph.depth} Stufen` : `${graph.depth} levels`} />
        <Stat label={de ? 'Abhängigkeiten' : 'Dependencies'} value={withDeps} />
        <Stat label={de ? 'Tickets' : 'Tickets'} value={tasks.length} />
      </div>

      {graph.cycles.length > 0 && (
        <div className="border-2 border-[#ef5a24] bg-[#fdf1ec] p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-[#ef5a24] shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">
              {de ? 'Diese Tickets warten im Kreis aufeinander' : 'These tickets wait on each other in a circle'}
            </p>
            <p className="text-slate-600 mt-0.5">
              {graph.cycles.map((t) => t.title).join(' → ')}
              {' — '}
              {de
                ? 'keines kann je fertig werden. Eine der Abhängigkeiten muss weg.'
                : 'none of them can ever finish. One of the dependencies has to go.'}
            </p>
          </div>
        </div>
      )}

      <div ref={wrapRef} className="relative overflow-x-auto border-2 border-black bg-white p-4">
        {/* Linien zuerst, damit die Karten darüber liegen */}
        {boxes && (
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
            {graph.edges.map((e, i) => {
              const a = boxes.get(e.from);
              const b = boxes.get(e.to);
              if (!a || !b) return null;
              const blocker = graph.byId.get(e.from);
              const stillOpen = blocker?.status !== DONE_STATUS;
              const x1 = a.right;
              const x2 = b.left;
              const mid = x1 + (x2 - x1) / 2;
              return (
                <path
                  key={`${e.from}-${e.to}-${i}`}
                  d={`M ${x1} ${a.middle} C ${mid} ${a.middle}, ${mid} ${b.middle}, ${x2} ${b.middle}`}
                  fill="none"
                  stroke={stillOpen ? '#ef5a24' : '#cbd5e1'}
                  strokeWidth={stillOpen ? 2 : 1.5}
                  strokeDasharray={e.kind === 'subtask' ? '4 3' : undefined}
                />
              );
            })}
          </svg>
        )}

        <div className="relative flex gap-10 items-start min-w-max">
          {graph.layers.map((layer, li) => (
            <div key={li} className="w-56 shrink-0 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {de ? `Stufe ${li + 1}` : `Level ${li + 1}`}
                {li === 0 && (
                  <span className="ml-1 text-[#ef5a24]">
                    {de ? '· sofort' : '· ready'}
                  </span>
                )}
              </p>
              {layer.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  ref={(el) => { if (el) cardRefs.current.set(task.id, el); else cardRefs.current.delete(task.id); }}
                  onClick={() => onOpenTask?.(task)}
                  className="w-full text-left border-2 border-black bg-white p-2.5 hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 w-2 h-2 rounded-full shrink-0"
                      style={{ background: STATUS_COLOR[task.status] || '#94a3b8' }}
                    />
                    <span className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 pl-4 text-[11px] text-slate-400">
                    {storyPointsOf(task) > 0 && (
                      <span className="border border-slate-300 px-1 font-bold text-slate-600">
                        {storyPointsOf(task)}
                      </span>
                    )}
                    {(task.assignees?.[0] || task.assignee_email) && (
                      <span className="truncate">{task.assignees?.[0] || task.assignee_email}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}

          {graph.cycles.length > 0 && (
            <div className="w-56 shrink-0 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ef5a24]">
                {de ? 'Im Kreis' : 'In a circle'}
              </p>
              {graph.cycles.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask?.(task)}
                  className="w-full text-left border-2 border-[#ef5a24] bg-[#fdf1ec] p-2.5"
                >
                  <span className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-[#ef5a24]" />
          {de ? 'wartet noch' : 'still waiting'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-6 h-0.5 bg-slate-300" />
          {de ? 'Vorgänger erledigt' : 'predecessor done'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-slate-400" />
          {de ? 'hängt an einer Teilaufgabe' : 'waits on a subtask'}
        </span>
        <span className="inline-flex items-center gap-1">
          {de ? 'Stufe 1' : 'Level 1'} <ArrowRight className="w-3 h-3" /> {de ? 'kann sofort beginnen' : 'can start now'}
        </span>
      </p>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`border-2 border-black p-2.5 ${accent ? 'bg-[#ef5a24] text-white' : 'bg-white'}`}>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className={`text-[10px] uppercase tracking-wide mt-1 ${accent ? 'text-white/80' : 'text-slate-500'}`}>
        {label}
      </p>
    </div>
  );
}
