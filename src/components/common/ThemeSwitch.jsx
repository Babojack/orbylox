import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { applyTheme, readTheme } from '@/lib/theme';
import { nod } from '@/lib/botStage';

/**
 * Umschalter fürs Erscheinungsbild.
 *
 * Bewusst kein Menü mit Vorschaubildern: Solange es zwei Themes gibt, ist ein
 * Schalter ehrlicher als eine Auswahl, die so tut, als gäbe es mehr.
 */
export default function ThemeSwitch({ de = true }) {
  const [theme, setTheme] = useState('default');

  useEffect(() => { setTheme(readTheme()); }, []);

  /**
   * Erst umschalten, dann nicken.
   *
   * Die Reihenfolge ist Absicht und das Gegenteil vom Sprachwechsel: Dort
   * grüßt die Figur und die Sprache springt in der Mitte der Geste um, weil
   * man sonst nicht sähe, wofür der Gruß war. Hier ist das neue Aussehen
   * selbst der Anlass — die Figur soll es begrüßen, nicht ankündigen. Also
   * steht die Retro-Welt schon, wenn sie auftritt.
   *
   * Zurück auf das normale Design geschieht wortlos: `nod` gibt es nur im
   * Retro, und ein Abschiedsnicken für ein Design, das man gerade verlässt,
   * wäre eine Geste zu viel.
   */
  const toggle = () => {
    const next = theme === 'retro' ? 'default' : 'retro';
    setTheme(applyTheme(next));
    if (next === 'retro') nod();
  };

  /**
   * Beim Berühren des Knopfes schon holen, was gleich gebraucht wird.
   *
   * Als dynamischer Import, nicht als Zeile oben: `ClipBot` bringt three.js
   * mit. Stünde der Import statisch hier, läge die ganze 3D-Bibliothek im
   * Hauptbündel jeder Seite — nur weil daneben ein Umschalter sitzt.
   *
   * Das `'retro'` ist kein Schreibfehler: Geholt wird, was NACH dem Klick
   * gebraucht wird. Beim Überfahren steht noch das alte Theme, und der
   * Roboter ist genau das, was gleich nicht mehr auftritt.
   */
  const vorwaermen = () => {
    if (theme === 'retro') return;              // zurück braucht keine Figur
    Promise.all([
      import('@/components/bot/ClipBot'),
      import('@/lib/botClips'),
    ]).then(([bot, clips]) => bot.prefetchClip?.(clips.clipFor('nod', 'retro'), 'retro'))
      .catch(() => {});
  };

  const retro = theme === 'retro';
  return (
    <button
      type="button"
      onClick={toggle}
      onPointerEnter={vorwaermen}
      onFocus={vorwaermen}
      data-testid="theme-switch"
      title={retro
        ? (de ? 'Zurück zum normalen Design' : 'Back to the normal look')
        : (de ? 'Retro-Design ausprobieren' : 'Try the retro look')}
      aria-pressed={retro}
      className="inline-flex items-center gap-2 h-9 px-3 border-2 border-black bg-white text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
    >
      <Palette className="w-4 h-4" />
      <span className="hidden sm:inline">{retro ? 'Retro' : (de ? 'Design' : 'Theme')}</span>
    </button>
  );
}
