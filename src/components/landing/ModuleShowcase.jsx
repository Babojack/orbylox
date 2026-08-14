import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ListTodo, FolderOpen, Shapes, LayoutGrid } from 'lucide-react';

/**
 * Modul-Rundgang mit Scroll-Bühne.
 *
 * Jedes Modul bekommt eine hohe Sektion, in der eine bildschirmhohe Bühne
 * klebt. Beim Durchscrollen zoomt das Bild langsam heran, der Titel wandert
 * nach oben und die Beschreibung schiebt sich darunter ins Bild. Dadurch
 * bekommt man pro Modul einen ruhigen Moment statt einer Bilderflut.
 *
 * Die Screenshots stehen bewusst ohne Rahmen und mit object-contain in einer
 * Box fester Höhe: so bleibt jedes Bild vollständig sichtbar und die Bühne
 * springt nicht, wenn der Text erscheint.
 */

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

function ModuleStage({ item, index, total, de }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Wer weniger Bewegung eingestellt hat, bekommt dieselbe Buehne ohne Fahrt.
  const rm = !!reduceMotion;

  // Bild faehrt langsam heran — der Blick wandert von der Uebersicht ins Detail.
  const imageScale = useTransform(scrollYProgress, [0, 0.55, 1], rm ? [1, 1, 1] : [0.86, 1.02, 1.1]);
  const imageY = useTransform(scrollYProgress, [0, 1], rm ? [0, 0] : [36, -28]);

  // Titel steigt auf, sobald die Buehne steht.
  const headY = useTransform(scrollYProgress, [0, 0.4], rm ? [0, 0] : [56, 0]);
  const headOpacity = useTransform(scrollYProgress, [0, 0.12], rm ? [1, 1] : [0, 1]);

  // Beschreibung kommt danach von unten nach.
  const textY = useTransform(scrollYProgress, [0.22, 0.5], rm ? [0, 0] : [28, 0]);
  const textOpacity = useTransform(scrollYProgress, [0.22, 0.45], rm ? [1, 1] : [0, 1]);

  // Die ganze Buehne blendet an den Raendern weich weg.
  const stageOpacity = useTransform(
    scrollYProgress,
    [0, 0.06, 0.9, 1],
    rm ? [1, 1, 1, 1] : [0, 1, 1, 0],
  );

  const barWidth = useTransform(scrollYProgress, [0.05, 0.85], ['0%', '100%']);

  return (
    <section ref={ref} className="relative h-[170vh]">
      <div className="sticky top-0 h-[100svh] flex items-center overflow-hidden">
        <motion.div
          style={{ opacity: stageOpacity }}
          className="w-full max-w-5xl mx-auto px-4 flex flex-col items-center text-center"
        >
          {/* Kopf: steigt beim Scrollen nach oben */}
          <motion.div style={{ y: headY, opacity: headOpacity }} className="mb-5 sm:mb-7">
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
          <div className="w-full h-[38vh] sm:h-[44vh] flex items-center justify-center">
            <motion.img
              src={item.src}
              alt={item.title}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ scale: imageScale, y: imageY }}
              className="max-h-full max-w-full w-auto object-contain drop-shadow-[0_24px_50px_rgba(10,10,10,0.18)]"
            />
          </div>

          {/* Beschreibung: schiebt sich darunter ins Bild */}
          <motion.div style={{ y: textY, opacity: textOpacity }} className="mt-6 sm:mt-8 max-w-2xl">
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

          {/* Fortschritt dieses Moduls */}
          <div className="mt-7 sm:mt-9 w-40 h-[3px] bg-slate-200 overflow-hidden">
            <motion.div style={{ width: barWidth }} className="h-full bg-[#ef5a24]" />
          </div>
          <span className="sr-only">
            {de ? 'Modul' : 'Module'} {index + 1} {de ? 'von' : 'of'} {total}
          </span>
        </motion.div>
      </div>
    </section>
  );
}

export default function ModuleShowcase({ de }) {
  const items = MODULES(de);

  return (
    <div className="border-b-2 border-black bg-white">
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-4 text-center">
        <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wide">
          {de ? 'Rundgang' : 'Guided tour'}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">
          {de ? 'Vier Module, ein Projekt' : 'Four modules, one project'}
        </h2>
        <p className="text-slate-600 mt-2">
          {de ? 'Scroll dich durch — jedes Modul zeigt sich selbst.' : 'Scroll through — each module shows itself.'}
        </p>
      </div>

      {items.map((item, i) => (
        <ModuleStage key={item.key} item={item} index={i} total={items.length} de={de} />
      ))}
    </div>
  );
}
