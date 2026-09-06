import { useEffect, useState } from 'react';
import BotOverlay from './BotOverlay';
import { onCelebrate } from '@/lib/celebrate';

const DANCE_URL = '/models/dance.clip.json';

/**
 * Hört auf `celebrate()` und lässt die Figur tanzen.
 *
 * Liegt einmal im Baum (im LanguageProvider, der auf jeder Seite steckt) und
 * kostet nichts, solange nichts fertig wird: Three.js und die Bewegung kommen
 * erst beim ersten Jubel dazu.
 *
 * Wer weniger Bewegung eingestellt hat, sieht gar nichts. Ein Jubel ist reine
 * Zierde — bei dieser Einstellung ist Weglassen die richtige Antwort.
 */
export default function CelebrationHost({ language = 'de' }) {
  const [show, setShow] = useState(false);

  useEffect(() => onCelebrate(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    // Kommen mehrere Tickets kurz nacheinander an: eine Figur reicht.
    setShow(true);
  }), []);

  if (!show) return null;

  return (
    <BotOverlay
      clipUrl={DANCE_URL}
      framing="full"
      caption={language === 'en' ? 'Done — nice one' : 'Erledigt — stark'}
      failsafeMs={6000}
      onFinish={() => setShow(false)}
    />
  );
}
