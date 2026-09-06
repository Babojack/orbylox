import BotOverlay from '@/components/bot/BotOverlay';

const SALUTE_URL = '/models/salute.clip.json';

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
 */
export default function LanguageSalute({ to, onApply, onClose }) {
  return (
    <BotOverlay
      clipUrl={SALUTE_URL}
      framing="bust"
      caption={to === 'en' ? 'Switching to English' : 'Wechsle auf Deutsch'}
      failsafeMs={3200}
      onPeak={onApply}
      onFinish={onClose}
    />
  );
}
