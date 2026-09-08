import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Send, Loader2, Check, Plus } from 'lucide-react';
import { askAssistant } from '@/api/assistant';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Der Projekt-Assistent.
 *
 * Er sieht das Projekt und schlägt vor — angelegt wird nichts ohne Klick.
 * Deshalb sind die Vorschläge keine Fließtextliste, sondern abhakbare Karten:
 * Man sieht Titel, Aufwand und Zuweisung vor der Entscheidung und kann
 * einzelne abwählen, statt alles oder nichts zu nehmen.
 *
 * Als Portal am Body, mit ausdrücklichen Zeigerereignissen: Der Assistent
 * lässt sich aus dem Board heraus öffnen, und ein offener Radix-Dialog würde
 * ihn sonst lahmlegen.
 */

const STARTERS = {
  de: [
    'Zerlege dieses Projekt in die ersten Tickets',
    'Was fehlt hier noch, damit es rund ist?',
    'Welche Tickets blockieren sich gegenseitig?',
    'Verteile die offenen Tickets sinnvoll im Team',
  ],
  en: [
    'Break this project into first tickets',
    'What is still missing here?',
    'Which tickets block each other?',
    'Spread the open tickets across the team',
  ],
};

export default function ProjectAssistant({ open, onClose, project, tasks = [], members = [], onCreateTasks }) {
  const { language } = useLanguage();
  const de = language !== 'en';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [chosen, setChosen] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, suggestions]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setError(null);
    setSuggestions([]);
    setChosen(new Set());
    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setBusy(true);
    try {
      const r = await askAssistant({
        message: q,
        history: messages,
        project,
        tasks,
        members,
        language,
      });
      setMessages([...history, { role: 'assistant', content: r.reply }]);
      setSuggestions(r.suggestions);
      // Voreingestellt alle angehakt: Wer den Vorschlag erbeten hat, will ihn
      // meist ganz — Abwählen ist die Ausnahme.
      setChosen(new Set(r.suggestions.map((_, i) => i)));
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const applyChosen = async () => {
    const picked = suggestions.filter((_, i) => chosen.has(i));
    if (!picked.length) return;
    setCreating(true);
    try {
      await onCreateTasks?.(picked);
      setSuggestions([]);
      setChosen(new Set());
      setMessages((m) => [...m, {
        role: 'assistant',
        content: de
          ? `${picked.length} Ticket(s) angelegt.`
          : `Created ${picked.length} ticket(s).`,
      }]);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setCreating(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9997] flex justify-end bg-black/30"
      style={{ pointerEvents: 'auto' }}
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-lg h-full bg-white border-l-2 border-black flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid place-items-center w-8 h-8 bg-[#ef5a24] text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-black leading-tight">
                {de ? 'Projekt-Assistent' : 'Project assistant'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {project?.name || (de ? 'Ohne Projekt' : 'No project')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={de ? 'Schließen' : 'Close'}
                  className="h-9 w-9 grid place-items-center border-2 border-black hover:bg-black hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {de
                  ? 'Ich sehe die Tickets dieses Projekts und helfe beim Planen. Ich lege nichts selbst an — du bekommst Vorschläge und entscheidest.'
                  : 'I can see this project’s tickets and help you plan. I never create anything myself — you get proposals and decide.'}
              </p>
              <div className="space-y-2">
                {(de ? STARTERS.de : STARTERS.en).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="w-full text-left text-sm border-2 border-black px-3 py-2 hover:bg-[#f5f5f5]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div className={`inline-block max-w-[92%] text-sm px-3 py-2 border-2 text-left whitespace-pre-wrap [overflow-wrap:anywhere] ${
                m.role === 'user'
                  ? 'border-black bg-black text-white'
                  : 'border-black bg-white'
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {busy && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {de ? 'Denkt nach…' : 'Thinking…'}
            </p>
          )}

          {error && (
            <div className="border-2 border-[#ef5a24] bg-[#fdf1ec] p-3 text-sm">
              <p className="font-bold">{de ? 'Das ging schief' : 'That went wrong'}</p>
              <p className="text-slate-600 mt-0.5 [overflow-wrap:anywhere]">{error}</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="border-2 border-black">
              <p className="px-3 py-2 border-b-2 border-black text-[11px] font-bold uppercase tracking-wide bg-[#f5f5f5]">
                {de ? `${suggestions.length} Vorschläge — du entscheidest` : `${suggestions.length} proposals — your call`}
              </p>
              <div className="divide-y divide-slate-200">
                {suggestions.map((s, i) => (
                  <label key={i} className="flex gap-2 p-3 cursor-pointer hover:bg-[#f5f5f5]">
                    <input
                      type="checkbox"
                      checked={chosen.has(i)}
                      onChange={() => setChosen((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                      className="mt-1 w-4 h-4 shrink-0 accent-[#ef5a24]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold [overflow-wrap:anywhere]">{s.title}</p>
                      {s.description && (
                        <p className="text-xs text-slate-600 mt-0.5 [overflow-wrap:anywhere]">{s.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                        {s.story_points > 0 && (
                          <span className="border border-slate-300 px-1 font-bold">{s.story_points} SP</span>
                        )}
                        <span className="border border-slate-300 px-1 uppercase">{s.priority}</span>
                        {s.assignee_email && (
                          <span className="border border-slate-300 px-1 truncate max-w-[160px]">{s.assignee_email}</span>
                        )}
                        {s.depends_on?.length > 0 && (
                          <span className="border border-[#ef5a24] text-[#ef5a24] px-1">
                            {de ? `wartet auf ${s.depends_on.length}` : `waits on ${s.depends_on.length}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="p-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={applyChosen}
                  disabled={chosen.size === 0 || creating}
                  className="w-full h-10 bg-[#ef5a24] text-white text-xs font-bold uppercase tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {de ? `${chosen.size} Ticket(s) anlegen` : `Create ${chosen.size} ticket(s)`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t-2 border-black p-3 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={de ? 'Frag etwas zum Projekt…' : 'Ask something about the project…'}
              className="flex-1 h-10 border-2 border-black px-3 text-sm outline-none focus:border-[#ef5a24]"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="h-10 w-10 grid place-items-center bg-black text-white disabled:opacity-40"
              aria-label={de ? 'Senden' : 'Send'}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Der Knopf, der ihn öffnet. */
export function AssistantButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 h-9 px-3 border-2 border-[#ef5a24] bg-[#ef5a24] text-white text-xs font-bold uppercase tracking-wide hover:bg-black hover:border-black"
    >
      <Sparkles className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      <Plus className="w-3 h-3 sm:hidden" />
    </button>
  );
}
