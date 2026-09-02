import { AnimatePresence, motion } from 'framer-motion';
import { AtSign, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Meldung unten rechts, wenn mich jemand im Chat erwähnt hat.
 *
 * Bewusst kein Toast aus der allgemeinen Meldungsleiste: eine Erwähnung ist
 * persönlich und soll anklickbar sein, um direkt in den Chat zu springen.
 * Mehrere Meldungen stapeln sich nach oben, die neueste liegt unten.
 */
export default function MentionToast({ items = [], onDismiss, onOpen }) {
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
            className="pointer-events-auto relative border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(10,10,10,0.88)]"
          >
            <button
              type="button"
              data-no-lift
              onClick={() => onOpen?.(item)}
              className="w-full text-left bg-transparent border-0 p-0 block"
            >
              <div className="flex items-start gap-3 p-3">
                <span className="w-8 h-8 shrink-0 bg-[#ef5a24] text-white flex items-center justify-center">
                  <AtSign className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-black leading-tight truncate">
                    {item.senderName} <span className="font-normal text-slate-500">{t('mentionedYou')}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5 line-clamp-2 break-words">
                    {item.content}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#ef5a24] mt-1.5">
                    {t('openChat')} →
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              data-no-lift
              onClick={() => onDismiss?.(item.id)}
              aria-label="OK"
              className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center bg-transparent border-0 p-0 text-slate-400 hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
