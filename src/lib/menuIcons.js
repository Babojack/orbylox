/**
 * Kennung -> Symbol.
 *
 * Getrennt von `menuModules.js`, damit dort keine Zeile React oder lucide
 * steht: Die Anordnungs-Rechnung soll sich ohne Browser pruefen lassen
 * (`npm run check:menu`), und ein Symbol laesst sich nicht pruefen.
 *
 * Die Symbole sind unveraendert die bisherigen — beim Einklappen der Leiste
 * bleiben genau diese stehen, damit man dieselbe Reihe wiedererkennt.
 */
import {
  LayoutDashboard, LayoutGrid, ListTodo, FileText, Shapes, FolderOpen,
  CalendarDays, MessageSquare, Video, Rocket, Puzzle,
} from 'lucide-react';

export const SYMBOL_VON = {
  dashboard: LayoutDashboard,
  feed: LayoutGrid,
  aufgaben: ListTodo,
  notizen: FileText,
  canvas: Shapes,
  dateien: FolderOpen,
  kalender: CalendarDays,
  chat: MessageSquare,
  meeting: Video,
  startup: Rocket,
  tools: Puzzle,
};
