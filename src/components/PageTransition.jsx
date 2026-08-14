import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Kurz, straff, ohne Nachwippen — passt zur kantigen Formsprache. */
const easeOutExpo = [0.16, 1, 0.3, 1];

/**
 * Smooth enter/exit when `pageKey` changes (route, query, language, etc.).
 * `initial={false}` avoids a flash on first paint.
 */
export function PageTransition({ pageKey, children, className = "" }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pageKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        // Die neue Seite schiebt sich von rechts unten heran und wird scharf,
        // die alte weicht nach links — dieselbe Diagonale wie der Hebe-Effekt.
        initial={{ opacity: 0, x: 18, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: -14, scale: 0.995 }}
        transition={{
          duration: 0.38,
          ease: easeOutExpo,
          opacity: { duration: 0.22 },
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
