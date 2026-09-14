/**
 * Ein gefülltes Projekt zum Ausprobieren — ohne Konto, ohne Registrierung.
 *
 * WARUM ES DAS ÜBERHAUPT BRAUCHT
 * Den Demo-Zugang gab es schon, aber er führte in eine leere Anwendung: kein
 * Projekt, kein Board, kein Ticket. Wer "ausprobieren" klickt, will nicht
 * zuerst eine halbe Stunde Daten eintippen, um zu sehen, ob das Werkzeug
 * etwas taugt. Er will ein Board, auf dem Karten liegen, die er anfassen kann.
 *
 * WARUM DIE DATEN HIER STEHEN UND NICHT IM BAUM DER OBERFLÄCHE
 * Es ist eine reine Datei: Sie ruft nichts auf, liest nichts und hängt an
 * keinem React. Damit lässt sie sich prüfen (`npm run check:demo`) und in
 * einem Rutsch in den Speicher legen. Und sie kann wachsen, ohne dass eine
 * Seite davon etwas merkt.
 *
 * WAS DRINSTEHT
 * Ein Projekt, das jeder kennt — eine Webseite bauen —, mit:
 *   - Tickets auf dem Hauptboard und ein zweites Board daneben,
 *   - Tickets in allen vier Spalten, mit Aufwand, Zuweisung und Etiketten,
 *   - einer echten Abhängigkeit (ein Ticket wartet auf ein anderes),
 *   - Teilaufgaben und Kommentaren an den Tickets, die man im Fokus öffnet,
 *   - Notizen, Terminen und Beiträgen im Feed.
 * Keine leere Liste irgendwo: Jeder Menüpunkt zeigt etwas.
 *
 * DIE ZEITEN SIND RELATIV
 * Feste Daten altern. Ein Demo-Projekt, in dem alle Termine zwei Jahre her
 * sind, sieht aus wie eine Leiche, nicht wie ein Werkzeug. Deshalb rechnet
 * `demoDaten()` alles vom heutigen Tag aus.
 */

export const DEMO_EMAIL = 'demo@orbylox.local';
export const DEMO_PROJEKT_ID = 'demo-projekt';

/** Mitspieler, damit Zuweisungen und Erwähnungen nicht ins Leere zeigen. */
const TEAM = {
  ich: DEMO_EMAIL,
  lena: 'lena@beispiel.de',
  tom: 'tom@beispiel.de',
};

/** Tage ab heute, als ISO-Zeitpunkt. Negative Zahlen liegen in der Vergangenheit. */
function tag(versatz, stunde = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  d.setHours(stunde, minute, 0, 0);
  return d.toISOString();
}

/** Für Formularfelder vom Typ datetime-local: ohne Zeitzone, auf die Minute. */
function terminZeit(versatz, stunde, minute = 0) {
  return tag(versatz, stunde, minute).slice(0, 16);
}

/**
 * Die Sammlungen, so wie `apiClient` sie liest.
 *
 * Die Schlüssel sind genau die Namen aus `api.entities` — wer hier einen Namen
 * verdreht, sieht eine leere Seite und keinen Fehler. `check:demo` hält die
 * Liste deshalb gegen den apiClient.
 */
