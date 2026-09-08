import BotOverlay from '@/components/bot/BotOverlay';
import { clipFor } from '@/lib/botClips';

/**
 * Sprachwechsel mit Gruß.
 *
 * Die Figur grüßt, und in dem Moment, in dem die Hand oben steht, springt die
 * Sprache um — der Zeitpunkt steht in der Bewegungsdatei (gemessen: 1,12 s).
 * Die Bewegung läuft danach aus.
 *
 * Die ganze Absicherung steckt in `BotOverlay`: Esc, Wegtippen, Zeitgeber und
 * Fehlerfall münden alle in `onFinish`, und vor dem Schließen wird `onPeak`
 * nachgeholt, falls es nicht schon lief. Damit gilt ausnahmslos: Wer den
 * Sprachknopf drückt, bekommt die neue Sprache.
 *
 * Im Retro grüßt eine andere Figur — dieselbe Geste, andere Aufnahme. Der
 * Zeitpunkt der Hand steht in beiden Dateien und wird von dort gelesen, hier
 * ist also nichts fest verdrahtet.
 */
export default function LanguageSalute({ to, onApply, onClose }) {
  return (
    <BotOverlay
      clipUrl={clipFor('salute')}
      framing="bust"
      caption={to === 'en' ? 'Switching to English' : 'Wechsle auf Deutsch'}
      failsafeMs={3200}
      onPeak={onApply}
      onFinish={onClose}
    />
  );
}
