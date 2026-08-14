import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion';
import { ListTodo, FolderOpen, Shapes, LayoutGrid } from 'lucide-react';

/**
 * Modul-Rundgang als eine durchgehende Buehne.
 *
 * Fruehere Fassung: jedes Modul hatte eine eigene hohe Sektion. Das kostete
 * mehrere Scroll-Bewegungen pro Modul und dazwischen war der Bildschirm kurz
 * leer. Jetzt klebt eine einzige Buehne, durch die alle Module wandern:
 *
 *   - die Module ueberlappen beim Wechsel, es gibt keine Luecke mehr
 *   - jede Scroll-Bewegung bewegt sichtbar etwas (kein Leerlauf am Segmentende)
 *   - eine Feder glaettet den Scroll, damit die Fahrt weich statt hakelig wirkt
 *   - die Leiste unten ist anklickbar und springt direkt zum Modul
 *
 * STEP_VH bestimmt, wie weit man pro Modul scrollt. Kleiner = schneller.
 */

const STEP_VH = 60;

const MODULES = (de) => [
  {
    key: 'tasks',
    icon: ListTodo,
    src: '/screens/tasks.webp',
    label: de ? 'Aufgaben' : 'Tasks',
    title: de ? 'Kanban, das mitdenkt' : 'Kanban that keeps up',
    text: de
      ? 'Vier Spalten, Ziehen und Ablegen, Prioritäten und Zuständige auf einen Blick. Der Arbeitszeit-Timer läuft automatisch mit, sobald du im Projekt arbeitest.'
      : 'Four columns, drag and drop, priorities and owners at a glance. The work timer runs automatically while you work in the project.',
    points: de
      ? ['Mehrere Boards pro Projekt', 'Prioritäten und Etiketten', 'Automatische Zeiterfassung']
      : ['Several boards per project', 'Priorities and labels', 'Automatic time tracking'],
  },
  {
    key: 'feed',
    icon: LayoutGrid,
    src: '/screens/feed.webp',
    label: 'Feed',
    title: de ? 'Alles Wichtige an einer Stelle' : 'Everything important in one place',
    text: de
      ? 'Ankündigungen, Rückfragen, Reaktionen. Wichtiges bleibt oben angeheftet, der Rest sortiert sich nach Aktualität.'
      : 'Announcements, questions, reactions. What matters stays pinned at the top, the rest sorts by recency.',
    points: de
      ? ['Beiträge anpinnen', 'Reaktionen und Kommentare', 'Bilder direkt im Beitrag']
      : ['Pin posts', 'Reactions and comments', 'Images inside the post'],
  },
  {
    key: 'canvas',
    icon: Shapes,
    src: '/screens/canvas.webp',
    label: 'Canvas',
    title: de ? 'Denken wie am Whiteboard' : 'Think like on a whiteboard',
    text: de
      ? 'Knoten per Ziehen verbinden, Post-its frei kleben und skalieren, Kommentare direkt am Gedanken. Scrollen bewegt, Cmd-Scroll zoomt.'
      : 'Connect nodes by dragging, stick and resize notes freely, comment right on the idea. Scroll to pan, Cmd-scroll to zoom.',
    points: de
      ? ['Post-its und Entscheidungen', 'Verbinden per Ziehen', 'Kommentare am Knoten']
      : ['Sticky notes and decisions', 'Connect by dragging', 'Comments on nodes'],
  },
  {
    key: 'files',
    icon: FolderOpen,
    src: '/screens/files.webp',
    label: de ? 'Dateien' : 'Files',
    title: de ? 'Dateien mit Vorschau' : 'Files with preview',
    text: de
      ? 'PDFs und Bilder direkt ansehen, ohne Download. Ordner, Drag & Drop und Voll-Backups, die auch die Dateien selbst enthalten.'
      : 'View PDFs and images directly, no download. Folders, drag and drop, and full backups that include the files themselves.',
    points: de
      ? ['Vorschau ohne Download', 'Ordnerstruktur', 'Backups inklusive Dateien']
      : ['Preview without download', 'Folder structure', 'Backups including files'],
  },
];

/**
 * Eine Modulschicht. Alle Schichten liegen uebereinander; sichtbar ist immer
 * die, deren Scroll-Abschnitt gerade dran ist. Ein- und Ausblenden greifen
 * ineinander, dadurch loest ein Modul das andere ohne Leerstelle ab.
 */
