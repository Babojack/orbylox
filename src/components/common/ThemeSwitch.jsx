import { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { applyTheme, THEME_LISTE } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';
import { nod } from '@/lib/botStage';
import { musikStarten, musikStoppen } from '@/lib/retroSound';

/**
 * Umschalter fürs Erscheinungsbild — jetzt mit drei Einträgen.
 *
 * WARUM KEIN DURCHKLICKEN MEHR
 * Bei zwei Themes war ein Schalter ehrlicher als eine Auswahl: Man sah am
 * Knopf, wo man steht, und ein Klick führte an den einzigen anderen Ort. Bei
 * dreien wird daraus Raten — man müsste zweimal klicken, um zu sehen, was es
 * überhaupt gibt, und käme dabei durch ein Aussehen, das man gar nicht
 * wollte. Also eine kleine Liste, die zeigt, was da ist, und markiert, wo man
 * steht.
 *
 * WARUM KEIN `DropdownMenu` VON RADIX
 * Dieser Schalter steht auf der Startseite, und die Startseite ist die Seite,
 * deren Gewicht gemessen wird (`npm run check:bundle`). Vier Zeilen eigenes
 * Auf- und Zuklappen sind hier billiger als ein weiterer Baustein im
 * Startbündel.
 */
export default function ThemeSwitch({ de = true }) {
  // Ueber den Hook statt ueber eigenen Zustand: Auf der Projektliste steht der
  // Schalter zweimal im Baum (Kopfzeile und Liste). Mit eigenem Zustand haette
  // der eine noch "Design" gezeigt, waehrend der andere schon "Retro" sagt.
  const theme = useTheme();
  const [offen, setOffen] = useState(false);
  const huelle = useRef(null);

  /** Klick daneben und Esc schliessen — beides erwartet man von einer Liste. */
  useEffect(() => {
    if (!offen) return undefined;
    const beiKlick = (e) => { if (!huelle.current?.contains(e.target)) setOffen(false); };
    const beiTaste = (e) => { if (e.key === 'Escape') setOffen(false); };
    document.addEventListener('pointerdown', beiKlick);
    window.addEventListener('keydown', beiTaste);
    return () => {
      document.removeEventListener('pointerdown', beiKlick);
      window.removeEventListener('keydown', beiTaste);
    };
  }, [offen]);

  /**
   * Erst umschalten, dann nicken.
   *
   * Die Reihenfolge ist Absicht und das Gegenteil vom Sprachwechsel: Dort
   * grüßt die Figur und die Sprache springt in der Mitte der Geste um, weil
   * man sonst nicht sähe, wofür der Gruß war. Hier ist das neue Aussehen
   * selbst der Anlass — die Figur soll es begrüßen, nicht ankündigen.
   *
   * Die Musik hängt weiterhin am Retro und nur an ihm: Browser lassen Ton erst
   * nach einer Nutzerhandlung zu, dieser Klick ist die Erlaubnis. Halloween
   * bekommt bewusst KEINE eigene Musik — gemütlich heisst still, solange
   * niemand danach fragt.
   */
  const waehlen = (id) => {
    setOffen(false);
    if (id === theme) return;
    applyTheme(id);
    if (id === 'retro') { nod(); musikStarten(); } else musikStoppen();
  };

  /**
   * Beim Berühren des Knopfes schon holen, was gleich gebraucht wird.
   *
   * Als dynamischer Import, nicht als Zeile oben: `ClipBot` bringt three.js
   * mit. Stünde der Import statisch hier, läge die ganze 3D-Bibliothek im
   * Hauptbündel jeder Seite — nur weil daneben ein Umschalter sitzt.
   */
  const vorwaermen = () => {
    if (theme === 'retro') return;              // zurück braucht keine Figur
    Promise.all([
      import('@/components/bot/ClipBot'),
      import('@/lib/botClips'),
    ]).then(([bot, clips]) => bot.prefetchClip?.(clips.clipFor('nod', 'retro'), 'retro'))
      .catch(() => {});
  };

  const jetzt = THEME_LISTE.find((x) => x.id === theme) || THEME_LISTE[0];
  const beschriftung = jetzt.kurz[de ? 'de' : 'en'];

  return (
    <div className="relative" ref={huelle}>
      <button
        type="button"
        onClick={() => setOffen((x) => !x)}
        onPointerEnter={vorwaermen}
        onFocus={vorwaermen}
        data-testid="theme-switch"
        title={de ? 'Erscheinungsbild wählen' : 'Choose a look'}
        aria-haspopup="menu"
        aria-expanded={offen}
        className="inline-flex items-center gap-2 h-9 px-3 border-2 border-black bg-white text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
      >
        <Palette className="w-4 h-4" />
        <span className="hidden sm:inline">{beschriftung}</span>
      </button>

      {offen && (
        <div
          role="menu"
          /* `z-[60]`: über der Kopfzeile (z-50), sonst schiebt sich die Liste
             beim Aufklappen hinter sie. */
          className="absolute right-0 top-full mt-1 z-[60] w-44 border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(10,10,10,0.85)]"
        >
          {THEME_LISTE.map((x) => (
            <button
              key={x.id}
              type="button"
              role="menuitemradio"
              aria-checked={x.id === theme}
              onClick={() => waehlen(x.id)}
              className={`w-full flex items-center gap-2 px-3 h-10 text-xs font-bold uppercase tracking-wide text-left transition-colors
                ${x.id === theme ? 'bg-[#ef5a24] text-white' : 'bg-white text-black hover:bg-black hover:text-white'}`}
            >
              <Check className={`w-4 h-4 shrink-0 ${x.id === theme ? 'opacity-100' : 'opacity-0'}`} />
              {de ? x.de : x.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
