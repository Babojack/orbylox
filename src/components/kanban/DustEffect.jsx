import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DustEffect({ isActive, x, y }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (isActive) {
      // Create particles
      const newParticles = [];
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 20 + Math.random() * 30;
        newParticles.push({
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance * 0.5, // Flatter spread
          size: 3 + Math.random() * 4,
          delay: Math.random() * 0.1,
          duration: 0.4 + Math.random() * 0.3
        });
      }
      setParticles(newParticles);

      // Clear after animation
      const timer = setTimeout(() => setParticles([]), 800);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isActive || particles.length === 0) return null;

  return (
    <div 
      className="fixed pointer-events-none z-[9999]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ 
              x: 0, 
              y: 0, 
              opacity: 0.8, 
              scale: 1 
            }}
            animate={{ 
              x: particle.x, 
              y: particle.y - 10, 
              opacity: 0, 
              scale: 0.3 
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: particle.duration,
              delay: particle.delay,
              ease: "easeOut"
            }}
            className="absolute rounded-full bg-slate-300"
            style={{ 
              width: particle.size, 
              height: particle.size,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}