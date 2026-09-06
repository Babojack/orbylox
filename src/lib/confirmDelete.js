/**
 * Nachfrage vor dem Löschen.
 *
 * `askDelete(...)` gibt ein Versprechen zurück, das mit `true` oder `false`
 * endet. Damit lässt sich jede vorhandene Löschstelle anschließen, ohne ihren
 * Aufbau zu ändern:
 *
 *     onClick={async () => { if (await askDelete({...})) mutation.mutate(id); }}
 *
 * Warum kein React-Kontext: Die Löschstellen liegen über zehn Seiten und
 * mehrere Ebenen verteilt, viele in Untermenüs. Ein Kontext müsste überallhin
 * durchgereicht werden. Ein Ereignis am `window` erreicht den Dialog von
 * jeder Stelle aus.
 *
 * Die wichtigste Eigenschaft: Antwortet niemand — weil der Dialog nicht
 * eingehängt ist —, lautet die Antwort `false`. Im Zweifel wird NICHT
 * gelöscht. Das ist die einzige Richtung, in der ein Fehler verzeihlich ist.
 */

const EVENT = 'orbylox:confirm-delete';

/** Wörter für den abzutippenden Satz. Bewusst kurz und eindeutig zu tippen. */
const WORDS = [
  'anker', 'birke', 'delta', 'eiche', 'falke', 'granit', 'hafen', 'iglu',
  'jaguar', 'kobalt', 'lupine', 'malve', 'nebel', 'olive', 'pinie', 'quarz',
  'raute', 'salbei', 'tundra', 'ulme', 'vulkan', 'wacholder', 'xenon', 'zeder',
];

function randomInt(max) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Erzeugt den Satz, der abgetippt werden muss.
 *
 * Drei Wörter und vier Ziffern. Nicht zu erraten, in wenigen Sekunden
 * abgetippt — und vor allem jedes Mal ein anderer, damit sich das Löschen
 * nicht zur Gewohnheit abschleift wie ein immer gleiches „Ja".
 */
export function makeDeletePhrase() {
  const words = [];
  while (words.length < 3) {
    const w = WORDS[randomInt(WORDS.length)];
    if (!words.includes(w)) words.push(w);
  }
  return `${words.join(' ')} ${String(randomInt(9000) + 1000)}`;
}

/**
 * @param {object} o
 * @param {string} o.title       Überschrift, z. B. „Notiz löschen?"
 * @param {string} [o.body]      Was genau verschwindet.
 * @param {string} [o.itemName]  Name des betroffenen Objekts.
 * @param {string} [o.confirmLabel]
 * @param {boolean} [o.requirePhrase] Satz abtippen verlangen.
 * @returns {Promise<boolean>}
 */
export function askDelete(o = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    let answered = false;
    const done = (v) => { if (!answered) { answered = true; resolve(!!v); } };

    // Hört niemand zu, bleibt es beim Nein.
    const noListener = window.setTimeout(() => done(false), 0);

    window.dispatchEvent(new CustomEvent(EVENT, {
      detail: {
        ...o,
        ack: () => window.clearTimeout(noListener),
        respond: done,
      },
    }));
  });
}

/** Zuhören. Gibt die Abmeldefunktion zurück. */
export function onAskDelete(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail || {});
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
