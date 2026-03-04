import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Eye, Calendar, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { METHODOLOGIES } from './MethodologyCard';

const STATUS_BADGES = {
  draft: { label: "Entwurf", color: "bg-slate-100 text-slate-600" },
  validating: { label: "In Prüfung", color: "bg-amber-100 text-amber-700" },
  validated: { label: "Validiert", color: "bg-green-100 text-green-700" },
  archived: { label: "Archiviert", color: "bg-slate-100 text-slate-500" }
};

export default function IdeaCard({ idea, onView, onDelete, index }) {
  const method = METHODOLOGIES[idea.methodology];
  const status = STATUS_BADGES[idea.status] || STATUS_BADGES.draft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{method?.icon || '💡'}</span>
          <div>
            <h3 className="font-bold text-slate-900 line-clamp-1">{idea.title}</h3>
            <p className="text-xs text-slate-500">{method?.name || 'Keine Methode'}</p>
          </div>
        </div>
        <Badge className={status.color}>{status.label}</Badge>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 line-clamp-2 mb-4">{idea.description}</p>

      {/* Roadmap indicator */}
      {idea.roadmap && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-600 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{idea.roadmap.phases?.length || 0} Phasen generiert</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {format(new Date(idea.created_date), 'dd.MM.yyyy')}
        </div>

        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(idea)}
            className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          >
            <Eye className="w-4 h-4 mr-1" />
            Ansehen
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(idea.id)}
            className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}