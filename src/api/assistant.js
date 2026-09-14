// Der Export heisst `auth`; `firebaseAuth` ist nur der Name, unter dem ihn der
// Rest der Anwendung fuehrt. Ohne das Umbenennen bricht der Build ab — Lint
// merkt es nicht, weil es Modulexporte nicht aufloest.
import { auth as firebaseAuth } from '@/lib/firebase';

/**
 * Anbindung an den Projekt-Assistenten.
 *
 * Der Schlüssel liegt auf dem Server; hier geht nur die Frage samt
 * Projektkontext hinaus. Zurück kommen ein kurzer Text und Vorschläge —
 * angelegt wird nichts, das entscheidet die Oberfläche.
 */

const ENDPOINT =
  import.meta.env.VITE_ASSISTANT_API_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api/assistant.php` : '');

/** Nur das, was der Assistent wirklich braucht — nicht der ganze Datensatz. */
function slimTask(t) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    story_points: t.story_points || 0,
    assignees: t.assignees?.length ? t.assignees : (t.assignee_email ? [t.assignee_email] : []),
    depends_on: t.depends_on || [],
  };
}

export async function askAssistant({ message, history = [], project, tasks = [], members = [], language = 'de' }) {
  if (!ENDPOINT) throw new Error('Assistent-Endpunkt nicht konfiguriert.');

  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Nicht angemeldet.');
  const idToken = await user.getIdToken();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      message,
      language,
      history: history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      context: {
        project: { name: project?.name || '', description: project?.description || '' },
        tasks: tasks.map(slimTask),
        members,
      },
    }),
  });

  // Wie beim Upload: Erst Text lesen, dann deuten. Kommt die Antwort von einer
  // Schutzschicht statt von PHP, steht sonst nur die Statusnummer da.
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  /** Aus HTML oder einer PHP-Meldung eine Zeile machen, die man lesen kann. */
  const lesbar = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

  if (!res.ok) {
    if (data?.error) throw new Error(data.error);
    const hint = lesbar(raw);
    throw new Error(`Assistent nicht erreichbar (HTTP ${res.status})${hint ? ` — ${hint}` : ''}`);
  }

  /**
   * HIER ENTSTAND DIE LEERE SPRECHBLASE.
   *
   * Vorher stand da `data?.reply || ''`. Das ist der Unterschied zwischen
   * "nichts zu sagen" und "die Antwort war nicht lesbar" — und beides kam als
   * leerer Text zurück. Die Oberfläche zeichnete daraufhin ein leeres Kästchen
   * neben den Kürbis, und niemand konnte sehen, WAS schiefging.
   *
   * Zwei Wege führen dahin, beide mit Status 200:
   *
   *   1. Die Antwort ist gar kein JSON. Genau das passiert, wenn PHP vor die
   *      Ausgabe eine Warnung oder einen Hinweis schreibt (bei eingeschaltetem
   *      display_errors), oder wenn eine Schutzschicht des Hosters eine
   *      HTML-Seite dazwischenschiebt. `JSON.parse` wirft, `data` wird null.
   *   2. Das JSON ist in Ordnung, enthält aber keinen Text — dann steht die
   *      Begründung im Feld `reason`, das der Endpunkt mitschickt.
   *
   * In beiden Fällen ist eine Fehlermeldung die ehrliche Antwort. Der rohe
   * Anfang der Serverantwort steht mit drin: Er nennt die Ursache beim Namen.
   */
  if (!data) {
    const hint = lesbar(raw);
    throw new Error(
      'Der Server hat geantwortet, aber nicht in der erwarteten Form'
      + (hint ? ` — er schickte: „${hint}“` : ' — die Antwort war leer.'),
    );
  }

  const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  if (!reply && !suggestions.length) {
    throw new Error(
      data.reason
        ? `Das Sprachmodell hat nichts geantwortet (${data.reason}).`
        : 'Das Sprachmodell hat eine leere Antwort geschickt.',
    );
  }

  return { reply, suggestions };
}
