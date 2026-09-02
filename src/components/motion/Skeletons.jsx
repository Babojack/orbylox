/**
 * Ladeplatzhalter im Umriss des späteren Inhalts.
 *
 * Ein kreisender Spinner sagt nur "es passiert etwas". Ein Umriss sagt
 * zusätzlich, was gleich kommt und wo es steht — und wenn die Daten da sind,
 * springt das Layout nicht, weil der Platz schon stimmt. Genau dieses Springen
 * ist eines der deutlichsten Zeichen einer lieblos gebauten Oberfläche.
 *
 * Das Pulsieren läuft über `animate-pulse`; wer weniger Bewegung eingestellt
 * hat, bekommt über die zentrale Regel in index.css eine ruhige Fläche.
 */

function Bar({ className = '' }) {
  return <div className={`bg-slate-200/80 animate-pulse ${className}`} />;
}

/** Umriss einer Projekt- oder Inhaltskarte. */
export function CardSkeleton({ withMedia = false }) {
  return (
    <div className="border-2 border-slate-200 bg-white overflow-hidden">
      {withMedia && <Bar className="h-28 w-full" />}
      <div className="p-4">
        <Bar className="h-10 w-10 mb-4" />
        <Bar className="h-4 w-2/3 mb-2" />
        <Bar className="h-3 w-1/3 mb-4" />
        <div className="flex gap-3 pt-3 border-t border-slate-100">
          <Bar className="h-3 w-16" />
          <Bar className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Raster aus Kartenumrissen. */
export function CardGridSkeleton({ count = 6, withMedia = false, className = '' }) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} withMedia={withMedia} />
      ))}
    </div>
  );
}

/** Umriss einer Zeilenliste (Dateien, Dokumente, Mitglieder). */
export function ListSkeleton({ count = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-2 border-slate-200 bg-white p-3">
          <Bar className="h-9 w-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <Bar className="h-3.5 w-1/3 mb-2" />
            <Bar className="h-3 w-1/5" />
          </div>
          <Bar className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Umriss der Kanban-Spalten. */
export function BoardSkeleton({ columns = 4 }) {
  return (
    <div className="flex gap-3 sm:gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex-1 min-w-[220px] bg-slate-50/60 border border-slate-100 p-2">
          <Bar className="h-8 w-full mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-100 p-3">
                <Bar className="h-3 w-14 mb-2" />
                <Bar className="h-3.5 w-4/5 mb-2" />
                <Bar className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Umriss eines Nachrichten- oder Beitragsstroms. */
export function FeedSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-2 border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-3">
            <Bar className="h-9 w-9 rounded-full" />
            <div>
              <Bar className="h-3.5 w-28 mb-1.5" />
              <Bar className="h-2.5 w-20" />
            </div>
          </div>
          <Bar className="h-3 w-full mb-2" />
          <Bar className="h-3 w-5/6 mb-2" />
          <Bar className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
