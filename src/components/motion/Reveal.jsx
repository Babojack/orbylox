import { motion, useReducedMotion } from 'framer-motion';

/**
 * Gemeinsame Bewegungssprache der App.
 *
 * Ein einziger Ort für Dauer und Kurve. Der häufigste Grund, warum eine
 * Oberfläche "zusammengewürfelt" wirkt, sind unterschiedliche Timings pro
 * Seite — mal 150ms, mal 400ms, mal linear. Hier ist es überall dasselbe.
 *
 * Die Kurve ist dieselbe wie beim Hover-Effekt (cubic-bezier .22 .61 .36 1):
 * schnell los, weich aus.
 */
export const EASE = [0.22, 0.61, 0.36, 1];
export const DURATION = 0.34;

/** Abstand zwischen zwei Einträgen einer Liste. */
export const STAGGER = 0.045;

/**
 * Ein Element blendet ein und steigt dabei leicht auf.
 *
 * `index` staffelt Einträge in einer Liste. Die Verzögerung wird gedeckelt:
 * bei 40 Karten wartete der letzte sonst fast zwei Sekunden — das fühlt sich
 * nicht mehr wie Reaktion an, sondern wie Trägheit.
 */
export function Reveal({
  children,
  index = 0,
  delay = 0,
  y = 12,
  className = '',
  once = true,
  inView = false,
  ...rest
}) {
  const reduce = useReducedMotion();

  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y };
  const shown = { opacity: 1, y: 0 };
  const transition = {
    duration: reduce ? 0.01 : DURATION,
    ease: EASE,
    delay: reduce ? 0 : delay + Math.min(index * STAGGER, 0.4),
  };

  const anim = inView
    ? { whileInView: shown, viewport: { once, margin: '-40px' } }
    : { animate: shown };

  return (
    <motion.div initial={hidden} {...anim} transition={transition} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Container für gestaffelte Kinder. Nutzt Varianten statt einzelner Delays —
 * dadurch staffelt auch alles korrekt, was nachträglich dazukommt.
 */
export function Stagger({ children, className = '', delay = 0, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: {
          transition: {
            staggerChildren: reduce ? 0 : STAGGER,
            delayChildren: reduce ? 0 : delay,
          },
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Kind eines Stagger-Containers. */
export function StaggerItem({ children, className = '', y = 12, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
        shown: { opacity: 1, y: 0, transition: { duration: reduce ? 0.01 : DURATION, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