export function demoDaten() {
  const jetzt = tag(0, 12);

  const projekt = {
    id: DEMO_PROJEKT_ID,
    name: 'Webseite für das Café Morgen',
    description:
      'Neue Seite mit Speisekarte, Öffnungszeiten und Tischreservierung. '
      + 'Bis zur Eröffnung in vier Wochen soll sie stehen.',
    members: [TEAM.ich, TEAM.lena, TEAM.tom],
    created_date: tag(-24, 10),
    updated_date: tag(-1, 16),
  };

  /**
   * Das zusätzliche Board.
   *
   * Das ERSTE Board ist keins: Jedes Projekt hat ein eingebautes "Hauptboard",
   * und dort liegen alle Tickets, deren `kanban_board_id` leer ist. Genau da
   * landet man nach dem Klick auf den Demo-Knopf — also liegt dort auch die
   * Arbeit. Ein zweites, benanntes Board kommt dazu, damit der Umschalter
   * darüber nicht nur ein einziges Wort zeigt.
   *
   * Das Feld heisst `title`, nicht `name`. Beim ersten Anlauf stand `name`
   * darin, und im Umschalter stand zweimal das Wort "Board" — die Oberfläche
   * fiel auf ihren Ersatztext zurück, ohne sich zu beschweren.
   */
  const boards = [
    { id: 'demo-board-eroeffnung', project_id: DEMO_PROJEKT_ID, title: 'Eröffnung', sort_order: 0, created_date: tag(-12, 10) },
  ];

  /**
   * Ein Ticket mit allem, was die Oberfläche anzeigen kann.
   * `kind` und `parent_stack_id` stehen bewusst drin: Ohne sie fallen die
   * Karten beim Stapeln durch die Prüfung im Board.
   */
  const ticket = (id, felder) => ({
    id,
    project_id: DEMO_PROJEKT_ID,
    kanban_board_id: null,
    kind: 'task',
    parent_stack_id: null,
    stack_order: 0,
    priority: 'medium',
    story_points: 0,
    assignee_email: '',
    assignees: [],
    depends_on: [],
    tags: [],
    description: '',
    created_date: tag(-20, 11),
    ...felder,
  });

  const tasks = [
    ticket('demo-t-entwurf', {
      title: 'Entwurf der Startseite abstimmen',
      description: 'Drei Entwürfe stehen. Mit Lena durchgehen und einen auswählen.',
      status: 'done',
      priority: 'high',
      story_points: 3,
      assignee_email: TEAM.lena,
      assignees: [TEAM.lena],
      tags: ['design'],
      board_order: 0,
      created_date: tag(-20, 11),
    }),
    ticket('demo-t-texte', {
      title: 'Texte für Speisekarte schreiben',
      description: 'Kurze Beschreibungen für 18 Gerichte. Allergene nicht vergessen.',
      status: 'done',
      story_points: 5,
      assignee_email: TEAM.ich,
      assignees: [TEAM.ich],
      tags: ['inhalt'],
      board_order: 1,
      created_date: tag(-18, 9),
    }),
    ticket('demo-t-fotos', {
      title: 'Fotos vom Innenraum machen',
      description: 'Vormittags, wenn das Licht von der Straßenseite kommt.',
      status: 'review',
      story_points: 2,
      assignee_email: TEAM.tom,
      assignees: [TEAM.tom],
      tags: ['inhalt'],
      board_order: 0,
      created_date: tag(-11, 14),
    }),
    ticket('demo-t-reservierung', {
      title: 'Tischreservierung einbauen',
      description:
        'Formular mit Datum, Uhrzeit und Personenzahl. Bestätigung per E-Mail. '
        + 'Geht erst, wenn die Startseite steht.',
      status: 'in_progress',
      priority: 'high',
      story_points: 8,
      assignee_email: TEAM.ich,
      assignees: [TEAM.ich],
      tags: ['funktion'],
      depends_on: ['demo-t-entwurf'],
      board_order: 0,
      created_date: tag(-9, 10),
    }),
    ticket('demo-t-oeffnungszeiten', {
      title: 'Öffnungszeiten pflegbar machen',
      description: 'Damit das Café sie selbst ändern kann, ohne uns zu fragen.',
      status: 'in_progress',
      story_points: 3,
      assignee_email: TEAM.lena,
      assignees: [TEAM.lena],
      tags: ['funktion'],
      board_order: 1,
      created_date: tag(-7, 15),
    }),
    ticket('demo-t-mobil', {
      title: 'Auf dem Handy durchgehen',
      description: 'Jede Seite einmal auf einem echten Gerät ansehen, nicht nur im Browser.',
      status: 'todo',
      priority: 'high',
      story_points: 3,
      assignee_email: TEAM.tom,
      assignees: [TEAM.tom],
      tags: ['test'],
      board_order: 0,
      created_date: tag(-5, 11),
    }),
    ticket('demo-t-impressum', {
      title: 'Impressum und Datenschutz',
      description: 'Vom Steuerberater gegenlesen lassen.',
      status: 'todo',
      story_points: 2,
      tags: ['recht'],
      board_order: 1,
      created_date: tag(-4, 9),
    }),
    ticket('demo-t-suchmaschine', {
      title: 'Bei Google eintragen',
      description: 'Search Console einrichten, Sitemap einreichen.',
      status: 'todo',
      story_points: 1,
      tags: ['marketing'],
      board_order: 2,
      created_date: tag(-3, 16),
    }),
    /* Auf dem zweiten Board, damit der Umschalter wirklich umschaltet und
       nicht zweimal dasselbe zeigt. */
    ticket('demo-t-flyer', {
      title: 'Flyer für die Nachbarschaft',
      kanban_board_id: 'demo-board-eroeffnung',
      description: '500 Stück, in die Briefkästen im Viertel.',
      status: 'todo',
      story_points: 2,
      assignee_email: TEAM.lena,
      assignees: [TEAM.lena],
      board_order: 0,
      created_date: tag(-6, 12),
    }),
    ticket('demo-t-eroeffnung', {
      title: 'Eröffnungsfeier planen',
      kanban_board_id: 'demo-board-eroeffnung',
      description: 'Termin, Getränke, Musik. Wer kommt?',
      status: 'in_progress',
      priority: 'high',
      story_points: 5,
      assignee_email: TEAM.ich,
      assignees: [TEAM.ich],
      board_order: 0,
      created_date: tag(-6, 12),
    }),
  ];

  const subtasks = [
    { id: 'demo-s-1', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, title: 'Formular bauen', completed: true, sort_order: 0, created_date: tag(-9, 11) },
    { id: 'demo-s-2', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, title: 'Bestätigungsmail schreiben', completed: true, sort_order: 1, created_date: tag(-8, 11) },
    { id: 'demo-s-3', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, title: 'Was tun, wenn alles voll ist?', completed: false, sort_order: 2, created_date: tag(-8, 12) },
    { id: 'demo-s-4', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, title: 'Absage durch den Gast ermöglichen', completed: false, sort_order: 3, created_date: tag(-2, 9) },
    { id: 'demo-s-5', task_id: 'demo-t-mobil', project_id: DEMO_PROJEKT_ID, title: 'iPhone', completed: false, sort_order: 0, created_date: tag(-5, 11) },
    { id: 'demo-s-6', task_id: 'demo-t-mobil', project_id: DEMO_PROJEKT_ID, title: 'Android', completed: false, sort_order: 1, created_date: tag(-5, 11) },
    { id: 'demo-s-7', task_id: 'demo-t-eroeffnung', project_id: DEMO_PROJEKT_ID, title: 'Termin festlegen', completed: true, sort_order: 0, created_date: tag(-6, 13) },
    { id: 'demo-s-8', task_id: 'demo-t-eroeffnung', project_id: DEMO_PROJEKT_ID, title: 'Getränke bestellen', completed: false, sort_order: 1, created_date: tag(-6, 13) },
  ];

  const taskComments = [
    { id: 'demo-c-1', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, content: 'Sollen wir auch Tische für draußen anbieten? Bei Regen wäre das ärgerlich.', author_email: TEAM.lena, created_date: tag(-6, 10, 20) },
    { id: 'demo-c-2', task_id: 'demo-t-reservierung', project_id: DEMO_PROJEKT_ID, content: 'Ja, aber mit Hinweis. Ich baue ein Häkchen "Terrasse, wenn das Wetter passt" ein.', author_email: TEAM.ich, created_date: tag(-6, 11, 5) },
    { id: 'demo-c-3', task_id: 'demo-t-fotos', project_id: DEMO_PROJEKT_ID, content: 'Die Bilder sind da. Drei sind unscharf, die anderen elf kann man nehmen.', author_email: TEAM.tom, created_date: tag(-2, 17, 30) },
    { id: 'demo-c-4', task_id: 'demo-t-mobil', project_id: DEMO_PROJEKT_ID, content: 'Ich habe ein altes Android hier, das nehme ich mit.', author_email: TEAM.tom, created_date: tag(-1, 9, 15) },
  ];

  const documents = [
    {
      id: 'demo-d-1',
      project_id: DEMO_PROJEKT_ID,
      title: 'Was die Seite können muss',
      icon: '📋',
      folder_id: null,
      created_date: tag(-22, 10),
      content:
        'Speisekarte, die das Café selbst ändern kann.\n'
        + 'Öffnungszeiten, auch für Feiertage.\n'
        + 'Tischreservierung mit Bestätigung.\n'
        + 'Anfahrt mit Karte.\n\n'
        + 'Nicht nötig: Onlineshop, Blog, Newsletter.',
    },
    {
      id: 'demo-d-2',
      project_id: DEMO_PROJEKT_ID,
      title: 'Notizen vom Gespräch mit dem Café',
      icon: '📝',
      folder_id: null,
      created_date: tag(-19, 15),
      content:
        'Frau Berger möchte es "warm und nicht überladen".\n'
        + 'Farben: Holz, Creme, ein kräftiges Orange als Akzent.\n'
        + 'Wichtig: Die Telefonnummer muss auf jeder Seite stehen — '
        + 'die meisten Gäste rufen lieber an, als zu tippen.',
    },
    {
      id: 'demo-d-3',
      project_id: DEMO_PROJEKT_ID,
      title: 'Offene Fragen',
      icon: '❓',
      folder_id: null,
      created_date: tag(-3, 11),
      content:
        'Wer pflegt die Speisekarte nach der Eröffnung?\n'
        + 'Brauchen wir eine englische Fassung?\n'
        + 'Was passiert mit Reservierungen an Feiertagen?',
    },
  ];

  const events = [
    { id: 'demo-e-1', project_id: DEMO_PROJEKT_ID, title: 'Entwurf zeigen', description: 'Bei Frau Berger im Café.', start_date: terminZeit(1, 10), end_date: terminZeit(1, 11), all_day: false, color: '#ef5a24', attendees: [TEAM.lena], video_enabled: false, created_date: tag(-4, 9) },
    { id: 'demo-e-2', project_id: DEMO_PROJEKT_ID, title: 'Fotos im Café', description: 'Vormittags, wegen des Lichts.', start_date: terminZeit(3, 9), end_date: terminZeit(3, 12), all_day: false, color: '#6366f1', attendees: [TEAM.tom], video_enabled: false, created_date: tag(-4, 9) },
    { id: 'demo-e-3', project_id: DEMO_PROJEKT_ID, title: 'Zwischenstand im Team', description: 'Kurz, eine halbe Stunde.', start_date: terminZeit(5, 14), end_date: terminZeit(5, 14, 30), all_day: false, color: '#16a34a', attendees: [TEAM.lena, TEAM.tom], video_enabled: true, created_date: tag(-4, 9) },
    { id: 'demo-e-4', project_id: DEMO_PROJEKT_ID, title: 'Eröffnung', description: 'Der Tag, auf den alles zuläuft.', start_date: terminZeit(21, 17), end_date: terminZeit(21, 22), all_day: false, color: '#ef5a24', attendees: [TEAM.lena, TEAM.tom], video_enabled: false, created_date: tag(-10, 9) },
  ];

  const posts = [
    { id: 'demo-p-1', project_id: DEMO_PROJEKT_ID, content: 'Der Entwurf ist durch — wir nehmen den mittleren. Lena baut ihn diese Woche.', author_email: TEAM.ich, type: 'update', tags: ['general'], created_date: tag(-8, 17) },
    { id: 'demo-p-2', project_id: DEMO_PROJEKT_ID, content: 'Fotos sind fertig und liegen im Dateibereich. Elf brauchbare, drei für die Tonne.', author_email: TEAM.tom, type: 'update', tags: ['general'], created_date: tag(-2, 18) },
    { id: 'demo-p-3', project_id: DEMO_PROJEKT_ID, content: 'Erinnerung: Zwischenstand am Freitag um zwei. Videokonferenz ist im Termin hinterlegt.', author_email: TEAM.lena, type: 'update', tags: ['general'], created_date: tag(-1, 12) },
  ];

  return {
    Project: [projekt],
    KanbanBoard: boards,
    Task: tasks,
    Subtask: subtasks,
    TaskComment: taskComments,
    Document: documents,
    Event: events,
    Post: posts,
    // Ausdrücklich leer: Wer etwas hochlädt oder zeichnet, soll seine eigene
    // erste Datei sehen und nicht zwischen erfundenen suchen.
    FileRecord: [],
    Folder: [],
    CanvasItem: [],
    CanvasConnection: [],
    __erzeugt: jetzt,
  };
}

/** Wie viele Einträge insgesamt — für die Prüfung und fürs Protokoll. */
export function demoAnzahl(daten = demoDaten()) {
  return Object.entries(daten)
    .filter(([k, v]) => !k.startsWith('__') && Array.isArray(v))
    .reduce((summe, [, v]) => summe + v.length, 0);
}
