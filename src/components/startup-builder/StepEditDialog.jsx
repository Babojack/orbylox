import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Lock, Trash2, CheckSquare, BookOpen, RefreshCw, Upload, Paperclip, HelpCircle } from 'lucide-react';
import { STEP_LABELS } from './StepBlock';
import { api } from "@/api/apiClient";
import TaskExplanationDialog from './TaskExplanationDialog';
import { useLanguage } from '@/components/LanguageProvider';

const METHODOLOGIES = [
  "Lean Startup",
  "The Mom Test",
  "Zero to One",
  "Design Thinking",
  "Jobs to be Done",
  "Blue Ocean Strategy",
  "Business Model Canvas",
  "Customer Development",
  "Agile/Scrum",
  "Andere"
];

const COMMON_TOOLS = [
  "Figma", "Miro", "Notion", "Trello", "Slack", "Google Forms",
  "Typeform", "Airtable", "Excel", "PowerPoint", "Canva",
  "Google Analytics", "Hotjar", "Mixpanel", "Stripe", "Shopify"
];

// Methodology-specific todos for each step type
const METHODOLOGY_TODOS = {
  "Lean Startup": {
    idea_validation: [
      { text: 'Leap-of-Faith Annahmen definieren', completed: false },
      { text: 'Problem-Hypothese formulieren', completed: false },
      { text: 'Value Hypothesis aufstellen', completed: false },
      { text: 'Growth Hypothesis definieren', completed: false }
    ],
    market_research: [
      { text: 'Customer Discovery Interviews (min. 20)', completed: false },
      { text: 'Get out of the building', completed: false },
      { text: 'Innovation Accounting Metriken definieren', completed: false },
      { text: 'Vanity Metrics vs. Actionable Metrics unterscheiden', completed: false }
    ],
    mvp: [
      { text: 'Kernhypothese für MVP festlegen', completed: false },
      { text: 'Minimum Viable Product bauen', completed: false },
      { text: 'Build-Measure-Learn Zyklus starten', completed: false },
      { text: 'Iteration oder Pivot entscheiden', completed: false }
    ],
    business_model: [
      { text: 'Validated Learning dokumentieren', completed: false },
      { text: 'Unit Economics berechnen', completed: false },
      { text: 'Sustainable Business Model entwickeln', completed: false }
    ],
    growth: [
      { text: 'Growth Engine wählen (Viral/Sticky/Paid)', completed: false },
      { text: 'Engine of Growth optimieren', completed: false },
      { text: 'A/B Tests durchführen', completed: false },
      { text: 'Skalierung planen', completed: false }
    ]
  },
  "The Mom Test": {
    idea_validation: [
      { text: 'Riskanteste Annahmen auflisten', completed: false },
      { text: 'Fragen über Verhalten formulieren (nicht Meinungen)', completed: false },
      { text: 'Leading Questions vermeiden', completed: false },
      { text: 'Auf vergangenes Verhalten fokussieren', completed: false }
    ],
    market_research: [
      { text: '10+ Casual Conversations führen', completed: false },
      { text: 'Kein Pitch - nur Zuhören', completed: false },
      { text: 'Schmerzpunkte identifizieren', completed: false },
      { text: 'Patterns in Antworten finden', completed: false }
    ],
    mvp: [
      { text: 'Commitment fragen (Zeit/Geld/Reputation)', completed: false },
      { text: 'Advancement sichern (nächster Schritt)', completed: false },
      { text: 'Pre-Orders oder Voranmeldungen sammeln', completed: false }
    ],
    business_model: [
      { text: 'Problem-Solution Fit dokumentieren', completed: false },
      { text: 'Zahlungsbereitschaft validieren', completed: false },
      { text: 'Early Adopter Profil erstellen', completed: false }
    ]
  },
  "Zero to One": {
    idea_validation: [
      { text: 'Contrarian Truth formulieren', completed: false },
      { text: 'Was glaubst du, das niemand sonst glaubt?', completed: false },
      { text: '0 to 1 Innovation identifizieren', completed: false }
    ],
    market_research: [
      { text: 'Kleinen Markt identifizieren', completed: false },
      { text: 'Monopol-Potenzial prüfen', completed: false },
      { text: 'Competition is for losers verstehen', completed: false }
    ],
    mvp: [
      { text: 'Proprietary Technology entwickeln', completed: false },
      { text: '10x Verbesserung definieren', completed: false },
      { text: 'Technologischen Vorsprung sichern', completed: false }
    ],
    business_model: [
      { text: 'Network Effects analysieren', completed: false },
      { text: 'Economies of Scale planen', completed: false },
      { text: 'Branding/Monopol aufbauen', completed: false }
    ],
    team: [
      { text: 'Founding Team mit komplementären Skills', completed: false },
      { text: 'Shared History prüfen', completed: false },
      { text: 'Mafia-Kultur aufbauen', completed: false }
    ],
    growth: [
      { text: 'Distribution Strategie (Sales vs Marketing vs Viral)', completed: false },
      { text: 'Durability planen', completed: false },
      { text: 'Last Mover Advantage sichern', completed: false }
    ]
  },
  "Design Thinking": {
    idea_validation: [
      { text: 'Empathize: Nutzer beobachten', completed: false },
      { text: 'Define: Problem Statement formulieren', completed: false },
      { text: 'How Might We Fragen erstellen', completed: false }
    ],
    market_research: [
      { text: 'User Interviews durchführen', completed: false },
      { text: 'Empathy Map erstellen', completed: false },
      { text: 'User Journey Map zeichnen', completed: false }
    ],
    mvp: [
      { text: 'Ideate: Brainstorming Session', completed: false },
      { text: 'Prototype: Low-Fidelity Prototyp', completed: false },
      { text: 'Test: Mit echten Nutzern testen', completed: false },
      { text: 'Iterate: Feedback einarbeiten', completed: false }
    ],
    business_model: [
      { text: 'Desirability prüfen (Wollen Nutzer es?)', completed: false },
      { text: 'Viability prüfen (Ist es wirtschaftlich?)', completed: false },
      { text: 'Feasibility prüfen (Können wir es bauen?)', completed: false }
    ]
  },
  "Jobs to be Done": {
    idea_validation: [
      { text: 'Job-to-be-Done identifizieren', completed: false },
      { text: 'Funktionale Jobs definieren', completed: false },
      { text: 'Emotionale Jobs definieren', completed: false },
      { text: 'Soziale Jobs definieren', completed: false }
    ],
    market_research: [
      { text: 'Switch Interviews führen', completed: false },
      { text: 'Hiring/Firing Momente identifizieren', completed: false },
      { text: 'Competing Against Luck verstehen', completed: false }
    ],
    mvp: [
      { text: 'Job Story formulieren', completed: false },
      { text: 'When _____, I want to _____, so I can _____', completed: false },
      { text: 'Outcome-Driven Innovation anwenden', completed: false }
    ],
    business_model: [
      { text: 'Unmet Needs priorisieren', completed: false },
      { text: 'Importance vs. Satisfaction Matrix', completed: false },
      { text: 'Job Map erstellen', completed: false }
    ]
  },
  "Blue Ocean Strategy": {
    idea_validation: [
      { text: 'Red Ocean vs Blue Ocean analysieren', completed: false },
      { text: 'Value Innovation identifizieren', completed: false },
      { text: 'Non-Customers analysieren', completed: false }
    ],
    market_research: [
      { text: 'Strategy Canvas erstellen', completed: false },
      { text: 'Four Actions Framework anwenden', completed: false },
      { text: 'Eliminate-Reduce-Raise-Create Grid', completed: false }
    ],
    mvp: [
      { text: 'ERRC Grid umsetzen', completed: false },
      { text: 'Buyer Utility Map erstellen', completed: false },
      { text: 'Price Corridor of the Mass', completed: false }
    ],
    business_model: [
      { text: 'Reconstruct Market Boundaries', completed: false },
      { text: 'Reach Beyond Existing Demand', completed: false },
      { text: 'Blue Ocean Strategy Canvas', completed: false }
    ]
  },
  "Business Model Canvas": {
    idea_validation: [
      { text: 'Value Proposition definieren', completed: false },
      { text: 'Customer Segments identifizieren', completed: false },
      { text: 'Problem-Solution Fit prüfen', completed: false }
    ],
    market_research: [
      { text: 'Channels analysieren', completed: false },
      { text: 'Customer Relationships definieren', completed: false },
      { text: 'Early Adopter identifizieren', completed: false }
    ],
    mvp: [
      { text: 'Value Proposition Canvas erstellen', completed: false },
      { text: 'Minimum Viable Product definieren', completed: false },
      { text: 'Key Activities für MVP festlegen', completed: false }
    ],
    business_model: [
      { text: 'Revenue Streams definieren', completed: false },
      { text: 'Cost Structure kalkulieren', completed: false },
      { text: 'Key Resources identifizieren', completed: false },
      { text: 'Key Partners auswählen', completed: false }
    ]
  },
  "Customer Development": {
    idea_validation: [
      { text: 'Customer Discovery starten', completed: false },
      { text: 'Problem-Solution Hypothese aufstellen', completed: false },
      { text: 'Earlyvangelists finden', completed: false }
    ],
    market_research: [
      { text: 'Customer Validation durchführen', completed: false },
      { text: 'Repeatable Sales Process finden', completed: false },
      { text: 'Product-Market Fit testen', completed: false }
    ],
    growth: [
      { text: 'Customer Creation starten', completed: false },
      { text: 'Demand Creation vs. Demand Fulfillment', completed: false },
      { text: 'Company Building Phase', completed: false }
    ],
    business_model: [
      { text: 'Pivot oder Proceed entscheiden', completed: false },
      { text: 'Business Model validieren', completed: false },
      { text: 'Scalable Business Model aufbauen', completed: false }
    ]
  }
};

