import React from 'react';
import { motion } from 'framer-motion';
import { 
  Lightbulb, Search, FileText, Rocket, Banknote, 
  Megaphone, TrendingUp, Users, Scale, Puzzle, Plus
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const BLOCK_TYPES = [
  { type: 'idea_validation', icon: Lightbulb, color: '#f59e0b' },
  { type: 'market_research', icon: Search, color: '#3b82f6' },
  { type: 'business_model', icon: FileText, color: '#8b5cf6' },
  { type: 'mvp', icon: Rocket, color: '#ef4444' },
  { type: 'funding', icon: Banknote, color: '#10b981' },
  { type: 'launch', icon: Megaphone, color: '#ec4899' },
  { type: 'growth', icon: TrendingUp, color: '#06b6d4' },
  { type: 'team', icon: Users, color: '#f97316' },
  { type: 'legal', icon: Scale, color: '#64748b' },
  { type: 'custom', icon: Puzzle, color: '#6366f1' },
];

const BLOCK_LABELS = {
  de: {
    idea_validation: { label: 'Ideen-Validierung', desc: 'Teste deine Idee' },
    market_research: { label: 'Marktforschung', desc: 'Analysiere den Markt' },
    business_model: { label: 'Business Model', desc: 'Definiere dein Geschäftsmodell' },
    mvp: { label: 'MVP', desc: 'Baue dein Minimum Viable Product' },
    funding: { label: 'Finanzierung', desc: 'Sichere dir Kapital' },
    launch: { label: 'Launch', desc: 'Gehe live!' },
    growth: { label: 'Wachstum', desc: 'Skaliere dein Business' },
    team: { label: 'Team', desc: 'Baue dein Team auf' },
    legal: { label: 'Rechtliches', desc: 'Gründung & Verträge' },
    custom: { label: 'Custom', desc: 'Eigener Schritt' },
    addBlock: 'Baustein hinzufügen'
  },
  en: {
    idea_validation: { label: 'Idea Validation', desc: 'Test your idea' },
    market_research: { label: 'Market Research', desc: 'Analyze the market' },
    business_model: { label: 'Business Model', desc: 'Define your business model' },
    mvp: { label: 'MVP', desc: 'Build your Minimum Viable Product' },
    funding: { label: 'Funding', desc: 'Secure capital' },
    launch: { label: 'Launch', desc: 'Go live!' },
    growth: { label: 'Growth', desc: 'Scale your business' },
    team: { label: 'Team', desc: 'Build your team' },
    legal: { label: 'Legal', desc: 'Founding & Contracts' },
    custom: { label: 'Custom', desc: 'Custom step' },
    addBlock: 'Add Block'
  }
};

export default function BlockPalette({ onAddBlock }) {
  const { language } = useLanguage();
  const labels = BLOCK_LABELS[language] || BLOCK_LABELS.en;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-lg">
      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <div className="w-6 h-6 bg-[#ef5a24]/10 rounded-lg flex items-center justify-center">
          <Plus className="w-4 h-4 text-[#ef5a24]" />
        </div>
        {labels.addBlock}
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_TYPES.map((block) => {
          const Icon = block.icon;
          const blockLabel = labels[block.type] || { label: block.type, desc: '' };
          return (
            <motion.button
              key={block.type}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddBlock(block.type, block.color)}
              className="p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#ef5a24] hover:bg-[#f5f5f5] transition-all text-left group"
            >
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${block.color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color: block.color }} />
                </div>
                <span className="text-sm font-medium text-slate-700">{blockLabel.label}</span>
              </div>
              <p className="text-xs text-slate-500 pl-9">{blockLabel.desc}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export { BLOCK_TYPES };