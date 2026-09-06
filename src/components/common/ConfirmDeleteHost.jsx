import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { onAskDelete, makeDeletePhrase } from '@/lib/confirmDelete';

/**
 * Der Dialog zu `askDelete()`.
 *
 * Liegt einmal im Baum (im LanguageProvider, der auf jeder Seite steckt).
 *
 * Zwei Stufen:
 *   normal        — Abbrechen oder Löschen, Eingabetaste bestätigt.
 *   mit Satz      — ein erzeugter Satz muss abgetippt werden, sonst bleibt
 *                   der Knopf gesperrt. Für Projekte: dort hängt alles dran,
 *                   Aufgaben, Notizen, Dateien, Verlauf.
 *
 * Jeder Ausgang antwortet genau einmal, und Wegklicken heißt Nein. Ein
 * versehentliches Ja darf es nicht geben.
 */
/**
 * Wortlaut je Art des Objekts.
 *
 * Steht hier und nicht an den zwölf Aufrufstellen: Dort hätte jede Stelle
 * ihre eigenen zwei Sprachfassungen mitschleppen müssen, und die Formulierung
 * wäre mit der Zeit auseinandergelaufen. So bleibt der Aufruf einzeilig:
 * `askDelete({ kind: 'note', itemName: doc.title })`.
 */
const KINDS = {
  note:        { de: ['Notiz löschen?', 'Der Text ist danach weg.'],
                 en: ['Delete note?', 'The text will be gone.'] },
  post:        { de: ['Beitrag löschen?', 'Der Beitrag verschwindet für alle im Projekt, samt Reaktionen und Kommentaren.'],
                 en: ['Delete post?', 'The post disappears for everyone in the project, along with reactions and comments.'] },
  event:       { de: ['Termin löschen?', 'Der Termin verschwindet aus dem Kalender aller Beteiligten.'],
                 en: ['Delete event?', 'The event disappears from everyone’s calendar.'] },
  idea:        { de: ['Idee löschen?', 'Notizen zu dieser Idee gehen mit.'],
                 en: ['Delete idea?', 'Notes on this idea go with it.'] },
  integration: { de: ['Verknüpfung löschen?', 'Die Verbindung zu diesem Dienst wird entfernt.'],
                 en: ['Delete integration?', 'The link to this service will be removed.'] },
  subtask:     { de: ['Teilaufgabe löschen?', ''],
                 en: ['Delete subtask?', ''] },
  task:        { de: ['Ticket löschen?', 'Teilaufgaben, Kommentare und Anhänge gehen mit.'],
                 en: ['Delete ticket?', 'Subtasks, comments and attachments go with it.'] },
  contact:     { de: ['Kontakt löschen?', 'Der Zähler und der eingestellte Takt gehen mit.'],
                 en: ['Delete contact?', 'The counter and the rhythm you set go with it.'] },
  file:        { de: ['Datei löschen?', 'Der Eintrag verschwindet aus der Ablage.'],
                 en: ['Delete file?', 'The entry disappears from the file area.'] },
  folder:      { de: ['Ordner löschen?', 'Der Ordner verschwindet aus der Ablage.'],
                 en: ['Delete folder?', 'The folder disappears from the file area.'] },
  comment:     { de: ['Kommentar löschen?', ''],
                 en: ['Delete comment?', ''] },
  connection:  { de: ['Verbindung löschen?', 'Die beiden Knoten bleiben, nur die Linie dazwischen geht.'],
                 en: ['Delete connection?', 'Both nodes stay — only the line between them goes.'] },
  node:        { de: ['Element löschen?', 'Verbindungen zu diesem Element gehen mit.'],
                 en: ['Delete element?', 'Connections to this element go with it.'] },
  ideaProduct: { de: ['Produktidee löschen?', ''],
                 en: ['Delete product idea?', ''] },
  boardTasks:  { de: ['Alle Tickets dieses Boards löschen?', 'Das betrifft jedes Ticket in allen vier Spalten.'],
                 en: ['Delete every ticket on this board?', 'This affects every ticket in all four columns.'] },
  allFiles:    { de: ['Alle Dateien löschen?', 'Die gesamte Ablage dieses Projekts wird geleert.'],
                 en: ['Delete all files?', 'The entire file area of this project will be emptied.'] },
  allMessages: { de: ['Den ganzen Verlauf löschen?', 'Alle Nachrichten dieses Projekts verschwinden für alle.'],
                 en: ['Delete the whole conversation?', 'Every message in this project disappears for everyone.'] },
};