// Get todos based on methodology and step type
export const getTodosByMethodology = (stepType, methodology) => {
  const methodTodos = METHODOLOGY_TODOS[methodology];
  if (methodTodos && methodTodos[stepType]) {
    return methodTodos[stepType].map((t, i) => ({ ...t, id: `${Date.now()}_${i}` }));
  }
  // Fallback to default todos
  return getDefaultTodos(stepType);
};

// Default todos based on step type (fallback)
const getDefaultTodos = (stepType) => {
  const baseTodos = {
    idea_validation: [
      { text: 'Problem-Hypothese formulieren', completed: false },
      { text: '10 potenzielle Kunden identifizieren', completed: false },
      { text: 'Kundeninterviews durchführen', completed: false },
      { text: 'Ergebnisse dokumentieren', completed: false }
    ],
    market_research: [
      { text: 'Marktgröße recherchieren', completed: false },
      { text: 'Wettbewerbsanalyse erstellen', completed: false },
      { text: 'Zielgruppen-Personas definieren', completed: false },
      { text: 'Markttrends analysieren', completed: false }
    ],
    business_model: [
      { text: 'Business Model Canvas ausfüllen', completed: false },
      { text: 'Einnahmequellen definieren', completed: false },
      { text: 'Kostenstruktur kalkulieren', completed: false },
      { text: 'Value Proposition formulieren', completed: false }
    ],
    mvp: [
      { text: 'Kernfunktionen definieren', completed: false },
      { text: 'Prototyp erstellen', completed: false },
      { text: 'MVP mit Nutzern testen', completed: false },
      { text: 'Feedback einarbeiten', completed: false }
    ],
    funding: [
      { text: 'Pitch Deck erstellen', completed: false },
      { text: 'Finanzplan aufstellen', completed: false },
      { text: 'Investoren identifizieren', completed: false },
      { text: 'Pitch üben', completed: false }
    ],
    launch: [
      { text: 'Launch-Strategie planen', completed: false },
      { text: 'Marketing-Materialien erstellen', completed: false },
      { text: 'Pressemitteilung vorbereiten', completed: false },
      { text: 'Launch-Event planen', completed: false }
    ],
    growth: [
      { text: 'Wachstums-KPIs definieren', completed: false },
      { text: 'Akquisitionskanäle testen', completed: false },
      { text: 'Retention-Strategien entwickeln', completed: false },
      { text: 'Skalierungsplan erstellen', completed: false }
    ],
    team: [
      { text: 'Rollen und Verantwortlichkeiten definieren', completed: false },
      { text: 'Stellenbeschreibungen erstellen', completed: false },
      { text: 'Recruiting-Kanäle identifizieren', completed: false },
      { text: 'Onboarding-Prozess planen', completed: false }
    ],
    legal: [
      { text: 'Rechtsform wählen', completed: false },
      { text: 'Firma gründen/registrieren', completed: false },
      { text: 'AGB und Datenschutz erstellen', completed: false },
      { text: 'Markenrecht prüfen', completed: false }
    ],
    custom: [
      { text: 'Ziel definieren', completed: false },
      { text: 'Aufgaben planen', completed: false },
      { text: 'Umsetzen', completed: false },
      { text: 'Ergebnisse evaluieren', completed: false }
    ]
  };
  const todos = baseTodos[stepType] || baseTodos.custom;
  return todos.map((t, i) => ({ ...t, id: `default_${i}` }));
};

