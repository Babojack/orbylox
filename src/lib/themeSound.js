import retroQuelle from '@/assets/retro-theme.mp3';
import halloweenQuelle from '@/assets/halloween-theme.mp3';

/**
 * Die Musik zu den Erscheinungsbildern.
 *
 * WANN SIE SPIELT
 * Nur beim Umschalten AUF ein Aussehen, das Musik hat — nicht beim Laden der
 * Seite. Das ist keine Bescheidenheit, sondern die Regel der Browser: Ton
 * ohne vorherigen Klick wird blockiert. Ein Aufruf beim Start würde also
 * entweder stumm scheitern oder, schlimmer, irgendwann später losbrüllen.
 * Der Klick auf den Design-Schalter ist die Erlaubnis, und nur dort wird sie
 * genutzt.
 *
 * WARUM SIE ERST DANN GELADEN WIRD
 * Jede Datei ist rund 2 MB. Sie wird erst geholt, wenn wirklich jemand
 * umschaltet — das `Audio`-Objekt entsteht beim ersten Abspielen, nicht
 * vorher. Wer nie ins Retro oder ins Halloween geht, lädt keine einzige Note.
 *
 * WAS GESPEICHERT WIRD
 * Nur ein Ja/Nein für den Ton. Keine Lautstärke, keine Position: Beides
 * wieder herzustellen klingt ordentlich und fühlt sich fremd an — Musik, die
 * mitten im Takt weiterläuft, wo man sie vor drei Tagen verlassen hat.
 *
 * FRÜHER HIESS DIESE DATEI `retroSound.js`
 * Solange es genau ein Stück gab, war das ehrlich. Der Speicherschlüssel
 * heisst trotzdem weiter `orbylox_retro_ton`: Er steht in den Browsern der
 * Leute, und ein neuer Name würde jede Entscheidung "Ton aus" stillschweigend
 * zurücksetzen.
 */

const SCHLUESSEL = 'orbylox_retro_ton';
const EREIGNIS = 'orbylox:ton';
const LAUTSTAERKE = 0.32;   // Hintergrund, nicht Vordergrund

/** Welches Aussehen hat welches Stück. Wer hier fehlt, bleibt still. */
const STUECKE = {
  retro: retroQuelle,
  halloween: halloweenQuelle,
};

/** Hat dieses Aussehen überhaupt Musik? Der Tonschalter fragt danach. */
export function hatMusik(theme) {
  return !!STUECKE[theme];
}

/** Je Aussehen ein eigenes Element — sonst fängt jedes Umschalten von vorn an. */
const klaenge = new Map();
let laeuft = null;          // das gerade spielende Element
let messer = null;          // Analysator des gerade spielenden Stücks
let hallraum = null;        // AudioContext, einmal für alle
const messwerte = new Uint8Array(128);

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

/**
 * Den Ton durch einen Analysator führen, damit der Kürbis mitwippen kann.
 *
 * ZWEI DINGE, DIE HIER SCHIEFGEHEN KÖNNEN, UND WAS DAGEGEN STEHT
 *
 *   `createMediaElementSource` darf je Element nur EINMAL aufgerufen werden.
 *   Deshalb geschieht es genau hier, beim Anlegen des Elements, und nie
 *   wieder.
 *
 *   Ab dem Aufruf läuft der Ton NUR noch über den Verbund. Bleibt eine
 *   Verbindung offen, ist die Musik still — und niemand käme auf die Idee,
 *   das einer Wackel-Animation anzulasten. Deshalb: Schlägt irgendetwas
 *   fehl, wird die Quelle direkt an den Ausgang gehängt und auf die Analyse
 *   verzichtet. Musik ohne Wackeln ist in Ordnung; Wackeln ohne Musik nicht.
 */
function analyseAnhaengen(audio) {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  let quelle = null;
  try {
    hallraum = hallraum || new Ctx();
    quelle = hallraum.createMediaElementSource(audio);
    const a = hallraum.createAnalyser();
    a.fftSize = 256;
    a.smoothingTimeConstant = 0.72;
    quelle.connect(a);
    a.connect(hallraum.destination);
    return a;
  } catch {
    try { quelle?.connect(hallraum.destination); } catch { /* dann eben roh */ }
    return null;
  }
}

function holen(theme) {
  const quelle = STUECKE[theme];
  if (!quelle) return null;
  let eintrag = klaenge.get(theme);
  if (eintrag) return eintrag;

  const a = new Audio(quelle);
  a.loop = true;
  a.volume = LAUTSTAERKE;
  a.preload = 'none';
  a.crossOrigin = 'anonymous';
  eintrag = { audio: a, messer: analyseAnhaengen(a) };
  klaenge.set(theme, eintrag);
  return eintrag;
}

/**
 * Anfangen — sofern der Ton eingeschaltet ist und dieses Aussehen Musik hat.
 *
 * `play()` gibt ein Versprechen zurück, das der Browser ablehnt, wenn er den
 * Ton nicht erlaubt. Das wird stillschweigend hingenommen: Eine Fehlermeldung
 * über Musik wäre lauter als die Musik.
 */
export function musikStarten(theme) {
  if (typeof window === 'undefined' || !tonAn()) return;
  const eintrag = holen(theme);
  if (!eintrag) return;
  if (laeuft && laeuft !== eintrag.audio) {
    laeuft.pause();
    laeuft.currentTime = 0;
  }
  laeuft = eintrag.audio;
  messer = eintrag.messer;
  // Der Verbund startet angehalten, wenn er vor der ersten Nutzerhandlung
  // entstand. Ohne dieses Aufwecken bliebe es still.
  hallraum?.resume?.().catch(() => {});
  eintrag.audio.play().catch(() => {});
}

export function musikStoppen() {
  if (!laeuft) return;
  laeuft.pause();
  laeuft.currentTime = 0;
  laeuft = null;
  messer = null;
}

/**
 * Wie laut ist es gerade, von 0 bis 1?
 *
 * Genommen wird nur das untere Ende des Spektrums. Bei `fftSize: 256` und
 * 44,1 kHz ist jeder Korb 172 Hz breit; die Körbe 1 bis 5 decken also rund
 * 170 bis 1000 Hz ab — Bass und Trommel. Genau die tragen den Takt, und
 * genau darauf soll der Kürbis wippen. Nähme man den Durchschnitt über
 * alles, wackelte er auf jedes Zischeln.
 *
 * Gibt 0 zurück, wenn nichts läuft oder der Browser keine Analyse zulässt.
 * Der Aufrufer muss diesen Fall ohnehin behandeln — dann steht eben eine
 * ruhige Drehung da.
 */
export function tonPegel() {
  if (!messer || !laeuft || laeuft.paused) return 0;
  try {
    messer.getByteFrequencyData(messwerte);
  } catch {
    return 0;
  }
  let summe = 0;
  for (let i = 1; i <= 5; i += 1) summe += messwerte[i];
  return Math.min(1, summe / (5 * 255));
}

/**
 * Ton an oder aus.
 *
 * Der Schalter tut beides: Er merkt sich die Entscheidung UND setzt sie
 * sofort um. Ein Schalter, der nur eine Einstellung ändert und erst beim
 * nächsten Mal wirkt, ist kein Schalter, sondern ein Formular.
 */
export function tonUmschalten(theme) {
  const neu = !tonAn();
  merken(neu);
  if (neu && hatMusik(theme)) musikStarten(theme);
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
