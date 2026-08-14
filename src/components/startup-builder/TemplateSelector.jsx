import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPLATES } from './templates';

export default function TemplateSelector({ isOpen, onClose, onSelectTemplate }) {
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);

  const handleApply = () => {
    if (selectedTemplate) {
      const template = TEMPLATES.find(t => t.id === selectedTemplate);
      onSelectTemplate(template.steps, template.id);
      onClose();
      setSelectedTemplate(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#ef5a24]" />
            Vorlage aus Startup-Büchern wählen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;

            return (
              <motion.button
                key={template.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedTemplate(template.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                  isSelected 
                    ? 'border-[#ef5a24] bg-[#f5f5f5] shadow-lg' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${template.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: template.color }} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900">{template.name}</h3>
                      {isSelected && (
                        <span className="w-5 h-5 bg-[#ef5a24] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mb-2">von {template.author}</p>
                    <p className="text-sm text-slate-600 mb-3">{template.description}</p>

                    {/* Steps Preview */}
                    <div className="flex flex-wrap gap-2">
                      {template.steps.map((step, i) => (
                        <span 
                          key={i}
                          className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1"
                        >
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: step.color }}
                          />
                          {step.title.length > 20 ? step.title.slice(0, 20) + '...' : step.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!selectedTemplate}
            className="flex-1 bg-[#ef5a24] hover:bg-black"
          >
            Vorlage anwenden
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}