export default function StepEditDialog({ isOpen, onClose, step, onSave, onDelete }) {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState({
    title: '',
    step_type: 'custom',
    description: '',
    problem: '',
    solution: '',
    challenges: '',
    methodology: '',
    tools_used: [],
    todos: [],
    attachments: [],
    learnings: '',
    status: 'planned',
    start_date: '',
    end_date: '',
    color: '#6366f1',
    is_from_template: false
  });
  const [newTodo, setNewTodo] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [explanationTask, setExplanationTask] = useState(null);
  
  // Check if fields should be locked (from template)
  const isLocked = step?.is_from_template === true;

  useEffect(() => {
    if (step) {
      // Generate default todos if none exist and it's a new step
      const existingTodos = step.todos || [];
      let todosToUse = existingTodos;
      
      if (existingTodos.length === 0 && !step.id) {
        // For new steps, generate todos based on methodology if available
        if (step.methodology) {
          todosToUse = getTodosByMethodology(step.step_type, step.methodology);
        } else {
          todosToUse = getDefaultTodos(step.step_type);
        }
      }
      
      setFormData({
        title: step.title || '',
        step_type: step.step_type || 'custom',
        description: step.description || '',
        problem: step.problem || '',
        solution: step.solution || '',
        challenges: step.challenges || '',
        methodology: step.methodology || '',
        tools_used: step.tools_used || [],
        todos: todosToUse,
        attachments: step.attachments || [],
        learnings: step.learnings || '',
        status: step.status || 'planned',
        start_date: step.start_date || '',
        end_date: step.end_date || '',
        color: step.color || '#6366f1',
        is_from_template: step.is_from_template || false
      });
    }
  }, [step]);

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    
    setFormData({
      ...formData,
      attachments: [...formData.attachments, { name: file.name, url: file_url }]
    });
    setIsUploading(false);
  };

  const handleRemoveAttachment = (index) => {
    setFormData({
      ...formData,
      attachments: formData.attachments.filter((_, i) => i !== index)
    });
  };

  // Todo handlers
  const handleAddTodo = () => {
    if (newTodo.trim()) {
      const newTodoItem = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false
      };
      setFormData({ ...formData, todos: [...formData.todos, newTodoItem] });
      setNewTodo('');
    }
  };

  const handleToggleTodo = (todoId) => {
    setFormData({
      ...formData,
      todos: formData.todos.map(t => 
        t.id === todoId ? { ...t, completed: !t.completed } : t
      )
    });
  };

  const handleDeleteTodo = (todoId) => {
    setFormData({
      ...formData,
      todos: formData.todos.filter(t => t.id !== todoId)
    });
  };

  const handleSave = () => {
    onSave({ ...step, ...formData });
    onClose();
  };

  // Translations for dialog
  const dialogLabels = language === 'de' ? {
    editBlock: 'Baustein bearbeiten',
    newBlock: 'Neuer Baustein',
    basic: 'Basis',
    tasks: 'Aufgaben',
    details: 'Details',
    files: 'Dateien',
    title: 'Titel',
    titlePlaceholder: 'z.B. Kundeninterviews durchführen',
    type: 'Typ',
    status: 'Status',
    description: 'Beschreibung',
    descriptionPlaceholder: 'Was passiert in diesem Schritt?',
    start: 'Start',
    end: 'Ende',
    color: 'Farbe',
    bookMethod: 'Buchmethode',
    selectMethod: 'Methode wählen...',
    tasksLabel: 'Aufgaben',
    newTask: 'Neue Aufgabe...',
    showExplanation: 'Erklärung anzeigen',
    problem: 'Problem',
    whatProblem: 'Welches Problem?',
    solution: 'Lösung',
    howSolved: 'Wie gelöst?',
    challenges: 'Herausforderungen',
    whatDifficult: 'Was war schwierig?',
    learnings: 'Learnings',
    whatLearned: 'Was gelernt?',
    uploadDoc: 'Dokument hochladen',
    uploading: 'Wird hochgeladen...',
    documents: 'Dokumente',
    noDocuments: 'Keine Dokumente',
    deleteBlock: 'Baustein löschen?',
    cancel: 'Abbrechen',
    save: 'Speichern',
    planned: 'Geplant',
    inProgress: 'In Arbeit',
    completed: 'Abgeschlossen'
  } : {
    editBlock: 'Edit Block',
    newBlock: 'New Block',
    basic: 'Basic',
    tasks: 'Tasks',
    details: 'Details',
    files: 'Files',
    title: 'Title',
    titlePlaceholder: 'e.g. Conduct customer interviews',
    type: 'Type',
    status: 'Status',
    description: 'Description',
    descriptionPlaceholder: 'What happens in this step?',
    start: 'Start',
    end: 'End',
    color: 'Color',
    bookMethod: 'Book Method',
    selectMethod: 'Select method...',
    tasksLabel: 'Tasks',
    newTask: 'New task...',
    showExplanation: 'Show explanation',
    problem: 'Problem',
    whatProblem: 'What problem?',
    solution: 'Solution',
    howSolved: 'How solved?',
    challenges: 'Challenges',
    whatDifficult: 'What was difficult?',
    learnings: 'Learnings',
    whatLearned: 'What learned?',
    uploadDoc: 'Upload document',
    uploading: 'Uploading...',
    documents: 'Documents',
    noDocuments: 'No documents',
    deleteBlock: 'Delete block?',
    cancel: 'Cancel',
    save: 'Save',
    planned: 'Planned',
    inProgress: 'In Progress',
    completed: 'Completed'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step?.id ? dialogLabels.editBlock : dialogLabels.newBlock}
            {isLocked && <Lock className="w-4 h-4 text-amber-500" />}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 mb-3">
            <TabsTrigger value="basic">{dialogLabels.basic}</TabsTrigger>
            <TabsTrigger value="tasks">{dialogLabels.tasks}</TabsTrigger>
            <TabsTrigger value="details">{dialogLabels.details}</TabsTrigger>
            <TabsTrigger value="files">{dialogLabels.files}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1">
            {/* TAB 1: Basic Info */}
            <TabsContent value="basic" className="space-y-4 mt-0">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.title} *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={dialogLabels.titlePlaceholder}
                  disabled={isLocked}
                  className={isLocked ? 'bg-slate-100' : ''}
                />
              </div>

              {/* Type & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.type}</label>
                  <Select 
                    value={formData.step_type} 
                    onValueChange={(v) => setFormData({ ...formData, step_type: v })}
                    disabled={isLocked}
                  >
                    <SelectTrigger className={isLocked ? 'bg-slate-100' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STEP_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.status}</label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">{dialogLabels.planned}</SelectItem>
                      <SelectItem value="in_progress">{dialogLabels.inProgress}</SelectItem>
                      <SelectItem value="completed">{dialogLabels.completed}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.description}</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={dialogLabels.descriptionPlaceholder}
                  rows={2}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.start}</label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.end}</label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{dialogLabels.color}</label>
                <div className="flex gap-2">
                  {['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#ec4899', '#06b6d4', '#6366f1'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`w-7 h-7 rounded-lg transition-transform ${formData.color === c ? 'ring-2 ring-offset-1 ring-[#ef5a24] scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Tasks / Methodology */}
            <TabsContent value="tasks" className="space-y-4 mt-0">
              {/* Methodology Selector */}
              <div className="bg-[#f5f5f5] rounded-lg p-3 border border-[#ef5a24]/30">
                <label className="text-sm font-medium text-[#ef5a24] mb-1 block flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {dialogLabels.bookMethod}
                </label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.methodology} 
                    onValueChange={(v) => setFormData({ ...formData, methodology: v })}
                    disabled={isLocked}
                  >
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue placeholder={dialogLabels.selectMethod} />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODOLOGIES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.methodology && !isLocked && (
                    <Button 
                      type="button" 
                      size="sm"
                      onClick={() => {
                        const newTodos = getTodosByMethodology(formData.step_type, formData.methodology);
                        setFormData({ ...formData, todos: newTodos });
                      }}
                      className="bg-[#ef5a24] hover:bg-black"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Todo List */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  {dialogLabels.tasksLabel} ({formData.todos.filter(t => t.completed).length}/{formData.todos.length})
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {formData.todos.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => handleToggleTodo(todo.id)}
                      />
                      <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                        {todo.text}
                      </span>
                      <button 
                        onClick={() => setExplanationTask(todo.text)} 
                        className="p-1 text-[#ef5a24] hover:text-[#ef5a24] transition-colors"
                        title={dialogLabels.showExplanation}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteTodo(todo.id)} className="p-1 text-slate-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    placeholder={dialogLabels.newTask}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTodo())}
                    className="text-sm"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddTodo}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Details */}
            <TabsContent value="details" className="space-y-3 mt-0">
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <label className="text-xs font-medium text-red-700 mb-1 block">🔴 {dialogLabels.problem}</label>
                <Textarea
                  value={formData.problem}
                  onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                  placeholder={dialogLabels.whatProblem}
                  rows={2}
                  className="text-sm border-red-200"
                />
              </div>

              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <label className="text-xs font-medium text-green-700 mb-1 block">🟢 {dialogLabels.solution}</label>
                <Textarea
                  value={formData.solution}
                  onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                  placeholder={dialogLabels.howSolved}
                  rows={2}
                  className="text-sm border-green-200"
                />
              </div>

              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                <label className="text-xs font-medium text-orange-700 mb-1 block">🟠 {dialogLabels.challenges}</label>
                <Textarea
                  value={formData.challenges}
                  onChange={(e) => setFormData({ ...formData, challenges: e.target.value })}
                  placeholder={dialogLabels.whatDifficult}
                  rows={2}
                  className="text-sm border-orange-200"
                />
              </div>

              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <label className="text-xs font-medium text-amber-700 mb-1 block">💡 {dialogLabels.learnings}</label>
                <Textarea
                  value={formData.learnings}
                  onChange={(e) => setFormData({ ...formData, learnings: e.target.value })}
                  placeholder={dialogLabels.whatLearned}
                  rows={2}
                  className="text-sm border-amber-200"
                />
              </div>
            </TabsContent>

            {/* TAB 4: Files */}
            <TabsContent value="files" className="space-y-4 mt-0">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {isUploading ? (
                    <RefreshCw className="w-8 h-8 text-[#ef5a24] animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-600">
                    {isUploading ? dialogLabels.uploading : dialogLabels.uploadDoc}
                  </span>
                </label>
              </div>

              {/* Uploaded files */}
              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{dialogLabels.documents}</label>
                  {formData.attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 text-sm text-[#ef5a24] hover:underline truncate"
                      >
                        {file.name}
                      </a>
                      <button 
                        onClick={() => handleRemoveAttachment(i)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {formData.attachments.length === 0 && !isUploading && (
                <p className="text-sm text-slate-400 text-center">{dialogLabels.noDocuments}</p>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t mt-3">
          {step?.id && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => { 
                if (window.confirm(dialogLabels.deleteBlock)) {
                  onDelete(step.id); 
                  onClose(); 
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>{dialogLabels.cancel}</Button>
          <Button size="sm" onClick={handleSave} disabled={!formData.title} className="bg-[#ef5a24] hover:bg-black">
            {dialogLabels.save}
          </Button>
        </div>
      </DialogContent>

      {/* Task Explanation Dialog */}
      <TaskExplanationDialog
        task={explanationTask}
        methodology={formData.methodology}
        isOpen={!!explanationTask}
        onClose={() => setExplanationTask(null)}
      />
    </Dialog>
  );
}