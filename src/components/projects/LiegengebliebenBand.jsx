import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, X, ArrowRight } from 'lucide-react';
import { ruheText } from '@/lib/projectNeglect';
import { DAUER, uebergang } from '@/components/motion/bewegung';

/**
 * "Lange nichts gehört von …" — ein schmales Band über der Projektliste.
 *
 * WARUM EIN BAND UND KEINE KACHEL IN DER LISTE
 * Eine Kachel zwischen den Projekten müsste anders aussehen als ihre
 * Nachbarn, um überhaupt aufzufallen — und verschöbe dabei das Raster. Das
 * Band steht darüber, nimmt zwei Zeilen und ist weg, sobald man es wegklickt.
 *
 * WARUM ES SICH WEGKLICKEN LÄSST, UND ZWAR NUR FÜR HEUTE
 * Ein Vorschlag, den man nicht loswird, ist ein Vorwurf. Einer, den man für
 * immer loswird, ist ein Knopf, den man einmal drückt und danach nie wieder
 * etwas hört. "Heute nicht" trifft das, was man in dem Moment meint.
 *
 * WAS HIER NICHT PASSIERT
 * Diese Ansicht rechnet nichts aus. Welche Projekte liegengeblieben sind,
 * entscheidet `lib/projectNeglect.js` — dort ohne Browser prüfbar
 * (`npm run check:neglect`).
 */
export default function LiegengebliebenBand({ eintraege = [], de = true, onOeffnen, onWeg }) {
  const reduziert = useReducedMotion();
  if (!eintraege.length) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={uebergang(DAUER.flaeche, reduziert)}
        data-liegengeblieben=""
        className="mb-6 border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(10,10,10,0.85)]"
      >
        <div className="flex items-start gap-3 p-3 sm:p-4">
          <span
            className="hidden sm:grid place-items-center w-9 h-9 shrink-0 bg-[#ef5a24] text-white"
            aria-hidden="true"
          >
            <Clock className="w-4 h-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ef5a24]">
              {de ? 'Lange nichts gehört von' : 'Nothing heard in a while from'}
            </p>

            {/* Eine Zeile je Projekt. Auf dem Handy untereinander, ab `sm`
                nebeneinander — bei höchstens drei passt das in eine Reihe. */}
            <ul className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-2">
              {eintraege.map(({ projekt, tage }) => (
                <li key={projekt.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOeffnen?.(projekt)}
                    className="group w-full sm:w-auto flex items-center gap-2 min-w-0 max-w-full
                      px-3 h-11 border-2 border-black bg-white text-left
                      hover:bg-black hover:text-white transition-colors"
                  >
                    <span className="min-w-0 flex-1 sm:flex-none">
                      <span className="block truncate text-sm font-bold">{projekt.name}</span>
                      {/* `group-hover:text-white/70`: Auf dem schwarzen Grund
                          wäre Grau nicht mehr zu lesen. */}
                      <span className="block truncate text-[11px] leading-tight text-slate-500 group-hover:text-white/70">
                        {ruheText(tage, de)}
                      </span>
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onWeg}
            title={de ? 'Heute nicht mehr zeigen' : 'Do not show again today'}
            aria-label={de ? 'Heute nicht mehr zeigen' : 'Do not show again today'}
            className="h-9 w-9 shrink-0 grid place-items-center border-2 border-black bg-white
              hover:bg-black hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
