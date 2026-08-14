import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle, BookOpen, Target, CheckSquare, Sparkles } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageProvider';

// Simple translation helper for German -> English
const translateText = (text) => {
  if (!text) return text;
  const translations = {
    'Beispiel:': 'Example:',
    'Beschreibe': 'Describe',
    'Identifiziere': 'Identify',
    'Finde': 'Find',
    'Liste': 'List',
    'Frage': 'Ask',
    'Teste': 'Test',
    'Definiere': 'Define',
    'Erstelle': 'Create',
    'Baue': 'Build',
    'Nutze': 'Use',
    'Wähle': 'Choose',
    'Überlege': 'Consider',
    'Prüfe': 'Check',
    'Analysiere': 'Analyze',
    'Dokumentiere': 'Document',
    'Formuliere': 'Formulate',
    'Vermeide': 'Avoid',
    'Stelle': 'Ask',
    'Suche': 'Search',
    'Achte': 'Pay attention',
    'Kalkuliere': 'Calculate',
    'Plane': 'Plan',
    'Studiere': 'Study',
    'Zeichne': 'Draw',
    'Visualisiere': 'Visualize',
    'Führe': 'Conduct',
    'Gehe': 'Go',
    'Gib': 'Give',
    'Verbessere': 'Improve',
    'Verkaufe': 'Sell',
    'Investiere': 'Invest',
    'Schaue': 'Look',
    'Beobachte': 'Observe',
    'Notiere': 'Note',
    'Segmentiere': 'Segment',
    'Eliminiere': 'Eliminate',
    'Implementiere': 'Implement',
    'Mappe': 'Map',
    'Transformiere': 'Transform',
    'Automatisiere': 'Automate',
    'Bereite': 'Prepare',
    'Widerstehe': 'Resist',
    'Schweige': 'Stay silent',
    'Lass': 'Let',
    'Vervollständige': 'Complete',
    'Kombiniere': 'Combine',
    'Lerne': 'Learn',
    'Zeigt': 'Shows',
    'Hilft': 'Helps',
  };
  
  let result = text;
  Object.entries(translations).forEach(([de, en]) => {
    result = result.replace(new RegExp(de, 'g'), en);
  });
  return result;
};

// English translations for methodology task explanations
const TASK_EXPLANATIONS_EN = {
  "Lean Startup": {
    "Leap-of-Faith Annahmen definieren": {
      description: "Identify the most critical assumptions that your business model needs to work.",
      why: "These assumptions are often unproven beliefs about your customers and their behavior. If they're wrong, your startup fails.",
      how: "List all assumptions. Ask yourself: Which of these MUST be true for my business to work?",
      example: "Example: 'Students would pay €9/month for a learning app' or 'Users share at least 3 photos daily'"
    },
    "Problem-Hypothese formulieren": {
      description: "Describe precisely which problem you want to solve for which target group.",
      why: "Without a clear problem, there's no reason for customers to buy your solution.",
      how: "Format: '[Target group] has the problem [X] because [reason]. This leads to [negative consequence].'",
      example: "Example: 'Students have problems with time management because they don't have an overview of all deadlines. This leads to stress and missed submissions.'"
    },
    "Value Hypothesis aufstellen": {
      description: "Define what value/benefit your product will deliver.",
      why: "You need to understand why customers should use your product instead of alternatives.",
      how: "Describe the main benefit customers get from your product.",
      example: "Example: 'Our app saves students 10 hours/week through automatic task planning.'"
    },
    "Growth Hypothesis definieren": {
      description: "How will your product acquire new users?",
      why: "A great product isn't enough - you need a plan for growth.",
      how: "Consider: Viral (users recruit users)? Paid (advertising)? Sticky (high retention)?",
      example: "Example: 'Users invite friends to create shared study groups (viral growth).'"
    },
    "Customer Discovery Interviews (min. 20)": {
      description: "Conduct at least 20 detailed conversations with potential customers.",
      why: "Only through real conversations do you understand if your problem is relevant.",
      how: "Ask open questions about their current problems and solution attempts. NOT about your idea!",
      example: "Questions: 'How do you currently manage your uni deadlines?', 'What frustrates you the most?', 'Have you tried any tools?'"
    },
    "Get out of the building": {
      description: "Leave your office/room and talk to real people in real life.",
      why: "Speculating at your laptop doesn't help. Real insights come from real conversations.",
      how: "Go to events, universities, cafés - anywhere your target group is. Approach them.",
      example: "Example: Go to the university library and ask 20 students how they study."
    },
    "Innovation Accounting Metriken definieren": {
      description: "Define which metrics really measure your progress.",
      why: "Vanity Metrics (e.g., total downloads) don't show real success. You need metrics that drive decisions.",
      how: "Choose metrics that show whether customers really use your product and derive value from it.",
      example: "Example: Instead of 'Downloads' → 'Active users after 7 days' or 'Average usage per week'"
    },
    "Kernhypothese für MVP festlegen": {
      description: "Define the ONE main assumption your MVP should test.",
      why: "An MVP should validate a specific hypothesis, not everything at once.",
      how: "Ask: 'What is the riskiest assumption I need to test now?'",
      example: "Example: 'Users are willing to pay for automatic time planning (not just use it for free).'"
    },
    "Minimum Viable Product bauen": {
      description: "Build the simplest version of your product that tests the core hypothesis.",
      why: "The faster you test, the faster you learn. Don't waste time on features nobody might want.",
      how: "Focus on ONE core function. Leave everything else out. Manual processes are OK.",
      example: "Example: Instead of full app → Simple Google Calendar bot that enters deadlines."
    },
    "Build-Measure-Learn Zyklus starten": {
      description: "Start the iterative process: Build → Measure → Learn → Repeat.",
      why: "Fast iteration is the core of Lean Startup. Each cycle brings you closer to the truth.",
      how: "1) Build MVP, 2) Give it to real users, 3) Measure behavior, 4) Learn what works, 5) Next iteration.",
      example: "Example: Version 1 → 10 users test → 70% don't use Feature X → Remove X, improve Y → Version 2"
    },
    "Iteration oder Pivot entscheiden": {
      description: "Based on data: Small changes (iteration) or complete direction change (pivot)?",
      why: "Sticking to a bad idea wastes time. But giving up too quickly does too.",
      how: "Look at your metrics. Is there progress? Are users learning the value?",
      example: "Iteration: Better onboarding. Pivot: Completely different target group (B2B instead of B2C)."
    },
    "Unit Economics berechnen": {
      description: "How much do you earn per customer vs. how much does a customer cost?",
      why: "If Customer Acquisition Cost > Lifetime Value → Your business doesn't work.",
      how: "CAC = Marketing costs / New customers. LTV = Average revenue per customer × Retention.",
      example: "Example: CAC = €20, LTV = €80 → Ratio 4:1 is good!"
    },
    "Growth Engine wählen (Viral/Sticky/Paid)": {
      description: "Choose your primary growth engine from the three options.",
      why: "Different engines need different strategies. Focusing on one is more effective.",
      how: "Viral: Users recruit users. Sticky: High retention. Paid: Paid acquisition with positive unit economics.",
      example: "Example: Dropbox = Viral (Referral Program), Netflix = Sticky (Content), Facebook Ads = Paid"
    },
    "A/B Tests durchführen": {
      description: "Systematically test different variants of your product.",
      why: "Opinions are useless. Data shows what really works.",
      how: "Change ONE element, split users 50/50, measure difference in target metric.",
      example: "Example: Button 'Start now' vs. 'Try for free' → Version B has +23% conversion"
    },
    "Skalierung planen": {
      description: "Plan how to get from 100 to 10,000 users.",
      why: "What works with 100 users breaks down with 10,000.",
      how: "Identify bottlenecks in tech, operations, support. Plan automation.",
      example: "Example: Manual support → Chatbot + FAQ. Plan server capacity."
    }
  },
  "The Mom Test": {
    "Riskanteste Annahmen auflisten": {
      description: "List all assumptions that could cause your concept to fail.",
      why: "You need to validate the biggest risks first, not the easy things.",
      how: "Ask: 'If this assumption is wrong, am I dead?' If yes → risky assumption.",
      example: "Example: 'Companies pay for our tool' is riskier than 'We can build it technically'."
    },
    "Fragen über Verhalten formulieren (nicht Meinungen)": {
      description: "Ask questions about past/current behavior, not hypothetical future.",
      why: "Opinions are worthless. What people SAY and what they DO is completely different.",
      how: "Good: 'How do you currently solve problem X?' Bad: 'Would you use feature Y?'",
      example: "Good: 'When did you last search for a learning app?' Bad: 'Would you buy our app?'"
    },
    "Leading Questions vermeiden": {
      description: "Ask neutral questions that don't suggest a particular answer.",
      why: "People want to be polite and say what you want to hear. This distorts everything.",
      how: "Avoid: 'Don't you also like...?' or 'Wouldn't it be great if...?'",
      example: "Bad: 'Doesn't problem X also annoy you?' Good: 'Tell me about your biggest challenges with Y.'"
    },
    "Auf vergangenes Verhalten fokussieren": {
      description: "Ask for concrete examples from the past.",
      why: "Past behavior is the best predictor of future behavior.",
      how: "Ask: 'When was the last time that...?' or 'Tell me about a specific case where...?'",
      example: "Example: 'Tell me about the last time you tried a new productivity app. What happened?'"
    },
    "10+ Casual Conversations führen": {
      description: "Have casual, informal conversations - no sales pitch, just listening.",
      why: "The more natural the conversation, the more honest the answers.",
      how: "No script. Ask open questions. Follow the conversation flow. Notes AFTER the conversation.",
      example: "Example: 'Hey, I'm researching learning apps. How do you actually study for exams?' → Just listen."
    },
    "Kein Pitch - nur Zuhören": {
      description: "Don't explain your solution. Just listen and learn.",
      why: "As soon as you pitch, people become polite and say what you want to hear.",
      how: "Resist the temptation to explain. Ask questions. Stay silent. Let them talk.",
      example: "If they ask 'What do you do?' → 'I'm researching time management. Tell me how you handle it.'"
    },
    "Schmerzpunkte identifizieren": {
      description: "Find out what really frustrates people and causes them pain.",
      why: "People only pay for solutions to real, painful problems.",
      how: "Pay attention to emotions. Where do they curse? What REALLY annoys them?",
      example: "Signal: 'I hate it so much when...' or 'This costs me hours every week...'"
    },
    "Patterns in Antworten finden": {
      description: "Look for recurring themes in your interviews.",
      why: "A problem is only a real problem if many people have it.",
      how: "After 10+ interviews: What statements keep coming up? Those are your patterns.",
      example: "Example: 8 out of 10 say 'I forget deadlines' → Pattern found!"
    },
    "Commitment fragen (Zeit/Geld/Reputation)": {
      description: "Ask for concrete commitments, not just interest.",
      why: "'That's interesting' means nothing. 'I'll give you €50 now' means everything.",
      how: "Ask for: Prepayment, beta test time, intro to their boss, public recommendation.",
      example: "Example: 'Would you pay €20 now for early access?' or 'Can you schedule 2h next week for testing?'"
    },
    "Pre-Orders oder Voranmeldungen sammeln": {
      description: "Sell your product BEFORE you've built it.",
      why: "Pre-orders are the strongest proof of real interest.",
      how: "Create landing page with description + price. Collect payments or binding registrations.",
      example: "Example: 'For €39 Early Bird price - Launch in 3 months. Secure now!' → 50 sales = validated!"
    },
    "Zahlungsbereitschaft validieren": {
      description: "Find out if and how much people would really pay.",
      why: "'I would use that' ≠ 'I would pay for that'.",
      how: "Test different price points. Ask about concrete budgets in their companies/lives.",
      example: "Example: 'What do you currently spend on similar tools?' or 'Would €9/month be worth it to you?'"
    },
    "Early Adopter Profil erstellen": {
      description: "Define exactly who your first paying customers will be.",
      why: "Not everyone is your customer. Early adopters are different from the masses.",
      how: "Describe: Demographics, psychographics, current behavior, budget, pain level.",
      example: "Example: 'CS students, 3rd-5th semester, already use 5+ apps, tech-savvy, pay for software.'"
    }
  }
};

