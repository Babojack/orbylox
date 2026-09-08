import { useEffect, useRef, useState } from 'react';
import BotOverlay from './BotOverlay';
import { onBotAct } from '@/lib/botStage';
import { clipFor } from '@/lib/botClips';

/**
 * Die Bühne für die ORBYLOX-Figur.
 *
 * Liegt einmal im Baum (im LanguageProvider, der auf jeder Seite steckt) und
 * kostet nichts, solange nichts passiert: Three.js und die Bewegungen kommen
 * erst beim ersten Auftritt dazu.
 *
 * Drei Auftritte, ein Unterschied im Wesen:
 *   celebrate — reine Zierde. Bei reduzierter Bewegung entfällt sie ganz.
 *   nod       — dito: der Gruß an das neu gewählte Aussehen.
 *   farewell  — hat eine Folge. Die Rückmeldung MUSS laufen, sonst bleibt man
 *               angemeldet. Sie läuft deshalb auch bei Esc, Wegtippen,
 *               fehlendem WebGL und abgelaufenem Zeitgeber.
 *
 * Welche Bewegung dabei läuft, entscheidet das Theme — siehe `lib/botClips`.
 * Der Anlass ist dasselbe Ereignis, die Figur zeigt nur im Retro etwas
 * anderes.
 */

const ACTS = {
  celebrate: {
    anlass: 'celebrate',
    framing: 'full',
    failsafeMs: 6000,
    caption: { de: 'Erledigt — stark', en: 'Done — nice one' },
  },
  farewell: {
    anlass: 'farewell',
    framing: 'exit',
    failsafeMs: 3000,
    caption: { de: 'Bis bald', en: 'See you' },
  },
  nod: {
    anlass: 'nod',
    framing: 'bust',
    failsafeMs: 3400,
    caption: { de: 'Retro steht dir', en: 'Retro suits you' },
  },
};

export default function BotStage({ language = 'de' }) {
  const [act, setAct] = useState(null);
  const thenRef = useRef(null);

  useEffect(() => onBotAct(({ act: name, then, ack }) => {
    const preset = ACTS[name];
    if (!preset) return;

    if (name === 'celebrate' || name === 'nod') {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;          // Zierde darf entfallen
    }

    ack?.();                             // "übernommen" — die Notbremse draußen darf aus
    thenRef.current = then || null;
    setAct(name);
  }), []);

  if (!act) return null;
  const preset = ACTS[act];
  // Gibt es für diesen Anlass im aktuellen Theme keine Bewegung, fällt der
  // Auftritt aus, statt eine fehlende Datei zu holen. Betrifft nur `nod`, und
  // `nod` hat nie eine Folgehandlung — die Prüfung steht zusätzlich im
  // Auslöser, damit hier nichts nachzuholen ist.
  const clipUrl = clipFor(preset.anlass);
  if (!clipUrl) return null;

  return (
    <BotOverlay
      key={act}
      clipUrl={clipUrl}
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
