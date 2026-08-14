import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ListTodo, FolderOpen, Shapes, LayoutGrid, Check } from 'lucide-react';

/**
 * Modul-Schaufenster mit Sticky-Scroll.
 *
 * Der Bildbereich bleibt beim Scrollen stehen, während links die Erklärungen
 * durchlaufen. Das jeweils aktive Modul blendet sein Bild ein — dadurch wirkt
 * es wie ein geführter Rundgang statt einer Bildergalerie.
 */

const MODULES = (de) => [
  {
    key: 'tasks',
    icon: ListTodo,
    src: '/screens/hero-laptop.webp',
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
    label: de ? 'Feed' : 'Feed',
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

function ModulePanel({ item, index, onActive, active }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onActive(index),
      { rootMargin: '-45% 0px -45% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onActive]);

  return (
    <div ref={ref} className="min-h-[70vh] lg:min-h-[80vh] flex flex-col justify-center py-10">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-20%' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`w-10 h-10 flex items-center justify-center border-2 transition-colors ${
              active ? 'bg-[#ef5a24] text-white border-[#ef5a24]' : 'bg-white text-black border-black'
            }`}
          >
            <item.icon className="w-5 h-5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
            {String(index + 1).padStart(2, '0')} · {item.label}
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">{item.title}</h3>
        <p className="text-slate-600 leading-relaxed mb-5 max-w-md">{item.text}</p>

        <ul className="space-y-2">
          {item.points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm font-medium">
              <span className="w-4 h-4 bg-[#ef5a24] text-white flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Auf schmalen Bildschirmen steht das Bild direkt unter dem Text */}
      <div className="lg:hidden mt-6 border-2 border-black bg-[#f5f5f5]">
        <img src={item.src} alt={item.title} loading="lazy" className="w-full" />
      </div>
    </div>
  );
}

export default function ModuleShowcase({ de }) {
  const items = MODULES(de);
  const [active, setActive] = useState(0);
  const sectionRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  // Der Bildstapel kippt beim Durchscrollen ganz leicht — genug, um Bewegung
  // zu zeigen, wenig genug, um nicht abzulenken.
  const tilt = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [1.5, -1.5]);

  return (
    <section ref={sectionRef} className="border-b-2 border-black bg-white">
      <div className="max-w-6xl mx-auto px-4 pt-16">
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wide">
            {de ? 'Rundgang' : 'Guided tour'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">
            {de ? 'Vier Module, ein Projekt' : 'Four modules, one project'}
          </h2>
          <p className="text-slate-600 mt-2">
            {de ? 'Scroll dich durch — die Ansicht wechselt mit.' : 'Scroll through — the view follows along.'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16 grid lg:grid-cols-2 gap-12">
        <div>
          {items.map((item, i) => (
            <ModulePanel key={item.key} item={item} index={i} active={active === i} onActive={setActive} />
          ))}
        </div>

        {/* Sticky-Bildbereich: bleibt stehen, während links gescrollt wird */}
        <div className="hidden lg:block">
          <motion.div style={{ rotate: tilt }} className="sticky top-24">
            <div className="relative border-2 border-black bg-[#f5f5f5] aspect-[16/10] overflow-hidden">
              {items.map((item, i) => (
                <motion.img
                  key={item.key}
                  src={item.src}
                  alt={item.title}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  initial={false}
                  animate={{
                    opacity: active === i ? 1 : 0,
                    scale: active === i ? 1 : 1.04,
                  }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>

            {/* Fortschrittsleiste statt Punkte — passt zur kantigen Sprache */}
            <div className="mt-3 flex gap-1.5">
              {items.map((item, i) => (
                <div key={item.key} className="flex-1 h-1.5 bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#ef5a24]"
                    initial={false}
                    animate={{ width: active >= i ? '100%' : '0%' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {items[active].label}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
