/**
 * Das Zeichen aus dem ORBYLOX-Logo: ein abgerundetes Quadrat mit einem
 * offenen Ring darin — zusammen mit dem Wort ergibt das "O RBYLOX".
 *
 * Warum als SVG und nicht als span mit Buchstabe:
 *   - die Rundung kommt aus dem rx-Attribut. Die zentrale Regel in index.css
 *     setzt jede CSS-Rundung auf 0, ein SVG bleibt davon unberührt.
 *   - der Ring sitzt immer exakt mittig, unabhängig von Schriftart und Größe.
 *     Als Buchstabe rutschte er je nach Schriftgröße leicht nach oben.
 *
 * Größe kommt von außen über className (w-8 h-8, w-14 h-14 …).
 */
export default function OrbyloxMark({ className = '', color = '#ef5a24', title = 'ORBYLOX' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <rect x="3" y="3" width="58" height="58" rx="19" fill={color} />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="8" />
    </svg>
  );
}
