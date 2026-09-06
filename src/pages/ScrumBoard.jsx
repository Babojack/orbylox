import React from 'react';
import { toast } from "@/components/ui/use-toast";
import { api } from "@/api/apiClient";
import { hasFirebaseConfig } from "@/lib/firebase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import { StrictModeDroppable as Droppable } from "@/components/StrictModeDroppable";
import { Plus, User as UserIcon, AlertCircle, MessageSquare, CheckSquare, Paperclip, LayoutGrid, GanttChart, Filter, LayoutPanelLeft, Pencil, Trash2, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskDetailDialog from "@/components/kanban/TaskDetailDialog";
import TimelineView from "@/components/kanban/TimelineView";
import DustEffect from "@/components/kanban/DustEffect";
import { indexTasks, openBlockersOf, canMoveTo, DONE_STATUS } from "@/lib/taskDependencies";
import { celebrate } from "@/lib/botStage";
import { useLanguage } from "@/components/LanguageProvider";
import { notifyAssignment } from "@/lib/notifyAssignment";
import { Reveal } from "@/components/motion/Reveal";
import { BoardSkeleton } from "@/components/motion/Skeletons";

/* `key` zeigt auf den Uebersetzungsschluessel — die Spaltentitel standen
   vorher fest auf Englisch, auch in der deutschen Fassung. */
const COLUMNS = {
  todo: { key: "todo", color: "bg-slate-100" },
  in_progress: { key: "inProgress", color: "bg-blue-50" },
  review: { key: "review", color: "bg-[#f5f5f5]" },
  done: { key: "done", color: "bg-green-50" }
};

function sortTasksByBoardOrder(taskList) {
  return [...taskList].sort((a, b) => {
    const ao = Number.isFinite(Number(a.board_order))
      ? Number(a.board_order)
      : Number.MAX_SAFE_INTEGER;
    const bo = Number.isFinite(Number(b.board_order))
      ? Number(b.board_order)
      : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (
      new Date(a.created_date || 0).getTime() -
      new Date(b.created_date || 0).getTime()
    );
  });
}

function parseTagsFromInput(str) {
  if (!str || typeof str !== "string") return [];
  return [
    ...new Set(
      str
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Synthetisches „Hauptboard“: Tasks ohne `kanban_board_id`. */
const DEFAULT_KANBAN_BOARD_KEY = "__default__";

function taskBelongsToKanbanBoard(task, selectedBoardId) {
  const bid = task?.kanban_board_id;
  if (selectedBoardId === DEFAULT_KANBAN_BOARD_KEY) {
    return bid == null || bid === "";
  }
  return String(bid) === String(selectedBoardId);
}

/** Frühere Karten-Stapel (Drag auf Karte) — nicht mehr anzeigen, stattdessen mehrere Boards nutzen. */
function isHiddenLegacyStackRow(task) {
  return task?.kind === "stack" || !!task?.parent_stack_id;
}

function mergeTaskPatches(updates) {
  const m = new Map();
  for (const { id, patch } of updates) {
    m.set(id, { ...(m.get(id) || {}), ...patch });
  }
  return Array.from(m.entries()).map(([id, patch]) => ({ id, patch }));
}

export default function ScrumBoard() {
    const queryClient = useQueryClient();
    const { t, language } = useLanguage();
    const [isNewTaskOpen, setIsNewTaskOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState({ title: "", priority: "medium", assignee_email: "", tagsInput: "" });
    const [selectedTask, setSelectedTask] = React.useState(null);
    const [viewMode, setViewMode] = React.useState('board'); // 'board' | 'timeline' | 'people'
    const [filterAssignee, setFilterAssignee] = React.useState(null); // null = all
    const [dustEffect, setDustEffect] = React.useState({ active: false, x: 0, y: 0 });
    const [dndPersistWarning, setDndPersistWarning] = React.useState(null);
    const [newBoardOpen, setNewBoardOpen] = React.useState(false);
    const [newBoardTitle, setNewBoardTitle] = React.useState("");
    const [renameBoardTarget, setRenameBoardTarget] = React.useState(null);
    const [renameBoardTitle, setRenameBoardTitle] = React.useState("");

    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get('project');

    const [selectedKanbanBoardId, setSelectedKanbanBoardId] = React.useState(() => {
      if (typeof window === "undefined" || !searchParams.get("project")) {
        return DEFAULT_KANBAN_BOARD_KEY;
      }
      const pid = searchParams.get("project");
      try {
        return (
          sessionStorage.getItem(`orbylox_kanban_board_${pid}`) ||
          DEFAULT_KANBAN_BOARD_KEY
        );
      } catch {
        return DEFAULT_KANBAN_BOARD_KEY;
      }
    });

    React.useEffect(() => {
      if (!projectId || typeof window === "undefined") return;
      try {
        sessionStorage.setItem(
          `orbylox_kanban_board_${projectId}`,
          selectedKanbanBoardId,
        );
      } catch {
        /* ignore */
      }
    }, [projectId, selectedKanbanBoardId]);

  // NOTE: keep page scrolling enabled (no body scroll lock).

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      return api.entities.Task.listByProject(projectId, '-updated_date');
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval:
      currentUser?.uid && hasFirebaseConfig ? false : 5000,
    enabled: !!projectId
  });

  // Wer wartet auf wen — einmal aufgebaut, von Karten und Dialog genutzt.
  const tasksById = React.useMemo(() => indexTasks(tasks || []), [tasks]);
  const [blockedNotice, setBlockedNotice] = React.useState(null);
  /** Ticket, das gerade gezogen wird — fuer die Rueckmeldung an den Spalten. */
  const [draggingTask, setDraggingTask] = React.useState(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const allProjects = await api.entities.Project.list();
      return allProjects.find(p => p.id === projectId);
    },
    enabled: !!projectId
  });

  const { data: kanbanBoards = [] } = useQuery({
    queryKey: ['kanbanBoards', projectId],
    queryFn: async () => {
      const all = await api.entities.KanbanBoard.list('-created_date', 100);
      return all
        .filter((b) => b.project_id === projectId)
        .sort(
          (a, b) =>
            (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
        );
    },
    initialData: [],
    enabled: !!projectId,
  });

  const boardScopedTasks = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(
      (t) =>
        taskBelongsToKanbanBoard(t, selectedKanbanBoardId) &&
        !isHiddenLegacyStackRow(t),
    );
  }, [tasks, selectedKanbanBoardId]);

  React.useEffect(() => {
    if (!projectId) return;
    try {
      const v = sessionStorage.getItem(`orbylox_kanban_board_${projectId}`);
      setSelectedKanbanBoardId(v || DEFAULT_KANBAN_BOARD_KEY);
    } catch {
      setSelectedKanbanBoardId(DEFAULT_KANBAN_BOARD_KEY);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (selectedKanbanBoardId === DEFAULT_KANBAN_BOARD_KEY) return;
    const exists = kanbanBoards.some(
      (b) => String(b.id) === String(selectedKanbanBoardId),
    );
    if (!exists) setSelectedKanbanBoardId(DEFAULT_KANBAN_BOARD_KEY);
  }, [kanbanBoards, selectedKanbanBoardId]);

  const projectMembers = Array.isArray(project?.members) ? project.members : [];

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (userError || (!userLoading && !currentUser)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [currentUser, userLoading, userError]);

  // Check if user has access to this project (emails stored lowercase in Firestore)
  const hasAccess = React.useMemo(() => {
    if (!project || !currentUser) return false;
    const mine = (currentUser.email || "").trim().toLowerCase();
    const owner = project.created_by ? String(project.created_by).trim().toLowerCase() : "";
    const members = Array.isArray(project.members) ? project.members : [];
    return owner === mine || members.some((m) => m && String(m).trim().toLowerCase() === mine);
  }, [project, currentUser]);

  // Fetch subtasks count for each task
  const { data: allSubtasks = [] } = useQuery({
    queryKey: ['allSubtasks', projectId],
    queryFn: () => api.entities.Subtask.listByProject(projectId, '-created_date'),
    enabled: !!projectId
  });

  // Fetch comments count for each task
  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', projectId],
    queryFn: () => api.entities.TaskComment.listByProject(projectId, '-created_date'),
    enabled: !!projectId
  });
  
  const allAssignees = React.useMemo(() => {
    const assignees = new Set();
    if (currentUser?.email) {
      assignees.add(currentUser.email);
    }
    projectMembers.forEach(email => assignees.add(email));
    return Array.from(assignees);
  }, [currentUser?.email, projectMembers]);

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId) => api.entities.Task.delete(taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      queryClient.setQueryData(['tasks', projectId], old => (old || []).filter(t => t.id !== taskId));
      return { previousTasks };
    },
    onError: (err, taskId, context) => {
      queryClient.setQueryData(['tasks', projectId], context.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    }
  });

  const reorderTasksMutation = useMutation({
    mutationFn: async (updates) => {
      const merged = mergeTaskPatches(updates);
      await Promise.all(
        merged.map(({ id, patch }) => api.entities.Task.update(id, patch)),
      );
    },
    onMutate: async (updates) => {
      setDndPersistWarning(null);
      const merged = mergeTaskPatches(updates);
      await queryClient.cancelQueries({ queryKey: ["tasks", projectId] });
      const previousTasks = queryClient.getQueryData(["tasks", projectId]);
      queryClient.setQueryData(["tasks", projectId], (old) => {
        const map = new Map((old || []).map((t) => [t.id, { ...t }]));
        merged.forEach(({ id, patch }) => {
          if (map.has(id)) {
            map.set(id, { ...map.get(id), ...patch });
          }
        });
        return Array.from(map.values());
      });
      return { previousTasks };
    },
    onError: (err, updates, context) => {
      const msg = String(err?.message || err || "");
      console.error("[Kanban] Persist reorder/stack failed:", err);
      const isPerm =
        msg.toLowerCase().includes("missing or insufficient permissions") ||
        msg.toLowerCase().includes("permission-denied");
      if (isPerm) {
        setDndPersistWarning(
          "Dein Account hat aktuell keine Firestore-Berechtigung zum Speichern. Die Änderung bleibt nur lokal sichtbar (bis Reload).",
        );
        return;
      }
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", projectId], context.previousTasks);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => {
      const todoTasks = (boardScopedTasks || []).filter(
        (t) => t.status === "todo",
      );
      const maxOrder = todoTasks.reduce(
        (m, t) => Math.max(m, Number(t.board_order) || 0),
        -1,
      );
      const { tagsInput, ...rest } = taskData;
      const tags = parseTagsFromInput(tagsInput || "");
      const boardKey =
        selectedKanbanBoardId === DEFAULT_KANBAN_BOARD_KEY
          ? null
          : selectedKanbanBoardId;
      return api.entities.Task.create({
        ...rest,
        project_id: projectId,
        status: "todo",
        board_order: maxOrder + 1,
        tags,
        kind: "task",
        parent_stack_id: null,
        stack_order: 0,
        kanban_board_id: boardKey,
      });
    },
    onMutate: async (taskData) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      const tempId = 'temp_' + Date.now();
      const { tagsInput: _tagsIn, ...rest } = taskData;
      const tags = parseTagsFromInput(taskData.tagsInput || "");
      const boardKey =
        selectedKanbanBoardId === DEFAULT_KANBAN_BOARD_KEY
          ? null
          : selectedKanbanBoardId;
      const todoN = (previousTasks || []).filter(
        (t) =>
          t.status === "todo" &&
          taskBelongsToKanbanBoard(t, selectedKanbanBoardId) &&
          !isHiddenLegacyStackRow(t),
      ).length;
      queryClient.setQueryData(['tasks', projectId], old => [
        ...(old || []),
        {
          ...rest,
          tags,
          id: tempId,
          project_id: projectId,
          status: 'todo',
          board_order: todoN,
          created_date: new Date().toISOString(),
          kanban_board_id: boardKey,
        },
      ]);
      setIsNewTaskOpen(false);
      setNewTask({ title: "", priority: "medium", assignee_email: "", tagsInput: "" });
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks', projectId], context.previousTasks);
    },
    onSuccess: (created, variables) => {
      // Erst nach echtem Speichern benachrichtigen — sonst ginge eine Mail
      // raus fuer ein Ticket, das es am Ende gar nicht gibt.
      if (variables?.assignee_email) {
        notifyAssignment({
          task: { ...(created || {}), ...variables, project_id: projectId },
          assigneeEmail: variables.assignee_email,
          currentUser,
          project,
          allTasks: tasks || [],
          language,
        }).then((r) => {
          if (r?.sent === false) {
            toast({
              title: language === 'de' ? 'Ticket gespeichert, Mail nicht verschickt' : 'Task saved, email not sent',
              description: r.error,
              variant: 'destructive',
            });
          }
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    }
  });

  const createKanbanBoardMutation = useMutation({
    mutationFn: async (title) => {
      const t = (title || "").trim() || "Neues Board";
      return api.entities.KanbanBoard.create({
        project_id: projectId,
        title: t,
        sort_order: (kanbanBoards?.length || 0),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["kanbanBoards", projectId] });
      if (created?.id) setSelectedKanbanBoardId(String(created.id));
      setNewBoardOpen(false);
      setNewBoardTitle("");
    },
  });

  const renameKanbanBoardMutation = useMutation({
    mutationFn: ({ id, title }) =>
      api.entities.KanbanBoard.update(id, {
        title: (title || "").trim() || "Board",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanbanBoards", projectId] });
      setRenameBoardTarget(null);
      setRenameBoardTitle("");
    },
  });

  const deleteKanbanBoardMutation = useMutation({
    mutationFn: async (boardId) => {
      const toMove = (tasks || []).filter(
        (t) => String(t.kanban_board_id) === String(boardId),
      );
      await Promise.all(
        toMove.map((t) =>
          api.entities.Task.update(t.id, { kanban_board_id: null }),
        ),
      );
      await api.entities.KanbanBoard.delete(boardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["kanbanBoards", projectId] });
      setSelectedKanbanBoardId(DEFAULT_KANBAN_BOARD_KEY);
    },
  });

  const getTasksForColumnFiltered = React.useCallback(
    (status) => {
      let filtered =
        boardScopedTasks?.filter((t) => t.status === status) || [];
      if (filterAssignee) {
        filtered = filtered.filter(
          (t) =>
            t.assignees?.includes(filterAssignee) ||
            t.assignee_email === filterAssignee,
        );
      }
      return filtered;
    },
    [boardScopedTasks, filterAssignee],
  );

  const getColumnTasks = React.useCallback(
    (status) => sortTasksByBoardOrder(getTasksForColumnFiltered(status)),
    [getTasksForColumnFiltered],
  );

  /**
   * Ticket ohne Ziehen in eine andere Spalte setzen.
   * Auf dem Handy ist Ziehen zwischen Spalten kaum zu treffen, deshalb liegt
   * dieselbe Bewegung als Knopfreihe auf der Karte.
   */
  const switchStatus = (task, nextStatus) => {
    if (!task || task.status === nextStatus) return;
    const check = canMoveTo(task, nextStatus, tasksById);
    if (!check.ok) {
      setBlockedNotice({
        title: task.title,
        blockers: check.blockers.map((b) => b.title),
      });
      window.setTimeout(() => setBlockedNotice(null), 6000);
      return;
    }
    // Ans Ende der Zielspalte haengen, damit nichts anderes umsortiert wird.
    const target = getColumnTasks(nextStatus);
    const maxOrder = target.reduce((m, x) => Math.max(m, Number(x.board_order) || 0), -1);
    reorderTasksMutation.mutate([
      { id: task.id, patch: { status: nextStatus, board_order: maxOrder + 1 } },
    ]);
    if (nextStatus === DONE_STATUS) celebrate();
  };

  const onDragStart = (start) => {
    const t = (tasks || []).find((x) => x.id === start.draggableId);
    setDraggingTask(t || null);
  };

  const onDragEnd = (result) => {
    setDraggingTask(null);
    if (result.reason === "CANCEL") return;
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    // Ein Ticket darf erst nach "Done", wenn alles erledigt ist, worauf es wartet.
    const moved = (tasks || []).find((x) => x.id === draggableId);
    const check = moved ? canMoveTo(moved, destination.droppableId, tasksById) : { ok: true };
    if (!check.ok) {
      setBlockedNotice({
        title: moved.title,
        blockers: check.blockers.map((b) => b.title),
      });
      window.setTimeout(() => setBlockedNotice(null), 6000);
      return;
    }
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const dustAtDroppable = (droppableId, indexHint) => {
      if (!droppableId) return;
      const escapedId = droppableId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const dropElement = document.querySelector(
        `[data-rbd-droppable-id="${escapedId}"]`,
      );
      if (dropElement) {
        const rect = dropElement.getBoundingClientRect();
        setDustEffect({
          active: true,
          x: rect.left + rect.width / 2,
          y: rect.top + (indexHint + 1) * 80,
        });
        setTimeout(() => setDustEffect({ active: false, x: 0, y: 0 }), 600);
      }
    };

    dustAtDroppable(destination.droppableId, destination.index);

    const srcCol = source.droppableId;
    const dstCol = destination.droppableId;

    const columnList = (col) =>
      sortTasksByBoardOrder(getColumnTasks(col)).map((t) => t.id);

    if (srcCol === dstCol) {
      const list = columnList(srcCol);
      if (!list.includes(draggableId)) return;
      const next = [...list];
      next.splice(source.index, 1);
      next.splice(destination.index, 0, draggableId);
      const updates = next.map((id, i) => ({
        id,
        patch: { board_order: i, status: srcCol },
      }));
      reorderTasksMutation.mutate(mergeTaskPatches(updates));
      return;
    }

    const srcList = columnList(srcCol).filter((id) => id !== draggableId);
    const dstList = [...columnList(dstCol)];
    if (!columnList(srcCol).includes(draggableId)) return;
    dstList.splice(destination.index, 0, draggableId);

    const updates = [
      ...srcList.map((id, i) => ({
        id,
        patch: { board_order: i, status: srcCol },
      })),
      ...dstList.map((id, i) => ({
        id,
        patch: { board_order: i, status: dstCol },
      })),
    ];
    reorderTasksMutation.mutate(mergeTaskPatches(updates));

    // Nur beim Wechsel IN die Erledigt-Spalte. Umsortieren innerhalb von
    // "Done" ist kein Anlass zum Jubeln — dieser Zweig wird ohnehin nur
    // erreicht, wenn Quelle und Ziel verschieden sind.
    if (dstCol === DONE_STATUS) celebrate();
  };

  const columnTaskCount = (status) => getTasksForColumnFiltered(status).length;

  const getSubtasksInfo = (taskId) => {
    const taskSubtasks = allSubtasks.filter(s => s.task_id === taskId);
    const completed = taskSubtasks.filter(s => s.completed).length;
    return { total: taskSubtasks.length, completed };
  };

  const getCommentsCount = (taskId) => {
    return allComments.filter(c => c.task_id === taskId).length;
  };

  if (isLoading || userLoading) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col">
        <div className="h-8 w-48 bg-slate-200/80 animate-pulse mb-6" />
        <BoardSkeleton columns={4} />
      </div>
    );
  }
  if (!currentUser) return <div className="flex items-center justify-center h-[70vh] text-slate-400">Redirecting to login...</div>;
  if (!tasks) return <div className="flex items-center justify-center h-[70vh] text-slate-400"><AlertCircle className="mr-2" /> Failed to load tasks</div>;
  if (project && !hasAccess) return <div className="flex items-center justify-center h-[70vh] text-red-500"><AlertCircle className="mr-2" /> No access to this project</div>;

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <div className="flex items-center gap-3 order-1 sm:order-2 flex-wrap">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Kanban Board</h2>
          </div>
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Board Ansicht"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded ${viewMode === 'timeline' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Timeline Ansicht"
            >
              <GanttChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('people')}
              className={`p-1.5 rounded ${viewMode === 'people' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Personen Ansicht"
            >
              <UserIcon className="w-4 h-4" />
            </button>
          </div>
          {/* Assignee Filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFilterAssignee(null)}
              className={`p-1.5 rounded text-xs ${!filterAssignee ? 'bg-white shadow-sm text-[#ef5a24]' : 'text-slate-500 hover:text-slate-700'}`}
              title="Alle anzeigen"
            >
              <Filter className="w-4 h-4" />
            </button>
            {allAssignees.slice(0, 5).map(email => (
              <button
                key={email}
                onClick={() => setFilterAssignee(filterAssignee === email ? null : email)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  filterAssignee === email 
                    ? 'ring-2 ring-[#ef5a24] ring-offset-1 bg-[#ef5a24]/10 text-[#ef5a24]' 
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
                title={email}
              >
                {email[0]?.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 order-2 sm:order-1 w-full sm:w-auto">
          <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#ef5a24] hover:bg-black text-white flex-1 sm:flex-none text-sm sm:text-base">
                    <Plus className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden xs:inline">Add</span> Task
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <Input 
                        placeholder="Task Title" 
                        value={newTask.title}
                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    />
                    <Select 
                        value={newTask.priority} 
                        onValueChange={(v) => setNewTask({...newTask, priority: v})}
                    >
                        <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="space-y-2">
                        <Select 
                            value={newTask.assignee_email || ""} 
                            onValueChange={(v) => setNewTask({...newTask, assignee_email: v})}
                        >
                            <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>Unassigned</SelectItem>
                                {allAssignees.map((email) => {
                                    const isMe = email === currentUser?.email;
                                    return (
                                        <SelectItem key={email} value={email}>
                                            {isMe && "👤 "}
                                            {email}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <div className="text-xs text-slate-600 bg-slate-100 p-2 rounded border border-slate-200">
                            📋 Available: <strong>{allAssignees.length}</strong> person{allAssignees.length !== 1 ? 's' : ''}
                            {allAssignees.length === 0 && " • Go to Settings to add team"}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Tags (optional)</label>
                        <Input
                          placeholder="Komma-getrennt, z. B. Bug, Frontend"
                          value={newTask.tagsInput}
                          onChange={(e) =>
                            setNewTask({ ...newTask, tagsInput: e.target.value })
                          }
                        />
                    </div>
                    <Button 
                        className="w-full bg-[#ef5a24]"
                        onClick={() => createTaskMutation.mutate(newTask)}
                        disabled={!newTask.title.trim()}
                    >
                        Create Task
                    </Button>
                </div>
            </DialogContent>
          </Dialog>
          <Button 
            variant="destructive" 
            size="sm"
            className="text-xs sm:text-sm"
            onClick={async () => {
              if (window.confirm('Alle Aufgaben auf diesem Board löschen?')) {
                const currentTasks = boardScopedTasks || [];
                await Promise.all(currentTasks.map(t => api.entities.Task.delete(t.id)));
                queryClient.invalidateQueries(['tasks', projectId]);
              }
            }}
          >
            <span className="hidden sm:inline">Alles löschen</span>
            <span className="sm:hidden">Löschen</span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
            <LayoutPanelLeft className="w-3.5 h-3.5" /> Boards
          </span>
          <button
            type="button"
            onClick={() => setSelectedKanbanBoardId(DEFAULT_KANBAN_BOARD_KEY)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              selectedKanbanBoardId === DEFAULT_KANBAN_BOARD_KEY
                ? "bg-[#ef5a24] text-white border-[#ef5a24]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#ef5a24]"
            }`}
          >
            Hauptboard
          </button>
          {kanbanBoards.map((b) => (
            <div key={b.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSelectedKanbanBoardId(String(b.id))}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors max-w-[160px] truncate ${
                  selectedKanbanBoardId === String(b.id)
                    ? "bg-[#ef5a24] text-white border-[#ef5a24]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-[#ef5a24]"
                }`}
                title={b.title}
              >
                {b.title || "Board"}
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100"
                title="Umbenennen"
                onClick={() => {
                  setRenameBoardTarget(b);
                  setRenameBoardTitle(b.title || "");
                }}
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-red-50"
                title="Board löschen"
                onClick={() => {
                  if (
                    window.confirm(
                      "Dieses Board löschen? Alle Tickets darauf werden ins Hauptboard verschoben.",
                    )
                  ) {
                    deleteKanbanBoardMutation.mutate(b.id);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setNewBoardOpen(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Neues Board
          </Button>
        </div>
      </div>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Name"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createKanbanBoardMutation.mutate(newBoardTitle);
                }
              }}
            />
            <Button
              className="w-full bg-[#ef5a24]"
              onClick={() => createKanbanBoardMutation.mutate(newBoardTitle)}
              disabled={createKanbanBoardMutation.isPending}
            >
              Erstellen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameBoardTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRenameBoardTarget(null);
            setRenameBoardTitle("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Board umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={renameBoardTitle}
              onChange={(e) => setRenameBoardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameBoardTarget) {
                  renameKanbanBoardMutation.mutate({
                    id: renameBoardTarget.id,
                    title: renameBoardTitle,
                  });
                }
              }}
            />
            <Button
              className="w-full bg-[#ef5a24]"
              onClick={() => {
                if (!renameBoardTarget) return;
                renameKanbanBoardMutation.mutate({
                  id: renameBoardTarget.id,
                  title: renameBoardTitle,
                });
              }}
            >
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {dndPersistWarning && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          {dndPersistWarning}
        </div>
      )}

      {/* Warum die Karte zurueckgesprungen ist */}
      {blockedNotice && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2.5 border-2 border-[#ef5a24] bg-[#ef5a24]/10 px-3 py-2.5"
        >
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-[#ef5a24]" />
          <p className="text-sm text-slate-800 min-w-0">
            <span className="font-bold">{blockedNotice.title}</span>
            {' — '}
            {t('cannotMoveToDone').replace('{list}', blockedNotice.blockers.join(', '))}
          </p>
          <button
            type="button"
            data-no-lift
            onClick={() => setBlockedNotice(null)}
            className="ml-auto shrink-0 h-6 w-6 flex items-center justify-center bg-transparent border-0 p-0 text-slate-500"
            aria-label="OK"
          >
            ✕
          </button>
        </div>
      )}

      {viewMode === 'timeline' ? (
        <TimelineView 
          tasks={boardScopedTasks} 
          onTaskClick={setSelectedTask} 
          allAssignees={allAssignees}
        />
      ) : viewMode === 'people' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAssignees.map(email => {
            const userTasks = boardScopedTasks.filter(t => 
              (t.assignees?.includes(email)) || (t.assignee_email === email)
            );
            const todoCount = userTasks.filter(t => t.status === 'todo').length;
            const inProgressCount = userTasks.filter(t => t.status === 'in_progress').length;
            const reviewCount = userTasks.filter(t => t.status === 'review').length;
            const doneCount = userTasks.filter(t => t.status === 'done').length;
            
            return (
              <div key={email} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="text-lg bg-[#ef5a24]/10 text-[#ef5a24]">
                      {email[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-slate-800">{email.split('@')[0]}</p>
                    <p className="text-xs text-slate-500">{userTasks.length} Tickets</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {todoCount > 0 && (
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-xs text-slate-600">To Do</span>
                      <Badge variant="secondary">{todoCount}</Badge>
                    </div>
                  )}
                  {inProgressCount > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 p-2 rounded">
                      <span className="text-xs text-blue-700">In Progress</span>
                      <Badge className="bg-blue-100 text-blue-700">{inProgressCount}</Badge>
                    </div>
                  )}
                  {reviewCount > 0 && (
                    <div className="flex items-center justify-between bg-[#f5f5f5] p-2 rounded">
                      <span className="text-xs text-[#ef5a24]">Review</span>
                      <Badge className="bg-[#ef5a24]/10 text-[#ef5a24]">{reviewCount}</Badge>
                    </div>
                  )}
                  {doneCount > 0 && (
                    <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                      <span className="text-xs text-green-700">Done</span>
                      <Badge className="bg-green-100 text-green-700">{doneCount}</Badge>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 space-y-2">
                  {userTasks.slice(0, 3).map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      <p className="text-xs font-medium text-slate-700 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`
                          ${task.priority === 'high' ? 'text-red-600 border-red-200' : 
                            task.priority === 'medium' ? 'text-orange-600 border-orange-200' : 
                            'text-blue-600 border-blue-200'}
                          text-[9px] px-1 py-0
                        `}>
                          {task.priority}
                        </Badge>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          task.status === 'done' ? 'bg-green-100 text-green-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          task.status === 'review' ? 'bg-[#ef5a24]/10 text-[#ef5a24]' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {COLUMNS[task.status] ? t(COLUMNS[task.status].key) : task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {userTasks.length > 3 && (
                    <p className="text-xs text-slate-400 text-center">+{userTasks.length - 3} weitere</p>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Unassigned Tasks */}
          {boardScopedTasks.filter(t => !t.assignees?.length && !t.assignee_email).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Nicht zugewiesen</p>
                  <p className="text-xs text-slate-500">{boardScopedTasks.filter(t => !t.assignees?.length && !t.assignee_email).length} Tickets</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {boardScopedTasks.filter(t => !t.assignees?.length && !t.assignee_email).slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <p className="text-xs font-medium text-slate-700 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`
                        ${task.priority === 'high' ? 'text-red-600 border-red-200' : 
                          task.priority === 'medium' ? 'text-orange-600 border-orange-200' : 
                          'text-blue-600 border-blue-200'}
                        text-[9px] px-1 py-0
                      `}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
                {boardScopedTasks.filter(t => !t.assignees?.length && !t.assignee_email).length > 3 && (
                  <p className="text-xs text-slate-400 text-center">+{boardScopedTasks.filter(t => !t.assignees?.length && !t.assignee_email).length - 3} weitere</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 sm:gap-4 overflow-auto pb-4 flex-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none scrollbar-hide">
          {Object.entries(COLUMNS).map(([columnId, config]) => {
            const columnTasks = getColumnTasks(columnId);
            const columnIndex = Object.keys(COLUMNS).indexOf(columnId);
            // Waehrend des Ziehens zeigt jede Spalte, ob sie das Ticket
            // ueberhaupt annehmen wuerde — man sieht es VOR dem Loslassen.
            const dropCheck = draggingTask
              ? canMoveTo(draggingTask, columnId, tasksById)
              : { ok: true };
            const forbidden = !!draggingTask && !dropCheck.ok;
            return (
            <Reveal
              key={columnId}
              index={columnIndex}
              className="flex-shrink-0 w-[80vw] sm:flex-1 sm:w-auto sm:min-w-[260px] snap-center sm:snap-align-none flex"
            >
            <div
              className={`flex-1 flex flex-col bg-slate-50/50 rounded-2xl border min-h-[60vh] transition-all duration-200 ${
                forbidden ? 'border-slate-200 opacity-45' : 'border-slate-100/60'
              }`}
            >
              <div className={`p-4 border-b border-slate-100 rounded-t-2xl ${config.color} bg-opacity-40`}>
                <div className="flex justify-between items-center gap-2">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-1.5 min-w-0">
                      {forbidden && <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                      <span className="truncate">{t(config.key)}</span>
                    </h3>
                    <Badge variant="secondary" className="bg-white text-slate-500 shadow-sm shrink-0">
                        {columnTaskCount(columnId)}
                    </Badge>
                </div>
                {forbidden && (
                  <p className="mt-1.5 text-[11px] leading-tight text-slate-500">
                    {t('cannotMoveToDone').replace(
                      '{list}',
                      dropCheck.blockers.map((b) => b.title).join(', '),
                    )}
                  </p>
                )}
              </div>

              <div className="flex-1 p-2 min-h-[120px]">
                <Droppable
                  droppableId={columnId}
                  type="BOARD_TASK"
                  direction="vertical"
                >
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`min-h-[72px] space-y-2 transition-all duration-200 ${
                        snapshot.isDraggingOver && !forbidden
                          ? "bg-[#ef5a24]/8 outline-2 outline-dashed outline-[#ef5a24] outline-offset-2 px-1 py-1"
                          : ""
                      }`}
                    >
                      {columnTasks.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-8 px-3">
                          {t('noTasksInColumn')}
                        </p>
                      )}
                      {columnTasks.map((draggableTask, index) => {
                        const subtasksInfo = getSubtasksInfo(draggableTask.id);
                        const commentsCount = getCommentsCount(draggableTask.id);
                        const attachmentsCount = (draggableTask.attachments || []).length;

                        return (
                        <Draggable
                          key={draggableTask.id}
                          draggableId={draggableTask.id}
                          index={index}
                          disableInteractiveElementBlocking
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`relative bg-white p-4 rounded-xl border-2 shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${
                                    snapshot.isDragging ? "shadow-2xl rotate-2 ring-2 ring-[#ef5a24] z-50 cursor-grabbing" : ""
                                  } ${
                                    draggableTask.priority === "high" && !snapshot.isDragging ? "border-red-200 animate-pulse-border" : "border-slate-100"
                                  }`}
                              style={{
                                ...provided.draggableProps.style,
                                ...(draggableTask.priority === "high" && !snapshot.isDragging
                                  ? { animation: "pulse-border 2s ease-in-out infinite" }
                                  : {}),
                              }}
                              onClick={() => setSelectedTask(draggableTask)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                  <Badge variant="outline" className={`
                                      ${draggableTask.priority === 'high' ? 'text-red-600 border-red-100 bg-red-50' : 
                                        draggableTask.priority === 'medium' ? 'text-orange-600 border-orange-100 bg-orange-50' : 
                                        'text-blue-600 border-blue-100 bg-blue-50'}
                                      text-[10px] px-2 py-0.5 h-5 uppercase tracking-wider border-0
                                  `}>
                                      {draggableTask.priority}
                                  </Badge>
                                  <span className="text-[10px] text-slate-300 group-hover:text-slate-400 transition-colors select-none">
                                      {t('dragHint')}
                                  </span>
                              </div>
                              <p className="text-sm font-medium text-slate-800 leading-snug mb-2">
                                  {draggableTask.title}
                              </p>

                              {/* Wartet noch auf andere Tickets */}
                              {(() => {
                                const open = openBlockersOf(draggableTask, tasksById);
                                if (open.length === 0) return null;
                                return (
                                  <div
                                    className="mb-3 flex items-start gap-1.5 border-l-2 border-[#ef5a24] bg-[#ef5a24]/8 pl-2 py-1"
                                    title={open.map((b) => b.title).join('\n')}
                                  >
                                    <Lock className="w-3 h-3 mt-0.5 shrink-0 text-[#ef5a24]" />
                                    <span className="text-[11px] leading-tight text-slate-600 min-w-0">
                                      <span className="font-bold text-[#ef5a24]">{t('blockedBadge')}</span>
                                      {' · '}
                                      <span className="truncate">{open[0].title}</span>
                                      {open.length > 1 && ` +${open.length - 1}`}
                                    </span>
                                  </div>
                                );
                              })()}
                              {(draggableTask.tags?.length > 0) && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {draggableTask.tags.slice(0, 4).map((tg) => (
                                    <span
                                      key={tg}
                                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f5f5f5] text-[#ef5a24] max-w-[120px] truncate"
                                      title={tg}
                                    >
                                      {tg}
                                    </span>
                                  ))}
                                  {draggableTask.tags.length > 4 && (
                                    <span className="text-[10px] text-slate-400">+{draggableTask.tags.length - 4}</span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                                {subtasksInfo.total > 0 && (
                                  <span className="flex items-center gap-1">
                                    <CheckSquare className="w-3 h-3" />
                                    {subtasksInfo.completed}/{subtasksInfo.total}
                                  </span>
                                )}
                                {commentsCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {commentsCount}
                                  </span>
                                )}
                                {attachmentsCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" />
                                    {attachmentsCount}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                  <div className="flex items-center gap-1">
                                      {(draggableTask.assignees?.length > 0 || draggableTask.assignee_email) ? (
                                          <div className="flex -space-x-2">
                                              {(draggableTask.assignees?.length > 0 ? draggableTask.assignees : [draggableTask.assignee_email]).slice(0, 3).map((email) => (
                                                  <Avatar key={email} className="w-6 h-6 border-2 border-white">
                                                      <AvatarFallback className="text-[10px] bg-[#ef5a24]/10 text-[#ef5a24]">
                                                          {email?.[0]?.toUpperCase()}
                                                      </AvatarFallback>
                                                  </Avatar>
                                              ))}
                                          </div>
                                      ) : (
                                          <span className="text-xs text-slate-400">Unassigned</span>
                                      )}
                                  </div>
                              </div>

                              {/* Statuswechsel ohne Ziehen — bewusst ganz unten,
                                  damit der Rest der Karte frei zum Ziehen bleibt.
                                  Die Beschriftung steht NEBEN dem Feld: im
                                  Ausloeser wuerde line-clamp-1 das Layout
                                  zerlegen. */}
                              <div className="flex items-center gap-2 mt-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                                  {t('status')}
                                </span>
                                <div
                                  className="flex-1 min-w-0"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Select
                                    value={draggableTask.status}
                                    onValueChange={(v) => switchStatus(draggableTask, v)}
                                  >
                                    <SelectTrigger className="h-9 w-full text-xs border-2 border-slate-200 bg-white hover:border-[#ef5a24] px-2 font-semibold text-slate-700">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(COLUMNS).map(([sid, cfg]) => {
                                        const allowed =
                                          sid === draggableTask.status ||
                                          canMoveTo(draggableTask, sid, tasksById).ok;
                                        return (
                                          <SelectItem key={sid} value={sid} disabled={!allowed}>
                                            <span className="flex items-center gap-2">
                                              {!allowed && <Lock className="w-3 h-3 text-slate-400" />}
                                              {t(cfg.key)}
                                            </span>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            )}
                        </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
            </Reveal>
            );
          })}
        </div>
      </DragDropContext>
      )}

      {/* Dust Effect */}
      <DustEffect isActive={dustEffect.active} x={dustEffect.x} y={dustEffect.y} />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        allAssignees={allAssignees}
        currentUser={currentUser}
        projectId={projectId}
        onDeleteTask={(taskId) => deleteTaskMutation.mutate(taskId)}
        allTasks={tasks || []}
        project={project}
      />
    </div>
  );
}