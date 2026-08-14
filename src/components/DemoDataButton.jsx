import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * TEMPORÄR — Demo-Daten zum Anschauen.
 *
 * Schreibt ausschließlich in den React-Query-Cache, nie nach Firestore. Beim
 * Neuladen der Seite ist alles wieder weg, echte Projektdaten bleiben unberührt.
 *
 * Zum Entfernen: diese Datei löschen und die zwei Zeilen in Layout.jsx streichen.
 */

const NAMES = ['anna.weber', 'tom.schneider', 'lisa.hoffmann', 'max.krueger', 'sara.lang'];
const email = (n) => `${n}@example.com`;

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAhead = (d, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};
const id = (prefix, i) => `demo_${prefix}_${i}`;

function buildDemoData(projectId, de) {
  const posts = (de
    ? [
        { title: 'Sprint 12 ist durch', body: 'Alle Tickets abgeschlossen, Review am Freitag. Danke an alle!', h: 2, pinned: true },
        { title: null, body: 'Neue Farbpalette liegt im Canvas — Feedback bitte bis morgen.', h: 6 },
        { title: null, body: 'Kurze Erinnerung: Standup verschiebt sich diese Woche auf 9:30 Uhr.', h: 26 },
        { title: null, body: 'Der Kunde hat den Entwurf freigegeben. Wir können in die Umsetzung.', h: 50 },
      ]
    : [
        { title: 'Sprint 12 is done', body: 'All tickets closed, review on Friday. Thanks everyone!', h: 2, pinned: true },
        { title: null, body: 'New colour palette is on the canvas — feedback by tomorrow please.', h: 6 },
        { title: null, body: 'Quick reminder: standup moves to 9:30 this week.', h: 26 },
        { title: null, body: 'The client approved the draft. We can start building.', h: 50 },
      ]).map((p, i) => ({
    id: id('post', i),
    project_id: projectId,
    content: p.title ? `${p.title}\n\n${p.body}` : p.body,
    author_email: email(NAMES[i % NAMES.length]),
    tags: ['general'],
    type: 'update',
    pinned: !!p.pinned,
    pinned_at: p.pinned ? hoursAgo(p.h) : null,
    reactions: i % 2 === 0 ? { '👍': [email(NAMES[1]), email(NAMES[2])], '🔥': [email(NAMES[3])] } : {},
    created_date: hoursAgo(p.h),
  }));

  const postComments = (de
    ? [
        { post: 0, text: 'Stark! Ich bereite die Demo vor.', h: 1 },
        { post: 0, text: 'Ich hänge die Zahlen für das Review an.', h: 1.5 },
        { post: 1, text: 'Das Orange wirkt kräftiger als im Entwurf — passt für mich.', h: 4 },
      ]
    : [
        { post: 0, text: 'Great! I will prepare the demo.', h: 1 },
        { post: 0, text: 'I will add the numbers for the review.', h: 1.5 },
        { post: 1, text: 'The orange looks stronger than in the draft — works for me.', h: 4 },
      ]).map((c, i) => ({
    id: id('comment', i),
    post_id: id('post', c.post),
    project_id: projectId,
    content: c.text,
    author_email: email(NAMES[(i + 2) % NAMES.length]),
    created_date: hoursAgo(c.h),
  }));

  const tasks = (de
    ? [
        { t: 'Login-Flow überarbeiten', s: 'done', p: 'high' },
        { t: 'Dunkelmodus für Kalender prüfen', s: 'done', p: 'medium' },
        { t: 'Datei-Vorschau für PDFs testen', s: 'inprogress', p: 'high' },
        { t: 'Einladungsmail: Texte gegenlesen', s: 'inprogress', p: 'low' },
        { t: 'Backup-Wiederherstellung dokumentieren', s: 'review', p: 'medium' },
        { t: 'Canvas: Mehrfachauswahl planen', s: 'todo', p: 'medium' },
        { t: 'Onboarding-Video schneiden', s: 'todo', p: 'low' },
        { t: 'Impressum aktualisieren', s: 'todo', p: 'low' },
      ]
    : [
        { t: 'Rework the login flow', s: 'done', p: 'high' },
        { t: 'Check dark mode in the calendar', s: 'done', p: 'medium' },
        { t: 'Test PDF file preview', s: 'inprogress', p: 'high' },
        { t: 'Proofread the invitation email', s: 'inprogress', p: 'low' },
        { t: 'Document backup restore', s: 'review', p: 'medium' },
        { t: 'Plan multi-select on the canvas', s: 'todo', p: 'medium' },
        { t: 'Edit the onboarding video', s: 'todo', p: 'low' },
        { t: 'Update the imprint', s: 'todo', p: 'low' },
      ]).map((task, i) => ({
    id: id('task', i),
    project_id: projectId,
    title: task.t,
    description: de ? 'Demo-Ticket zur Ansicht.' : 'Demo ticket for preview.',
    status: task.s,
    priority: task.p,
    assignee_email: email(NAMES[i % NAMES.length]),
    board_order: i,
    tags: i % 3 === 0 ? ['design'] : ['dev'],
    created_date: hoursAgo(i * 7 + 3),
  }));

  const docs = (de
    ? [
        { t: 'Projektauftrag', c: 'Ziel, Umfang und Ansprechpartner.', pin: true },
        { t: 'Meeting-Notizen 12.08.', c: 'Themen: Release-Termin, offene Bugs, Urlaubsplanung.' },
        { t: 'Ideen-Sammlung', c: 'Später: Automatische Berichte, Slack-Anbindung, Gantt-Ansicht.' },
        { t: 'Checkliste Livegang', c: 'DNS, SSL, Backups, Impressum, Testkonten löschen.' },
      ]
    : [
        { t: 'Project brief', c: 'Goal, scope and who to ask.', pin: true },
        { t: 'Meeting notes 12 Aug', c: 'Topics: release date, open bugs, holiday planning.' },
        { t: 'Idea collection', c: 'Later: automatic reports, Slack integration, Gantt view.' },
        { t: 'Go-live checklist', c: 'DNS, SSL, backups, imprint, delete test accounts.' },
      ]).map((d, i) => ({
    id: id('doc', i),
    project_id: projectId,
    title: d.t,
    content: `<p>${d.c}</p>`,
    parent_id: d.pin ? 'pinned' : null,
    color: ['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8'][i % 4],
    created_date: hoursAgo(i * 20 + 5),
    updated_date: hoursAgo(i * 3),
  }));

  const files = (de
    ? [
        { n: 'Angebot_Kunde.pdf', t: 'application/pdf', s: 284_120 },
        { n: 'Screendesign_v3.png', t: 'image/png', s: 1_204_887 },
        { n: 'Budgetplanung.xlsx', t: 'application/vnd.ms-excel', s: 48_233 },
        { n: 'Protokoll_Kickoff.docx', t: 'application/msword', s: 92_045 },
      ]
    : [
        { n: 'Client_quote.pdf', t: 'application/pdf', s: 284_120 },
        { n: 'Screendesign_v3.png', t: 'image/png', s: 1_204_887 },
        { n: 'Budget_plan.xlsx', t: 'application/vnd.ms-excel', s: 48_233 },
        { n: 'Kickoff_minutes.docx', t: 'application/msword', s: 92_045 },
      ]).map((f, i) => ({
    id: id('file', i),
    project_id: projectId,
    name: f.n,
    type: f.t,
    size: f.s,
    url: '',
    folder_id: null,
    created_date: hoursAgo(i * 12 + 2),
  }));

  const messages = (de
    ? [
        { m: 'Moin! Ich schaue mir heute die Datei-Vorschau an.', h: 3 },
        { m: 'Perfekt. Ich kümmere mich um die Einladungsmails.', h: 2.6 },
        { m: 'Habt ihr das neue Canvas schon gesehen? Post-its kleben jetzt wirklich.', h: 2 },
        { m: 'Ja, sieht gut aus. Termin für die Demo steht im Kalender.', h: 1.2 },
      ]
    : [
        { m: 'Morning! I am looking at the file preview today.', h: 3 },
        { m: 'Perfect. I will take care of the invitation emails.', h: 2.6 },
        { m: 'Have you seen the new canvas? Sticky notes really stick now.', h: 2 },
        { m: 'Yes, looks good. The demo is already in the calendar.', h: 1.2 },
      ]).map((msg, i) => ({
    id: id('msg', i),
    project_id: projectId,
    content: msg.m,
    sender_email: email(NAMES[i % 3]),
    created_date: hoursAgo(msg.h),
  }));

  const events = (de
    ? [
        { t: 'Sprint Review', d: 1, c: '#ef5a24', video: true },
        { t: 'Kundentermin', d: 3, c: '#0a0a0a' },
        { t: 'Retro', d: 5, c: '#22c55e', video: true },
      ]
    : [
        { t: 'Sprint review', d: 1, c: '#ef5a24', video: true },
        { t: 'Client meeting', d: 3, c: '#0a0a0a' },
        { t: 'Retro', d: 5, c: '#22c55e', video: true },
      ]).map((e, i) => ({
    id: id('event', i),
    project_id: projectId,
    title: e.t,
    description: de ? 'Demo-Termin.' : 'Demo appointment.',
    start_date: daysAhead(e.d, 10),
    end_date: daysAhead(e.d, 11),
    all_day: false,
    color: e.c,
    attendees: [email(NAMES[0]), email(NAMES[1])],
    video_url: e.video ? 'https://meet.jit.si/orbylox-demo-termin' : '',
    created_date: hoursAgo(30),
  }));

  const canvasItems = (de
    ? [
        { c: 'Produktidee', x: 320, y: 120, type: 'node' },
        { c: 'Zielgruppe', x: 120, y: 280, type: 'node' },
        { c: 'Preismodell?', x: 520, y: 280, type: 'decision' },
        { c: 'Erst Beta testen', x: 700, y: 140, type: 'sticky' },
      ]
    : [
        { c: 'Product idea', x: 320, y: 120, type: 'node' },
        { c: 'Target group', x: 120, y: 280, type: 'node' },
        { c: 'Pricing?', x: 520, y: 280, type: 'decision' },
        { c: 'Test the beta first', x: 700, y: 140, type: 'sticky' },
      ]).map((n, i) => ({
    id: id('canvas', i),
    project_id: projectId,
    type: n.type,
    content: n.c,
    x: n.x,
    y: n.y,
    width: n.type === 'sticky' ? 180 : n.type === 'decision' ? 140 : 160,
    height: n.type === 'sticky' ? 180 : n.type === 'decision' ? 70 : 50,
    color: n.type === 'sticky' ? '#fde68a' : n.type === 'decision' ? '#f97316' : '#0a0a0a',
    borderColor: n.type === 'sticky' ? '#1f2937' : '#ffffff',
    is_done: false,
    created_date: hoursAgo(40),
  }));

  const canvasConnections = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
  ].map((c, i) => ({
    id: id('conn', i),
    project_id: projectId,
    from_item_id: id('canvas', c.from),
    to_item_id: id('canvas', c.to),
    label: null,
    created_date: hoursAgo(40),
  }));

  return { posts, postComments, tasks, docs, files, messages, events, canvasItems, canvasConnections };
}

