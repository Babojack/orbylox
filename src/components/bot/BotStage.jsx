import { useEffect, useRef, useState } from 'react';
import BotOverlay from './BotOverlay';
import { onBotAct } from '@/lib/botStage';

/**
 * Die Bühne für die ORBYLOX-Figur.
 *
 * Liegt einmal im Baum (im LanguageProvider, der auf jeder Seite steckt) und
 * kostet nichts, solange nichts passiert: Three.js und die Bewegungen kommen
 * erst beim ersten Auftritt dazu.
 *
 * Zwei Auftritte, ein Unterschied im Wesen:
 *   celebrate — reine Zierde. Bei reduzierter Bewegung entfällt sie ganz.
 *   farewell  — hat eine Folge. Die Rückmeldung MUSS laufen, sonst bleibt man
 *               angemeldet. Sie läuft deshalb auch bei Esc, Wegtippen,
 *               fehlendem WebGL und abgelaufenem Zeitgeber.
 */

const ACTS = {
  celebrate: {
    clipUrl: '/models/dance.clip.json',
    framing: 'full',
    failsafeMs: 6000,
    caption: { de: 'Erledigt — stark', en: 'Done — nice one' },
  },
  farewell: {
    clipUrl: '/models/run.clip.json',
    framing: 'exit',
    failsafeMs: 3000,
    caption: { de: 'Bis bald', en: 'See you' },
  },
};

export default function BotStage({ language = 'de' }) {
  const [act, setAct] = useState(null);
  const thenRef = useRef(null);

  useEffect(() => onBotAct(({ act: name, then, ack }) => {
    const preset = ACTS[name];
    if (!preset) return;

    if (name === 'celebrate') {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;          // Zierde darf entfallen
    }

    ack?.();                             // "übernommen" — die Notbremse draußen darf aus
    thenRef.current = then || null;
    setAct(name);
  }), []);

  if (!act) return null;
  const preset = ACTS[act];

  return (
    <BotOverlay
      key={act}
      clipUrl={preset.clipUrl}
      framing={preset.framing}
      caption={preset.caption[language === 'en' ? 'en' : 'de']}
      failsafeMs={preset.failsafeMs}
      onFinish={() => {
        const run = thenRef.current;
        thenRef.current = null;
        setAct(null);
        run?.();                          // erst wegblenden, dann abmelden
      }}
    />
  );
}
