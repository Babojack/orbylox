import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';
import { musikStarten, onTonChange, tonAn, tonUmschalten } from '@/lib/retroSound';

/**
 * Der Tonschalter.
 *
 * Steht nur im Retro. Im normalen Design gibt es keine Musik, und ein Schalter
 * ohne Wirkung ist schlimmer als kein Schalter.
 *
 * Er startet die Musik auch dann, wenn sie gerade nicht läuft — etwa nach dem
 * Neuladen der Seite. Der Browser lässt Ton erst nach einem Klick zu; dieser
 * Klick ist einer. So ist der Schalter nicht nur ein Aus-, sondern auch der
 * Anknopf, und man kommt aus der Stille wieder heraus, ohne das Design zweimal
 * umzuschalten.
 */
export default function SoundSwitch({ de = true }) {
  const theme = useTheme();
  const [an, setAn] = useState(() => tonAn());

  useEffect(() => onTonChange(setAn), []);

  if (theme !== 'retro') return null;

  const klick = () => {
    const neu = tonUmschalten(true);
    setAn(neu);
    // Ausgeschaltet und wieder eingeschaltet: dann soll auch etwas zu hören
    // sein, ohne dass man das Design erneut wechselt.
    if (neu) musikStarten();
  };

  return (
    <button
      type="button"
      onClick={klick}
      data-testid="sound-switch"
      aria-pressed={an}
      title={an
        ? (de ? 'Musik ausschalten' : 'Turn the music off')
        : (de ? 'Musik einschalten' : 'Turn the music on')}
      aria-label={an
        ? (de ? 'Musik ausschalten' : 'Turn the music off')
        : (de ? 'Musik einschalten' : 'Turn the music on')}
      /* `px-3` statt `w-9`: Die Nachbarn in der Kopfzeile sind 44 Pixel breit
         (12 + 16 Symbol + 12, dazu zweimal 2 Pixel Rahmen). Mit fester Breite
         waere dieser Knopf 36 — acht Pixel schmaler als alle anderen, und in
         einer Reihe sieht man das sofort. */
      className="h-9 px-3 shrink-0 inline-flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-colors"
    >
      {an ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}