export default function DemoDataButton({ projectId }) {
  const { language } = useLanguage();
  const de = language === 'de';
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [open, setOpen] = useState(true);

  if (!projectId || !open) return null;

  const fill = () => {
    const d = buildDemoData(projectId, de);
    const put = (key, value) => queryClient.setQueryData(key, value);

    put(['posts', projectId], d.posts);
    put(['postComments', projectId], d.postComments);
    put(['tasks', projectId], d.tasks);
    put(['allComments', projectId], []);
    put(['allSubtasks', projectId], []);
    put(['docs', projectId], d.docs);
    put(['files', projectId], d.files);
    put(['messages', projectId], d.messages);
    put(['events', projectId], d.events);
    put(['canvasItems', projectId], d.canvasItems);
    put(['mindmapNodes', projectId], d.canvasItems);
    put(['mindmapConnections', projectId], d.canvasConnections);
    put(['canvasComments', projectId], []);
    setActive(true);
  };

  const clear = () => {
    queryClient.invalidateQueries();
    setActive(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[80] flex items-center gap-2" data-timer-ignore="true">
      <button
        type="button"
        onClick={active ? clear : fill}
        className={`flex items-center gap-2 px-4 py-2.5 border-2 text-xs font-bold uppercase tracking-wide ${
          active
            ? 'bg-white text-black border-black'
            : 'bg-[#ef5a24] text-white border-[#ef5a24]'
        }`}
        title={de ? 'Nur zur Ansicht — nichts wird gespeichert' : 'Preview only — nothing is saved'}
      >
        {active ? <Trash2 className="w-4 h-4" /> : <Database className="w-4 h-4" />}
        {active ? (de ? 'Demo-Daten weg' : 'Clear demo data') : (de ? 'Demo-Daten' : 'Demo data')}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-8 h-8 border-2 border-black bg-white text-black flex items-center justify-center"
        title={de ? 'Knopf ausblenden' : 'Hide button'}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
