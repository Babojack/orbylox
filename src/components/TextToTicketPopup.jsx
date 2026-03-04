import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Loader2, Sparkles } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";

export default function TextToTicketPopup({ projectId }) {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me()
  });

  const isEnabled = currentUser?.text_to_ticket_enabled !== false;
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleMouseUp = useCallback((e) => {
    // Small delay to let selection complete
    setTimeout(() => {
      const selectedText = window.getSelection()?.toString().trim();
      
      if (selectedText && selectedText.length > 5) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
          setSelection(selectedText);
        }
      } else {
        setSelection(null);
      }
    }, 10);
  }, []);

  const handleMouseDown = useCallback(() => {
    if (!isCreating) {
      setSelection(null);
    }
  }, [isCreating]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseUp, handleMouseDown]);

  const createTicket = async () => {
    if (!selection || !projectId) return;
    
    setIsCreating(true);
    
    // Generate title and subtasks from selected text
    const response = await api.integrations.Core.InvokeLLM({
      prompt: `Analysiere diesen Text und erstelle daraus ein Ticket für ein Projektmanagement-Tool.

Text: "${selection}"

Erstelle:
1. Einen kurzen, prägnanten Titel (max 50 Zeichen)
2. 2-5 konkrete Subtasks/Aufgaben die erledigt werden müssen

Antworte NUR im JSON Format.`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtasks: { 
            type: "array", 
            items: { type: "string" }
          }
        },
        required: ["title", "subtasks"]
      }
    });

    // Create the task
    const task = await api.entities.Task.create({
      title: response.title,
      description: selection,
      project_id: projectId,
      status: 'todo',
      priority: 'medium'
    });

    // Create subtasks
    for (const subtaskTitle of response.subtasks) {
      await api.entities.Subtask.create({
        task_id: task.id,
        title: subtaskTitle,
        completed: false
      });
    }

    setIsCreating(false);
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      setSelection(null);
    }, 1500);
  };

  if (!projectId || !isEnabled) return null;

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.9 }}
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ left: position.x, top: position.y }}
        >
          <button
            onClick={createTicket}
            disabled={isCreating}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl
              text-sm font-medium transition-all
              ${showSuccess 
                ? 'bg-emerald-500 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }
              ${isCreating ? 'cursor-wait' : 'cursor-pointer'}
            `}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Erstelle Ticket...</span>
              </>
            ) : showSuccess ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ticket erstellt!</span>
              </>
            ) : (
              <>
                <Ticket className="w-4 h-4" />
                <span>Ticket erstellen</span>
              </>
            )}
          </button>
          {/* Arrow */}
          <div className={`
            absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[6px] 
            ${showSuccess ? 'border-t-emerald-500' : 'border-t-indigo-600'}
          `} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}