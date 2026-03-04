import { Rocket, Target, Layers } from 'lucide-react';

// Helper to generate default todos based on step type
const getDefaultTodos = (stepType) => {
  const todos = {
    idea_validation: [
      { id: '1', text: 'Problem-Hypothese formulieren', completed: false },
      { id: '2', text: 'Zielkunden identifizieren', completed: false },
      { id: '3', text: 'Interviews durchführen', completed: false },
      { id: '4', text: 'Ergebnisse dokumentieren', completed: false }
    ],
    market_research: [
      { id: '1', text: 'Marktgröße recherchieren', completed: false },
      { id: '2', text: 'Wettbewerbsanalyse', completed: false },
      { id: '3', text: 'Zielgruppen-Personas', completed: false }
    ],
    business_model: [
      { id: '1', text: 'Business Model Canvas', completed: false },
      { id: '2', text: 'Einnahmequellen definieren', completed: false },
      { id: '3', text: 'Kostenstruktur kalkulieren', completed: false }
    ],
    mvp: [
      { id: '1', text: 'Kernfunktionen definieren', completed: false },
      { id: '2', text: 'Prototyp erstellen', completed: false },
      { id: '3', text: 'Mit Nutzern testen', completed: false }
    ],
    funding: [
      { id: '1', text: 'Pitch Deck erstellen', completed: false },
      { id: '2', text: 'Finanzplan aufstellen', completed: false },
      { id: '3', text: 'Investoren kontaktieren', completed: false }
    ],
    growth: [
      { id: '1', text: 'Growth-KPIs definieren', completed: false },
      { id: '2', text: 'Kanäle testen', completed: false },
      { id: '3', text: 'Skalierungsplan erstellen', completed: false }
    ],
    team: [
      { id: '1', text: 'Rollen definieren', completed: false },
      { id: '2', text: 'Stellenbeschreibungen', completed: false },
      { id: '3', text: 'Recruiting starten', completed: false }
    ]
  };
  return todos[stepType] || [
    { id: '1', text: 'Ziel definieren', completed: false },
    { id: '2', text: 'Umsetzen', completed: false }
  ];
};

