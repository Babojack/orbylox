import { motion, useReducedMotion } from 'framer-motion';
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import { StrictModeDroppable as Droppable } from '@/components/StrictModeDroppable';
import { GripVertical, Check } from 'lucide-react';
import { sichtbareIds, kastenIds, modulVon } from '@/lib/menuModules';
import { SYMBOL_VON } from '@/lib/menuIcons';
import { DAUER, VON_UNTEN, uebergang } from '@/components/motion/bewegung';

/**
 * Das Menü einrichten: ziehen, sortieren, in den Kasten legen.
 *
 * WARUM EINE EIGENE DATEI UND NACHGELADEN
 * Hier steckt die einzige Abhängigkeit, die das Menü sonst nicht braucht —
 * die Zieh-Bibliothek. Sie liegt bereits als eigener Brocken vor, weil das
 * Kanban-Brett sie benutzt; nachgeladen kostet sie niemanden etwas, der sein
 * Menü nie anfasst.
 *
 * WARUM DIESELBE BIBLIOTHEK WIE AUF DEM BRETT
 * Weil Ziehen mit der Tastatur, mit dem Finger und mit dem Bildschirmleser
 * funktionieren muss. Das selbst zu bauen heisst, all das noch einmal zu
 * bauen — und schlechter.
 *
 * WAS HIER NICHT PASSIERT
 * Diese Ansicht rechnet nichts aus. Sie meldet nur "dieses Modul, dorthin,
 * an diese Stelle"; die Anordnung entsteht in `menuModules.js` und wird dort
 * ohne Browser geprüft.
 */
export default function MenuEditor({ menu, onVerschieben, onFertig, de, t }) {
  const reduziert = useReducedMotion();
  const imMenue = sichtbareIds(menu);
  const imKasten = kastenIds(menu);

  const beschriftung = (id) => {
    const m = modulVon(id);
    if (!m) return id;
    if (m.labelKey) return t(m.labelKey);
    return typeof m.label === 'string' ? m.label : (m.label?.[de ? 'de' : 'en'] || m.label?.de);
  };

  const beimAblegen = (ergebnis) => {
    const { draggableId, destination } = ergebnis;
    if (!destination) return;                       // neben der Liste losgelassen
    onVerschieben(draggableId, destination.droppableId, destination.index);
  };

  const Eintrag = ({ id, index, gedimmt }) => {
    const Symbol = SYMBOL_VON[id];
    return (
      <Draggable draggableId={id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`flex items-center gap-2 px-2 py-2 border-2 border-black bg-white
              text-xs font-bold uppercase tracking-wide select-none min-w-0
              ${snapshot.isDragging ? 'shadow-[4px_4px_0_0_rgba(10,10,10,0.85)]' : ''}
              ${gedimmt ? 'opacity-70' : ''}`}
          >
            <GripVertical className="w-4 h-4 shrink-0 text-slate-400" />
            {Symbol && <Symbol className="w-4 h-4 shrink-0" />}
            <span className="truncate min-w-0">{beschriftung(id)}</span>
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <DragDropContext onDragEnd={beimAblegen}>
      {/* Der Kasten schiebt sich von unten herein, statt die Liste zu
          ersetzen: So sieht man, dass etwas HINZUKOMMT, und sucht nicht nach
          der Navigation, die eben noch da war. */}
      <motion.div
        {...VON_UNTEN}
        transition={uebergang(DAUER.flaeche, reduziert)}
        className="space-y-4"
      >
        <p className="text-[11px] leading-tight text-slate-600 px-1">
          {de
            ? 'Zieh die Bausteine in die Reihenfolge, die du brauchst. Was du nicht brauchst, kommt in den Kasten — von dort holst du es jederzeit zurück.'
            : 'Drag the blocks into the order you need. Anything you do not need goes into the box — you can pull it back out any time.'}
        </p>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1">
            {de ? 'Im Menü' : 'In the menu'}
          </h3>
          <Droppable droppableId="menue" type="MENUE">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-1.5 p-1.5 border-2 border-dashed min-h-[64px] transition-colors
                  ${snapshot.isDraggingOver ? 'border-[#ef5a24] bg-[#ef5a24]/5' : 'border-slate-300'}`}
              >
                {imMenue.map((id, i) => <Eintrag key={id} id={id} index={i} />)}
                {provided.placeholder}
                {imMenue.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    {de ? 'Leer — zieh etwas aus dem Kasten hierher.' : 'Empty — drag something here from the box.'}
                  </p>
                )}
              </div>
            )}
          </Droppable>
        </section>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1">
            {de ? 'Kasten' : 'Box'}
          </h3>
          <Droppable droppableId="kasten" type="MENUE">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-1.5 p-1.5 border-2 border-dashed min-h-[64px] bg-slate-50 transition-colors
                  ${snapshot.isDraggingOver ? 'border-[#ef5a24] bg-[#ef5a24]/5' : 'border-slate-300'}`}
              >
                {imKasten.map((id, i) => <Eintrag key={id} id={id} index={i} gedimmt />)}
                {provided.placeholder}
                {imKasten.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    {de ? 'Alles im Menü.' : 'Everything is in the menu.'}
                  </p>
                )}
              </div>
            )}
          </Droppable>
        </section>

        <button
          type="button"
          onClick={onFertig}
          className="w-full inline-flex items-center justify-center gap-2 h-10 bg-[#ef5a24] border-2 border-[#ef5a24] text-white text-xs font-bold uppercase tracking-wide"
        >
          <Check className="w-4 h-4" /> {de ? 'Fertig' : 'Done'}
        </button>
      </motion.div>
    </DragDropContext>
  );
}
