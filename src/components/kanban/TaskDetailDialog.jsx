import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import TaskDependencies from "@/components/kanban/TaskDependencies";
import { notifyAssignment } from "@/lib/notifyAssignment";
import { canMoveTo, indexTasks } from "@/lib/taskDependencies";
import { celebrate } from "@/lib/botStage";
import { useLanguage } from "@/components/LanguageProvider";
import { 
  Send, 
  Plus, 
  Paperclip, 
  X, 
  CheckSquare, 
  MessageSquare,
  Upload,
  FileText,
  Trash2,
  Calendar
} from 'lucide-react';
import { askDelete } from '@/lib/confirmDelete';

const URL_IN_TEXT = /(https?:\/\/[^\s]+)/gi;

/** Plain-text comments with long URLs: split into spans + links so layout never overflows. */
function CommentBody({ text }) {
  if (!text) return null;
  const parts = String(text).split(URL_IN_TEXT);
  return (
    <div className="text-sm text-slate-700 max-w-full min-w-0 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] break-words [word-break:break-word]">
      {parts.map((part, i) =>
        part.match(/^https?:\/\//i) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline text-[#ef5a24] underline decoration-[#ef5a24] underline-offset-2 hover:text-[#ef5a24] break-all align-baseline"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  );
}

export default function TaskDetailDialog({ 
  task, 
  isOpen, 
  onClose, 
  allAssignees, 
  currentUser,
  projectId,
  onDeleteTask,
  allTasks = [],
  project = null
}) {
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const [statusBlocked, setStatusBlocked] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [editedTask, setEditedTask] = useState(null);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (task) {
      setEditedTask({
        ...task,
        tags: Array.isArray(task.tags) ? [...task.tags] : [],
      });
      setNewTagText('');
    }
  }, [task]);

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ['taskComments', task?.id],
    queryFn: async () => {
      const all = await api.entities.TaskComment.list('-created_date', 100);
      return all.filter(c => c.task_id === task?.id);
    },
    enabled: !!task?.id && isOpen
  });

  // Fetch subtasks
  const { data: subtasks = [] } = useQuery({
    queryKey: ['subtasks', task?.id],
    queryFn: async () => {
      const all = await api.entities.Subtask.list('-created_date', 100);
      return all.filter(s => s.task_id === task?.id);
    },
    enabled: !!task?.id && isOpen
  });

  // Update task mutation with optimistic update
  const updateTaskMutation = useMutation({
    mutationFn: (data) => api.entities.Task.update(task.id, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries(['tasks', projectId]);
      const previousTasks = queryClient.getQueryData(['tasks', projectId]);
      
      // Optimistic update
      queryClient.setQueryData(['tasks', projectId], (old) =>
        (old || []).map(t => t.id === task.id ? { ...t, ...data } : t)
      );
      
      return { previousTasks };
    },
    onError: (err, data, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
    }
    // No onSuccess invalidation - optimistic update is enough
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (content) => api.entities.TaskComment.create({
      task_id: task.id,
      project_id: projectId,
      content,
      author_email: currentUser?.email
    }),
    onMutate: async (content) => {
      await queryClient.cancelQueries(['taskComments', task?.id]);
      const previous = queryClient.getQueryData(['taskComments', task?.id]);
      queryClient.setQueryData(['taskComments', task?.id], old => [
        { id: 'temp_' + Date.now(), task_id: task.id, project_id: projectId, content, author_email: currentUser?.email, created_date: new Date().toISOString() },
        ...(old || [])
      ]);
      setNewComment('');
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['taskComments', task?.id], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['taskComments', task?.id]);
    }
  });

  // Add subtask mutation
  const addSubtaskMutation = useMutation({
    mutationFn: (title) => api.entities.Subtask.create({
      task_id: task.id,
      project_id: projectId,
      title,
      completed: false
    }),
    onMutate: async (title) => {
      await queryClient.cancelQueries(['subtasks', task?.id]);
      const previous = queryClient.getQueryData(['subtasks', task?.id]);
      queryClient.setQueryData(['subtasks', task?.id], old => [
        ...(old || []),
        { id: 'temp_' + Date.now(), task_id: task.id, project_id: projectId, title, completed: false }
      ]);
      setNewSubtask('');
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['subtasks', task?.id], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['subtasks', task?.id]);
    }
  });

  // Toggle subtask mutation
  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ id, completed }) => api.entities.Subtask.update(id, { completed }),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries(['subtasks', task?.id]);
      const previous = queryClient.getQueryData(['subtasks', task?.id]);
      queryClient.setQueryData(['subtasks', task?.id], old =>
        (old || []).map(s => s.id === id ? { ...s, completed } : s)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['subtasks', task?.id], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['subtasks', task?.id]);
    }
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: (id) => api.entities.Subtask.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries(['subtasks', task?.id]);
      const previous = queryClient.getQueryData(['subtasks', task?.id]);
      queryClient.setQueryData(['subtasks', task?.id], old =>
        (old || []).filter(s => s.id !== id)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['subtasks', task?.id], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['subtasks', task?.id]);
    }
  });

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const currentAttachments = editedTask?.attachments || [];
      const newAttachments = [...currentAttachments, { name: file.name, url: file_url }];
      await updateTaskMutation.mutateAsync({ attachments: newAttachments });
      setEditedTask(prev => ({ ...prev, attachments: newAttachments }));
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  // Remove attachment
  const removeAttachment = async (index) => {
    const newAttachments = (editedTask?.attachments || []).filter((_, i) => i !== index);
    await updateTaskMutation.mutateAsync({ attachments: newAttachments });
    setEditedTask(prev => ({ ...prev, attachments: newAttachments }));
  };

  if (!task || !editedTask) return null;

  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const totalSubtasks = subtasks.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[100vw] h-[100dvh] max-w-none max-h-[100dvh] overflow-hidden p-0 rounded-none border-0 left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[95vw] sm:max-w-4xl sm:h-[90dvh] sm:max-h-[90dvh] sm:border sm:rounded-lg">
        <div className="flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">
          {/* Left side - Task details */}
          <div className="flex-1 min-h-0 min-w-0 p-4 sm:p-6 overflow-y-auto lg:border-r border-slate-200 lg:max-h-none">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl min-w-0 pr-8">
                <Input
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                  onBlur={() => updateTaskMutation.mutate({ title: editedTask.title })}
                  className="text-xl font-semibold border-0 p-0 focus-visible:ring-0 shadow-none min-w-0 break-words [overflow-wrap:anywhere]"
                />
              </DialogTitle>
            </DialogHeader>

            {/* Description */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-600 mb-2 block">Description</label>
              <Textarea
                placeholder="Add a description..."
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                onBlur={() => updateTaskMutation.mutate({ description: editedTask.description })}
                className="min-h-[100px] min-w-0 max-w-full [overflow-wrap:anywhere] break-words"
              />
            </div>

            {/* Tags / categories */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-600 mb-2 block">Tags / Kategorien</label>
              <p className="text-xs text-slate-500 mb-2">
                Tags helfen beim Filtern und auf der Karte zur schnellen Orientierung.
              </p>
              <div className="flex flex-wrap gap-2 mb-3 min-w-0">
                {(editedTask.tags || []).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1 max-w-full"
                  >
                    <span className="truncate max-w-[200px]" title={tag}>
                      {tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newTags = (editedTask.tags || []).filter((x) => x !== tag);
                        setEditedTask({ ...editedTask, tags: newTags });
                        updateTaskMutation.mutate({ tags: newTags });
                      }}
                      className="ml-0.5 hover:text-red-500 rounded p-0.5"
                      aria-label={`Tag ${tag} entfernen`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="z. B. Scope & Struktur"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = newTagText.trim();
                      if (!t) return;
                      if ((editedTask.tags || []).includes(t)) {
                        setNewTagText("");
                        return;
                      }
                      const newTags = [...(editedTask.tags || []), t];
                      setEditedTask({ ...editedTask, tags: newTags });
                      updateTaskMutation.mutate({ tags: newTags });
                      setNewTagText("");
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const t = newTagText.trim();
                    if (!t) return;
                    if ((editedTask.tags || []).includes(t)) {
                      setNewTagText("");
                      return;
                    }
                    const newTags = [...(editedTask.tags || []), t];
                    setEditedTask({ ...editedTask, tags: newTags });
                    updateTaskMutation.mutate({ tags: newTags });
                    setNewTagText("");
                  }}
                >
                  Hinzufügen
                </Button>
              </div>
            </div>

            {/* Priority, Assignee & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
              {/* Spalte wechseln, ohne zu ziehen — auf dem Handy ist Ziehen
                  zwischen Spalten kaum zu treffen. */}
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">{t('status')}</label>
                <Select
                  value={editedTask.status || 'todo'}
                  onValueChange={(v) => {
                    const check = canMoveTo(editedTask, v, indexTasks(allTasks));
                    if (!check.ok) {
                      setStatusBlocked(check.blockers.map((b) => b.title));
                      window.setTimeout(() => setStatusBlocked(null), 6000);
                      return;
                    }
                    setStatusBlocked(null);
                    const warDone = editedTask.status === 'done';
                    setEditedTask({ ...editedTask, status: v });
                    updateTaskMutation.mutate({ status: v });
                    // Nur beim Übergang nach "erledigt", nicht wenn es das
                    // ohnehin schon war.
                    if (v === 'done' && !warDone) celebrate();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{t('todo')}</SelectItem>
                    <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                    <SelectItem value="review">{t('review')}</SelectItem>
                    <SelectItem value="done">{t('done')}</SelectItem>
                  </SelectContent>
                </Select>
                {statusBlocked && (
                  <p className="mt-2 text-xs text-[#ef5a24] font-medium">
                    {t('cannotMoveToDone').replace('{list}', statusBlocked.join(', '))}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">{t('priority')}</label>
                <Select
                  value={editedTask.priority || "medium"}
                  onValueChange={(v) => {
                    setEditedTask({ ...editedTask, priority: v });
                    updateTaskMutation.mutate({ priority: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-600 mb-2 block">Zugewiesene Personen</label>
                <div className="flex flex-wrap gap-2 mb-2 min-w-0">
                  {(editedTask.assignees || []).map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1 pr-1 max-w-full min-w-0">
                      <Avatar className="w-4 h-4">
                        <AvatarFallback className="text-[8px] bg-[#ef5a24]/10 text-[#ef5a24]">
                          {email[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate max-w-[140px]">{email.split('@')[0]}</span>
                      <button
                        onClick={() => {
                          const newAssignees = (editedTask.assignees || []).filter(e => e !== email);
                          setEditedTask({ ...editedTask, assignees: newAssignees });
                          updateTaskMutation.mutate({ assignees: newAssignees });
                        }}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (v && !(editedTask.assignees || []).includes(v)) {
                      const newAssignees = [...(editedTask.assignees || []), v];
                      setEditedTask({ ...editedTask, assignees: newAssignees });
                      updateTaskMutation.mutate({ assignees: newAssignees });
                      // Benachrichtigung laeuft nebenher — sie darf die
                      // Zuweisung nicht aufhalten und nicht scheitern lassen.
                      notifyAssignment({
                        task: { ...editedTask, assignees: newAssignees },
                        assigneeEmail: v,
                        currentUser,
                        project: project || { id: projectId },
                        allTasks,
                        language,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Person hinzufügen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAssignees
                      .filter(email => !(editedTask.assignees || []).includes(email))
                      .map((email) => (
                        <SelectItem key={email} value={email}>
                          {email === currentUser?.email ? "👤 " : ""}{email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Start
                </label>
                <Input
                  type="date"
                  value={editedTask.start_date || ''}
                  onChange={(e) => {
                    setEditedTask({ ...editedTask, start_date: e.target.value });
                    updateTaskMutation.mutate({ start_date: e.target.value || null });
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Deadline
                </label>
                <Input
                  type="date"
                  value={editedTask.due_date || ''}
                  onChange={(e) => {
                    setEditedTask({ ...editedTask, due_date: e.target.value });
                    updateTaskMutation.mutate({ due_date: e.target.value || null });
                  }}
                />
              </div>
            </div>

            {/* Abhängigkeiten: worauf dieses Ticket wartet */}
            <div className="mb-6">
              <TaskDependencies
                task={editedTask}
                allTasks={allTasks}
                onChange={(next) => {
                  setEditedTask({ ...editedTask, depends_on: next });
                  updateTaskMutation.mutate({ depends_on: next });
                }}
              />
            </div>

            {/* Subtasks */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Subtasks {totalSubtasks > 0 && `(${completedSubtasks}/${totalSubtasks})`}
                </label>
              </div>
              
              {totalSubtasks > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 mb-3">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={subtask.completed}
                      onCheckedChange={(checked) => 
                        toggleSubtaskMutation.mutate({ id: subtask.id, completed: checked })
                      }
                    />
                    <span className={`flex-1 min-w-0 text-sm break-words [overflow-wrap:anywhere] ${subtask.completed ? 'line-through text-slate-400' : ''}`}>
                      {subtask.title}
                    </span>
                    <button
                      onClick={async () => { if (await askDelete({ kind: 'subtask', itemName: subtask.title })) deleteSubtaskMutation.mutate(subtask.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add subtask..."
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newSubtask.trim()) {
                      addSubtaskMutation.mutate(newSubtask.trim());
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => newSubtask.trim() && addSubtaskMutation.mutate(newSubtask.trim())}
                  disabled={!newSubtask.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Attachments */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
              </label>
              
              <div className="space-y-2 mb-3 min-w-0">
                {(editedTask.attachments || []).map((att, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg group min-w-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <a 
                      href={att.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-[#ef5a24] hover:underline truncate"
                    >
                      {att.name}
                    </a>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-[#ef5a24] transition-colors flex items-center justify-center gap-2 text-slate-500">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Click to upload file'}
                </div>
              </label>
            </div>

            {/* Delete Task */}
            <div className="pt-4 border-t border-slate-200">
              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
                  if (await askDelete({ kind: 'task', itemName: task?.title })) {
                    onClose();
                    setTimeout(() => {
                      onDeleteTask?.(task.id);
                    }, 100);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Aufgabe löschen
              </Button>
            </div>
          </div>

          {/* Right side - Comments */}
          <div className="w-full lg:w-80 flex flex-col bg-slate-50 border-t lg:border-t-0 min-h-[220px] lg:min-h-0 lg:max-h-none">
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-white/80">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm sm:text-base">
                <MessageSquare className="w-4 h-4 shrink-0" />
                Comments ({comments.length})
              </h3>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 sm:space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm min-w-0 max-w-full overflow-hidden"
                  >
                    <div className="flex items-start gap-2 mb-3 min-w-0">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarFallback className="text-xs bg-[#ef5a24]/10 text-[#ef5a24]">
                          {comment.author_email?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-slate-700 block truncate">
                          {comment.author_email?.split('@')[0] || 'Anonymous'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comment.created_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <CommentBody text={comment.content} />
                  </div>
                ))
              )}
            </div>

            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-2 items-stretch sm:items-end">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[52px] sm:min-h-[60px] min-w-0 flex-1 resize-none text-sm [overflow-wrap:anywhere] break-words"
                />
                <Button
                  size="icon"
                  className="shrink-0 h-11 w-11 sm:h-12 sm:w-12 self-end rounded-xl"
                  onClick={() => newComment.trim() && addCommentMutation.mutate(newComment.trim())}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}