import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';

// Three.js und das Modell kommen erst, wenn die Sektion wirklich sichtbar wird.
const HeroBot = lazy(() => import('./HeroBot'));

/**
 * "Dein Projektassistent" — die animierte Figur mit dem Tablet in der Hand,
 * daneben drei Saetze, was ORBYLOX einem abnimmt.
 */
export default function BotSection({ de }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const points = de
    ? ['Behaelt Aufgaben, Termine und Dateien im Blick', 'Erinnert, wenn etwas haengt', 'Laeuft auf Laptop, Tablet und Handy']
    : ['Keeps tasks, dates and files in view', 'Reminds you when something is stuck', 'Runs on laptop, tablet and phone'];

  return (
    <section ref={ref} className="border-b-2 border-black bg-[#f5f5f5] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        {/* Figur */}
        <div className="order-2 lg:order-1 h-[420px] sm:h-[520px] lg:h-[600px]">
          {inView ? (
            <Suspense fallback={<div className="w-full h-full" aria-hidden="true" />}>
              <HeroBot className="w-full h-full" />
            </Suspense>
          ) : (
            <div className="w-full h-full" aria-hidden="true" />
          )}
        </div>

        {/* Text */}
        <Reveal inView className="order-1 lg:order-2 text-center lg:text-left">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wide mb-4">
            {de ? 'Immer dabei' : 'Always with you'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            {de ? 'Dein Projekt, in einer Hand.' : 'Your project, in one hand.'}
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto lg:mx-0">
            {de
              ? 'Aufgaben, Notizen, Chat und Dateien liegen an einem Ort — und der passt in jede Tasche.'
              : 'Tasks, notes, chat and files live in one place — and it fits in any pocket.'}
          </p>
          <ul className="space-y-2 inline-block text-left">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm font-medium">
                <span className="w-4 h-4 bg-[#ef5a24] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
