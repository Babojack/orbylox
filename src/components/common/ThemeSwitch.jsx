import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { applyTheme, readTheme } from '@/lib/theme';

/**
 * Umschalter fürs Erscheinungsbild.
 *
 * Bewusst kein Menü mit Vorschaubildern: Solange es zwei Themes gibt, ist ein
 * Schalter ehrlicher als eine Auswahl, die so tut, als gäbe es mehr.
 */
export default function ThemeSwitch({ de = true }) {
  const [theme, setTheme] = useState('default');

  useEffect(() => { setTheme(readTheme()); }, []);

  const toggle = () => {
    const next = theme === 'retro' ? 'default' : 'retro';
    setTheme(applyTheme(next));
  };

  const retro = theme === 'retro';
  return (
    <button
      type="button"
      onClick={toggle}
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
