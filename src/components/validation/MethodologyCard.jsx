import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const METHODOLOGIES = {
  lean_startup: {
    name: "Lean Startup",
    author: "Eric Ries",
    color: "from-emerald-500 to-teal-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: "🚀",
    description: "Build-Measure-Learn Zyklus für schnelle Validierung",
    keyPoints: ["MVP Development", "Validated Learning", "Pivot or Persevere"]
  },
  design_thinking: {
    name: "Design Thinking",
    author: "IDEO / Tim Brown",
    color: "from-[#ef5a24] to-[#ef5a24]",
    bgColor: "bg-[#f5f5f5]",
    borderColor: "border-[#ef5a24]/30",
    icon: "🎨",
    description: "Nutzerzentrierte Innovation durch Empathie",
    keyPoints: ["Empathize", "Define", "Ideate", "Prototype", "Test"]
  },
  jobs_to_be_done: {
    name: "Jobs to be Done",
    author: "Clayton Christensen",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "🎯",
    description: "Verstehe welchen 'Job' dein Produkt erfüllt",
    keyPoints: ["Job Mapping", "Outcome Expectations", "Competitive Analysis"]
  },
  blue_ocean: {
    name: "Blue Ocean Strategy",
    author: "W. Chan Kim",
    color: "from-cyan-500 to-blue-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    icon: "🌊",
    description: "Schaffe neue Märkte statt zu konkurrieren",
    keyPoints: ["Value Innovation", "Strategy Canvas", "Four Actions Framework"]
  },
  business_model_canvas: {
    name: "Business Model Canvas",
    author: "Alexander Osterwalder",
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: "📋",
    description: "Visualisiere dein komplettes Geschäftsmodell",
    keyPoints: ["9 Building Blocks", "Value Proposition", "Revenue Streams"]
  }
};

export default function MethodologyCard({ methodKey, selected, onSelect }) {
  const method = METHODOLOGIES[methodKey];
  const isSelected = selected === methodKey;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(methodKey)}
      className={`
        relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300
        ${isSelected 
          ? `${method.borderColor} ${method.bgColor} shadow-lg` 
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'}
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r ${method.color} flex items-center justify-center shadow-lg`}
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Icon */}
      <motion.div 
        className="text-4xl mb-3"
        animate={{ rotate: isSelected ? [0, -10, 10, 0] : 0 }}
        transition={{ duration: 0.5 }}
      >
        {method.icon}
      </motion.div>

      {/* Title & Author */}
      <h3 className={`font-bold text-lg mb-1 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
        {method.name}
      </h3>
      <p className="text-xs text-slate-500 mb-2">von {method.author}</p>

      {/* Description */}
      <p className="text-sm text-slate-600 mb-3">{method.description}</p>

      {/* Key Points */}
      <div className="flex flex-wrap gap-1.5">
        {method.keyPoints.map((point, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`
              text-xs px-2 py-1 rounded-full
              ${isSelected 
                ? `bg-gradient-to-r ${method.color} text-white` 
                : 'bg-slate-100 text-slate-600'}
            `}
          >
            {point}
          </motion.span>
        ))}
      </div>

      {/* Glow effect when selected */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${method.color} opacity-5 pointer-events-none`}
        />
      )}
    </motion.div>
  );
}

export { METHODOLOGIES };