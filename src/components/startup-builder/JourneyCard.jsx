import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Clock, Check, Archive, Eye, Trash2, BookOpen } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { TEMPLATES } from './templates';

const STATUS_CONFIG = {
  active: { label: "Aktiv", color: "bg-emerald-100 text-emerald-700", icon: Rocket },
  completed: { label: "Abgeschlossen", color: "bg-blue-100 text-blue-700", icon: Check },
  archived: { label: "Archiviert", color: "bg-slate-100 text-slate-600", icon: Archive }
};

export default function JourneyCard({ journey, index, onView, onDelete }) {
  const statusConfig = STATUS_CONFIG[journey.status];
  const StatusIcon = statusConfig.icon;
  const template = journey.template_used ? TEMPLATES.find(t => t.id === journey.template_used) : null;
  const stepsCount = journey.steps_snapshot?.length || 0;
  const completedCount = journey.steps_snapshot?.filter(s => s.status === 'completed').length || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group"
    >
      {/* Color Bar */}
      <div className={`h-2 ${template ? '' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
        style={template ? { background: `linear-gradient(to right, ${template.color}, ${template.color}dd)` } : {}}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${template ? '' : 'bg-gradient-to-br from-emerald-100 to-teal-100'}`}
              style={template ? { backgroundColor: `${template.color}20` } : {}}
            >
              {template?.icon ? (
                <template.icon className="w-5 h-5" style={{ color: template.color }} />
              ) : (
                <Rocket className="w-5 h-5 text-emerald-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{journey.name}</h3>
              {template && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {template.name}
                </p>
              )}
            </div>
          </div>
          <Badge className={statusConfig.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Description */}
        {journey.description && (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2">{journey.description}</p>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{completedCount} von {stepsCount} Schritten</span>
            <span className="font-medium">{journey.progress || 0}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${journey.progress || 0}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
            />
          </div>
        </div>

        {/* Steps Preview */}
        {stepsCount > 0 && (
          <div className="flex -space-x-1 mb-4">
            {journey.steps_snapshot.slice(0, 6).map((step, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: step.color || '#6366f1' }}
                title={step.title}
              >
                {i + 1}
              </div>
            ))}
            {stepsCount > 6 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                +{stepsCount - 6}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {new Date(journey.created_date).toLocaleDateString('de')}
          </span>
          
          {/* Actions */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onView(journey)}
              className="p-2 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Anzeigen"
            >
              <Eye className="w-4 h-4 text-indigo-600" />
            </button>
            <button
              onClick={() => onDelete(journey.id)}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}