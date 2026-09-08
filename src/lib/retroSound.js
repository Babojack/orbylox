import quelle from '@/assets/retro-theme.mp3';

/**
 * Die Musik der Retro-Welt.
 *
 * WANN SIE SPIELT
 * Nur beim Umschalten AUF Retro — nicht beim Laden der Seite. Das ist keine
 * Bescheidenheit, sondern die Regel der Browser: Ton ohne vorherigen Klick
 * wird blockiert. Ein Aufruf beim Start würde also entweder stumm scheitern
 * oder, schlimmer, irgendwann später losbrüllen. Der Klick auf den
 * Design-Schalter ist die Erlaubnis, und nur dort wird sie genutzt.
 *
 * WARUM SIE ERST DANN GELADEN WIRD
 * Die Datei ist 2 MB. Sie wird erst geholt, wenn wirklich jemand umschaltet —
 * das `Audio`-Objekt entsteht beim ersten Abspielen, nicht vorher. Wer nie
 * ins Retro geht, lädt keine einzige Note.
 *
 * WAS GESPEICHERT WIRD
 * Nur ein Ja/Nein für den Ton. Keine Lautstärke, keine Position: Beides wieder
 * herzustellen klingt ordentlich und fühlt sich fremd an — Musik, die mitten
 * im Takt weiterläuft, wo man sie vor drei Tagen verlassen hat.
 */

const SCHLUESSEL = 'orbylox_retro_ton';
const EREIGNIS = 'orbylox:ton';
const LAUTSTAERKE = 0.32;   // Hintergrund, nicht Vordergrund

let klang = null;

/** Ist der Ton eingeschaltet? Voreinstellung: ja. */
export function tonAn() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SCHLUESSEL) !== 'aus';
  } catch {
    return true;
  }
}

function merken(an) {
  try {
    window.localStorage.setItem(SCHLUESSEL, an ? 'an' : 'aus');
  } catch {
    // Privater Modus: gilt dann nur für diese Sitzung.
  }
  window.dispatchEvent(new CustomEvent(EREIGNIS, { detail: { an } }));
}

function holen() {
  if (klang) return klang;
  klang = new Audio(quelle);
  klang.loop = true;
  klang.volume = LAUTSTAERKE;
  klang.preload = 'none';
  return klang;
}

/**
 * Anfangen — sofern der Ton eingeschaltet ist.
 *
 * `play()` gibt ein Versprechen zurück, das der Browser ablehnt, wenn er den
 * Ton nicht erlaubt. Das wird stillschweigend hingenommen: Eine Fehlermeldung
 * über Musik wäre lauter als die Musik.
 */
export function musikStarten() {
  if (typeof window === 'undefined' || !tonAn()) return;
  const a = holen();
  a.play().catch(() => {});
}

export function musikStoppen() {
  if (!klang) return;
  klang.pause();
  klang.currentTime = 0;
}

/**
 * Ton an oder aus.
 *
 * Der Schalter tut beides: Er merkt sich die Entscheidung UND setzt sie sofort
 * um. Ein Schalter, der nur eine Einstellung ändert und erst beim nächsten Mal
 * wirkt, ist kein Schalter, sondern ein Formular.
 */
export function tonUmschalten(imRetro) {
  const neu = !tonAn();
  merken(neu);
  if (neu && imRetro) musikStarten();
  else musikStoppen();
  return neu;
}

/** Zuhören, wenn sich der Ton ändert. Gibt die Abmeldefunktion zurück. */
export function onTonChange(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail?.an ?? tonAn());
  window.addEventListener(EREIGNIS, fn);
  return () => window.removeEventListener(EREIGNIS, fn);
}
