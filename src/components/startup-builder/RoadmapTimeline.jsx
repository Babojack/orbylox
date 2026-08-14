import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, Search, FileText, Rocket, Banknote, 
  Megaphone, TrendingUp, Users, Scale, Puzzle,
  GripVertical, Check, Clock, Circle, Trash2, Edit, Plus, Lock, CheckSquare
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
  planned: { icon: Circle, label: "Geplant", color: "bg-slate-100 text-slate-600", dotColor: "bg-slate-400" },
  in_progress: { icon: Clock, label: "In Arbeit", color: "bg-amber-100 text-amber-700", dotColor: "bg-amber-500" },
  completed: { icon: Check, label: "Abgeschlossen", color: "bg-emerald-100 text-emerald-700", dotColor: "bg-emerald-500" }
};

function TimelineStep({ step, index, isLast, onEdit, onDelete, onAddAfter, onUpdateTodo, dragHandleProps, isDragging }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const Icon = STEP_ICONS[step.step_type] || Puzzle;
  const statusConfig = STATUS_CONFIG[step.status] || STATUS_CONFIG.planned;
  const StatusIcon = statusConfig.icon;
  const isEven = index % 2 === 0;
  const isLocked = step.is_from_template === true;
  const completedTodos = step.todos?.filter(t => t.completed)?.length || 0;
  const totalTodos = step.todos?.length || 0;

  return (
    <div className="relative">
      {/* Timeline Container */}
      <div 
        className={`flex items-start gap-0 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Content Card */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`
            w-[calc(50%-40px)] bg-white rounded-2xl border-2 shadow-sm transition-all duration-300 cursor-pointer
            ${isDragging ? 'shadow-2xl border-[#ef5a24] scale-105' : 'border-slate-200 hover:border-[#ef5a24] hover:shadow-lg'}
          `}
          style={{ borderTopColor: step.color, borderTopWidth: '4px' }}
          onClick={() => setShowDetails(!showDetails)}
        >
          {/* Header */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Drag Handle */}
              <div 
                {...dragHandleProps}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded-lg transition-colors mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-slate-400" />
              </div>

              {/* Icon */}
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${step.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: step.color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
                    style={{ backgroundColor: step.color }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-semibold text-slate-900 truncate">{step.title}</h3>
                </div>
                <p className="text-xs text-slate-500 mb-2">{STEP_LABELS[step.step_type]}</p>
                
                {/* Badges Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isLocked && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Template
                    </Badge>
                  )}
                  <Badge className={`${statusConfig.color} flex items-center gap-1`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </Badge>
                  {totalTodos > 0 && (
                    <Badge variant="outline" className="text-[#ef5a24] border-[#ef5a24]/30 flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" />
                      {completedTodos}/{totalTodos}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-slate-100 space-y-3"
                >
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
                            onClick={(e) => e.stopPropagation()}
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

                  {step.tools_used && step.tools_used.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Tools</p>
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
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-medium text-amber-700 mb-1">💡 Key Learnings</p>
                      <p className="text-sm text-amber-800">{step.learnings}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(step); }}
                      className="flex-1 py-2 text-sm text-[#ef5a24] hover:bg-[#f5f5f5] rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Bearbeiten
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}
                      className="flex-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Löschen
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Timeline Center with S-Curve */}
        <div className="w-20 flex flex-col items-center relative">
          {/* Dot */}
          <div 
            className={`w-5 h-5 rounded-full border-4 border-white shadow-lg z-10 ${statusConfig.dotColor}`}
          />
          
          {/* S-Curve Line */}
          {!isLast && (
            <svg 
              className="absolute top-5 w-20 h-24" 
              viewBox="0 0 80 96"
              fill="none"
            >
              <path
                d={isEven 
                  ? "M40 0 C40 30, 70 40, 70 48 C70 56, 40 66, 40 96"  // Curve right then left
                  : "M40 0 C40 30, 10 40, 10 48 C10 56, 40 66, 40 96"  // Curve left then right
                }
                stroke="#e2e8f0"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* Empty Space for alignment */}
        <div className="w-[calc(50%-40px)]" />
      </div>

      {/* Add Step Button between steps */}
      {!isLast && isHovered && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 -translate-x-1/2 top-full -mt-2 z-20"
        >
          <button
            onClick={() => onAddAfter(index)}
            className="w-8 h-8 bg-[#ef5a24] hover:bg-black text-white rounded-full shadow-lg flex items-center justify-center transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default function RoadmapTimeline({ steps, onEdit, onDelete, onReorder, onAddAfter, onUpdateTodo }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  const handleDelete = (stepId) => {
    if (window.confirm('Möchtest du diesen Schritt wirklich löschen?')) {
      onDelete(stepId);
    }
  };

  if (steps.length === 0) return null;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="timeline">
        {(provided) => (
          <div 
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="relative py-8"
          >
            {/* Central Timeline Line Background */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 -translate-x-1/2" />

            {/* Steps */}
            <div className="space-y-16">
              {steps.map((step, index) => (
                <Draggable key={step.id} draggableId={step.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                    >
                      <TimelineStep
                        step={step}
                        index={index}
                        isLast={index === steps.length - 1}
                        onEdit={onEdit}
                        onDelete={handleDelete}
                        onAddAfter={onAddAfter}
                        onUpdateTodo={onUpdateTodo}
                        dragHandleProps={provided.dragHandleProps}
                        isDragging={snapshot.isDragging}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

export { STEP_ICONS, STEP_LABELS, STATUS_CONFIG };