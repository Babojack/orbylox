import { currentTheme } from '@/lib/theme';

/**
 * Welche Bewegung die Figur zu welchem Anlass zeigt.
 *
 * Im Retro-Design ist es ein anderer Satz Bewegungen. Nicht als Spielerei:
 * Wer das Aussehen der Anwendung wechselt, wechselt ihren Tonfall mit, und
 * eine Figur, die in beiden Welten exakt dasselbe tut, wirkt wie ein Fremd-
 * körper im neuen Kleid.
 *
 * Alle Bewegungen liegen auf demselben Skelett (Mixamo, 52 Knochen wie in
 * `xbot.glb`). Das Modell wird also weiterhin genau einmal geladen und aus
 * dem Zwischenspeicher wiederverwendet — nur die Spuren wechseln. Die neuen
 * Dateien stammen von einer anderen Figur mit Umhang; deren sieben
 * zusätzliche Knochen (`Neck1`, `Cloak1`–`Cloak6`) sind beim Umrechnen
 * entfernt worden, weil `xbot.glb` sie nicht hat und der Mischer sie sonst
 * bei jedem Auftritt anmahnt.
 *
 * `nod` gibt es nur im Retro: Es ist die Begrüßung des neuen Aussehens und
 * hat im normalen Design keinen Anlass.
 */

/**
 * Wer auftritt.
 *
 * Im Retro nicht der Roboter, sondern die Figur mit Umhang. Sie steckte in
 * denselben Mixamo-Dateien wie die Bewegungen: vier Meshes, ein Material,
 * rund 9.000 Dreiecke.
 *
 * Zwei Dinge daran waren nicht selbstverständlich:
 *
 *   Die Datei brachte VIER Kopien desselben Skeletts mit, eine je Mesh. Die
 *   Bewegungsspuren sprechen Knochen über ihren Namen an, und der Mischer
 *   nimmt den ersten Treffer — ohne Zusammenlegen hätte der Körper getanzt,
 *   während Rock, Umhang und Waffen in der T-Pose stehen bleiben.
 *
 *   Ihr Skelett hat sieben Knochen mehr als der Roboter (`Neck1`, `Cloak1`–`6`).
 *   Modell und Bewegung gehören deshalb zusammen und werden nie einzeln
 *   gewählt: beides hängt am selben Theme.
 */
const MODELLE = {
  default: '/models/xbot.glb',
  retro: '/models/retro-figure.glb',
};

export function modelFor(theme = currentTheme()) {
  return MODELLE[theme] || MODELLE.default;
}

/**
 * Die Ruhebewegung für den runden Knopf.
 *
 * `null` heißt: steckt im Modell selbst. Der Roboter bringt sein `idle` in
 * `xbot.glb` mit; ihre Datei enthält bewusst keine Bewegung, weil dieselben
 * Spuren sonst dreimal im Paket lägen.
 *
 * Genommen wird die Kopfgeste. Das ist keine Verlegenheitslösung: Ihre erste
 * und letzte Haltung sind bis auf drei Nachkommastellen gleich, die Schleife
 * schließt sich also ohne Sprung — nachgemessen, nicht gehofft.
 */
const RUHE = {
  default: null,
  retro: '/models/nod-retro.clip.json',
};

export function idleFor(theme = currentTheme()) {
  return RUHE[theme] ?? null;
}

const SAETZE = {
  default: {
    celebrate: '/models/dance.clip.json',
    farewell: '/models/run.clip.json',
    salute: '/models/salute.clip.json',
    nod: null,
  },
  retro: {
    celebrate: '/models/dance-retro.clip.json',
    farewell: '/models/run-retro.clip.json',
    salute: '/models/salute-retro.clip.json',
    nod: '/models/nod-retro.clip.json',
  },
};

/**
 * Bewegungsdatei für einen Anlass — nach dem Theme, das GERADE gilt.
 *
 * Bewusst bei jedem Aufruf neu gefragt statt einmal beim Laden: Das Theme
 * lässt sich mitten in der Sitzung umschalten, und der nächste Auftritt soll
 * dann schon der neuen Welt gehören.
 */
export function clipFor(anlass, theme = currentTheme()) {
  const satz = SAETZE[theme] || SAETZE.default;
  return satz[anlass] ?? SAETZE.default[anlass] ?? null;
}

/** Alle Dateien eines Themes — für das Vorabholen. */
export function clipsOf(theme = currentTheme()) {
  return Object.values(SAETZE[theme] || SAETZE.default).filter(Boolean);
}