function Layer({ item, index, total, progress, rm, isActive }) {
  const seg = 1 / total;
  const start = index * seg;
  const end = start + seg;

  // Die Blende liegt genau auf der Grenze: waehrend eines abtritt, tritt der
  // naechste auf. Keine Luecke, kein Flackern.
  const w = 0.12 * seg;
  const fadeIn = index === 0 ? [-2, -1.999] : [start - w, start + w];
  const fadeOut = index === total - 1 ? [2, 2.001] : [end - w, end + w];

  const opacity = useTransform(
    progress,
    [fadeIn[0], fadeIn[1], fadeOut[0], fadeOut[1]],
    rm ? [1, 1, 1, 1] : [0, 1, 1, 0],
  );

  // Alles laeuft ueber den gesamten Abschnitt durch — so bewegt jede
  // Scroll-Bewegung etwas und es entsteht kein toter Bereich.
  const span = [start - 0.3 * seg, end + 0.3 * seg];
  const imageScale = useTransform(progress, span, rm ? [1, 1] : [0.9, 1.1]);
  const imageY = useTransform(progress, span, rm ? [0, 0] : [26, -26]);
  const headY = useTransform(progress, span, rm ? [0, 0] : [44, -30]);
  const textY = useTransform(progress, span, rm ? [0, 0] : [30, -14]);
  const textOpacity = useTransform(
    progress,
    [start - 0.14 * seg, start + 0.24 * seg],
    rm ? [1, 1] : [0, 1],
  );

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none"
      aria-hidden={!isActive}
    >
      <div className="w-full max-w-5xl flex flex-col items-center text-center">
        {/* Kopf: steigt waehrend des ganzen Abschnitts nach oben */}
        <motion.div style={{ y: headY }} className="mb-4 sm:mb-6">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <span className="w-9 h-9 bg-[#ef5a24] text-white flex items-center justify-center">
              <item.icon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · {item.label}
            </span>
          </div>
          <h3 className="text-3xl sm:text-5xl font-black tracking-tighter leading-[1.05]">
            {item.title}
          </h3>
        </motion.div>

        {/* Bild: feste Hoehe, object-contain — nichts wird abgeschnitten */}
        <div className="w-full h-[34vh] sm:h-[40vh] flex items-center justify-center">
          <motion.img
            src={item.src}
            alt={item.title}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            style={{ scale: imageScale, y: imageY }}
            className="max-h-full max-w-full w-auto object-contain drop-shadow-[0_24px_50px_rgba(10,10,10,0.18)]"
          />
        </div>

        {/* Beschreibung: kommt kurz nach dem Titel von unten nach */}
        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className="mt-5 sm:mt-7 max-w-2xl"
        >
          <p className="text-slate-600 leading-relaxed text-sm sm:text-base">{item.text}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {item.points.map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 bg-[#f5f5f5] text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-700"
              >
                {p}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function ModuleShowcase({ de }) {
  const items = MODULES(de);
  const total = items.length;
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const rm = !!reduceMotion;
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // Die Feder laeuft dem Scroll leicht hinterher — dadurch fuehlt sich die
  // Fahrt weich an, statt an jedem Mausrad-Rasten zu zucken.
  const spring = useSpring(scrollYProgress, {
    stiffness: 170,
    damping: 30,
    mass: 0.35,
    restDelta: 0.0005,
  });
  const progress = rm ? scrollYProgress : spring;

  useMotionValueEvent(progress, 'change', (v) => {
    const i = Math.min(total - 1, Math.max(0, Math.floor(v * total)));
    setActive((prev) => (prev === i ? prev : i));
  });

  /** Direkt zum Modul springen, damit niemand durchscrollen muss. */
  const jumpTo = (i) => {
    const el = ref.current;
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top;
    const pinned = el.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + (pinned * (i + 0.45)) / total,
      behavior: rm ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="border-b-2 border-black bg-white">
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-2 text-center">
        <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wide">
          {de ? 'Rundgang' : 'Guided tour'}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">
          {de ? 'Vier Module, ein Projekt' : 'Four modules, one project'}
        </h2>
        <p className="text-slate-600 mt-2">
          {de ? 'Scroll dich durch — oder spring unten direkt hin.' : 'Scroll through — or jump straight in below.'}
        </p>
      </div>

      <section
        ref={ref}
        className="relative"
        style={{ height: `calc(${total * STEP_VH}vh + 100svh)` }}
      >
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {items.map((item, i) => (
            <Layer
              key={item.key}
              item={item}
              index={i}
              total={total}
              progress={progress}
              rm={rm}
              isActive={active === i}
            />
          ))}

          {/* Anklickbare Leiste: zeigt, wo man ist, und springt hin */}
          <div className="absolute inset-x-0 bottom-6 sm:bottom-8 flex justify-center px-4">
            <div className="flex gap-2 sm:gap-3">
              {items.map((item, i) => (
                <button
                  key={item.key}
                  type="button"
                  data-no-lift
                  onClick={() => jumpTo(i)}
                  className="group flex flex-col items-center gap-2 px-1 py-1"
                  aria-label={item.label}
                  aria-current={active === i ? 'true' : undefined}
                >
                  <span
                    className={`block h-[3px] w-12 sm:w-20 transition-colors duration-300 ${
                      active === i ? 'bg-[#ef5a24]' : 'bg-slate-200 group-hover:bg-slate-400'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wide transition-colors duration-300 ${
                      active === i ? 'text-black' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
