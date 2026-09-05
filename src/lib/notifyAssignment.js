import { api } from '@/api/apiClient';
import { indexTasks, blockersOf, DONE_STATUS } from '@/lib/taskDependencies';

/**
 * E-Mail an die Person, der ein Ticket zugewiesen wurde.
 *
 * Absichtlich "beste Absicht, kein Drama": schlägt der Versand fehl, bleibt die
 * Zuweisung trotzdem bestehen. Eine Zuweisung darf nicht daran scheitern, dass
 * gerade der Mailserver hakt — deshalb wird der Fehler nur protokolliert.
 *
 * Wird bewusst NICHT ausgelöst, wenn jemand sich selbst zuweist: die eigene
 * Aktion muss man niemandem per Mail mitteilen.
 */
export async function notifyAssignment({
  task,
  assigneeEmail,
  currentUser,
  project,
  allTasks = [],
  language = 'de',
}) {
  const to = String(assigneeEmail || '').trim();
  if (!to || !to.includes('@')) return { skipped: 'no-recipient' };

  const me = String(currentUser?.email || '').trim().toLowerCase();
  if (me && to.toLowerCase() === me) return { skipped: 'self-assignment' };
  if (!task?.title) return { skipped: 'no-title' };

  const byId = indexTasks(allTasks);
  const blockers = blockersOf(task, byId)
    .filter((b) => b.status !== DONE_STATUS)
    .map((b) => b.title)
    .filter(Boolean);

  try {
    await api.integrations.Core.SendEmail({
      type: 'assignment',
      to,
      projectId: task.project_id || project?.id || '',
      projectName: project?.name || '',
      inviterName: currentUser?.full_name || currentUser?.displayName || currentUser?.email || '',
      language: language === 'en' ? 'en' : 'de',
      appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://orbylox.de',
      task: {
        title: task.title,
        priority: task.priority || '',
        due: task.due_date || task.deadline || '',
        blockers,
      },
    });
    return { sent: true };
  } catch (err) {
    // Kein Abbruch: die Zuweisung selbst ist längst gespeichert.
    //
    // Frueher endete der Fehler hier in der Konsole — und damit im Nichts.
    // Wer eine Zuweisung machte, ging davon aus, dass eine Mail rausging;
    // dass der Mailserver nicht antwortete, erfuhr er nie. Deshalb wird der
    // Fehlschlag jetzt nach oben gemeldet, damit die Oberflaeche ihn zeigen
    // kann.
    console.error('[notifyAssignment]', err);
    return { sent: false, error: String(err?.message || err) };
  }
}