export default function ConfirmDeleteHost({ language = 'de' }) {
  const [req, setReq] = useState(null);
  const [typed, setTyped] = useState('');
  const [phrase, setPhrase] = useState('');
  const respondRef = useRef(null);
  const inputRef = useRef(null);
  const de = language !== 'en';

  const close = useCallback((answer) => {
    const respond = respondRef.current;
    respondRef.current = null;
    setReq(null);
    setTyped('');
    setPhrase('');
    respond?.(answer);
  }, []);

  useEffect(() => onAskDelete((detail) => {
    detail.ack?.();
    // Läuft schon einer, gewinnt der erste — der zweite bekommt ein Nein,
    // statt den ersten stillschweigend zu ersetzen.
    if (respondRef.current) { detail.respond?.(false); return; }
    respondRef.current = detail.respond || null;
    setPhrase(detail.requirePhrase ? makeDeletePhrase() : '');
    setTyped('');
    setReq(detail);
  }), []);

  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
    };
    window.addEventListener('keydown', onKey, true);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => { window.removeEventListener('keydown', onKey, true); window.clearTimeout(t); };
  }, [req, close]);

  if (!req) return null;

  const needsPhrase = !!req.requirePhrase;
  const ready = !needsPhrase || typed.trim() === phrase;

  // Ausdrücklicher Text schlägt die Art, die Art schlägt den Standardsatz.
  const preset = KINDS[req.kind]?.[de ? 'de' : 'en'];
  const title = req.title || preset?.[0] || (de ? 'Wirklich löschen?' : 'Really delete?');
  const body = req.body ?? (preset?.[1] || (de
    ? 'Das lässt sich nicht rückgängig machen.'
    : 'This cannot be undone.'));

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
      onPointerDown={() => close(false)}
      role="dialog"
      aria-modal="true"
      data-testid="confirm-delete"
    >
      <div
        className="w-full max-w-md border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b-2 border-black p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-[#ef5a24] text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight">{title}</h2>
            {req.itemName && (
              <p className="mt-1 break-words text-sm font-semibold text-slate-700">{req.itemName}</p>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {body && <p className="text-sm text-slate-600">{body}</p>}

          {needsPhrase && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                {de
                  ? 'Tippe zur Bestätigung diesen Satz ab:'
                  : 'Type this phrase to confirm:'}
              </p>
              <p
                className="select-all border-2 border-black bg-[#f5f5f5] px-3 py-2 text-center font-mono text-sm font-bold tracking-wide"
                data-testid="delete-phrase"
              >
                {phrase}
              </p>
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && ready) close(true); }}
                autoComplete="off"
                spellCheck="false"
                aria-label={de ? 'Satz abtippen' : 'Type the phrase'}
                data-testid="delete-phrase-input"
                className="h-10 w-full border-2 border-black px-3 font-mono text-sm outline-none focus:border-[#ef5a24]"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t-2 border-black p-4">
          <button
            type="button"
            onClick={() => close(false)}
            data-testid="confirm-cancel"
            className="h-10 border-2 border-black bg-white px-4 text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white"
          >
            {de ? 'Abbrechen' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => ready && close(true)}
            data-testid="confirm-ok"
            className="h-10 border-2 border-[#ef5a24] bg-[#ef5a24] px-4 text-xs font-bold uppercase tracking-wide text-white enabled:hover:border-black enabled:hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {req.confirmLabel || (de ? 'Löschen' : 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
