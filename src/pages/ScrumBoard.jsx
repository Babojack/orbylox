import React from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import { StrictModeDroppable as Droppable } from "@/components/StrictModeDroppable";
import { Plus, MoreVertical, Calendar, User as UserIcon, AlertCircle, MessageSquare, CheckSquare, Paperclip, LayoutGrid, GanttChart, Filter } from 'lucide-react';
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

export default function ScrumBoard() {
    const queryClient = useQueryClient();
    const [isNewTaskOpen, setIsNewTaskOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState({ title: "", priority: "medium", assignee_email: "" });
    const [selectedTask, setSelectedTask] = React.useState(null);
    const [viewMode, setViewMode] = React.useState('board'); // 'board' | 'timeline' | 'people'
    const [filterAssignee, setFilterAssignee] = React.useState(null); // null = all
    const [taskOrder, setTaskOrder] = React.useState({}); // Store order per column
    const [dustEffect, setDustEffect] = React.useState({ active: false, x: 0, y: 0 });

    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get('project');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const allTasks = await api.entities.Task.list('-updated_date', 200);
      return allTasks.filter(t => t.project_id === projectId);
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 5000,
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
  
  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

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

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, ...data }) => api.entities.Task.update(id, { status, ...data }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      
      queryClient.setQueryData(['tasks', projectId], (old) =>
        old?.map(task => task.id === id ? { ...task, status } : task) || []
      );
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    }
  });

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

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => api.entities.Task.create({
        ...taskData,
        project_id: projectId,
        status: "todo"
    }),
    onMutate: async (taskData) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      const tempId = 'temp_' + Date.now();
      queryClient.setQueryData(['tasks', projectId], old => [
        ...(old || []),
        { ...taskData, id: tempId, project_id: projectId, status: 'todo', created_date: new Date().toISOString() }
      ]);
      setIsNewTaskOpen(false);
      setNewTask({ title: "", priority: "medium", assignee_email: "" });
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks', projectId], context.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    }
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    
    // Show dust effect at drop location
    const dropElement = document.querySelector(`[data-rbd-droppable-id="${destination.droppableId}"]`);
    if (dropElement) {
      const rect = dropElement.getBoundingClientRect();
      setDustEffect({
        active: true,
        x: rect.left + rect.width / 2,
        y: rect.top + (destination.index + 1) * 100 // Approximate position
      });
      setTimeout(() => setDustEffect({ active: false, x: 0, y: 0 }), 600);
    }

    // Get current order for both columns
    const sourceColumnTasks = getTasksByStatusRaw(source.droppableId);
    const destColumnTasks = source.droppableId === destination.droppableId 
      ? sourceColumnTasks 
      : getTasksByStatusRaw(destination.droppableId);

    // Find the task being moved
    const movedTask = sourceColumnTasks[source.index];
    if (!movedTask) return;

    // Remove from source
    const newSourceTasks = [...sourceColumnTasks];
    newSourceTasks.splice(source.index, 1);

    // Add to destination
    let newDestTasks;
    if (source.droppableId === destination.droppableId) {
      newDestTasks = newSourceTasks;
    } else {
      newDestTasks = [...destColumnTasks];
    }
    newDestTasks.splice(destination.index, 0, movedTask);

    // Update order state
    setTaskOrder(prev => ({
      ...prev,
      [source.droppableId]: newSourceTasks.map(t => t.id),
      [destination.droppableId]: newDestTasks.map(t => t.id)
    }));
    
    // Update status if column changed
    if (destination.droppableId !== source.droppableId) {
      updateStatusMutation.mutate({ 
        id: draggableId, 
        status: destination.droppableId 
      });
    }
  };

  // Get raw tasks without ordering
  const getTasksByStatusRaw = (status) => {
    let filtered = tasks?.filter(t => t.status === status) || [];
    if (filterAssignee) {
      filtered = filtered.filter(t => 
        (t.assignees?.includes(filterAssignee)) || (t.assignee_email === filterAssignee)
      );
    }
    
    // Apply custom order if exists
    const order = taskOrder[status];
    if (order && order.length > 0) {
      const orderedTasks = [];
      const remaining = [...filtered];
      
      order.forEach(id => {
        const idx = remaining.findIndex(t => t.id === id);
        if (idx !== -1) {
          orderedTasks.push(remaining[idx]);
          remaining.splice(idx, 1);
        }
      });
      
      // Add any new tasks that aren't in the order yet
      return [...orderedTasks, ...remaining];
    }
    
    // Default: sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return filtered.sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));
  };

  const getTasksByStatus = (status) => {
    return getTasksByStatusRaw(status);
  };

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
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Kanban Board</h2>
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
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 flex-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none scrollbar-hide">
          {Object.entries(COLUMNS).map(([columnId, config]) => (
            <div key={columnId} className="flex-shrink-0 w-[80vw] sm:flex-1 sm:w-auto sm:min-w-[250px] flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100/60 snap-center sm:snap-align-none min-h-[60vh]">
              <div className={`p-4 border-b border-slate-100 rounded-t-2xl ${config.color} bg-opacity-40`}>
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-slate-700">{config.label}</h3>
                    <Badge variant="secondary" className="bg-white text-slate-500 shadow-sm">
                        {getTasksByStatus(columnId).length}
                    </Badge>
                </div>
              </div>
              
              <Droppable droppableId={columnId}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 p-3 space-y-3 overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/50' : ''}`}
                  >
                    {getTasksByStatus(columnId).map((task, index) => {
                      const subtasksInfo = getSubtasksInfo(task.id);
                      const commentsCount = getCommentsCount(task.id);
                      const attachmentsCount = (task.attachments || []).length;

                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`
                                  bg-white p-4 rounded-xl border-2 shadow-sm 
                                  hover:shadow-md transition-all group cursor-pointer
                                  ${snapshot.isDragging ? 'shadow-2xl scale-110 ring-2 ring-indigo-500/50 rotate-2 z-50' : ''}
                                  ${task.priority === 'high' && !snapshot.isDragging ? 'border-red-200 animate-pulse-border' : 'border-slate-100'}
                              `}
                              style={{
                                ...provided.draggableProps.style,
                                ...(task.priority === 'high' && !snapshot.isDragging ? {
                                  animation: 'pulse-border 2s ease-in-out infinite'
                                } : {})
                              }}
                              onClick={() => setSelectedTask(task)}
                            >
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
                              <p className="text-sm font-medium text-slate-800 leading-snug mb-3">
                                  {task.title}
                              </p>

                              {/* Task indicators */}
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
                                      {(task.assignees?.length > 0 || task.assignee_email) ? (
                                          <div className="flex -space-x-2">
                                              {(task.assignees?.length > 0 ? task.assignees : [task.assignee_email]).slice(0, 3).map((email, i) => (
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
          ))}
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