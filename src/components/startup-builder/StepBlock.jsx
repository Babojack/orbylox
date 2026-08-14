import React from 'react';
import { motion } from 'framer-motion';
import { 
  Lightbulb, Search, FileText, Rocket, Banknote, 
  Megaphone, TrendingUp, Users, Scale, Puzzle,
  GripVertical, Check, Clock, Circle, ChevronDown, ChevronUp, Lock, CheckSquare
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function StepBlock({ step, isExpanded, onToggle, onEdit, isDragging, dragHandleProps, onUpdateTodo }) {
  const Icon = STEP_ICONS[step.step_type] || Puzzle;
  const statusConfig = STATUS_CONFIG[step.status];
  const StatusIcon = statusConfig.icon;
  const isLocked = step.is_from_template === true;
  const completedTodos = step.todos?.filter(t => t.completed)?.length || 0;
  const totalTodos = step.todos?.length || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`
        bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isDragging ? 'shadow-2xl border-[#ef5a24] rotate-2' : 'shadow-md border-slate-200 hover:border-[#ef5a24] hover:shadow-lg'}
      `}
      style={{ borderLeftColor: step.color, borderLeftWidth: '4px' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        {/* Drag Handle */}
        <div 
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <GripVertical className="w-5 h-5 text-slate-400" />
        </div>

        {/* Icon */}
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${step.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: step.color }} />
        </div>

        {/* Title & Type */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">{step.title}</h3>
          <p className="text-xs text-slate-500">{STEP_LABELS[step.step_type]}</p>
        </div>

        {/* Template Lock Indicator */}
        {isLocked && (
          <div className="p-1" title="Template-Baustein">
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
        )}

        {/* Status Badge */}
        <Badge className={`${statusConfig.color} flex items-center gap-1`}>
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </Badge>

        {/* Todos Counter */}
        {totalTodos > 0 && (
          <Badge variant="outline" className="text-[#ef5a24] border-[#ef5a24]/30 flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            {completedTodos}/{totalTodos}
          </Badge>
        )}

        {/* Expand Button */}
        <button 
          onClick={onToggle}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 border-t border-slate-100"
        >
          <div className="pt-4 space-y-4">
            {/* Problem */}
            {step.problem && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs font-medium text-red-700 mb-1">🔴 Problematik</p>
                <p className="text-sm text-red-800">{step.problem}</p>
              </div>
            )}

            {/* Solution */}
            {step.solution && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-xs font-medium text-green-700 mb-1">🟢 Lösung</p>
                <p className="text-sm text-green-800">{step.solution}</p>
              </div>
            )}

            {/* Description */}
            {step.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Beschreibung</p>
                <p className="text-sm text-slate-700">{step.description}</p>
              </div>
            )}

            {/* Challenges */}
            {step.challenges && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                <p className="text-xs font-medium text-orange-700 mb-1">🟠 Herausforderungen</p>
                <p className="text-sm text-orange-800">{step.challenges}</p>
              </div>
            )}

            {/* Methodology */}
            {step.methodology && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Methodik</p>
                <Badge variant="outline" className="bg-[#f5f5f5] text-[#ef5a24] border-[#ef5a24]/30">
                  {step.methodology}
                </Badge>
              </div>
            )}

            {/* Todos Checklist */}
            {step.todos && step.todos.length > 0 && (
              <div className="bg-[#f5f5f5] border border-[#ef5a24]/30 rounded-xl p-3">
                <p className="text-xs font-medium text-[#ef5a24] mb-2 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  Aufgaben ({completedTodos}/{totalTodos})
                </p>
                <div className="space-y-1.5">
                  {step.todos.map((todo) => (
                    <div 
                      key={todo.id} 
                      className="flex items-center gap-2 bg-white rounded-lg p-2 border border-[#ef5a24]/30"
                    >
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => onUpdateTodo && onUpdateTodo(step.id, todo.id)}
                        className="border-[#ef5a24]"
                      />
                      <span className={`text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {todo.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {step.tools_used && step.tools_used.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Verwendete Tools</p>
                <div className="flex flex-wrap gap-2">
                  {step.tools_used.map((tool, i) => (
                    <Badge key={i} variant="outline" className="bg-slate-50">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Learnings */}
            {step.learnings && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-medium text-amber-700 mb-1">💡 Key Learnings</p>
                <p className="text-sm text-amber-800">{step.learnings}</p>
              </div>
            )}

            {/* Dates */}
            {(step.start_date || step.end_date) && (
              <div className="flex gap-4 text-xs text-slate-500">
                {step.start_date && <span>Start: {new Date(step.start_date).toLocaleDateString('de')}</span>}
                {step.end_date && <span>Ende: {new Date(step.end_date).toLocaleDateString('de')}</span>}
              </div>
            )}

            {/* Edit Button */}
            <button
              onClick={onEdit}
              className="w-full py-2 text-sm text-[#ef5a24] hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              Bearbeiten
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export { STEP_ICONS, STEP_LABELS, STATUS_CONFIG };