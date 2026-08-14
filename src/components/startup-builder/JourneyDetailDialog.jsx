import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Rocket, Lightbulb, Search, FileText, Banknote, 
  Megaphone, TrendingUp, Users, Scale, Puzzle,
  Check, Clock, Circle, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

const STEP_ICONS = {
  idea_validation: Lightbulb,
  market_research: Search,
  business_model: FileText,
  mvp: Rocket,
  funding: Banknote,
  launch: Megaphone,
  growth: TrendingUp,
  team: Users,
  legal: Scale,
  custom: Puzzle
};

const STEP_LABELS = {
  idea_validation: "Ideen-Validierung",
  market_research: "Marktforschung",
  business_model: "Business Model",
  mvp: "MVP",
  funding: "Finanzierung",
  launch: "Launch",
  growth: "Wachstum",
  team: "Team",
  legal: "Rechtliches",
  custom: "Custom"
};

const STATUS_CONFIG = {
  planned: { icon: Circle, label: "Geplant", color: "bg-slate-100 text-slate-600" },
  in_progress: { icon: Clock, label: "In Arbeit", color: "bg-amber-100 text-amber-700" },
  completed: { icon: Check, label: "Abgeschlossen", color: "bg-emerald-100 text-emerald-700" }
};

function StepDetail({ step, index, isExpanded, onToggle }) {
  const Icon = STEP_ICONS[step.step_type] || Puzzle;
  const statusConfig = STATUS_CONFIG[step.status] || STATUS_CONFIG.planned;
  const StatusIcon = statusConfig.icon;
  const isEven = index % 2 === 0;

  return (
    <div className="relative">
      <div className={`flex items-start gap-0 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Content Card */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="w-[calc(50%-24px)] bg-white rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-[#ef5a24] hover:shadow-md transition-all"
          style={{ borderTopColor: step.color, borderTopWidth: '3px' }}
          onClick={onToggle}
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${step.color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color: step.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                    style={{ backgroundColor: step.color }}
                  >
                    {index + 1}
                  </span>
                  <h4 className="font-medium text-slate-900 text-sm truncate">{step.title}</h4>
                </div>
                <p className="text-xs text-slate-500">{STEP_LABELS[step.step_type]}</p>
              </div>
              <button className="p-1">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            <Badge className={`${statusConfig.color} text-xs`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>

            {/* Expanded Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 pt-3 border-t border-slate-100 space-y-2"
                >
                  {step.description && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Beschreibung</p>
                      <p className="text-xs text-slate-700">{step.description}</p>
                    </div>
                  )}

                  {step.methodology && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Methodik</p>
                      <Badge variant="outline" className="bg-[#f5f5f5] text-[#ef5a24] border-[#ef5a24]/30 text-xs">
                        {step.methodology}
                      </Badge>
                    </div>
                  )}

                  {step.tools_used && step.tools_used.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Tools</p>
                      <div className="flex flex-wrap gap-1">
                        {step.tools_used.map((tool, i) => (
                          <Badge key={i} variant="outline" className="bg-slate-50 text-xs">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.learnings && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="text-xs font-medium text-amber-700 mb-1">💡 Key Learnings</p>
                      <p className="text-xs text-amber-800">{step.learnings}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Timeline Center */}
        <div className="w-12 flex flex-col items-center relative">
          <div 
            className="w-4 h-4 rounded-full border-3 border-white shadow z-10"
            style={{ backgroundColor: step.color }}
          />
          <div className="w-0.5 flex-1 bg-slate-200" />
        </div>

        {/* Empty Space */}
        <div className="w-[calc(50%-24px)]" />
      </div>
    </div>
  );
}

export default function JourneyDetailDialog({ journey, isOpen, onClose, onDelete }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  if (!journey) return null;

  const toggleStep = (index) => {
    setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const completedCount = journey.steps_snapshot?.filter(s => s.status === 'completed').length || 0;
  const totalSteps = journey.steps_snapshot?.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#ef5a24]" />
            {journey.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Journey Info */}
          {journey.description && (
            <p className="text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">{journey.description}</p>
          )}

          {/* Progress */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Fortschritt</span>
              <span className="text-sm font-bold text-[#ef5a24]">{journey.progress || 0}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#ef5a24] rounded-full transition-all"
                style={{ width: `${journey.progress || 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {completedCount} von {totalSteps} Schritten abgeschlossen
            </p>
          </div>

          {/* Timeline View */}
          <div className="relative py-4">
            <div className="space-y-4">
              {journey.steps_snapshot?.map((step, index) => (
                <StepDetail
                  key={index}
                  step={step}
                  index={index}
                  isExpanded={expandedSteps[index]}
                  onToggle={() => toggleStep(index)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t border-slate-100 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm('Journey wirklich löschen?')) {
                onDelete(journey.id);
                onClose();
              }
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Löschen
          </Button>
          <Button onClick={onClose}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}