// Detaillierte Erklärungen für jede Methodik-Aufgabe (German)
const TASK_EXPLANATIONS = {
  "Lean Startup": {
    "Leap-of-Faith Annahmen definieren": {
      description: "Identifiziere die kritischsten Annahmen, die dein Geschäftsmodell zum Funktionieren braucht.",
      why: "Diese Annahmen sind oft unbewiesene Überzeugungen über deine Kunden und deren Verhalten. Wenn sie falsch sind, scheitert dein Startup.",
      how: "Liste alle Annahmen auf. Frage dich: Welche davon MUSS wahr sein, damit mein Business funktioniert?",
      example: "Beispiel: 'Studenten würden 9€/Monat für eine Lern-App zahlen' oder 'Nutzer teilen täglich mindestens 3 Fotos'"
    },
    "Problem-Hypothese formulieren": {
      description: "Beschreibe präzise, welches Problem du für welche Zielgruppe lösen willst.",
      why: "Ohne klares Problem gibt es keinen Grund für Kunden, deine Lösung zu kaufen.",
      how: "Format: '[Zielgruppe] hat das Problem [X], weil [Grund]. Das führt zu [negativer Konsequenz].'",
      example: "Beispiel: 'Studierende haben Probleme beim Zeitmanagement, weil sie keine Übersicht über alle Deadlines haben. Das führt zu Stress und verpassten Abgaben.'"
    },
    "Value Hypothesis aufstellen": {
      description: "Definiere, welchen Wert/Nutzen dein Produkt liefern wird.",
      why: "Du musst verstehen, warum Kunden dein Produkt nutzen sollten statt Alternativen.",
      how: "Beschreibe den Hauptnutzen, den Kunden von deinem Produkt bekommen.",
      example: "Beispiel: 'Unsere App spart Studenten 10 Stunden/Woche durch automatische Aufgabenplanung.'"
    },
    "Growth Hypothesis definieren": {
      description: "Wie wird dein Produkt neue Nutzer gewinnen?",
      why: "Ein großartiges Produkt reicht nicht - du brauchst einen Plan für Wachstum.",
      how: "Überlege: Viral (Nutzer werben Nutzer)? Paid (Werbung)? Sticky (hohe Retention)?",
      example: "Beispiel: 'Nutzer laden Freunde ein, um gemeinsame Lerngruppen zu erstellen (virales Wachstum).'"
    },
    "Customer Discovery Interviews (min. 20)": {
      description: "Führe mindestens 20 ausführliche Gespräche mit potenziellen Kunden.",
      why: "Nur durch echte Gespräche verstehst du, ob dein Problem relevant ist.",
      how: "Stelle offene Fragen über ihre aktuellen Probleme und Lösungsversuche. NICHT über deine Idee!",
      example: "Fragen: 'Wie managst du aktuell deine Uni-Deadlines?', 'Was frustriert dich dabei am meisten?', 'Hast du schon Tools ausprobiert?'"
    },
    "Get out of the building": {
      description: "Verlasse dein Büro/Zimmer und sprich mit echten Menschen im echten Leben.",
      why: "Am Laptop spekulieren hilft nicht. Echte Insights kommen von echten Gesprächen.",
      how: "Geh zu Events, Unis, Cafés - überall wo deine Zielgruppe ist. Sprich sie an.",
      example: "Beispiel: Gehe in die Uni-Bibliothek und frage 20 Studenten, wie sie lernen."
    },
    "Innovation Accounting Metriken definieren": {
      description: "Lege fest, welche Metriken deinen Fortschritt wirklich messen.",
      why: "Vanity Metrics (z.B. Gesamt-Downloads) zeigen keinen echten Erfolg. Du brauchst Metriken, die Entscheidungen treiben.",
      how: "Wähle Metriken, die zeigen, ob Kunden dein Produkt wirklich nutzen und Wert daraus ziehen.",
      example: "Beispiel: Statt 'Downloads' → 'Aktive Nutzer nach 7 Tagen' oder 'Durchschnittliche Nutzung pro Woche'"
    },
    "Vanity Metrics vs. Actionable Metrics unterscheiden": {
      description: "Lerne den Unterschied zwischen bedeutungslosen und aussagekräftigen Metriken.",
      why: "Vanity Metrics fühlen sich gut an, helfen aber nicht bei Entscheidungen.",
      how: "Actionable Metrics sind spezifisch, zeigen Kausalität und erlauben Vorhersagen.",
      example: "Vanity: '10.000 Nutzer registriert' vs. Actionable: '40% der Nutzer öffnen die App täglich'"
    },
    "Kernhypothese für MVP festlegen": {
      description: "Definiere die EINE Hauptannahme, die dein MVP testen soll.",
      why: "Ein MVP soll eine spezifische Hypothese validieren, nicht alles auf einmal.",
      how: "Frage: 'Was ist die riskanteste Annahme, die ich jetzt testen muss?'",
      example: "Beispiel: 'Nutzer sind bereit, für automatische Zeitplanung zu zahlen (nicht nur kostenlos nutzen).'"
    },
    "Minimum Viable Product bauen": {
      description: "Baue die einfachste Version deines Produkts, die die Kernhypothese testet.",
      why: "Je schneller du testest, desto schneller lernst du. Verschwende keine Zeit mit Features, die vielleicht niemand will.",
      how: "Fokus auf EINE Kernfunktion. Alles andere weglassen. Manuelle Prozesse sind OK.",
      example: "Beispiel: Statt volle App → Einfacher Google Calendar Bot, der Deadlines einträgt."
    },
    "Build-Measure-Learn Zyklus starten": {
      description: "Starte den iterativen Prozess: Bauen → Messen → Lernen → Wiederholen.",
      why: "Schnelle Iteration ist der Kern von Lean Startup. Jeder Zyklus bringt dich näher zur Wahrheit.",
      how: "1) Baue MVP, 2) Gib es echten Nutzern, 3) Miss Verhalten, 4) Lerne, was funktioniert, 5) Nächste Iteration.",
      example: "Beispiel: Version 1 → 10 Nutzer testen → 70% nutzen Feature X nicht → Entferne X, verbessere Y → Version 2"
    },
    "Iteration oder Pivot entscheiden": {
      description: "Basierend auf Daten: Kleine Änderungen (Iteration) oder komplette Richtungsänderung (Pivot)?",
      why: "Festhalten an einer schlechten Idee verschwendet Zeit. Aber zu schnelles Aufgeben auch.",
      how: "Schaue auf deine Metriken. Gibt es Fortschritt? Lernen Nutzer den Wert kennen?",
      example: "Iteration: Besseres Onboarding. Pivot: Komplett andere Zielgruppe (B2B statt B2C)."
    },
    "Validated Learning dokumentieren": {
      description: "Schreibe auf, was du WIRKLICH gelernt hast (mit Daten belegt).",
      why: "Ohne Dokumentation wiederholst du Fehler und kannst Fortschritt nicht messen.",
      how: "Format: Hypothese → Experiment → Ergebnis → Lerning → Nächster Schritt",
      example: "Beispiel: 'Hypothese: Nutzer wollen Gamification. Test: 100 Nutzer mit/ohne. Ergebnis: +5% Retention. Learning: Gamification hilft marginal.'"
    },
    "Unit Economics berechnen": {
      description: "Wie viel verdienst du pro Kunde vs. wie viel kostet ein Kunde?",
      why: "Wenn Customer Acquisition Cost > Lifetime Value → Dein Business funktioniert nicht.",
      how: "CAC = Marketingkosten / Neue Kunden. LTV = Durchschnittlicher Umsatz pro Kunde * Retention.",
      example: "Beispiel: CAC = 20€, LTV = 80€ → Ratio 4:1 ist gut!"
    },
    "Sustainable Business Model entwickeln": {
      description: "Entwickle ein Geschäftsmodell, das langfristig profitabel ist.",
      why: "Schnelles Wachstum ohne Profitabilität führt zum Scheitern.",
      how: "Stelle sicher, dass Unit Economics positiv sind und du einen defensible Wettbewerbsvorteil hast.",
      example: "Beispiel: SaaS mit monatlicher Subscription + Netzwerkeffekten"
    },
    "Growth Engine wählen (Viral/Sticky/Paid)": {
      description: "Wähle deinen primären Wachstumsmotor aus den drei Optionen.",
      why: "Verschiedene Engines brauchen verschiedene Strategien. Fokus auf eine ist effektiver.",
      how: "Viral: Nutzer werben Nutzer. Sticky: Hohe Retention. Paid: Bezahlte Akquise mit positiver Unit Economics.",
      example: "Beispiel: Dropbox = Viral (Referral Program), Netflix = Sticky (Content), Facebook Ads = Paid"
    },
    "Engine of Growth optimieren": {
      description: "Verbessere systematisch deinen gewählten Wachstumsmotor.",
      why: "Kleine Verbesserungen im Engine führen zu exponentiellem Wachstum.",
      how: "Viral: Erhöhe Viral Coefficient. Sticky: Verbessere Retention Rate. Paid: Senke CAC.",
      example: "Beispiel Viral: Von 0.5 zu 1.2 invites per user → exponentielles Wachstum"
    },
    "A/B Tests durchführen": {
      description: "Teste systematisch verschiedene Varianten deines Produkts.",
      why: "Meinungen sind nutzlos. Daten zeigen, was wirklich funktioniert.",
      how: "Ändere EIN Element, teile Nutzer 50/50, messe Unterschied in Zielmetrik.",
      example: "Beispiel: Button 'Jetzt starten' vs. 'Kostenlos testen' → Version B hat +23% Conversion"
    },
    "Skalierung planen": {
      description: "Plane, wie du von 100 auf 10.000 Nutzer kommst.",
      why: "Was bei 100 Nutzern funktioniert, bricht bei 10.000 zusammen.",
      how: "Identifiziere Bottlenecks in Tech, Operations, Support. Plane Automatisierung.",
      example: "Beispiel: Manueller Support → Chatbot + FAQ. Server Capacity planen."
    }
  },
  "The Mom Test": {
    "Riskanteste Annahmen auflisten": {
      description: "Liste alle Annahmen auf, die dein Konzept zum Scheitern bringen könnten.",
      why: "Du musst die größten Risiken zuerst validieren, nicht die einfachen Dinge.",
      how: "Frage: 'Wenn diese Annahme falsch ist, bin ich dann tot?' Falls ja → riskante Annahme.",
      example: "Beispiel: 'Firmen zahlen für unser Tool' ist riskanter als 'Wir können es technisch bauen'."
    },
    "Fragen über Verhalten formulieren (nicht Meinungen)": {
      description: "Stelle Fragen über vergangenes/aktuelles Verhalten, nicht über hypothetische Zukunft.",
      why: "Meinungen sind wertlos. Was Leute SAGEN und was sie TUN ist völlig unterschiedlich.",
      how: "Gut: 'Wie löst du Problem X aktuell?' Schlecht: 'Würdest du Feature Y nutzen?'",
      example: "Gut: 'Wann hast du zuletzt nach einer Lern-App gesucht?' Schlecht: 'Würdest du unsere App kaufen?'"
    },
    "Leading Questions vermeiden": {
      description: "Stelle neutrale Fragen, die keine bestimmte Antwort suggerieren.",
      why: "Menschen wollen höflich sein und sagen, was du hören willst. Das verfälscht alles.",
      how: "Vermeide: 'Magst du nicht auch...?' oder 'Wäre es nicht toll, wenn...?'",
      example: "Schlecht: 'Nervt dich nicht auch das Problem X?' Gut: 'Erzähl mir von deinen größten Herausforderungen bei Y.'"
    },
    "Auf vergangenes Verhalten fokussieren": {
      description: "Frage nach konkreten Beispielen aus der Vergangenheit.",
      why: "Vergangenes Verhalten ist die beste Vorhersage für zukünftiges Verhalten.",
      how: "Frage: 'Wann war das letzte Mal, dass...?' oder 'Erzähl mir von einem konkreten Fall, wo...?'",
      example: "Beispiel: 'Erzähl mir vom letzten Mal, als du eine neue Produktivitäts-App ausprobiert hast. Was ist passiert?'"
    },
    "10+ Casual Conversations führen": {
      description: "Führe lockere, informelle Gespräche - kein Verkaufspitch, nur Zuhören.",
      why: "Je natürlicher das Gespräch, desto ehrlicher die Antworten.",
      how: "Kein Skript. Stelle offene Fragen. Folge dem Gesprächsfluss. Notizen NACH dem Gespräch.",
      example: "Beispiel: 'Hey, ich forsche über Lern-Apps. Wie lernst du eigentlich für Klausuren?' → Einfach zuhören."
    },
    "Kein Pitch - nur Zuhören": {
      description: "Erkläre NICHT deine Lösung. Höre nur zu und lerne.",
      why: "Sobald du pitchst, werden Leute höflich und sagen, was du hören willst.",
      how: "Widerstehe der Versuchung zu erklären. Stelle Fragen. Schweige. Lass sie reden.",
      example: "Wenn sie fragen 'Was machst du?' → 'Ich forsche über Zeitmanagement. Erzähl mir, wie du das handhabst.'"
    },
    "Schmerzpunkte identifizieren": {
      description: "Finde heraus, was Menschen wirklich frustriert und Schmerzen bereitet.",
      why: "Menschen zahlen nur für Lösungen zu echten, schmerzenden Problemen.",
      how: "Achte auf Emotionen. Wo fluchen sie? Was nervt sie WIRKLICH?",
      example: "Signal: 'Ich hasse es so sehr, wenn...' oder 'Das kostet mich jede Woche Stunden...'"
    },
    "Patterns in Antworten finden": {
      description: "Suche nach wiederkehrenden Themen in deinen Interviews.",
      why: "Ein Problem ist nur dann ein echtes Problem, wenn viele Leute es haben.",
      how: "Nach 10+ Interviews: Welche Aussagen kommen immer wieder? Das sind deine Patterns.",
      example: "Beispiel: 8 von 10 sagen 'Ich vergesse Deadlines' → Pattern gefunden!"
    },
    "Commitment fragen (Zeit/Geld/Reputation)": {
      description: "Frage nach konkreten Verpflichtungen, nicht nur nach Interesse.",
      why: "'Das ist interessant' bedeutet nichts. 'Ich gebe dir 50€ jetzt' bedeutet alles.",
      how: "Frage nach: Vorauszahlung, Beta-Test-Zeit, Intro zu ihrem Chef, öffentlicher Empfehlung.",
      example: "Beispiel: 'Würdest du jetzt 20€ zahlen für Early Access?' oder 'Kannst du 2h nächste Woche zum Testen einplanen?'"
    },
    "Advancement sichern (nächster Schritt)": {
      description: "Jedes Gespräch sollte zu einem konkreten nächsten Schritt führen.",
      why: "Ohne Commitment ist das Interesse nicht echt.",
      how: "Ende jedes Gespräch mit: 'Was ist der nächste Schritt?' oder 'Wann können wir uns wieder treffen?'",
      example: "Beispiel: 'Kann ich dir nächste Woche einen Prototyp zeigen?' oder 'Stellst du mich deinem Team vor?'"
    },
    "Pre-Orders oder Voranmeldungen sammeln": {
      description: "Verkaufe dein Produkt BEVOR du es gebaut hast.",
      why: "Pre-Orders sind der stärkste Beweis für echtes Interesse.",
      how: "Erstelle Landing Page mit Beschreibung + Preis. Sammle Zahlungen oder verbindliche Anmeldungen.",
      example: "Beispiel: 'Für 39€ Early Bird Preis - Launch in 3 Monaten. Jetzt sichern!' → 50 Verkäufe = validiert!"
    },
    "Problem-Solution Fit dokumentieren": {
      description: "Beweise mit Daten, dass deine Lösung das Problem wirklich löst.",
      why: "Ohne Problem-Solution Fit ist alles weitere Zeitverschwendung.",
      how: "Dokumentiere: Welches Problem? Wer hat es? Wie löst deine Solution es? Beweis?",
      example: "Beispiel: 'Problem: Studenten vergessen Deadlines (8/10 Interviews). Lösung: Auto-Reminder. Beweis: Beta-Nutzer haben 0 verpasste Deadlines in 4 Wochen.'"
    },
    "Zahlungsbereitschaft validieren": {
      description: "Finde heraus, ob und wie viel Menschen wirklich zahlen würden.",
      why: "'Ich würde das nutzen' ≠ 'Ich würde dafür zahlen'.",
      how: "Teste verschiedene Preispunkte. Frage nach konkreten Budgets in ihren Firmen/Leben.",
      example: "Beispiel: 'Was gibst du aktuell für ähnliche Tools aus?' oder 'Wäre dir das 9€/Monat wert?'"
    },
    "Early Adopter Profil erstellen": {
      description: "Definiere genau, wer deine ersten zahlenden Kunden sein werden.",
      why: "Nicht jeder ist dein Kunde. Early Adopters sind anders als die Masse.",
      how: "Beschreibe: Demografie, Psychografie, aktuelles Verhalten, Budget, Schmerzlevel.",
      example: "Beispiel: 'Informatik-Studenten, 3.-5. Semester, nutzen bereits 5+ Apps, technikaffin, zahlen für Software.'"
    }
  },
  "Zero to One": {
    "Contrarian Truth formulieren": {
      description: "Definiere eine Wahrheit, die du glaubst, aber die meisten Menschen für falsch halten.",
      why: "Echte Innovation kommt von Ideen, die andere übersehen oder für unmöglich halten.",
      how: "Vervollständige: 'Die meisten Leute glauben X. Aber die Wahrheit ist Y.'",
      example: "Beispiel: 'Die meisten denken, man braucht viel Geld für ein Startup. Wahrheit: Man braucht ein Monopol in einem kleinen Markt.'"
    },
    "Was glaubst du, das niemand sonst glaubt?": {
      description: "Die Kernfrage aus Zero to One. Was ist deine einzigartige Einsicht?",
      why: "Wenn alle einer Meinung sind, gibt es keinen Raum für außergewöhnliche Gewinne.",
      how: "Überlege, welche unpopuläre Wahrheit du über dein Feld kennst.",
      example: "Beispiel: 'Alle denken, Social Media braucht viele Features. Ich glaube: Weniger ist mehr (siehe BeReal).'"
    },
    "0 to 1 Innovation identifizieren": {
      description: "Erschaffe etwas NEUES (0→1), kopiere nicht Bestehendes (1→n).",
      why: "Kopieren führt zu Wettbewerb. Innovation führt zu Monopolen.",
      how: "Frage: 'Erschaffe ich etwas komplett Neues oder verbessere ich nur Bestehendes?'",
      example: "1→n: Besseres Uber. 0→1: Tesla (E-Autos zum Mainstream gemacht)"
    },
    "Kleinen Markt identifizieren": {
      description: "Finde einen kleinen, spezifischen Markt, den du dominieren kannst.",
      why: "Besser 100% von einem kleinen Markt als 1% von einem großen.",
      how: "Wähle einen Nischenmarkt, der klein genug ist zum Dominieren, aber groß genug zum Wachsen.",
      example: "Beispiel: Facebook startete nur mit Harvard-Studenten. PayPal nur mit eBay Power Sellern."
    },
    "Monopol-Potenzial prüfen": {
      description: "Kannst du in deinem gewählten Markt eine monopolartige Position erreichen?",
      why: "Monopole erzielen die größten Gewinne. Competition is for losers.",
      how: "Prüfe: Netzwerkeffekte? Economies of Scale? Proprietary Technology? Branding?",
      example: "Beispiel: Google = Proprietärer Algorithmus + Netzwerkeffekte (mehr Nutzer = bessere Ergebnisse)"
    },
    "Competition is for losers verstehen": {
      description: "Verstehe, warum perfekter Wettbewerb zu null Profit führt.",
      why: "In perfekt kompetitiven Märkten sinken Preise auf Kosten. Niemand verdient.",
      how: "Studiere: Warum haben Google/Apple/Amazon hohe Margen? → Monopole!",
      example: "Beispiel: Restaurant-Business (perfect competition, kaum Profit) vs. Google Search (Quasi-Monopol, riesige Margen)"
    },
    "Proprietary Technology entwickeln": {
      description: "Entwickle Technologie, die 10x besser ist als Alternativen.",
      why: "Nur marginale Verbesserungen reichen nicht für ein defensibles Business.",
      how: "Frage: 'Ist unsere Tech mindestens 10x besser in einer Dimension?'",
      example: "Beispiel: Google Search war 10x besser als Yahoo. Tesla Reichweite 10x besser als frühe E-Autos."
    },
    "10x Verbesserung definieren": {
      description: "In welcher Dimension ist dein Produkt 10x besser als die beste Alternative?",
      why: "10x ist notwendig, um Wechselkosten zu überwinden und echte Aufmerksamkeit zu bekommen.",
      how: "Identifiziere eine Metrik: Geschwindigkeit? Kosten? Benutzerfreundlichkeit? Genauigkeit?",
      example: "Beispiel: ChatGPT ist 10x schneller beim Schreiben als traditionelle Methoden."
    },
    "Technologischen Vorsprung sichern": {
      description: "Wie hältst du deinen technologischen Vorteil langfristig?",
      why: "Ohne defensible Technologie können andere dich schnell kopieren.",
      how: "Optionen: Patente, Trade Secrets, ständige Innovation, Netzwerkeffekte.",
      example: "Beispiel: Tesla hält Vorsprung durch ständige Innovation + eigene Batterietech + Daten von Millionen Meilen."
    },
    "Network Effects analysieren": {
      description: "Wird dein Produkt wertvoller, je mehr Menschen es nutzen?",
      why: "Netzwerkeffekte sind der stärkste defensible Advantage.",
      how: "Frage: Profitiert jeder Nutzer davon, dass es mehr Nutzer gibt?",
      example: "Beispiel: Facebook (mehr Freunde = mehr Wert), Uber (mehr Fahrer = kürzere Wartezeiten), WhatsApp (alle Freunde dort)"
    },
    "Economies of Scale planen": {
      description: "Wie sinken deine Kosten pro Einheit mit wachsender Größe?",
      why: "Größere Firmen mit Economies of Scale können kleinere unterbieten.",
      how: "Plane: Fixkosten über mehr Einheiten verteilen. Bessere Einkaufskonditionen. Automatisierung.",
      example: "Beispiel: Amazon kann niedrigere Preise bieten durch massive Economies of Scale in Logistik."
    },
    "Branding/Monopol aufbauen": {
      description: "Baue eine Marke, die synonym mit deiner Kategorie wird.",
      why: "Starkes Branding ist ein defensibler Vorteil, der schwer zu kopieren ist.",
      how: "Werde DIE Lösung in deiner Nische. Konsistentes, einzigartiges Branding.",
      example: "Beispiel: 'Google it' (Verb für Suchen), 'Uber' (Verb für Ride Sharing)"
    },
    "Founding Team mit komplementären Skills": {
      description: "Stelle ein Team zusammen, wo jeder unterschiedliche, notwendige Skills mitbringt.",
      why: "Genies brauchen Teams. Verschiedene Perspektiven + Skills = stärker.",
      how: "Ideal: Tech + Business + Design. Keine Überlappungen, aber gemeinsame Vision.",
      example: "Beispiel: Steve Jobs (Vision/Design) + Steve Wozniak (Tech) = Apple"
    },
    "Shared History prüfen": {
      description: "Haben Gründer eine gemeinsame Vergangenheit und Vertrauen?",
      why: "Startups sind hart. Du brauchst Menschen, die du durch Dick und Dünn kennst.",
      how: "Beste Co-Founder: Langjährige Freunde, frühere Kollegen, Mitschüler.",
      example: "Beispiel: PayPal Mafia - alle kannten sich von PayPal. Basis für spätere Erfolge."
    },
    "Mafia-Kultur aufbauen": {
      description: "Schaffe eine eng verbundene Kultur wie die PayPal Mafia.",
      why: "Starke, einzigartige Kultur = starker Competitive Advantage.",
      how: "Hire slowly. Nur Leute, die perfekt zur Mission passen. Schaffe Rituale und shared beliefs.",
      example: "Beispiel: PayPal Mafia - alle glaubten an dieselbe Vision. Resultat: Tesla, LinkedIn, YouTube, Yelp von Ex-PayPal Leuten."
    },
    "Distribution Strategie (Sales vs Marketing vs Viral)": {
      description: "Wähle die richtige Distributionsstrategie basierend auf deinem Produkt.",
      why: "Auch das beste Produkt stirbt ohne Distribution.",
      how: "Sales: Hoher Preis, komplexes Produkt. Marketing: Mittlerer Preis. Viral: Niedriger/kein Preis.",
      example: "Enterprise Software → Sales. Consumer App → Viral. SaaS → Marketing"
    },
    "Durability planen": {
      description: "Wie stellst du sicher, dass dein Vorteil langfristig hält?",
      why: "Temporäre Vorteile führen zu temporärem Erfolg.",
      how: "Kombiniere mehrere Vorteile: Tech + Network Effects + Brand + Economies of Scale.",
      example: "Beispiel: Google kombiniert Proprietary Tech + Network Effects (mehr Nutzer = bessere Daten) + Brand"
    },
    "Last Mover Advantage sichern": {
      description: "Sei der letzte bedeutende Innovator in deinem Markt, nicht der Erste.",
      why: "First Mover Advantage ist ein Mythos. Last Mover macht die letzten, entscheidenden Verbesserungen.",
      how: "Lerne von allen Fehlern der Ersten. Dann mache es richtig und dominiere.",
      example: "Beispiel: Google war nicht die erste Suchmaschine. Facebook nicht das erste Social Network. Aber beide wurden dominant."
    }
  },
  "Design Thinking": {
    "Empathize: Nutzer beobachten": {
      description: "Beobachte Nutzer in ihrer natürlichen Umgebung, ohne zu urteilen.",
      why: "Menschen können oft nicht artikulieren, was sie brauchen. Beobachtung zeigt es.",
      how: "Shadowing: Verbringe Zeit mit Nutzern. Beobachte ihr Verhalten. Notiere Überraschungen.",
      example: "Beispiel: Beobachte Studenten beim Lernen in der Bibliothek. Was machen sie? Welche Tools nutzen sie? Wo strugglen sie?"
    },
    "Define: Problem Statement formulieren": {
      description: "Formuliere ein klares, nutzer-zentriertes Problem Statement.",
      why: "Ohne klares Problem kannst du keine gute Lösung entwerfen.",
      how: "Format: '[Nutzer] braucht [Need] weil [Insight].'",
      example: "Beispiel: 'Studierende brauchen eine Übersicht über alle Deadlines, weil sie mehrere Kurse gleichzeitig verwalten müssen.'"
    },
    "How Might We Fragen erstellen": {
      description: "Verwandle Probleme in Fragen, die zu Lösungen inspirieren.",
      why: "HMW-Fragen öffnen den Ideenraum statt ihn zu limitieren.",
      how: "Format: 'How Might We [Ziel erreichen] for [Nutzer]?'",
      example: "Beispiel: 'How Might We es Studenten ermöglichen, alle Deadlines auf einen Blick zu sehen?'"
    },
    "User Interviews durchführen": {
      description: "Führe strukturierte Interviews mit Nutzern über ihre Erfahrungen.",
      why: "Empathie kommt durch Zuhören. Interviews geben dir tiefe Einblicke.",
      how: "Offene Fragen. Erzähl-mir-von-einem-Zeitpunkt-wo... Nach dem Warum fragen.",
      example: "Beispiel: 'Erzähl mir von deiner letzten Prüfungsphase. Was lief gut? Was war chaotisch?'"
    },
    "Empathy Map erstellen": {
      description: "Visualisiere, was Nutzer denken, fühlen, sagen und tun.",
      why: "Empathy Maps helfen dem Team, sich in Nutzer hineinzuversetzen.",
      how: "4 Quadranten: Says (was sie sagen), Thinks (was sie denken), Does (Verhalten), Feels (Emotionen).",
      example: "Says: 'Ich bin gut organisiert' / Thinks: 'Ich bin überfordert' / Does: Vergisst Deadlines / Feels: Gestresst"
    },
    "User Journey Map zeichnen": {
      description: "Zeichne die komplette Reise eines Nutzers durch dein Produkt/Service.",
      why: "Zeigt Pain Points, Moments of Truth und Optimierungsmöglichkeiten.",
      how: "Schritte: Awareness → Consideration → Purchase → Usage → Loyalty. Emotionen bei jedem Schritt.",
      example: "Beispiel: Student hört von App (Excited) → Download (Skeptisch) → Setup (Frustriert - zu lang) → Nutzt es (Happy) → Empfiehlt (Proud)"
    },
    "Ideate: Brainstorming Session": {
      description: "Generiere viele verschiedene Lösungsideen ohne sie zu bewerten.",
      why: "Quantität führt zu Qualität. Frühe Bewertung killt Kreativität.",
      how: "Regeln: Keine Kritik. Wilde Ideen willkommen. Auf Ideen anderer aufbauen. Quantität über Qualität.",
      example: "Beispiel: 100 Ideen in 1 Stunde. Von realistisch bis verrückt. Später filtern."
    },
    "Prototype: Low-Fidelity Prototyp": {
      description: "Baue einen schnellen, einfachen Prototyp zum Testen.",
      why: "Low-Fidelity ist schnell und billig zu ändern. Perfekt zum Lernen.",
      how: "Paper Sketches, Wireframes, Clickable Mockups in Figma. NICHT Code!",
      example: "Beispiel: Paper Prototype mit gezeichneten Screens. Nutzer 'klickt' auf Papier."
    },
    "Test: Mit echten Nutzern testen": {
      description: "Zeige deinen Prototyp echten Nutzern und beobachte ihre Reaktionen.",
      why: "Nur echte Nutzer geben echtes Feedback. Dein Team ist blind für Probleme.",
      how: "Beobachte: Wo strugglen sie? Was verstehen sie nicht? Was lieben sie?",
      example: "Beispiel: 5 Nutzer testen Prototyp. 4/5 verstehen Feature X nicht → Re-design."
    },
    "Iterate: Feedback einarbeiten": {
      description: "Verbessere deinen Prototyp basierend auf Nutzer-Feedback.",
      why: "Design ist iterativ. Jede Version sollte besser sein als die letzte.",
      how: "Priorisiere Feedback. Fix die größten Pain Points zuerst. Teste erneut.",
      example: "Beispiel: Version 1 → Tests → 3 große Probleme → Version 2 → Tests → 1 Problem bleibt → Version 3"
    },
    "Desirability prüfen (Wollen Nutzer es?)": {
      description: "Validiere, dass Nutzer deine Lösung tatsächlich wollen.",
      why: "Ohne Desirability gibt es kein Business.",
      how: "Teste: Klicken sie auf Prototypen? Melden sie sich an? Zahlen sie?",
      example: "Beispiel: Landing Page mit Signup → 15% Conversion = High Desirability"
    },
    "Viability prüfen (Ist es wirtschaftlich?)": {
      description: "Kann man damit Geld verdienen?",
      why: "Ein tolles Produkt, das nicht profitabel ist, ist kein Business.",
      how: "Kalkuliere: Revenue Streams, Kosten, Break-Even Point, Profitabilität.",
      example: "Beispiel: 10€/Monat Subscription, 5€ Kosten → 5€ Marge. 1000 Nutzer = 5000€/Monat Profit."
    },
    "Feasibility prüfen (Können wir es bauen?)": {
      description: "Haben wir die technischen/operativen Fähigkeiten, dies umzusetzen?",
      why: "Eine Idee ist nutzlos, wenn du sie nicht bauen kannst.",
      how: "Prüfe: Tech Stack machbar? Team Skills ausreichend? Zeit/Budget realistisch?",
      example: "Beispiel: KI-Feature geplant aber kein ML-Experte im Team → Feasibility fraglich."
    }
  },
  "Jobs to be Done": {
    "Job-to-be-Done identifizieren": {
      description: "Finde heraus, welchen 'Job' Kunden mit deinem Produkt 'erledigen' wollen.",
      why: "Menschen kaufen keine Produkte, sie 'hiren' sie, um einen Job zu erledigen.",
      how: "Frage: 'Wofür hiren Kunden dieses Produkt?' Nicht: Was ist es? Sondern: Was soll es erreichen?",
      example: "Beispiel: Menschen kaufen keine Bohrmaschine, sie hiren sie um Löcher zu machen. Eigentlich wollen sie: Bilder aufhängen!"
    },
    "Funktionale Jobs definieren": {
      description: "Welche praktischen Aufgaben soll dein Produkt erledigen?",
      why: "Der funktionale Job ist der offensichtliche Grund für den Kauf.",
      how: "Liste alle funktionalen Tasks auf, die dein Produkt erfüllen soll.",
      example: "Beispiel: Fitness App → Funktionaler Job: Training tracken, Kalorien zählen, Fortschritt messen"
    },
    "Emotionale Jobs definieren": {
      description: "Welche emotionalen Bedürfnisse erfüllt dein Produkt?",
      why: "Emotionale Jobs sind oft wichtiger als funktionale Jobs!",
      how: "Frage: Wie wollen sich Nutzer FÜHLEN bei der Nutzung?",
      example: "Beispiel: Fitness App → Emotionaler Job: Sich stark fühlen, Stolz sein, sich selbst beweisen"
    },
    "Soziale Jobs definieren": {
      description: "Wie beeinflusst dein Produkt, wie andere den Nutzer wahrnehmen?",
      why: "Menschen kümmern sich sehr darum, wie sie von anderen gesehen werden.",
      how: "Frage: Wie wollen Nutzer von anderen gesehen werden?",
      example: "Beispiel: Tesla → Sozialer Job: Als innovativ, umweltbewusst, erfolgreich gesehen werden"
    },
    "Switch Interviews führen": {
      description: "Interview Menschen über den Moment, als sie zu deinem Produkt (oder Konkurrent) gewechselt sind.",
      why: "Der 'Switch' Moment zeigt die wahren Motivationen und Job to be Done.",
      how: "Frage: 'Erzähl mir von dem Moment, als du dich entschieden hast, [Produkt] zu kaufen. Was war der Auslöser?'",
      example: "Beispiel: 'Ich habe Notion gekauft, als mein Professor sagte, ich soll besser organisiert sein' → Job: Andere beeindrucken + organisiert sein"
    },
    "Hiring/Firing Momente identifizieren": {
      description: "Wann 'hiren' Kunden dein Produkt und wann 'firen' sie es?",
      why: "Verstehe die Trigger für Nutzung und Abwanderung.",
      how: "Hiring Moment: Was war der Auslöser für erste Nutzung? Firing: Warum hören Leute auf?",
      example: "Hiring: Prüfungsphase beginnt. Firing: Semester endet, Motivation sinkt."
    },
    "Competing Against Luck verstehen": {
      description: "Verstehe, dass Kunden 'Fortschritt' wollen, nicht Features.",
      why: "Features sind irrelevant, wenn sie nicht zum gewünschten Fortschritt beitragen.",
      how: "Frage immer: Welchen Fortschritt will der Kunde in seiner Life Situation machen?",
      example: "Beispiel: Milkshake-Studie - Leute 'hiren' Morgen-Milkshakes nicht zum Genießen, sondern für langen Arbeitsweg ohne Hunger."
    },
    "Job Story formulieren": {
      description: "Formuliere den Job in einem standardisierten Format.",
      why: "Job Stories sind klarer als User Stories, weil sie Kontext + Motivation zeigen.",
      how: "Format: 'When [Situation], I want to [Motivation], so I can [Expected Outcome].'",
      example: "Beispiel: 'When ich morgens aufwache, I want to einen schnellen Überblick über meinen Tag, so I can mich mental vorbereiten.'"
    },
    "When _____, I want to _____, so I can _____": {
      description: "Das Job Story Template - der Kern der JTBD Methodik.",
      why: "Zeigt Situation, Motivation und gewünschtes Ergebnis - alles was du zum Lösen brauchst.",
      how: "Fülle für jeden identifizierten Job aus.",
      example: "Beispiel: 'When ich ein wichtiges Meeting habe, I want to schnell vorbereitet sein, so I can kompetent wirken.'"
    },
    "Outcome-Driven Innovation anwenden": {
      description: "Fokussiere auf die gewünschten Outcomes der Kunden, nicht auf Lösungen.",
      why: "Outcome-fokussierte Innovation hat höhere Erfolgsrate.",
      how: "Frage: 'Was versucht der Kunde zu erreichen?' Dann: 'Wie können wir helfen, das besser/schneller zu erreichen?'",
      example: "Beispiel: Outcome: 'Schnell gesund kochen' → Lösung könnte sein: Meal Kits, Rezept-App, oder Lieferservice"
    },
    "Unmet Needs priorisieren": {
      description: "Finde heraus, welche Bedürfnisse aktuell am schlechtesten erfüllt sind.",
      why: "Die größten Opportunities liegen bei high importance + low satisfaction.",
      how: "Frage Nutzer: Wie wichtig ist X? (1-10) Wie zufrieden bist du mit aktuellen Lösungen? (1-10)",
      example: "Beispiel: 'Schnelle Antworten' → Importance: 9, Satisfaction: 3 → OPPORTUNITY!"
    },
    "Importance vs. Satisfaction Matrix": {
      description: "Plotte alle Customer Needs auf eine Matrix: Wichtigkeit vs. Zufriedenheit.",
      why: "Zeigt visuell, wo die größten Opportunities sind.",
      how: "4 Quadranten: High/High (gut erfüllt), High/Low (Opportunity!), Low/High (Overkill), Low/Low (egal).",
      example: "Top-right (High Importance, Low Satisfaction) = deine besten Innovations-Opportunities"
    },
    "Job Map erstellen": {
      description: "Zeichne alle Schritte, die ein Kunde durchläuft, um seinen Job zu erledigen.",
      why: "Jeder Schritt ist eine Opportunity für Innovation.",
      how: "Schritte: Define → Locate → Prepare → Confirm → Execute → Monitor → Modify → Conclude.",
      example: "Beispiel Job: 'Gesund essen' → Locate (Rezept finden) → Prepare (Einkaufen) → Execute (Kochen) → jeder Schritt = Opportunity"
    }
  },
  "Blue Ocean Strategy": {
    "Red Ocean vs Blue Ocean analysieren": {
      description: "Identifiziere, ob du in einem Red Ocean (blutiger Wettbewerb) oder Blue Ocean (unberührter Markt) bist.",
      why: "Red Oceans sind überfüllt mit Konkurrenz. Blue Oceans bieten Raum für Wachstum.",
      how: "Red: Viele Konkurrenten, Preiskampf, sinkende Margen. Blue: Keine direkte Konkurrenz, neue Nachfrage.",
      example: "Beispiel: Red Ocean = Taxi Business. Blue Ocean = Uber (neue Kategorie)"
    },
    "Value Innovation identifizieren": {
      description: "Finde einen Weg, Wert zu schaffen UND Kosten zu senken gleichzeitig.",
      why: "Normale Innovation: Mehr Wert für mehr Kosten. Value Innovation: Mehr Wert für weniger Kosten!",
      how: "Eliminiere teure Features, die Kunden nicht schätzen. Füge günstige Features hinzu, die Kunden lieben.",
      example: "Beispiel: Southwest Airlines eliminierte Meals+Sitzplatzwahl (senkt Kosten), fügte Frequent Flights hinzu (erhöht Wert)"
    },
    "Non-Customers analysieren": {
      description: "Studiere Menschen, die NICHT deine Kunden sind. Warum nicht?",
      why: "Größtes Wachstum kommt oft von Non-Customers, nicht von bestehenden Kunden.",
      how: "3 Tiers: 1) Soon-to-be (am Rande), 2) Refusing (aktiv ablehnend), 3) Unexplored (nie in Betracht gezogen).",
      example: "Beispiel: Cirque du Soleil betrachtete Leute, die NICHT in Zirkus gehen (Theater-Fans) → Blue Ocean"
    },
    "Strategy Canvas erstellen": {
      description: "Visualisiere, wie du vs. Konkurrenten auf Schlüsselfaktoren abschneiden.",
      why: "Zeigt deutlich, wo alle gleich sind (Red Ocean) und wo du anders sein kannst (Blue Ocean).",
      how: "X-Achse: Wettbewerbsfaktoren. Y-Achse: Offering Level. Zeichne Kurven für dich und Konkurrenten.",
      example: "Beispiel: Alle Airlines hoch bei Meals, niedrig bei Convenience → Southwest genau umgekehrt"
    },
    "Four Actions Framework anwenden": {
      description: "Nutze die 4 Fragen: Eliminate, Reduce, Raise, Create.",
      why: "Systematische Methode, um neue Wertkurve zu finden.",
      how: "Eliminate: Was kann komplett weg? Reduce: Was ist überentwickelt? Raise: Was sollte über Standard? Create: Was völlig Neues?",
      example: "Beispiel: Eliminate: Lange Meetings. Reduce: Features. Raise: Speed. Create: Async collaboration"
    },
    "Eliminate-Reduce-Raise-Create Grid": {
      description: "Erstelle ein Grid mit allen Faktoren in den 4 Kategorien.",
      why: "Konkrete Aktionen für jeden Wettbewerbsfaktor.",
      how: "Liste alle Faktoren. Sortiere in die 4 Spalten basierend auf Analyse.",
      example: "Eliminate: Komplexe Verträge | Reduce: Meetings | Raise: Transparenz | Create: Real-time collaboration"
    },
    "ERRC Grid umsetzen": {
      description: "Implementiere die Entscheidungen aus deinem ERRC Grid im MVP.",
      why: "Von Theorie zur Praxis - baue was du geplant hast.",
      how: "Für jeden Punkt im Grid: Konkrete Umsetzung planen und bauen.",
      example: "Beispiel: 'Eliminate Meetings' → Baue Async Update Feature"
    },
    "Buyer Utility Map erstellen": {
      description: "Mappe alle Touchpoints in der Buyer Experience gegen Utility Levers.",
      why: "Findet versteckte Opportunities, wo Kunden frustriert sind.",
      how: "6 Stages (Kauf → Lieferung → Nutzung → Ergänzungen → Wartung → Entsorgung) x 6 Utility Levers.",
      example: "Beispiel: IKEA verbesserte 'Lieferung' (flache Pakete, selbst transport) → Competitive Advantage"
    },
    "Price Corridor of the Mass": {
      description: "Finde den optimalen Preispunkt für Massenmarkt-Appeal.",
      why: "Zu teuer: Keine Masse. Zu billig: Kein Profit.",
      how: "Analysiere Preis-Sensitivität. Welcher Preis zieht Masse an, ist aber profitabel?",
      example: "Beispiel: Netflix 10€/Monat statt 50€ → Massenmarkt erschlossen"
    },
    "Reconstruct Market Boundaries": {
      description: "Definiere deinen Markt neu, indem du traditionelle Grenzen ignorierst.",
      why: "Traditionelle Marktdefinitionen führen zu Red Ocean Denken.",
      how: "6 Paths Framework: Schaue über Industrien, strategische Gruppen, Buyer Groups, Komplementäre Angebote, Functional-Emotional Orientation, Zeit.",
      example: "Beispiel: Starbucks schaute über 'Coffee' hinaus → 'Third Place' zwischen Home und Work"
    },
    "Reach Beyond Existing Demand": {
      description: "Fokussiere auf Non-Customers statt auf bestehende Kunden.",
      why: "Größte Nachfrage ist oft bei Leuten, die aktuell NICHT kaufen.",
      how: "Analysiere, warum Non-Customers nicht kaufen. Adressiere diese Barrieren.",
      example: "Beispiel: Yellow Tail Wein machte Wein zugänglich für Leute, die Wein zu kompliziert/intimidierend fanden"
    },
    "Blue Ocean Strategy Canvas": {
      description: "Erstelle dein finales Strategy Canvas mit deiner neuen Wertkurve.",
      why: "Visualisiert deine Blue Ocean Strategie klar für das ganze Team.",
      how: "Zeichne: Aktuelle Industrie (alle Konkurrenten ähnlich) vs. Deine neue Kurve (deutlich anders).",
      example: "Beispiel: Deine Kurve sollte radikal anders aussehen - hoch wo andere niedrig, niedrig wo andere hoch, neue Faktoren"
    }
  },
  "Business Model Canvas": {
    "Value Proposition definieren": {
      description: "Was ist der einzigartige Wert, den du deinen Kunden lieferst?",
      why: "Die Value Proposition ist das Herz deines Business Models.",
      how: "Format: 'Wir helfen [Zielgruppe] [Ziel erreichen] durch [Lösung].'",
      example: "Beispiel: 'Wir helfen Studenten, organisiert zu bleiben durch automatische Deadline-Verwaltung.'"
    },
    "Customer Segments identifizieren": {
      description: "Wer sind deine verschiedenen Kundengruppen?",
      why: "Verschiedene Segmente haben verschiedene Needs, Zahlungsbereitschaften, Kanäle.",
      how: "Segmentiere nach: Verhalten, Demografie, Bedürfnisse, Budget.",
      example: "Beispiel: 1) Bachelor-Studenten (budget-sensitiv), 2) Master-Studenten (zahlen mehr), 3) Doktoranden (brauchen Kollaboration)"
    },
    "Problem-Solution Fit prüfen": {
      description: "Passt deine Lösung wirklich zum Problem deiner Kunden?",
      why: "Ohne Problem-Solution Fit ist alles weitere sinnlos.",
      how: "Teste: Löst es das Problem wirklich? Ist es 10x besser als aktuelle Lösungen?",
      example: "Beispiel: Problem: Deadlines vergessen. Lösung: Auto-Reminder. Fit? Ja! → Weitermachen"
    },
    "Channels analysieren": {
      description: "Über welche Kanäle erreichst du deine Kunden?",
      why: "Das beste Produkt stirbt ohne funktionierende Vertriebskanäle.",
      how: "Liste alle möglichen Kanäle: Social Media, Content, Sales, Partner, etc.",
      example: "Beispiel: Studenten-App → Instagram, TikTok, Uni-Kooperationen, Mund-zu-Mund"
    },
    "Customer Relationships definieren": {
      description: "Wie interagierst du mit deinen Kunden? Automatisiert? Persönlich? Community?",
      why: "Die Art der Beziehung beeinflusst Kosten, Retention und Satisfaction.",
      how: "Optionen: Personal Assistance, Self-Service, Automated, Communities, Co-Creation.",
      example: "Beispiel: SaaS = Self-Service + Automated Email + Community Forum"
    },
    "Early Adopter identifizieren": {
      description: "Wer werden deine ersten begeisterten Nutzer sein?",
      why: "Early Adopters verzeihen Bugs, geben Feedback, empfehlen dich weiter.",
      how: "Suche nach: Technikaffinen, Problem-geplagten, Visionären in deiner Zielgruppe.",
      example: "Beispiel: Informatik-Studenten, die 5+ Apps nutzen und aktiv nach Lösungen suchen"
    },
    "Value Proposition Canvas erstellen": {
      description: "Detaillierte Version der Value Proposition mit Customer Jobs, Pains, Gains.",
      why: "Tieferes Verständnis von Customer Fit.",
      how: "Rechte Seite: Customer Jobs, Pains, Gains. Linke Seite: Deine Products/Services, Pain Relievers, Gain Creators.",
      example: "Customer Pain: 'Deadlines vergessen' → Pain Reliever: 'Auto-Notifications 3 Tage vorher'"
    },
    "Minimum Viable Product definieren": {
      description: "Definiere die absolut minimale Version, die Wert liefert.",
      why: "Zu viele Features verzögern Launch und verschwenden Ressourcen.",
      how: "Frage: 'Was ist das MINIMUM, um unsere Value Proposition zu liefern?'",
      example: "Beispiel: Nicht: Volle App mit 20 Features. Sondern: Eine einzige Funktion die wirklich funktioniert."
    },
    "Key Activities für MVP festlegen": {
      description: "Welche Aktivitäten musst du durchführen, um deine Value Proposition zu liefern?",
      why: "Zeigt, was du wirklich tun musst - verhindert Fokus auf unwichtige Dinge.",
      how: "Liste alle notwendigen Aktivitäten: Development, Marketing, Support, etc.",
      example: "Beispiel: App Development, User Testing, Content Creation, Customer Support"
    },
    "Revenue Streams definieren": {
      description: "Wie verdienst du Geld? Welche Modelle nutzt du?",
      why: "Kein Revenue = kein Business (langfristig).",
      how: "Optionen: Subscription, Transaction Fee, Licensing, Ads, Freemium, Pay-per-use.",
      example: "Beispiel: Freemium (Basis kostenlos) + 9€/Monat Premium + 49€/Jahr für Pro"
    },
    "Cost Structure kalkulieren": {
      description: "Was sind deine Haupt-Kostenblöcke?",
      why: "Kosten müssen niedriger sein als Revenue für Profitabilität.",
      how: "Kategorien: Fixed Costs (Server, Gehälter) + Variable Costs (per User).",
      example: "Beispiel: 5000€/Monat Fix (Server, 1 Dev) + 0,50€ pro active User"
    },
    "Key Resources identifizieren": {
      description: "Welche Assets brauchst du absolut, um dein Business zu betreiben?",
      why: "Zeigt, welche Investments kritisch sind.",
      how: "Kategorien: Physical, Intellectual (IP, Brand), Human, Financial.",
      example: "Beispiel: Entwickler-Team (Human), App Code (Intellectual), 50k€ Runway (Financial)"
    },
    "Key Partners auswählen": {
      description: "Wer sind strategische Partner für dein Business?",
      why: "Partner können Dinge liefern, die du nicht selbst bauen musst.",
      how: "Überlege: Supplier? Tech-Partner? Marketing-Partner? Distribution?",
      example: "Beispiel: Uni-Partnerschaften (Marketing), AWS (Infrastructure), Stripe (Payments)"
    }
  },
  "Customer Development": {
    "Customer Discovery starten": {
      description: "Phase 1 von Customer Development: Finde heraus, wer deine Kunden sind und was sie brauchen.",
      why: "Du kannst nicht verkaufen, wenn du nicht verstehst, wer kauft und warum.",
      how: "Hypothesen aufstellen → Rausgehen → Testen → Lernen → Pivoten wenn nötig.",
      example: "Beispiel: 100 Interviews → 'Wir dachten Studenten sind Zielgruppe' → 'Eigentlich sind es Doktoranden'"
    },
    "Problem-Solution Hypothese aufstellen": {
      description: "Formuliere deine initiale Hypothese über Problem und Lösung.",
      why: "Eine klare Hypothese ermöglicht fokussiertes Testen.",
      how: "Problem: [Zielgruppe] hat [Problem]. Lösung: Wir lösen es mit [Produkt].",
      example: "Beispiel: 'Freelancer haben Probleme mit Invoicing. Wir lösen es mit automatisierter Invoice-Software.'"
    },
    "Earlyvangelists finden": {
      description: "Finde die ersten fanatischen Nutzer, die dein Produkt evangelisieren.",
      why: "Earlyvangelists kaufen unfertige Produkte, geben Feedback und werben für dich.",
      how: "Merkmale: Haben das Problem akut, suchten bereits nach Lösungen, technikaffin, Budget vorhanden.",
      example: "Beispiel: Leute, die schon 3 andere Tools ausprobiert haben und immer noch unzufrieden sind"
    },
    "Customer Validation durchführen": {
      description: "Phase 2: Validiere, dass dein Business Model wiederholbar und skalierbar ist.",
      why: "Discovery zeigt Problem-Solution Fit. Validation zeigt Product-Market Fit.",
      how: "Verkaufe an echte Kunden (nicht nur Friends & Family). Dokumentiere Sales Process.",
      example: "Beispiel: 50 zahlende Kunden über denselben Prozess gewonnen = validiert!"
    },
    "Repeatable Sales Process finden": {
      description: "Finde einen Verkaufsprozess, der wiederholbar skaliert.",
      why: "Ohne wiederholbaren Prozess kannst du nicht skalieren.",
      how: "Dokumentiere jeden Step: Lead Gen → Qualification → Demo → Close. Optimiere jeden Step.",
      example: "Beispiel: Cold Email → Demo Call → Free Trial → Conversion. Conversion Rate: 15% = wiederholbar!"
    },
    "Product-Market Fit testen": {
      description: "Hast du ein Produkt, das einen starken Markt erfüllt?",
      why: "Product-Market Fit ist THE Meilenstein für Startups.",
      how: "Teste: Hohe Retention? Organisches Wachstum? Kunden sind enttäuscht, wenn sie es verlieren?",
      example: "Marc Andreessen: 'You can feel Product-Market Fit when it happens' - überwältigende Nachfrage"
    },
    "Customer Creation starten": {
      description: "Phase 3: Skaliere deine Customer Acquisition.",
      why: "Jetzt kannst du Gas geben, weil du weißt, was funktioniert.",
      how: "Investiere in Marketing und Sales. Skaliere was funktioniert.",
      example: "Beispiel: Wenn Cold Email funktioniert → Hire 3 SDRs und sende 1000 Emails/Tag"
    },
    "Demand Creation vs. Demand Fulfillment": {
      description: "Musst du Nachfrage erschaffen oder bestehendem Bedarf begegnen?",
      why: "Demand Creation ist teurer und langsamer. Demand Fulfillment ist effizienter.",
      how: "Neues Problem (niemand sucht danach) = Creation. Bestehendes Problem = Fulfillment.",
      example: "Creation: Erste Smartphones (mussten Bedarf erschaffen). Fulfillment: 100ste Todo-App (Bedarf existiert)"
    },
    "Company Building Phase": {
      description: "Phase 4: Baue eine skalierbare Organisation.",
      why: "Von Startup zu Company - Prozesse, Struktur, Kultur aufbauen.",
      how: "Hire, Prozesse etablieren, Kultur definieren, Skalierungsinfrastruktur.",
      example: "Beispiel: Von 5 Leuten in Garage → Büro, HR, strukturierte Meetings, OKRs"
    },
    "Pivot oder Proceed entscheiden": {
      description: "Basierend auf Learnings: Richtung ändern oder fortfahren?",
      why: "Kritischste Entscheidung. Falsch = verschwendete Zeit.",
      how: "Schaue auf Daten. Gibt es Traktion? Lernen Kunden den Wert? Kaufen sie?",
      example: "Pivot: Instagram war erst Check-in App → Pivot zu Foto-Sharing. Proceed: Metrics zeigen Wachstum → weitermachen"
    },
    "Business Model validieren": {
      description: "Funktioniert dein komplettes Business Model in der Praxis?",
      why: "Alle Teile müssen zusammenarbeiten: Value Prop, Channels, Revenue, Costs.",
      how: "Teste alle Komponenten: Akquisition funktioniert? Kosten unter Kontrolle? Kunden bleiben?",
      example: "Beispiel: CAC 20€, LTV 100€, Retention 85% nach 6 Monaten = Business Model funktioniert!"
    },
    "Scalable Business Model aufbauen": {
      description: "Transformiere von validiertem Modell zu skalierbarem System.",
      why: "Was bei 10 Kunden funktioniert, muss auch bei 10.000 funktionieren.",
      how: "Automatisiere, systematisiere, dokumentiere. Bereite für Wachstum vor.",
      example: "Beispiel: Manueller Onboarding → Automatisierter Onboarding Flow. Personal Support → AI Chat + Help Center"
    }
  }
};