export const TEMPLATES = [
  {
    id: 'lean_startup',
    name: 'The Lean Startup',
    author: 'Eric Ries',
    icon: Rocket,
    color: '#10b981',
    description: 'Build-Measure-Learn Zyklus für schnelle Validierung',
    steps: [
      { step_type: 'idea_validation', title: 'Problem-Hypothese definieren', description: 'Definiere die Kernhypothese: Welches Problem löst du?', methodology: 'Lean Startup', color: '#f59e0b', is_from_template: true, todos: getDefaultTodos('idea_validation') },
      { step_type: 'market_research', title: 'Customer Discovery', description: 'Führe 20+ Kundeninterviews durch, um das Problem zu validieren', methodology: 'Lean Startup', color: '#3b82f6', is_from_template: true, todos: getDefaultTodos('market_research') },
      { step_type: 'mvp', title: 'MVP bauen', description: 'Erstelle ein Minimum Viable Product mit den Kernfunktionen', methodology: 'Lean Startup', color: '#ef4444', is_from_template: true, todos: getDefaultTodos('mvp') },
      { step_type: 'market_research', title: 'Measure - Metriken sammeln', description: 'Definiere und tracke Innovation Accounting Metriken', methodology: 'Lean Startup', color: '#3b82f6', is_from_template: true, todos: [{ id: '1', text: 'KPIs definieren', completed: false }, { id: '2', text: 'Tracking einrichten', completed: false }, { id: '3', text: 'Dashboard erstellen', completed: false }] },
      { step_type: 'idea_validation', title: 'Learn - Pivot or Persevere', description: 'Analysiere die Daten: Weitermachen oder Pivot?', methodology: 'Lean Startup', color: '#f59e0b', is_from_template: true, todos: [{ id: '1', text: 'Daten analysieren', completed: false }, { id: '2', text: 'Team-Retrospektive', completed: false }, { id: '3', text: 'Entscheidung dokumentieren', completed: false }] },
      { step_type: 'growth', title: 'Growth Engine starten', description: 'Skaliere mit Viral, Sticky oder Paid Growth Engine', methodology: 'Lean Startup', color: '#06b6d4', is_from_template: true, todos: getDefaultTodos('growth') },
    ]
  },
  {
    id: 'mom_test',
    name: 'The Mom Test',
    author: 'Rob Fitzpatrick',
    icon: Target,
    color: '#8b5cf6',
    description: 'Kundeninterviews richtig führen ohne Bias',
    steps: [
      { step_type: 'idea_validation', title: 'Riskanteste Annahmen identifizieren', description: 'Liste die 3 riskantesten Annahmen deiner Idee auf', methodology: 'The Mom Test', color: '#f59e0b', is_from_template: true, todos: [{ id: '1', text: 'Annahme 1 formulieren', completed: false }, { id: '2', text: 'Annahme 2 formulieren', completed: false }, { id: '3', text: 'Annahme 3 formulieren', completed: false }, { id: '4', text: 'Risiko-Ranking erstellen', completed: false }] },
      { step_type: 'market_research', title: 'Interview-Fragen vorbereiten', description: 'Formuliere offene Fragen über Verhalten, nicht Meinungen', methodology: 'The Mom Test', color: '#3b82f6', is_from_template: true, todos: [{ id: '1', text: 'Fragen zu Verhalten formulieren', completed: false }, { id: '2', text: 'Leading Questions vermeiden', completed: false }, { id: '3', text: 'Fragenkatalog erstellen', completed: false }] },
      { step_type: 'market_research', title: '10 Casual Conversations', description: 'Führe 10 lockere Gespräche ohne Pitch', methodology: 'The Mom Test', color: '#3b82f6', is_from_template: true, todos: [{ id: '1', text: 'Gesprächspartner finden', completed: false }, { id: '2', text: '5 Gespräche führen', completed: false }, { id: '3', text: '10 Gespräche führen', completed: false }, { id: '4', text: 'Notizen zusammenfassen', completed: false }] },
      { step_type: 'idea_validation', title: 'Patterns erkennen', description: 'Analysiere wiederkehrende Probleme und Verhaltensweisen', methodology: 'The Mom Test', color: '#f59e0b', is_from_template: true, todos: [{ id: '1', text: 'Alle Notizen durchgehen', completed: false }, { id: '2', text: 'Wiederkehrende Themen markieren', completed: false }, { id: '3', text: 'Patterns dokumentieren', completed: false }] },
      { step_type: 'market_research', title: 'Commitment & Advancement', description: 'Frage nach echtem Commitment: Zeit, Geld oder Reputation', methodology: 'The Mom Test', color: '#3b82f6', is_from_template: true, todos: [{ id: '1', text: 'Commitment-Fragen vorbereiten', completed: false }, { id: '2', text: 'Nach Voranmeldungen fragen', completed: false }, { id: '3', text: 'Ergebnisse dokumentieren', completed: false }] },
      { step_type: 'business_model', title: 'Problem-Solution Fit dokumentieren', description: 'Dokumentiere den validierten Problem-Solution Fit', methodology: 'The Mom Test', color: '#8b5cf6', is_from_template: true, todos: getDefaultTodos('business_model') },
    ]
  },
  {
    id: 'zero_to_one',
    name: 'Zero to One',
    author: 'Peter Thiel',
    icon: Layers,
    color: '#ec4899',
    description: 'Monopol-Strategie für echte Innovation',
    steps: [
      { step_type: 'idea_validation', title: 'Contrarian Truth finden', description: 'Was glaubst du, das fast niemand sonst glaubt?', methodology: 'Zero to One', color: '#f59e0b', is_from_template: true, todos: [{ id: '1', text: 'Eigene Überzeugungen auflisten', completed: false }, { id: '2', text: 'Gegenargumente recherchieren', completed: false }, { id: '3', text: 'Contrarian Truth formulieren', completed: false }] },
      { step_type: 'market_research', title: 'Kleinen Markt dominieren', description: 'Identifiziere einen kleinen Markt, den du monopolisieren kannst', methodology: 'Zero to One', color: '#3b82f6', is_from_template: true, todos: [{ id: '1', text: 'Nischenmärkte identifizieren', completed: false }, { id: '2', text: 'Marktgröße prüfen', completed: false }, { id: '3', text: 'Dominanz-Strategie planen', completed: false }] },
      { step_type: 'business_model', title: '10x besser sein', description: 'Definiere wie dein Produkt 10x besser ist als Alternativen', methodology: 'Zero to One', color: '#8b5cf6', is_from_template: true, todos: [{ id: '1', text: 'Alternativen analysieren', completed: false }, { id: '2', text: '10x Faktor definieren', completed: false }, { id: '3', text: 'Differenzierung dokumentieren', completed: false }] },
      { step_type: 'team', title: 'Founding Team aufbauen', description: 'Stelle sicher, dass das Gründerteam komplementäre Skills hat', methodology: 'Zero to One', color: '#f97316', is_from_template: true, todos: getDefaultTodos('team') },
      { step_type: 'mvp', title: 'Proprietary Technology bauen', description: 'Entwickle einzigartige Technologie oder Prozesse', methodology: 'Zero to One', color: '#ef4444', is_from_template: true, todos: getDefaultTodos('mvp') },
      { step_type: 'growth', title: 'Distribution Strategy', description: 'Definiere deinen Vertriebskanal (Sales vs Marketing vs Viral)', methodology: 'Zero to One', color: '#06b6d4', is_from_template: true, todos: [{ id: '1', text: 'Vertriebskanäle analysieren', completed: false }, { id: '2', text: 'Beste Option wählen', completed: false }, { id: '3', text: 'Distribution Plan erstellen', completed: false }] },
      { step_type: 'funding', title: 'Durability planen', description: 'Plane für langfristige Marktdominanz', methodology: 'Zero to One', color: '#10b981', is_from_template: true, todos: getDefaultTodos('funding') },
    ]
  }
];