import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const easeSmooth = [0.25, 0.1, 0.25, 1];

/**
 * Smooth enter/exit when `pageKey` changes (route, query, language, etc.).
 * `initial={false}` avoids a flash on first paint.
 */
export function PageTransition({ pageKey, children, className = "" }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
        }
        animate={
          reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
        }
        exit={
          reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }
        }
        transition={{
          duration: reduceMotion ? 0.12 : 0.32,
          ease: easeSmooth,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