// Generische Erklärungen für Standard-Aufgaben (ohne Methodik)
const DEFAULT_EXPLANATIONS = {
  de: {
    "Problem-Hypothese formulieren": {
      description: "Beschreibe präzise, welches Problem du für welche Zielgruppe lösen willst.",
      why: "Ohne klares Problem gibt es keinen Grund für Kunden, deine Lösung zu kaufen.",
      how: "Format: '[Zielgruppe] hat das Problem [X], weil [Grund]. Das führt zu [negativer Konsequenz].'",
      example: "Beispiel: 'Studierende haben Probleme beim Zeitmanagement, weil sie keine Übersicht über alle Deadlines haben.'"
    },
    "10 potenzielle Kunden identifizieren": {
      description: "Finde 10 echte Menschen, die potenziell dein Problem haben könnten.",
      why: "Ohne echte Kunden zu kennen, baust du ins Blaue.",
      how: "Suche in deinem Netzwerk, auf LinkedIn, in Foren, bei Events. Notiere Namen und Kontaktdaten.",
      example: "Beispiel: Liste mit 10 Studenten aus deinem Umfeld, die über Deadline-Stress klagen."
    },
    "Kundeninterviews durchführen": {
      description: "Führe Gespräche mit potenziellen Kunden über ihre Probleme.",
      why: "Nur durch echte Gespräche verstehst du, ob dein Problem relevant ist.",
      how: "Stelle offene Fragen: 'Wie machst du X aktuell?', 'Was frustriert dich dabei?'",
      example: "Beispiel: 'Erzähl mir, wie du deine Uni-Deadlines managst. Was funktioniert? Was nicht?'"
    },
    "Ergebnisse dokumentieren": {
      description: "Schreibe auf, was du gelernt hast.",
      why: "Ohne Dokumentation vergisst du wichtige Insights.",
      how: "Notiere: Wer? Was gesagt? Welche Patterns? Was überrascht?",
      example: "Beispiel: '8 von 10 sagten, sie vergessen Deadlines regelmäßig.'"
    },
    "Marktgröße recherchieren": {
      description: "Finde heraus, wie groß dein potenzieller Markt ist.",
      why: "Du musst wissen, ob genug Menschen dein Problem haben.",
      how: "TAM (Total), SAM (Serviceable), SOM (Obtainable). Nutze Statistiken und Studien.",
      example: "Beispiel: '3 Mio. Studierende in DE, 40% nutzen Produktivitäts-Apps = 1.2 Mio. SAM'"
    },
    "Wettbewerbsanalyse erstellen": {
      description: "Analysiere, wer sonst noch dieses Problem löst.",
      why: "Du musst wissen, gegen wen du antrittst.",
      how: "Liste Konkurrenten, ihre Stärken/Schwächen, Preise, Features.",
      example: "Beispiel: 'Todoist: stark bei Features, aber komplex. Notion: flexibel, aber überladen.'"
    },
    "Zielgruppen-Personas definieren": {
      description: "Erstelle detaillierte Profile deiner idealen Kunden.",
      why: "Hilft dem Team, sich in Kunden hineinzuversetzen.",
      how: "Name, Alter, Job, Ziele, Frustrationen, Verhalten, Budget.",
      example: "Beispiel: 'Lisa, 23, BWL-Studentin, gestresst wegen Prüfungen, technikaffin, 10€/Monat Budget'"
    },
    "Markttrends analysieren": {
      description: "Verstehe, wohin sich der Markt entwickelt.",
      why: "Bau nicht für den Markt von gestern.",
      how: "Google Trends, Branchenberichte, Experten-Meinungen.",
      example: "Beispiel: 'Remote Work steigt → mehr Bedarf an digitaler Organisation'"
    },
    "Business Model Canvas ausfüllen": {
      description: "Visualisiere dein gesamtes Geschäftsmodell auf einer Seite.",
      why: "Hilft, alle Aspekte des Business zu durchdenken.",
      how: "9 Felder: Value Prop, Segments, Channels, Relationships, Revenue, Resources, Activities, Partners, Costs.",
      example: "Beispiel: Fülle jedes Feld mit 3-5 Punkten aus."
    },
    "Einnahmequellen definieren": {
      description: "Wie verdienst du Geld?",
      why: "Ohne Revenue kein Business.",
      how: "Optionen: Subscription, Einmalkauf, Freemium, Werbung, Transaktionsgebühr.",
      example: "Beispiel: '9€/Monat Subscription + 49€/Jahr für Pro-Features'"
    },
    "Kostenstruktur kalkulieren": {
      description: "Was kostet es, dein Business zu betreiben?",
      why: "Kosten müssen niedriger sein als Einnahmen.",
      how: "Fixkosten (Server, Gehälter) + Variable Kosten (pro Nutzer).",
      example: "Beispiel: '500€/Monat Server + 2000€/Monat für Entwickler'"
    },
    "Value Proposition formulieren": {
      description: "Was ist der einzigartige Wert, den du lieferst?",
      why: "Kunden müssen verstehen, warum sie dich wählen sollten.",
      how: "Format: 'Wir helfen [Zielgruppe] [Ziel erreichen] durch [Lösung].'",
      example: "Beispiel: 'Wir helfen Studenten, keine Deadline mehr zu verpassen, durch smarte Reminder.'"
    },
    "Kernfunktionen definieren": {
      description: "Welche Features sind absolut essentiell?",
      why: "Fokus auf das Wichtigste spart Zeit und Geld.",
      how: "Liste alles auf, dann streiche 80%. Was bleibt, ist der Kern.",
      example: "Beispiel: 'Nur Deadline-Import und Reminder. Keine Kalenderansicht, keine Sharing-Features.'"
    },
    "Prototyp erstellen": {
      description: "Baue eine erste, einfache Version.",
      why: "Schnell testen ist besser als lange planen.",
      how: "Paper Prototype, Figma Mockup, oder einfachster Code.",
      example: "Beispiel: 'Clickable Mockup in Figma mit 5 Screens.'"
    },
    "MVP mit Nutzern testen": {
      description: "Gib echten Menschen dein Produkt zum Testen.",
      why: "Nur echte Nutzer zeigen echte Probleme.",
      how: "5-10 Testnutzer. Beobachte, frage, lerne.",
      example: "Beispiel: 'Lisa testet App 1 Woche, gibt tägliches Feedback.'"
    },
    "Feedback einarbeiten": {
      description: "Verbessere basierend auf dem Feedback.",
      why: "Iteratives Verbessern führt zu besserem Produkt.",
      how: "Priorisiere Feedback, fix die wichtigsten Probleme zuerst.",
      example: "Beispiel: '4/5 verstanden Button nicht → Button redesignen'"
    }
  },
  en: {
    "Problem-Hypothese formulieren": {
      description: "Describe precisely which problem you want to solve for which target group.",
      why: "Without a clear problem, there is no reason for customers to buy your solution.",
      how: "Format: '[Target group] has the problem [X] because [reason]. This leads to [negative consequence].'",
      example: "Example: 'Students have problems with time management because they don't have an overview of all deadlines.'"
    },
    "10 potenzielle Kunden identifizieren": {
      description: "Find 10 real people who could potentially have your problem.",
      why: "Without knowing real customers, you're building blindly.",
      how: "Search in your network, on LinkedIn, in forums, at events. Note names and contact details.",
      example: "Example: List of 10 students from your environment who complain about deadline stress."
    },
    "Kundeninterviews durchführen": {
      description: "Have conversations with potential customers about their problems.",
      why: "Only through real conversations do you understand if your problem is relevant.",
      how: "Ask open questions: 'How do you currently do X?', 'What frustrates you about it?'",
      example: "Example: 'Tell me how you manage your uni deadlines. What works? What doesn't?'"
    },
    "Ergebnisse dokumentieren": {
      description: "Write down what you have learned.",
      why: "Without documentation, you forget important insights.",
      how: "Note: Who? What was said? What patterns? What surprised you?",
      example: "Example: '8 out of 10 said they regularly forget deadlines.'"
    },
    "Marktgröße recherchieren": {
      description: "Find out how big your potential market is.",
      why: "You need to know if enough people have your problem.",
      how: "TAM (Total), SAM (Serviceable), SOM (Obtainable). Use statistics and studies.",
      example: "Example: '3 million students in Germany, 40% use productivity apps = 1.2 million SAM'"
    },
    "Wettbewerbsanalyse erstellen": {
      description: "Analyze who else is solving this problem.",
      why: "You need to know who you're competing against.",
      how: "List competitors, their strengths/weaknesses, prices, features.",
      example: "Example: 'Todoist: strong features but complex. Notion: flexible but overloaded.'"
    },
    "Zielgruppen-Personas definieren": {
      description: "Create detailed profiles of your ideal customers.",
      why: "Helps the team empathize with customers.",
      how: "Name, age, job, goals, frustrations, behavior, budget.",
      example: "Example: 'Lisa, 23, business student, stressed about exams, tech-savvy, €10/month budget'"
    },
    "Markttrends analysieren": {
      description: "Understand where the market is heading.",
      why: "Don't build for yesterday's market.",
      how: "Google Trends, industry reports, expert opinions.",
      example: "Example: 'Remote work is increasing → more need for digital organization'"
    },
    "Business Model Canvas ausfüllen": {
      description: "Visualize your entire business model on one page.",
      why: "Helps think through all aspects of the business.",
      how: "9 fields: Value Prop, Segments, Channels, Relationships, Revenue, Resources, Activities, Partners, Costs.",
      example: "Example: Fill each field with 3-5 points."
    },
    "Einnahmequellen definieren": {
      description: "How do you make money?",
      why: "No revenue means no business.",
      how: "Options: Subscription, one-time purchase, freemium, advertising, transaction fee.",
      example: "Example: '€9/month subscription + €49/year for pro features'"
    },
    "Kostenstruktur kalkulieren": {
      description: "What does it cost to run your business?",
      why: "Costs must be lower than revenue.",
      how: "Fixed costs (servers, salaries) + variable costs (per user).",
      example: "Example: '€500/month server + €2000/month for developers'"
    },
    "Value Proposition formulieren": {
      description: "What is the unique value you deliver?",
      why: "Customers need to understand why they should choose you.",
      how: "Format: 'We help [target group] [achieve goal] through [solution].'",
      example: "Example: 'We help students never miss a deadline again through smart reminders.'"
    },
    "Kernfunktionen definieren": {
      description: "Which features are absolutely essential?",
      why: "Focus on the most important saves time and money.",
      how: "List everything, then cut 80%. What remains is the core.",
      example: "Example: 'Only deadline import and reminders. No calendar view, no sharing features.'"
    },
    "Prototyp erstellen": {
      description: "Build a first, simple version.",
      why: "Quick testing is better than long planning.",
      how: "Paper prototype, Figma mockup, or simplest code.",
      example: "Example: 'Clickable mockup in Figma with 5 screens.'"
    },
    "MVP mit Nutzern testen": {
      description: "Give real people your product to test.",
      why: "Only real users show real problems.",
      how: "5-10 test users. Observe, ask, learn.",
      example: "Example: 'Lisa tests app for 1 week, gives daily feedback.'"
    },
    "Feedback einarbeiten": {
      description: "Improve based on feedback.",
      why: "Iterative improvement leads to better product.",
      how: "Prioritize feedback, fix the most important problems first.",
      example: "Example: '4/5 didn't understand button → redesign button'"
    }
  }
};

