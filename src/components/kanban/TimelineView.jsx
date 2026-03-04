import React, { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, differenceInDays, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const STATUS_COLORS = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#8b5cf6',
  done: '#22c55e'
};

export default function TimelineView({ tasks, onTaskClick, allAssignees }) {
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const daysToShow = 14;
  const today = new Date();

  const days = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const groupedByAssignee = useMemo(() => {
    const groups = { unassigned: [] };
    
    allAssignees.forEach(email => {
      groups[email] = [];
    });

    tasks.forEach(task => {
      // Support both new assignees array and legacy assignee_email
      const assignees = task.assignees?.length > 0 ? task.assignees : (task.assignee_email ? [task.assignee_email] : []);
      
      if (assignees.length === 0) {
        groups.unassigned.push(task);
      } else {
        assignees.forEach(email => {
          if (!groups[email]) groups[email] = [];
          groups[email].push(task);
        });
      }
    });

    return groups;
  }, [tasks, allAssignees]);

  const getTaskPosition = (task) => {
    // Need at least one date
    if (!task.start_date && !task.due_date) return null;
    
    const taskStart = task.start_date ? parseISO(task.start_date) : parseISO(task.due_date);
    const taskEnd = task.due_date ? parseISO(task.due_date) : taskStart;
    
    const viewEnd = addDays(startDate, daysToShow - 1);
    
    // Check if task overlaps with view
    if (taskEnd < startDate || taskStart > viewEnd) return null;
    
    // Calculate visible portion
    const visibleStart = taskStart < startDate ? startDate : taskStart;
    const visibleEnd = taskEnd > viewEnd ? viewEnd : taskEnd;
    
    const startIndex = differenceInDays(visibleStart, startDate);
    const endIndex = differenceInDays(visibleEnd, startDate);
    
    return {
      left: `${(startIndex / daysToShow) * 100}%`,
      width: `${((endIndex - startIndex + 1) / daysToShow) * 100}%`
    };
  };

  // Calculate today line position
  const todayPosition = useMemo(() => {
    const dayIndex = differenceInDays(today, startDate);
    if (dayIndex < 0 || dayIndex >= daysToShow) return null;
    // Add partial day progress
    const now = new Date();
    const hoursProgress = now.getHours() / 24;
    return ((dayIndex + hoursProgress) / daysToShow) * 100;
  }, [startDate, today]);

  const navigateWeek = (direction) => {
    setStartDate(addDays(startDate, direction * 7));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
        </Button>
        <span className="font-semibold text-slate-700">
          {format(startDate, 'd. MMM', { locale: de })} - {format(addDays(startDate, daysToShow - 1), 'd. MMM yyyy', { locale: de })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)}>
          Weiter <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Timeline header - days */}
      <div className="flex border-b border-slate-100 relative">
        <div className="w-48 flex-shrink-0 p-3 border-r border-slate-100 bg-slate-50">
          <span className="text-xs font-medium text-slate-500 uppercase">Mitglieder</span>
        </div>
        <div className="flex-1 flex relative">
          {days.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div
                key={i}
                className={`flex-1 p-2 text-center border-r border-slate-50 ${isWeekend ? 'bg-slate-50' : ''}`}
              >
                <div className="text-[10px] text-slate-400 uppercase">
                  {format(day, 'EEE', { locale: de })}
                </div>
                <div className={`
                  text-sm font-medium mt-0.5
                  ${isToday ? 'w-6 h-6 bg-red-500 text-white rounded-full mx-auto flex items-center justify-center' : 'text-slate-700'}
                `}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {Object.entries(groupedByAssignee).map(([assignee, assigneeTasks]) => {
          if (assignee === 'unassigned' && assigneeTasks.length === 0) return null;
          
          return (
            <div key={assignee} className="flex border-b border-slate-50 hover:bg-slate-50/50">
              {/* Assignee column */}
              <div className="w-48 flex-shrink-0 p-3 border-r border-slate-100 flex items-center gap-2">
                {assignee === 'unassigned' ? (
                  <span className="text-sm text-slate-400">Nicht zugewiesen</span>
                ) : (
                  <>
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                        {assignee[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-slate-700 truncate">
                      {assignee.split('@')[0]}
                    </span>
                  </>
                )}
              </div>

              {/* Tasks timeline */}
              <div className="flex-1 relative min-h-[60px] py-2">
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((day, i) => (
                    <div
                      key={i}
                      className={`flex-1 border-r border-slate-50 ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50/50' : ''}`}
                    />
                  ))}
                </div>

                {/* Today line */}
                {todayPosition !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                    style={{ left: `${todayPosition}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                )}

                {/* Task bars */}
                {assigneeTasks.map(task => {
                  const position = getTaskPosition(task);
                  if (!position) return null;

                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="absolute top-2 h-8 rounded-lg px-2 flex items-center cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                      style={{
                        left: position.left,
                        width: position.width,
                        backgroundColor: STATUS_COLORS[task.status] || '#94a3b8',
                        minWidth: '80px'
                      }}
                    >
                      <span className="text-xs text-white font-medium truncate">
                        {task.title}
                      </span>
                    </div>
                  );
                })}

                {/* Empty state */}
                {assigneeTasks.filter(t => getTaskPosition(t)).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-slate-300">Keine Tasks mit Deadline</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-4 justify-center">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-600 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}