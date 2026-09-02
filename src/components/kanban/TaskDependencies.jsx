import { useMemo, useState } from 'react';
import { Lock, Plus, X, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/LanguageProvider';
import {
  indexTasks,
  blockersOf,
  openBlockersOf,
  dependentsOf,
  selectableBlockers,
  DONE_STATUS,
} from '@/lib/taskDependencies';

/**
 * Abschnitt im Ticket-Dialog: worauf dieses Ticket wartet und wer auf dieses
 * Ticket wartet.
 *
 * Die Auswahlliste zeigt nur Tickets, die keinen Kreis erzeugen würden — so
 * kann man gar nicht erst A wartet auf B wartet auf A bauen. Was fehlt, fehlt
 * also mit Absicht; ein Hinweis unter der Liste erklärt das.
 */
export default function TaskDependencies({ task, allTasks = [], onChange }) {
  const { t } = useLanguage();
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');

  const byId = useMemo(() => indexTasks(allTasks), [allTasks]);
  const blockers = useMemo(() => blockersOf(task, byId), [task, byId]);
  const open = useMemo(() => openBlockersOf(task, byId), [task, byId]);
  const dependents = useMemo(() => dependentsOf(task?.id, allTasks), [task?.id, allTasks]);

  const candidates = useMemo(() => {
    const list = selectableBlockers(task, allTasks, byId);
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((c) => (c.title || '').toLowerCase().includes(q)) : list;
    return filtered.slice(0, 8);
  }, [task, allTasks, byId, search]);

  const current = Array.isArray(task?.depends_on) ? task.depends_on : [];

  const add = (id) => {
    onChange([...current, id]);
    setSearch('');
    setPicking(false);
  };
  const remove = (id) => onChange(current.filter((x) => x !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          {t('dependencies')}
        </h4>
        {open.length > 0 && (
          <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 bg-[#ef5a24] text-white">
            {t('blockedByCount').replace('{n}', String(open.length))}
          </span>
        )}
      </div>

      {/* Worauf dieses Ticket wartet */}
      {blockers.length === 0 ? (
        <p className="text-sm text-slate-500 mb-3">{t('noDependencies')}</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {blockers.map((b) => {
            const done = b.status === DONE_STATUS;
            return (
              <li
                key={b.id}
                className="flex items-center gap-2 border-2 border-slate-200 px-2.5 py-2"
              >
                <span
                  className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                    done ? 'bg-green-600 text-white' : 'bg-[#ef5a24] text-white'
                  }`}
                >
                  {done ? <Check className="w-3 h-3" /> : <Lock className="w-2.5 h-2.5" />}
                </span>
                <span
                  className={`text-sm min-w-0 truncate ${
                    done ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}
                  title={b.title}
                >
                  {b.title}
                </span>
                <button
                  type="button"
                  data-no-lift
                  onClick={() => remove(b.id)}
                  aria-label={t('removeDependency')}
                  title={t('removeDependency')}
                  className="ml-auto shrink-0 h-7 w-7 flex items-center justify-center text-slate-400 hover:text-red-600 bg-transparent border-0 p-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Hinzufuegen */}
      {picking ? (
        <div className="border-2 border-black p-2">
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchTicket')}
              className="pl-8 h-9"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="text-xs text-slate-500 px-1 py-2">{t('noTicketsFound')}</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-no-lift
                    onClick={() => add(c.id)}
                    className="w-full text-left px-2 py-2 text-sm bg-transparent border-0 hover:bg-[#f5f5f5] flex items-center gap-2"
                  >
                    <span
                      className={`w-2 h-2 shrink-0 ${
                        c.status === DONE_STATUS ? 'bg-green-600' : 'bg-slate-300'
                      }`}
                    />
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-400 px-1 pt-2 border-t border-slate-100 mt-1">
            {t('wouldLoop')}
          </p>
          <button
            type="button"
            onClick={() => { setPicking(false); setSearch(''); }}
            className="mt-2 w-full h-9 border-2 border-black bg-white text-xs font-bold uppercase"
          >
            {t('cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-2 h-9 px-3 border-2 border-black bg-white text-xs font-bold uppercase"
        >
          <Plus className="w-4 h-4" />
          {t('addDependency')}
        </button>
      )}

      {/* Wer auf dieses Ticket wartet — nur zur Information */}
      {dependents.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            {t('blocksTheseTasks')}
          </p>
          <ul className="space-y-1">
            {dependents.map((d) => (
              <li key={d.id} className="text-sm text-slate-600 truncate" title={d.title}>
                {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