export default function TaskExplanationDialog({ task, methodology, isOpen, onClose }) {
  const { language } = useLanguage();
  
  if (!task) return null;
  
  // UI labels based on language
  const labels = language === 'de' ? {
    whatIsThis: 'Was ist das?',
    whyImportant: 'Warum ist das wichtig?',
    howToDo: 'Wie mache ich das?',
    example: 'Beispiel',
    understood: 'Verstanden'
  } : {
    whatIsThis: 'What is this?',
    whyImportant: 'Why is this important?',
    howToDo: 'How do I do this?',
    example: 'Example',
    understood: 'Got it'
  };
  
  // Erst in der Methodik suchen, dann in Default
  let explanation = null;
  
  // For methodology tasks - use English translations if language is English
  if (methodology && TASK_EXPLANATIONS[methodology] && TASK_EXPLANATIONS[methodology][task]) {
    if (language === 'en' && TASK_EXPLANATIONS_EN[methodology] && TASK_EXPLANATIONS_EN[methodology][task]) {
      explanation = TASK_EXPLANATIONS_EN[methodology][task];
    } else {
      explanation = TASK_EXPLANATIONS[methodology][task];
    }
  }
  
  // Check default explanations
  if (!explanation) {
    const defaultExpl = DEFAULT_EXPLANATIONS[language] || DEFAULT_EXPLANATIONS.en;
    explanation = defaultExpl[task];
  }
  
  // Fallback: Generic explanation
  if (!explanation) {
    explanation = language === 'de' ? {
      description: `${task} - Ein wichtiger Schritt in deiner Startup-Journey.`,
      why: "Jeder Schritt bringt dich näher zu einem validierten Geschäftsmodell.",
      how: "Definiere klare Ziele, setze um, dokumentiere Learnings.",
      example: "Tipp: Fang klein an, teste schnell, iteriere basierend auf Feedback."
    } : {
      description: `${task} - An important step in your startup journey.`,
      why: "Every step brings you closer to a validated business model.",
      how: "Define clear goals, execute, document learnings.",
      example: "Tip: Start small, test quickly, iterate based on feedback."
    };
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-[#ef5a24]" />
            {task}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4 mt-4">
            {/* Description */}
            <div className="bg-[#f5f5f5] border border-[#ef5a24]/30 rounded-lg p-4">
              <h3 className="font-semibold text-[#ef5a24] mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {labels.whatIsThis}
              </h3>
              <p className="text-slate-700 leading-relaxed">{explanation.description}</p>
            </div>

            {/* Why */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" />
                {labels.whyImportant}
              </h3>
              <p className="text-slate-700 leading-relaxed">{explanation.why}</p>
            </div>

            {/* How */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                {labels.howToDo}
              </h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{explanation.how}</p>
            </div>

            {/* Example */}
            <div className="bg-[#f5f5f5] border border-[#ef5a24]/30 rounded-lg p-4">
              <h3 className="font-semibold text-[#ef5a24] mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {labels.example}
              </h3>
              <p className="text-slate-700 leading-relaxed italic">{explanation.example}</p>
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button onClick={onClose} className="w-full">
            {labels.understood}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}