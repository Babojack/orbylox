import { useEffect } from 'react';

/**
 * Der Kopf einer Seite: Titel, Beschreibung, Canonical, Vorschaubild.
 *
 * WARUM ES DAS BRAUCHT
 * Die Einzelseiten-App liefert für JEDE Adresse dieselbe `index.html` aus.
 * Ohne diese Komponente trügen Startseite, Über-uns und Impressum denselben
 * Titel und dieselbe Beschreibung — in der Trefferliste sähe man dreimal
 * dasselbe, und Google entscheidet in so einem Fall selbst, was es anzeigt
 * (meistens etwas Beliebiges aus dem Seitentext).
 *
 * WARUM KEINE BIBLIOTHEK
 * `react-helmet` und Verwandte wiegen 5 bis 15 kB und lösen ein Problem, das
 * hier aus vier Zeilen besteht: Titel setzen, drei Meta-Tags nachziehen, beim
 * Verlassen nichts kaputtmachen. Die Startseite wird auf ihr Gewicht geprüft
 * (`npm run check:bundle`); dafür lohnt keine Bibliothek.
 *
 * WAS DAS NICHT LEISTET
 * Das hier läuft im Browser. Google führt JavaScript aus und liest es —
 * andere Dienste nicht: Was WhatsApp, LinkedIn oder Slack beim Teilen eines
 * Links anzeigen, kommt aus der ausgelieferten `index.html`, nicht von hier.
 * Deshalb steht dort der Kopf der Startseite, und deshalb kommen die Seiten,
 * die wirklich in der Suche stehen sollen (die Ratgeber), fertig vom Server
 * (`api/blog.php`).
 */

const BASIS = 'https://orbylox.de';

/** Ein `<meta>` mit diesem Namen (oder dieser Eigenschaft) setzen — oder anlegen. */
function metaSetzen(schluessel, wert, alsEigenschaft = false) {
  if (!wert) return;
  const attr = alsEigenschaft ? 'property' : 'name';
  let tag = document.head.querySelector(`meta[${attr}="${schluessel}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, schluessel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', wert);
}

function linkSetzen(rel, href) {
  if (!href) return;
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

export default function Seo({
  titel,
  beschreibung,
  pfad,
  bild = '/screens/hero-devices.webp',
  sprache = 'de',
  typ = 'website',
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const vollerTitel = titel?.includes('ORBYLOX') ? titel : `${titel} – ORBYLOX`;
    const url = pfad ? `${BASIS}${pfad}` : BASIS + '/';
    const bildUrl = bild?.startsWith('http') ? bild : BASIS + bild;

    const vorher = document.title;
    document.title = vollerTitel;
    /* Die Sprache steht am Dokument, nicht nur im Text: Vorlese-Programme
       wählen danach die Stimme, und Suchmaschinen die Sprachfassung. */
    document.documentElement.lang = sprache;

    metaSetzen('description', beschreibung);
    linkSetzen('canonical', url);

    metaSetzen('og:type', typ, true);
    metaSetzen('og:title', vollerTitel, true);
    metaSetzen('og:description', beschreibung, true);
    metaSetzen('og:url', url, true);
    metaSetzen('og:image', bildUrl, true);
    metaSetzen('og:locale', sprache === 'de' ? 'de_DE' : 'en_US', true);
    metaSetzen('twitter:title', vollerTitel);
    metaSetzen('twitter:description', beschreibung);
    metaSetzen('twitter:image', bildUrl);

    /* Beim Verlassen nur den Titel zurücksetzen.
       Die Meta-Tags bleiben stehen: Die nächste Seite setzt ihre eigenen, und
       ein zwischenzeitlich leeres `description` wäre schlechter als ein
       veraltetes. Beim Titel ist es umgekehrt — er steht im Reiter, und ein
       falscher Reiter fällt sofort auf. */
    return () => { document.title = vorher; };
  }, [titel, beschreibung, pfad, bild, sprache, typ]);

  return null;
}
