import React from 'react';
import { api } from "@/api/apiClient";
import { hasFirebaseConfig } from "@/lib/firebase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import { StrictModeDroppable as Droppable } from "@/components/StrictModeDroppable";
import { Plus, MoreVertical, User as UserIcon, AlertCircle, MessageSquare, CheckSquare, Paperclip, LayoutGrid, GanttChart, Filter, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TaskDetailDialog from "@/components/kanban/TaskDetailDialog";
import TimelineView from "@/components/kanban/TimelineView";
import DustEffect from "@/components/kanban/DustEffect";

const COLUMNS = {
  todo: { label: "To Do", color: "bg-slate-100" },
  in_progress: { label: "In Progress", color: "bg-blue-50" },
  review: { label: "Review", color: "bg-purple-50" },
  done: { label: "Done", color: "bg-green-50" }
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
    const asi = Number(a.stack_index) || 0;
    const bsi = Number(b.stack_index) || 0;
    if (asi !== bsi) return asi - bsi;
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

const DEFAULT_STACK_LABEL = "Stapel";

function newStackUuid() {
  return crypto.randomUUID();
}

function groupConsecutiveStacks(sortedTasks) {
  const out = [];
  let i = 0;
  while (i < sortedTasks.length) {
    const t = sortedTasks[i];
    const sid = t?.kanban_stack_id;
    if (!sid || typeof sid !== "string") {
      out.push({ stackId: null, tasks: [t] });
      i++;
      continue;
    }
    const chunk = [t];
    i++;
    while (i < sortedTasks.length && sortedTasks[i]?.kanban_stack_id === sid) {
      chunk.push(sortedTasks[i]);
      i++;
    }
    if (chunk.length < 2) {
      for (const x of chunk) out.push({ stackId: null, tasks: [x] });
    } else {
      out.push({ stackId: sid, tasks: chunk });
    }
  }
  return out;
}

function isStackExpanded(stackOpen, stackId) {
  return stackOpen[stackId] !== false;
}

function buildFlatDragItems(groups, stackOpen) {
  const flat = [];
  for (const g of groups) {
    if (g.stackId && g.tasks.length >= 2 && !isStackExpanded(stackOpen, g.stackId)) {
      flat.push({
        task: g.tasks[0],
        meta: { kind: "stack-collapsed", group: g },
      });
    } else if (g.stackId && g.tasks.length >= 2) {
      for (const t of g.tasks) {
        flat.push({
          task: t,
          meta: { kind: "stack-expanded", group: g },
        });
      }
    } else {
      for (const t of g.tasks) {
        flat.push({
          task: t,
          meta: { kind: "single", group: g },
        });
      }
    }
  }
  return flat.map((x, index) => ({ ...x, index }));
}

function expandFlatToTaskIds(flatItems) {
  const ids = [];
  for (const f of flatItems) {
    if (f.meta.kind === "stack-collapsed") {
      for (const t of f.meta.group.tasks) ids.push(t.id);
    } else {
      ids.push(f.task.id);
    }
  }
  return ids;
}

function flatDestIndexToExpandedInsertPos(flatItems, destFlatIndex) {
  let pos = 0;
  for (let i = 0; i < destFlatIndex && i < flatItems.length; i++) {
    const f = flatItems[i];
    if (f.meta.kind === "stack-collapsed") {
      pos += f.meta.group.tasks.length;
    } else {
      pos += 1;
    }
  }
  return pos;
}

function flatSourceIndexToBlockIds(flatItems, sourceFlatIndex) {
  const f = flatItems[sourceFlatIndex];
  if (!f) return [];
  if (f.meta.kind === "stack-collapsed") {
    return f.meta.group.tasks.map((t) => t.id);
  }
  return [f.task.id];
}

function mergeTaskPatches(updates) {
  const m = new Map();
  for (const { id, patch } of updates) {
    m.set(id, { ...(m.get(id) || {}), ...patch });
  }
  return Array.from(m.entries()).map(([id, patch]) => ({ id, patch }));
}

/** Fixes split / orphan stack ids on column order; mutates taskById */
function sanitizeStackGeometry(orderedIds, taskById) {
  const patches = [];
  const get = (id) => taskById.get(id);

  const findRuns = () => {
    const rs = [];
    let idx = 0;
    while (idx < orderedIds.length) {
      const sid = get(orderedIds[idx])?.kanban_stack_id;
      if (!sid) {
        idx++;
        continue;
      }
      let j = idx;
      while (
        j + 1 < orderedIds.length &&
        get(orderedIds[j + 1])?.kanban_stack_id === sid
      ) {
        j++;
      }
      rs.push({ start: idx, end: j, sid });
      idx = j + 1;
    }
    return rs;
  };

  let runs = findRuns();
  const bySid = new Map();
  for (const r of runs) {
    if (!bySid.has(r.sid)) bySid.set(r.sid, []);
    bySid.get(r.sid).push(r);
  }

  for (const [, rlist] of bySid) {
    if (rlist.length > 1) {
      for (let ri = 1; ri < rlist.length; ri++) {
        const newSid = newStackUuid();
        const label =
          get(orderedIds[rlist[ri].start])?.kanban_stack_label ||
          DEFAULT_STACK_LABEL;
        for (let k = rlist[ri].start; k <= rlist[ri].end; k++) {
          const id = orderedIds[k];
          patches.push({
            id,
            patch: { kanban_stack_id: newSid, kanban_stack_label: label },
          });
          taskById.set(id, {
            ...get(id),
            kanban_stack_id: newSid,
            kanban_stack_label: label,
          });
        }
      }
    }
  }

  runs = findRuns();
  for (const r of runs) {
    if (r.end === r.start) {
      const id = orderedIds[r.start];
      patches.push({
        id,
        patch: {
          kanban_stack_id: null,
          kanban_stack_label: null,
          stack_index: 0,
        },
      });
      taskById.set(id, {
        ...get(id),
        kanban_stack_id: null,
        kanban_stack_label: null,
        stack_index: 0,
      });
    }
  }

  return patches;
}

function finalizeColumnOrderPatches(orderedIds, taskById, status) {
  const stackPatches = sanitizeStackGeometry(orderedIds, taskById);
  const reorderPatches = [];
  let lastSid = null;
  let stackSeq = 0;
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const t = taskById.get(id);
    if (!t) continue;
    const sid = t.kanban_stack_id || null;
    if (sid && sid === lastSid) stackSeq++;
    else {
      stackSeq = 0;
      lastSid = sid;
    }
    reorderPatches.push({
      id,
      patch: {
        board_order: i,
        status,
        stack_index: sid ? stackSeq : 0,
      },
    });
  }
  return [...stackPatches, ...reorderPatches];
}

export default function ScrumBoard() {
    const queryClient = useQueryClient();
    const [isNewTaskOpen, setIsNewTaskOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState({ title: "", priority: "medium", assignee_email: "", tagsInput: "" });
    const [selectedTask, setSelectedTask] = React.useState(null);
    const [viewMode, setViewMode] = React.useState('board'); // 'board' | 'timeline' | 'people'
    const [filterAssignee, setFilterAssignee] = React.useState(null); // null = all
    /** kanban_stack_id -> false means collapsed (iOS-style stack) */
    const [stackOpen, setStackOpen] = React.useState({});
    const [dustEffect, setDustEffect] = React.useState({ active: false, x: 0, y: 0 });
    /** @hello-pangea/dnd liefert beim Loslassen manchmal kein `combine`, obwohl die UI Combine zeigt — letzter Stand aus onDragUpdate. */
    const lastCombineRef = React.useRef(null);

    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get('project');

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const allTasks = await api.entities.Task.list('-updated_date', 200);
      return allTasks.filter(t => t.project_id === projectId);
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval:
      currentUser?.uid && hasFirebaseConfig ? false : 5000,
    enabled: !!projectId
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const allProjects = await api.entities.Project.list();
      return allProjects.find(p => p.id === projectId);
    },
    enabled: !!projectId
  });

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
    queryFn: () => api.entities.Subtask.list('-created_date', 500),
    enabled: !!projectId
  });

  // Fetch comments count for each task
  const { data: allComments = [] } = useQuery({
    queryKey: ['allComments', projectId],
    queryFn: () => api.entities.TaskComment.list('-created_date', 500),
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
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", projectId], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => {
      const todoTasks = (tasks || []).filter((t) => t.status === "todo");
      const maxOrder = todoTasks.reduce(
        (m, t) => Math.max(m, Number(t.board_order) || 0),
        -1,
      );
      const { tagsInput, ...rest } = taskData;
      const tags = parseTagsFromInput(tagsInput || "");
      return api.entities.Task.create({
        ...rest,
        project_id: projectId,
        status: "todo",
        board_order: maxOrder + 1,
        tags,
        stack_index: 0,
        kanban_stack_id: null,
        kanban_stack_label: null,
      });
    },
    onMutate: async (taskData) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      const tempId = 'temp_' + Date.now();
      const { tagsInput: _tagsIn, ...rest } = taskData;
      const tags = parseTagsFromInput(taskData.tagsInput || "");
      const todoN = (previousTasks || []).filter((t) => t.status === "todo").length;
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
        },
      ]);
      setIsNewTaskOpen(false);
      setNewTask({ title: "", priority: "medium", assignee_email: "", tagsInput: "" });
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks', projectId], context.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    }
  });

  const getTasksForColumnFiltered = React.useCallback(
    (status) => {
      let filtered = tasks?.filter((t) => t.status === status) || [];
      if (filterAssignee) {
        filtered = filtered.filter(
          (t) =>
            t.assignees?.includes(filterAssignee) ||
            t.assignee_email === filterAssignee,
        );
      }
      return filtered;
    },
    [tasks, filterAssignee],
  );

  const getSortedColumnIds = React.useCallback(
    (status) =>
      sortTasksByBoardOrder(getTasksForColumnFiltered(status)).map((t) => t.id),
    [getTasksForColumnFiltered],
  );

  const renameStackLabel = React.useCallback(
    (stackId, raw) => {
      const label = (raw || "").trim() || DEFAULT_STACK_LABEL;
      const affected = (tasks || []).filter((t) => t.kanban_stack_id === stackId);
      if (!affected.length) return;
      const updates = affected.map((t) => ({
        id: t.id,
        patch: { kanban_stack_label: label },
      }));
      reorderTasksMutation.mutate(mergeTaskPatches(updates));
    },
    [tasks, reorderTasksMutation],
  );

  const onDragEnd = (result) => {
    if (result.reason === "CANCEL") {
      lastCombineRef.current = null;
      return;
    }

    const findTaskById = (id) =>
      (tasks || []).find((t) => String(t.id) === String(id));

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

    const combineFromLib = result.combine?.draggableId ? result.combine : null;
    const combineFallback =
      result.reason === "DROP" &&
      result.destination &&
      lastCombineRef.current &&
      result.destination.droppableId === lastCombineRef.current.droppableId &&
      String(result.draggableId) !== String(lastCombineRef.current.draggableId)
        ? lastCombineRef.current
        : null;
    const effectiveCombine = combineFromLib || combineFallback;

    lastCombineRef.current = null;

    if (effectiveCombine?.draggableId) {
      const draggedId = result.draggableId;
      const targetId = effectiveCombine.draggableId;
      if (draggedId === targetId) return;

      const srcTask = findTaskById(draggedId);
      const tgtTask = findTaskById(targetId);
      if (!srcTask || !tgtTask) return;

      dustAtDroppable(effectiveCombine.droppableId, result.source.index);

      const destStatus = tgtTask.status;
      const srcStatus = srcTask.status;
      const taskById = new Map((tasks || []).map((t) => [t.id, { ...t }]));

      const finalSid = tgtTask.kanban_stack_id || newStackUuid();
      const finalLabel =
        tgtTask.kanban_stack_label ||
        srcTask.kanban_stack_label ||
        DEFAULT_STACK_LABEL;

      let destIds = getSortedColumnIds(destStatus).filter((id) => id !== draggedId);

      const anchorIdx = destIds.indexOf(targetId);
      if (anchorIdx === -1) return;

      const tgtBefore = taskById.get(targetId);
      const walkSid = tgtBefore?.kanban_stack_id;
      let insertAt = anchorIdx + 1;
      if (walkSid) {
        let blockEnd = anchorIdx;
        while (
          blockEnd + 1 < destIds.length &&
          taskById.get(destIds[blockEnd + 1])?.kanban_stack_id === walkSid
        ) {
          blockEnd++;
        }
        insertAt = blockEnd + 1;
      }

      destIds = [
        ...destIds.slice(0, insertAt),
        draggedId,
        ...destIds.slice(insertAt),
      ];

      taskById.set(draggedId, {
        ...taskById.get(draggedId),
        status: destStatus,
        kanban_stack_id: finalSid,
        kanban_stack_label: finalLabel,
      });
      taskById.set(targetId, {
        ...taskById.get(targetId),
        kanban_stack_id: finalSid,
        kanban_stack_label: finalLabel,
      });
      for (const id of destIds) {
        const t = taskById.get(id);
        if (t?.kanban_stack_id === finalSid) {
          taskById.set(id, { ...t, kanban_stack_label: finalLabel });
        }
      }

      const patches = [];
      if (srcStatus !== destStatus) {
        const srcIds = getSortedColumnIds(srcStatus).filter(
          (id) => id !== draggedId,
        );
        patches.push(...finalizeColumnOrderPatches(srcIds, taskById, srcStatus));
      }
      patches.push(...finalizeColumnOrderPatches(destIds, taskById, destStatus));

      reorderTasksMutation.mutate(mergeTaskPatches(patches));
      setStackOpen((prev) => ({ ...prev, [finalSid]: true }));
      return;
    }

    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    dustAtDroppable(destination.droppableId, destination.index);

    const srcCol = source.droppableId;
    const dstCol = destination.droppableId;

    const srcSorted = sortTasksByBoardOrder(getTasksForColumnFiltered(srcCol));
    const srcGroups = groupConsecutiveStacks(srcSorted);
    const flatSrc = buildFlatDragItems(srcGroups, stackOpen);

    if (String(flatSrc[source.index]?.task?.id) !== String(draggableId)) return;

    const blockIds = flatSourceIndexToBlockIds(flatSrc, source.index);
    const flatWithoutSource = flatSrc.filter((_, idx) => idx !== source.index);

    if (srcCol === dstCol) {
      const insertPos = flatDestIndexToExpandedInsertPos(
        flatWithoutSource,
        destination.index,
      );
      let expanded = expandFlatToTaskIds(flatSrc);
      for (const id of blockIds) {
        const ix = expanded.indexOf(id);
        if (ix !== -1) expanded.splice(ix, 1);
      }
      expanded.splice(insertPos, 0, ...blockIds);

      const taskById = new Map((tasks || []).map((t) => [t.id, { ...t }]));
      const patches = finalizeColumnOrderPatches(
        expanded,
        taskById,
        srcCol,
      );
      reorderTasksMutation.mutate(mergeTaskPatches(patches));
      return;
    }

    const taskById = new Map((tasks || []).map((t) => [t.id, { ...t }]));
    for (const id of blockIds) {
      taskById.set(id, { ...taskById.get(id), status: dstCol });
    }

    let srcExpanded = expandFlatToTaskIds(flatSrc);
    for (const id of blockIds) {
      const ix = srcExpanded.indexOf(id);
      if (ix !== -1) srcExpanded.splice(ix, 1);
    }

    const dstSorted = sortTasksByBoardOrder(getTasksForColumnFiltered(dstCol));
    const flatDst = buildFlatDragItems(
      groupConsecutiveStacks(dstSorted),
      stackOpen,
    );
    const insertPos = flatDestIndexToExpandedInsertPos(
      flatDst,
      destination.index,
    );
    let destExpanded = expandFlatToTaskIds(flatDst);
    destExpanded.splice(insertPos, 0, ...blockIds);

    const patches = [
      ...finalizeColumnOrderPatches(srcExpanded, taskById, srcCol),
      ...finalizeColumnOrderPatches(destExpanded, taskById, dstCol),
    ];
    reorderTasksMutation.mutate(mergeTaskPatches(patches));
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

  if (isLoading || userLoading) return <div className="flex items-center justify-center h-[70vh] text-slate-400">Loading Board...</div>;
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
              className={`p-1.5 rounded text-xs ${!filterAssignee ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
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
                    ? 'ring-2 ring-indigo-500 ring-offset-1 bg-indigo-100 text-indigo-700' 
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
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none text-sm sm:text-base">
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
                        className="w-full bg-indigo-600"
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
              if (window.confirm('Alle Aufgaben löschen?')) {
                const currentTasks = tasks || [];
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

      {viewMode === 'timeline' ? (
        <TimelineView 
          tasks={tasks} 
          onTaskClick={setSelectedTask} 
          allAssignees={allAssignees}
        />
      ) : viewMode === 'people' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAssignees.map(email => {
            const userTasks = tasks.filter(t => 
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
                    <AvatarFallback className="text-lg bg-indigo-100 text-indigo-600">
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
                    <div className="flex items-center justify-between bg-purple-50 p-2 rounded">
                      <span className="text-xs text-purple-700">Review</span>
                      <Badge className="bg-purple-100 text-purple-700">{reviewCount}</Badge>
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
                          task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {COLUMNS[task.status]?.label || task.status}
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
          {tasks.filter(t => !t.assignees?.length && !t.assignee_email).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Nicht zugewiesen</p>
                  <p className="text-xs text-slate-500">{tasks.filter(t => !t.assignees?.length && !t.assignee_email).length} Tickets</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {tasks.filter(t => !t.assignees?.length && !t.assignee_email).slice(0, 3).map(task => (
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
                {tasks.filter(t => !t.assignees?.length && !t.assignee_email).length > 3 && (
                  <p className="text-xs text-slate-400 text-center">+{tasks.filter(t => !t.assignees?.length && !t.assignee_email).length - 3} weitere</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
      <DragDropContext
        onDragStart={() => {
          lastCombineRef.current = null;
        }}
        onDragUpdate={(update) => {
          lastCombineRef.current = update.combine;
        }}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 flex-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none scrollbar-hide">
          {Object.entries(COLUMNS).map(([columnId, config]) => {
            const sorted = sortTasksByBoardOrder(
              getTasksForColumnFiltered(columnId),
            );
            const groups = groupConsecutiveStacks(sorted);
            const flat = buildFlatDragItems(groups, stackOpen);
            return (
            <div key={columnId} className="flex-shrink-0 w-[80vw] sm:flex-1 sm:w-auto sm:min-w-[260px] flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100/60 snap-center sm:snap-align-none min-h-[60vh]">
              <div className={`p-4 border-b border-slate-100 rounded-t-2xl ${config.color} bg-opacity-40`}>
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-700">{config.label}</h3>
                    <Badge variant="secondary" className="bg-white text-slate-500 shadow-sm">
                        {columnTaskCount(columnId)}
                    </Badge>
                </div>
              </div>

              <div className="flex-1 p-2 min-h-[120px]">
                <Droppable
                  droppableId={columnId}
                  type="BOARD_TASK"
                  isCombineEnabled
                  direction="vertical"
                >
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`min-h-[72px] space-y-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl px-1 py-1"
                          : ""
                      }`}
                    >
                      {flat.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-8 px-3">
                          Keine Aufgaben in dieser Spalte.
                        </p>
                      )}
                      {flat.map((row) => {
                      const { task, index, meta } = row;
                      const subtasksInfo = getSubtasksInfo(task.id);
                      const commentsCount = getCommentsCount(task.id);
                      const attachmentsCount = (task.attachments || []).length;
                      const stackId = meta.group?.stackId;
                      const stackCount = meta.group?.tasks?.length || 0;
                      const stackLabel =
                        meta.group?.tasks?.[0]?.kanban_stack_label ||
                        task.kanban_stack_label ||
                        DEFAULT_STACK_LABEL;
                      const showStackChrome =
                        !!stackId &&
                        (meta.kind === "stack-collapsed" ||
                          (meta.kind === "stack-expanded" &&
                            meta.group.tasks[0].id === task.id));
                      const compact = meta.kind === "stack-collapsed";
                      const stackIndent =
                        meta.kind === "stack-expanded" ? "ml-1 pl-2 border-l-2 border-indigo-200/70" : "";

                      return (
                        <React.Fragment key={`${task.id}-${index}`}>
                          {showStackChrome && (
                            <div
                              className="rounded-lg border border-indigo-200/90 bg-indigo-50/60 dark:bg-indigo-950/30 px-2 py-1.5 flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="shrink-0 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                aria-label="Stapel auf- oder zuklappen"
                                onClick={() =>
                                  setStackOpen((p) => {
                                    const expanded = p[stackId] !== false;
                                    return { ...p, [stackId]: !expanded };
                                  })
                                }
                              >
                                {isStackExpanded(stackOpen, stackId) ? (
                                  <ChevronDown className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                                )}
                              </button>
                              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                              <Input
                                className="h-7 text-xs flex-1 min-w-0 bg-white/90 dark:bg-slate-900/40 border-indigo-200 dark:border-indigo-800"
                                defaultValue={stackLabel}
                                title="Stapel-Name"
                                onBlur={(e) =>
                                  renameStackLabel(stackId, e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                              />
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-[10px] tabular-nums"
                              >
                                {stackCount}
                              </Badge>
                            </div>
                          )}
                          <div className={stackIndent}>
                        <Draggable
                          draggableId={task.id}
                          index={index}
                          disableInteractiveElementBlocking
                        >
                          {(provided, snapshot) => {
                            const isCombineDropTarget = Boolean(snapshot.combineTargetFor);
                            const isDraggingCombinable =
                              snapshot.isDragging && snapshot.combineWith;
                            return (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={compact
                                ? `relative bg-white dark:bg-slate-800 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 cursor-grab active:cursor-grabbing hover:border-indigo-300 ${
                                    snapshot.isDragging ? "shadow-lg ring-2 ring-indigo-400 z-50" : ""
                                  } ${
                                    isCombineDropTarget
                                      ? "ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 scale-[1.02]"
                                      : ""
                                  }`
                                : `
                                  relative bg-white dark:bg-slate-800 p-4 rounded-xl border-2 shadow-sm 
                                  hover:shadow-md transition-all group cursor-grab active:cursor-grabbing
                                  ${snapshot.isDragging ? 'shadow-2xl scale-105 ring-2 ring-indigo-500/50 z-50' : ''}
                                  ${task.priority === 'high' && !snapshot.isDragging ? 'border-red-200 animate-pulse-border' : 'border-slate-100 dark:border-slate-600'}
                                  ${
                                    isCombineDropTarget
                                      ? "!ring-2 !ring-indigo-500 !border-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/35"
                                      : ""
                                  }
                                  ${
                                    isDraggingCombinable
                                      ? "ring-2 ring-amber-400 border-amber-300"
                                      : ""
                                  }
                              `}
                              style={{
                                ...provided.draggableProps.style,
                                ...(task.priority === 'high' && !snapshot.isDragging && !compact ? {
                                  animation: 'pulse-border 2s ease-in-out infinite'
                                } : {})
                              }}
                              onClick={() => setSelectedTask(task)}
                            >
                              {compact ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant="outline" className={`
                                      shrink-0 ${task.priority === 'high' ? 'text-red-600 border-red-100 bg-red-50' : 
                                        task.priority === 'medium' ? 'text-orange-600 border-orange-100 bg-orange-50' : 
                                        'text-blue-600 border-blue-100 bg-blue-50'}
                                      text-[9px] px-1.5 py-0 h-5 uppercase border-0
                                  `}>
                                      {task.priority}
                                  </Badge>
                                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
                                      {task.title}
                                  </p>
                                  {stackCount > 1 && (
                                    <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5 border-indigo-200 text-indigo-700 bg-indigo-50">
                                      {stackCount}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                              <>
                              <div className="flex justify-between items-start mb-2">
                                  <Badge variant="outline" className={`
                                      ${task.priority === 'high' ? 'text-red-600 border-red-100 bg-red-50' : 
                                        task.priority === 'medium' ? 'text-orange-600 border-orange-100 bg-orange-50' : 
                                        'text-blue-600 border-blue-100 bg-blue-50'}
                                      text-[10px] px-2 py-0.5 h-5 uppercase tracking-wider border-0
                                  `}>
                                      {task.priority}
                                  </Badge>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-slate-300 hover:text-slate-600">
                                      <MoreVertical className="w-3 h-3" />
                                  </Button>
                              </div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug mb-3">
                                  {task.title}
                              </p>
                              {(task.tags?.length > 0) && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {task.tags.slice(0, 4).map((tg) => (
                                    <span
                                      key={tg}
                                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 max-w-[120px] truncate"
                                      title={tg}
                                    >
                                      {tg}
                                    </span>
                                  ))}
                                  {task.tags.length > 4 && (
                                    <span className="text-[10px] text-slate-400">+{task.tags.length - 4}</span>
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

                              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-700">
                                  <div className="flex items-center gap-1">
                                      {(task.assignees?.length > 0 || task.assignee_email) ? (
                                          <div className="flex -space-x-2">
                                              {(task.assignees?.length > 0 ? task.assignees : [task.assignee_email]).slice(0, 3).map((email) => (
                                                  <Avatar key={email} className="w-6 h-6 border-2 border-white">
                                                      <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                                                          {email?.[0]?.toUpperCase()}
                                                      </AvatarFallback>
                                                  </Avatar>
                                              ))}
                                              {(task.assignees?.length || 0) > 3 && (
                                                  <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center">
                                                      <span className="text-[10px] text-slate-600">+{task.assignees.length - 3}</span>
                                                  </div>
                                              )}
                                          </div>
                                      ) : (
                                          <span className="text-xs text-slate-400">Unassigned</span>
                                      )}
                                  </div>
                              </div>
                              </>
                              )}
                            </div>
                            );
                          }}
                        </Draggable>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
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
      />
    </div>
  );
}