import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Puzzle, Rocket, ArrowRight, Sparkles, X } from 'lucide-react';

export default function StartDecisionDialog({ isOpen, onChooseTemplate, onChooseSelfBuild, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative"
        >
          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-[#ef5a24] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <Rocket className="w-8 h-8 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Startup Builder</h2>
            <p className="text-slate-500">Wie möchtest du starten?</p>
          </div>

          {/* Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Template Option */}
            <motion.button
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChooseTemplate}
              className="bg-[#f5f5f5] border-2 border-[#ef5a24]/30 hover:border-[#ef5a24] rounded-2xl p-6 text-left transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#ef5a24]/10 rounded-full -mr-10 -mt-10 opacity-50" />
              
              <div className="relative">
                <div className="w-14 h-14 bg-[#ef5a24] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                  Mit Vorlage starten
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </h3>
                
                <p className="text-slate-600 text-sm mb-4">
                  Nutze bewährte Frameworks aus bekannten Startup-Büchern wie Lean Startup, The Mom Test oder Zero to One.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs px-2 py-1 bg-[#ef5a24]/10 text-[#ef5a24] rounded-full">Lean Startup</span>
                  <span className="text-xs px-2 py-1 bg-[#ef5a24]/10 text-[#ef5a24] rounded-full">The Mom Test</span>
                  <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded-full">Zero to One</span>
                </div>

                <div className="flex items-center text-[#ef5a24] font-medium text-sm group-hover:translate-x-1 transition-transform">
                  Vorlage wählen
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.button>

            {/* Self Build Option */}
            <motion.button
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChooseSelfBuild}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-6 text-left transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-full -mr-10 -mt-10 opacity-50" />
              
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                  <Puzzle className="w-7 h-7 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2">Selbst bauen</h3>
                
                <p className="text-slate-600 text-sm mb-4">
                  Erstelle deine eigene Journey von Grund auf. Wähle aus verschiedenen Bausteinen und dokumentiere jeden Schritt individuell.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Flexibel</span>
                  <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">Drag & Drop</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">10+ Bausteine</span>
                </div>

                <div className="flex items-center text-emerald-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                  Los geht's
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}