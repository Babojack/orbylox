import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const METHODOLOGY_COLORS = {
  lean_startup: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", gradient: "from-emerald-500 to-teal-600" },
  design_thinking: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", gradient: "from-purple-500 to-violet-600" },
  jobs_to_be_done: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", gradient: "from-blue-500 to-indigo-600" },
  blue_ocean: { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700", gradient: "from-cyan-500 to-blue-600" },
  business_model_canvas: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", gradient: "from-amber-500 to-orange-600" }
};

export default function RoadmapDisplay({ roadmap, methodology }) {
  if (!roadmap || !roadmap.phases) return null;

  const colors = METHODOLOGY_COLORS[methodology] || METHODOLOGY_COLORS.lean_startup;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl ${colors.bg} ${colors.border} border`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-5 h-5 ${colors.text}`} />
          <h3 className={`font-bold ${colors.text}`}>KI-generierte Roadmap</h3>
        </div>
        <p className="text-sm text-slate-600">{roadmap.summary}</p>
      </motion.div>

      {/* Phases */}
      <div className="space-y-4">
        {roadmap.phases.map((phase, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className="relative"
          >
            {/* Connector line */}
            {index < roadmap.phases.length - 1 && (
              <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-slate-200" />
            )}

            <div className="flex gap-4">
              {/* Phase number */}
              <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${colors.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0`}>
                {index + 1}
              </div>

              {/* Phase content */}
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900">{phase.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {phase.duration}
                  </Badge>
                </div>
                
                <p className="text-sm text-slate-600 mb-3">{phase.description}</p>

                {/* Tasks */}
                <div className="space-y-2">
                  {phase.tasks?.map((task, taskIndex) => (
                    <motion.div
                      key={taskIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.15 + taskIndex * 0.05 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Circle className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{task}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Deliverables */}
                {phase.deliverables && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">Ergebnisse:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {phase.deliverables.map((d, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Key Metrics */}
      {roadmap.keyMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-50 rounded-xl p-4"
        >
          <h4 className="font-bold text-slate-900 mb-3">📊 Wichtige Metriken</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {roadmap.keyMetrics.map((metric, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-500">{metric.name}</p>
                <p className="font-bold text-slate-900">{metric.target}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}