import React, { useMemo, useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import { StrictModeDroppable as Droppable } from "@/components/StrictModeDroppable";
import { Plus, FolderOpen, Users, Calendar, ArrowRight, Languages, Trash2, CheckSquare, Square, Image, X, Lightbulb, Play, Pause, Star, EyeOff, Pencil, GripVertical, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from "@/utils";
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { toast } from "@/components/ui/use-toast";
import { getProjectTimer, startTimer, stopTimer, formatDuration } from "@/lib/projectTimer";

const ADMIN_EMAIL = "gudfransen@gmail.com";
const MAX_PROJECTS_BASIC = 2;
const MAX_PROJECTS_PREMIUM = 10;
const MAX_MEMBERS_PER_PROJECT = 3;

const STORAGE_PREFIX = "orbylox_projects_v1:";

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function storageKey(userEmailLower, suffix) {
  return `${STORAGE_PREFIX}${userEmailLower || "anon"}:${suffix}`;
}

function readStringArray(key) {
  if (typeof window === "undefined") return [];
  return safeJsonParse(window.localStorage.getItem(key), []).filter((x) => typeof x === "string");
}

function writeStringArray(key, arr) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.isArray(arr) ? arr : []));
}

function toggleInArray(arr, id) {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function uniq(arr) {
  return [...new Set(arr)];
}

function clampMembers(members) {
  return uniq(
    (Array.isArray(members) ? members : [])
      .map((m) => String(m || "").trim())
      .filter(Boolean)
  ).slice(0, MAX_MEMBERS_PER_PROJECT);
}

function computeProjectStats({ tasks = [], posts = [], docs = [], canvasItems = [], files = [], messages = [] }) {
  const stats = {};
  const ensure = (pid) => {
    if (!pid) return null;
    if (!stats[pid]) {
      stats[pid] = {
        tasks: 0,
        posts: 0,
        docs: 0,
        canvasItems: 0,
        files: 0,
        messages: 0,
        activeModules: 0,
      };
    }
    return stats[pid];
  };

  tasks.forEach((t) => {
    const s = ensure(t.project_id);
    if (s) s.tasks += 1;
  });
  posts.forEach((p) => {
    const s = ensure(p.project_id);
    if (s) s.posts += 1;
  });
  docs.forEach((d) => {
    const s = ensure(d.project_id);
    if (s) s.docs += 1;
  });
  canvasItems.forEach((c) => {
    const s = ensure(c.project_id);
    if (s) s.canvasItems += 1;
  });
  files.forEach((f) => {
    const s = ensure(f.project_id);
    if (s) s.files += 1;
  });
  messages.forEach((m) => {
    const s = ensure(m.project_id);
    if (s) s.messages += 1;
  });

  Object.values(stats).forEach((s) => {
    s.activeModules =
      (s.tasks > 0 ? 1 : 0) +
      (s.posts > 0 ? 1 : 0) +
      (s.docs > 0 ? 1 : 0) +
      (s.canvasItems > 0 ? 1 : 0) +
      (s.files > 0 ? 1 : 0) +
      (s.messages > 0 ? 1 : 0);
  });

  return stats;
}

function ProjectsListContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDecisionMenu, setShowDecisionMenu] = useState(true);
  const [createMode, setCreateMode] = useState(null); // 'project' or 'validation'
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", cover_image: "" });
  const [uploadingCover, setUploadingCover] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [, forceTick] = React.useState(0);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", description: "", cover_image: "", members: [] });
  const [editingCoverUpload, setEditingCoverUpload] = useState(false);

  React.useEffect(() => {
    const t = window.setInterval(() => forceTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const { data: user, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (userError || (!userLoading && !user)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [user, userLoading, userError]);

  const userEmailLower = user?.email?.toLowerCase();

  const favoritesKey = storageKey(userEmailLower, "favorites");
  const hiddenKey = storageKey(userEmailLower, "hidden");
  const orderKey = storageKey(userEmailLower, "order");
  const workspaceKey = storageKey(userEmailLower, "workspace");

  const [favoriteIds, setFavoriteIds] = useState(() => readStringArray(favoritesKey));
  const [hiddenIds, setHiddenIds] = useState(() => readStringArray(hiddenKey));
  const [orderedIds, setOrderedIds] = useState(() => readStringArray(orderKey));
  const [workspaceIds, setWorkspaceIds] = useState(() => readStringArray(workspaceKey));

  React.useEffect(() => {
    setFavoriteIds(readStringArray(favoritesKey));
    setHiddenIds(readStringArray(hiddenKey));
    setOrderedIds(readStringArray(orderKey));
    setWorkspaceIds(readStringArray(workspaceKey));
  }, [favoritesKey, hiddenKey, orderKey, workspaceKey]);

  const { data: projects = [], isLoading, isError: projectsError, error: projectsErrorObj, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', userEmailLower],
    queryFn: async () => {
      const allProjects = await api.entities.Project.list('-created_date', 200);
      const list = Array.isArray(allProjects)
        ? allProjects
        : Array.isArray(allProjects?.items)
          ? allProjects.items
          : [];
      return list.filter((p) => {
        const createdByMatch = p.created_by && userEmailLower && p.created_by.toLowerCase() === userEmailLower;
        const memberMatch = p.members && Array.isArray(p.members) && userEmailLower
          && p.members.some((m) => m && m.toLowerCase() === userEmailLower);
        return createdByMatch || memberMatch;
      });
    },
    enabled: !!user,
    refetchOnMount: 'always',
  });

  const userCreatedProjects = projects.filter(p =>
    p.created_by && userEmailLower && p.created_by.toLowerCase() === userEmailLower
  );
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const maxProjects = user?.plan === "premium" ? MAX_PROJECTS_PREMIUM : MAX_PROJECTS_BASIC;
  const canCreateProject = isAdmin || userCreatedProjects.length < maxProjects;

  const createProjectMutation = useMutation({
    mutationFn: (projectData) => api.entities.Project.create({
      ...projectData,
      members: user?.email ? [user.email] : []
    }),
    onSuccess: (newProj) => {
      const key = ['projects', userEmailLower];
      queryClient.setQueryData(key, (old) => {
        const list = Array.isArray(old) ? old : [];
        if (list.some((p) => p.id === newProj.id)) return old;
        return [newProj, ...list];
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateOpen(false);
      setNewProject({ name: "", description: "", cover_image: "" });
      if (createMode === 'validation') {
        navigate(createPageUrl('ProductValidation') + `?project=${newProj.id}`);
      } else {
        navigate(createPageUrl('SocialBoard') + `?project=${newProj.id}`);
      }
      setCreateMode(null);
    },
    onError: (err) => {
      toast({
        title: "Projekt konnte nicht erstellt werden",
        description: err?.message || "Bitte mit Google anmelden für Cloud-Speicher oder Fehler prüfen.",
        variant: "destructive",
      });
    },
  });

  const deleteProjectsMutation = useMutation({
    mutationFn: async (projectIds) => {
      await Promise.all(projectIds.map(id => api.entities.Project.delete(id)));
    },
    onMutate: async (projectIds) => {
      const key = ['projects', userEmailLower];
      await queryClient.cancelQueries({ queryKey: key });
      const previousProjects = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old) =>
        (old || []).filter((p) => !projectIds.includes(p.id))
      );
      return { previousProjects };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProjects([]);
      setIsSelectionMode(false);
    },
    onError: (err, projectIds, context) => {
      if (context?.previousProjects != null) {
        queryClient.setQueryData(['projects', userEmailLower], context.previousProjects);
      }
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Project.update(id, data),
    onSuccess: (updated) => {
      const key = ['projects', userEmailLower];
      queryClient.setQueryData(key, (old) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditOpen(false);
      setEditProjectId(null);
    },
    onError: (err) => {
      toast({
        title: "Projekt konnte nicht gespeichert werden",
        description: err?.message || "Bitte erneut versuchen.",
        variant: "destructive",
      });
    },
  });

  const toggleProjectSelection = (projectId) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedProjects.length === 0) return;
    if (window.confirm(`Delete ${selectedProjects.length} project(s)?`)) {
      deleteProjectsMutation.mutate(selectedProjects);
    }
  };

  const handleDeleteAll = () => {
    if (projects.length === 0) return;
    if (window.confirm(`Delete ALL ${projects.length} projects? This cannot be undone!`)) {
      deleteProjectsMutation.mutate(projects.map(p => p.id));
    }
  };

  const openProject = (project) => {
    navigate(createPageUrl('SocialBoard') + `?project=${project.id}`);
  };

  const startProjectAndOpen = (project) => {
    startTimer(project.id, { source: "ProjectsList" });
    navigate(createPageUrl('SocialBoard') + `?project=${project.id}`);
  };

  const openEditProject = (project) => {
    setEditProjectId(project.id);
    setEditDraft({
      name: project?.name || "",
      description: project?.description || "",
      cover_image: project?.cover_image || "",
      members: clampMembers(project?.members || []),
    });
    setIsEditOpen(true);
  };

  const handleEditCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editProjectId) return;
    setEditingCoverUpload(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setEditDraft((d) => ({ ...d, cover_image: file_url }));
    } catch (err) {
      toast({
        title: "Cover Upload fehlgeschlagen",
        description: err?.message || "Bitte erneut versuchen.",
        variant: "destructive",
      });
    } finally {
      setEditingCoverUpload(false);
    }
  };

  const persistFavorites = (next) => {
    const uniqNext = uniq(next);
    setFavoriteIds(uniqNext);
    writeStringArray(favoritesKey, uniqNext);
  };

  const persistHidden = (next) => {
    const uniqNext = uniq(next);
    setHiddenIds(uniqNext);
    writeStringArray(hiddenKey, uniqNext);
  };

  const persistOrder = (next) => {
    const uniqNext = uniq(next);
    setOrderedIds(uniqNext);
    writeStringArray(orderKey, uniqNext);
  };

  const persistWorkspace = (next) => {
    const uniqNext = uniq(next);
    setWorkspaceIds(uniqNext);
    writeStringArray(workspaceKey, uniqNext);
  };

  const toggleFavorite = (projectId) => persistFavorites(toggleInArray(favoriteIds, projectId));
  const toggleHidden = (projectId) => persistHidden(toggleInArray(hiddenIds, projectId));

  const visibleProjects = useMemo(() => {
    const base = projects.filter((p) => !hiddenIds.includes(p.id));
    if (!orderedIds.length) return base;
    const byId = new Map(base.map((p) => [p.id, p]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    const rest = base.filter((p) => !orderedIds.includes(p.id));
    return [...ordered, ...rest];
  }, [projects, hiddenIds, orderedIds]);

  const favoriteProjects = useMemo(
    () => visibleProjects.filter((p) => favoriteIds.includes(p.id)),
    [visibleProjects, favoriteIds]
  );

  const nonFavoriteProjects = useMemo(
    () => visibleProjects.filter((p) => !favoriteIds.includes(p.id)),
    [visibleProjects, favoriteIds]
  );

  const workspaceProjects = useMemo(() => {
    const byId = new Map(visibleProjects.map((p) => [p.id, p]));
    return workspaceIds.map((id) => byId.get(id)).filter(Boolean);
  }, [visibleProjects, workspaceIds]);

  const { data: projectStats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ["projectStats", userEmailLower],
    enabled: !!user,
    staleTime: 30000,
    queryFn: async () => {
      const [tasks, posts, docs, canvasItems, files, messages] = await Promise.all([
        api.entities.Task.list("-updated_date", 500).catch(() => []),
        api.entities.Post.list("-created_date", 500).catch(() => []),
        api.entities.Document.list("-updated_date", 500).catch(() => []),
        api.entities.CanvasItem.list("-created_date", 500).catch(() => []),
        api.entities.FileRecord.list("-created_date", 500).catch(() => []),
        api.entities.Message.list("-created_date", 500).catch(() => []),
      ]);

      const onlyValid = (items) => (Array.isArray(items) ? items : []).filter((x) => x?.project_id);
      return computeProjectStats({
        tasks: onlyValid(tasks),
        posts: onlyValid(posts),
        docs: onlyValid(docs),
        canvasItems: onlyValid(canvasItems),
        files: onlyValid(files),
        messages: onlyValid(messages),
      });
    },
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (source.droppableId === "workspace" && destination.droppableId === "workspace") {
      const next = [...workspaceIds];
      next.splice(source.index, 1);
      next.splice(destination.index, 0, draggableId);
      persistWorkspace(next);
      return;
    }

    if (source.droppableId === "all" && destination.droppableId === "workspace") {
      persistWorkspace(uniq([...workspaceIds, draggableId]));
      return;
    }

    if (source.droppableId === "workspace" && destination.droppableId === "all") {
      persistWorkspace(workspaceIds.filter((id) => id !== draggableId));
      return;
    }

    if (source.droppableId === "all" && destination.droppableId === "all" && viewMode === "list") {
      const ids = nonFavoriteProjects.map((p) => p.id);
      const nextIds = [...ids];
      nextIds.splice(source.index, 1);
      nextIds.splice(destination.index, 0, draggableId);
      persistOrder(nextIds);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingCover(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setNewProject({ ...newProject, cover_image: file_url });
    } catch (error) {
      console.error('Failed to upload cover:', error);
    } finally {
      setUploadingCover(false);
    }
  };

  if (isLoading || userLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('myProjects')}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-[11px] sm:text-sm font-extrabold tracking-[0.08em] leading-tight text-slate-900">
              ORBYLOX - FREE PROJECT MANAGEMENT FOR EVERYONE
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
              title={language === 'en' ? 'Switch to German' : 'Switch to English'}
              className="text-slate-600 hover:text-slate-900"
            >
              <Languages className="w-5 h-5" />
            </Button>
            <span className="text-sm text-slate-600">👋 {user?.email}</span>
          </div>
        </div>
      </div>

      {/* Decision Menu Overlay */}
      <AnimatePresence>
        {showDecisionMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Was möchtest du tun?</h2>
                <p className="text-slate-500">Wähle eine Option um zu starten</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Create Project Option */}
                <motion.button
                  whileHover={canCreateProject ? { scale: 1.03, y: -4 } : {}}
                  whileTap={canCreateProject ? { scale: 0.98 } : {}}
                  onClick={() => {
                    if (!canCreateProject) {
                      alert(language === 'de' 
                        ? `❌ Du hast das Limit von ${maxProjects} Projekten erreicht!`
                        : `❌ You've reached the limit of ${maxProjects} projects!`);
                      return;
                    }
                    setShowDecisionMenu(false);
                    setCreateMode('project');
                    setIsCreateOpen(true);
                  }}
                  className={`bg-gradient-to-br from-indigo-50 to-purple-50 border-2 rounded-2xl p-6 text-left transition-all group ${
                    canCreateProject 
                      ? 'border-indigo-200 hover:border-indigo-400' 
                      : 'border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform ${
                    canCreateProject 
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 group-hover:scale-110' 
                      : 'bg-slate-400'
                  }`}>
                    <FolderOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Projekt erstellen</h3>
                  <p className="text-slate-600 text-sm">
                    {canCreateProject 
                      ? 'Starte ein neues Projekt mit Tasks, Docs, Chat und mehr'
                      : `Limit erreicht (${userCreatedProjects.length}/${maxProjects})`}
                  </p>
                </motion.button>

                {/* Validate Idea Option */}
                <motion.button
                  whileHover={canCreateProject ? { scale: 1.03, y: -4 } : {}}
                  whileTap={canCreateProject ? { scale: 0.98 } : {}}
                  onClick={() => {
                    if (!canCreateProject) {
                      alert(language === 'de' 
                        ? `❌ Du hast das Limit von ${maxProjects} Projekten erreicht!`
                        : `❌ You've reached the limit of ${maxProjects} projects!`);
                      return;
                    }
                    setShowDecisionMenu(false);
                    setCreateMode('validation');
                    setIsCreateOpen(true);
                  }}
                  className={`bg-gradient-to-br from-amber-50 to-orange-50 border-2 rounded-2xl p-6 text-left transition-all group ${
                    canCreateProject 
                      ? 'border-amber-200 hover:border-amber-400' 
                      : 'border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform ${
                    canCreateProject 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 group-hover:scale-110' 
                      : 'bg-slate-400'
                  }`}>
                    <Lightbulb className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Idee validieren</h3>
                  <p className="text-slate-600 text-sm">
                    {canCreateProject 
                      ? 'Prüfe deine Produktidee mit Lean Startup, Design Thinking & mehr'
                      : `Limit erreicht (${userCreatedProjects.length}/${maxProjects})`}
                  </p>
                </motion.button>
              </div>

              {/* Skip to projects */}
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowDecisionMenu(false)}
                  className="text-slate-500 hover:text-slate-700 text-sm underline"
                >
                  Zu meinen Projekten →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {user && !user.uid && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Data is stored only on this device. Sign in with Google to save to the cloud (Firestore).
          </div>
        )}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('myProjects')}</h2>
            <p className="text-slate-600">{t('selectProject')}</p>
          </div>
          
          <div className="flex gap-2">
            {projects.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedProjects([]);
                  }}
                  className="border-slate-300"
                >
                  {isSelectionMode ? 'Cancel' : 'Select'}
                </Button>
                {isSelectionMode && selectedProjects.length > 0 && (
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={deleteProjectsMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedProjects.length})
                  </Button>
                )}
                {isSelectionMode && (
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAll}
                    disabled={deleteProjectsMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                )}
              </>
            )}
            <Button 
              onClick={() => {
                if (!canCreateProject) {
                  alert(language === 'de' 
                    ? `❌ Du hast das Limit von ${maxProjects} Projekten erreicht!`
                    : `❌ You've reached the limit of ${maxProjects} projects!`);
                  return;
                }
                setShowDecisionMenu(true);
              }}
              className={`shadow-lg ${
                canCreateProject 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white' 
                  : 'bg-slate-400 text-white cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5 mr-2" />
              Neu {!isAdmin && `(${userCreatedProjects.length}/${maxProjects})`}
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) setCreateMode(null);
            }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {createMode === 'validation' ? (
                    <>
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Neues Validierungsprojekt
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-5 h-5 text-indigo-600" />
                      {t('newProject')}
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('projectName')}</label>
                  <Input
                    placeholder={t('projectNamePlaceholder')}
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
                  <Textarea
                    placeholder={t('descriptionPlaceholder')}
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Cover Image</label>
                  {newProject.cover_image ? (
                    <div className="relative">
                      <img src={newProject.cover_image} alt="Cover" className="w-full h-32 object-cover rounded-lg" />
                      <button
                        onClick={() => setNewProject({ ...newProject, cover_image: "" })}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleCoverUpload}
                        disabled={uploadingCover}
                      />
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-500 transition-colors flex flex-col items-center justify-center">
                        <Image className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500">
                          {uploadingCover ? 'Uploading...' : 'Click to upload cover'}
                        </span>
                      </div>
                    </label>
                  )}
                </div>
                <Button
                  type="button"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    if (!newProject.name?.trim()) {
                      toast({ title: "Bitte Projektname eingeben", variant: "destructive" });
                      return;
                    }
                    createProjectMutation.mutate({ ...newProject, name: newProject.name.trim() });
                  }}
                  disabled={createProjectMutation.isPending || !newProject.name?.trim()}
                >
                  {createProjectMutation.isPending ? "Wird erstellt…" : t('createAndOpen')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Edit Project Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditProjectId(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                Projekt bearbeiten
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Name</label>
                <Input value={editDraft.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Beschreibung</label>
                <Textarea rows={3} value={editDraft.description} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Cover Image</label>
                {editDraft.cover_image ? (
                  <div className="relative">
                    <img src={editDraft.cover_image} alt="Cover" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, cover_image: "" }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditCoverUpload} disabled={editingCoverUpload} />
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-indigo-500 transition-colors flex flex-col items-center justify-center">
                      <Image className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">
                        {editingCoverUpload ? 'Uploading...' : 'Click to upload cover'}
                      </span>
                    </div>
                  </label>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Members (max {MAX_MEMBERS_PER_PROJECT})</label>
                <Input
                  value={(editDraft.members || []).join(", ")}
                  onChange={(e) => setEditDraft((d) => ({ ...d, members: clampMembers(String(e.target.value).split(",")) }))}
                  placeholder="email1, email2"
                />
                <p className="text-xs text-slate-500 mt-1">Kommagetrennt.</p>
              </div>
              <Button
                type="button"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={updateProjectMutation.isPending || !editProjectId || !editDraft.name.trim()}
                onClick={() => {
                  const payload = {
                    name: editDraft.name.trim(),
                    description: editDraft.description,
                    cover_image: editDraft.cover_image || "",
                    members: clampMembers(editDraft.members),
                  };
                  updateProjectMutation.mutate({ id: editProjectId, data: payload });
                }}
              >
                {updateProjectMutation.isPending ? "Speichert…" : "Speichern"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View controls */}
        {projects.length > 0 && (
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-slate-300"
                onClick={() => setViewMode((m) => (m === "grid" ? "list" : "grid"))}
                title="Ansicht wechseln"
              >
                {viewMode === "grid" ? <List className="w-4 h-4 mr-2" /> : <LayoutGrid className="w-4 h-4 mr-2" />}
                {viewMode === "grid" ? "List" : "Grid"}
              </Button>
              <Button
                variant="outline"
                className="border-slate-300"
                onClick={() => {
                  persistHidden([]);
                  persistFavorites([]);
                  persistWorkspace([]);
                  persistOrder([]);
                }}
                title="Ansicht zurücksetzen"
              >
                Reset
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              {statsLoading ? "Stats…" : ""}
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projectsError ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-12 h-12 text-red-600" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 mb-2">Projekte konnten nicht geladen werden</h3>
            <p className="text-slate-600 mb-4 max-w-md mx-auto">
              {projectsErrorObj?.message || "Fehler beim Laden. Bitte prüfe die Verbindung und ob du mit Google angemeldet bist."}
            </p>
            <Button
              onClick={() => refetchProjects()}
              variant="outline"
              className="mr-2"
            >
              Erneut versuchen
            </Button>
            <Button
              onClick={() => setShowDecisionMenu(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Erstes Projekt erstellen
            </Button>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 mb-2">{hiddenIds.length > 0 ? "Alle Projekte sind ausgeblendet" : t('noProjects')}</h3>
            <p className="text-slate-600 mb-6">{hiddenIds.length > 0 ? "Blende Projekte wieder ein oder erstelle ein neues." : t('noProjectsDesc')}</p>
            {hiddenIds.length > 0 && (
              <Button
                onClick={() => persistHidden([])}
                variant="outline"
                className="mr-2"
              >
                <EyeOff className="w-5 h-5 mr-2" />
                Ausgeblendete anzeigen ({hiddenIds.length})
              </Button>
            )}
            <Button
              onClick={() => setShowDecisionMenu(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('createFirstProject')}
            </Button>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            {/* Workspace */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Workspace</span>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600">{workspaceProjects.length}</Badge>
                </div>
                <span className="text-xs text-slate-500">Drag projects here</span>
              </div>
              <Droppable droppableId="workspace" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex gap-3 overflow-x-auto p-3 rounded-2xl border border-slate-200 bg-white"
                  >
                    {workspaceProjects.map((project, index) => (
                      <Draggable draggableId={project.id} index={index} key={project.id}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} className="min-w-[260px]">
                            <Card
                              className="border-2 border-indigo-100 hover:border-indigo-300 cursor-pointer"
                              onClick={() => openProject(project)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    <CardTitle className="text-sm truncate">{project.name}</CardTitle>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); persistWorkspace(workspaceIds.filter((id) => id !== project.id)); }}
                                    className="text-slate-400 hover:text-red-500"
                                    title="Remove from workspace"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Feeds: <span className="font-medium text-slate-700">{projectStats?.[project.id]?.posts || 0}</span></span>
                                  <span>Modules: <span className="font-medium text-slate-700">{projectStats?.[project.id]?.activeModules || 0}</span></span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {workspaceProjects.length === 0 && (
                      <div className="text-xs text-slate-400 py-6 px-3">Drop projects here to pin them to your workspace.</div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Favorites */}
            {favoriteProjects.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-700">Favorites</span>
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700">{favoriteProjects.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      language={language}
                      t={t}
                      isSelectionMode={isSelectionMode}
                      selectedProjects={selectedProjects}
                      toggleProjectSelection={toggleProjectSelection}
                      openProject={openProject}
                      startProjectAndOpen={startProjectAndOpen}
                      stopTimer={stopTimer}
                      getProjectTimer={getProjectTimer}
                      forceTick={forceTick}
                      formatDuration={formatDuration}
                      onToggleFavorite={toggleFavorite}
                      onToggleHidden={toggleHidden}
                      onEdit={openEditProject}
                      isFavorite
                      stats={projectStats?.[project.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All projects */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{language === "de" ? "Projekte" : "Projects"}</span>
                <Badge variant="secondary" className="bg-slate-100 text-slate-600">{nonFavoriteProjects.length}</Badge>
              </div>
              {hiddenIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                  onClick={() => persistHidden([])}
                  title="Hidden projects wieder anzeigen"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Show hidden ({hiddenIds.length})
                </Button>
              )}
            </div>

            <Droppable droppableId="all">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {viewMode === "list" ? (
                    <div className="space-y-3">
                      {nonFavoriteProjects.map((project, index) => (
                        <Draggable draggableId={project.id} index={index} key={project.id}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className="flex items-stretch gap-2">
                              <div {...provided.dragHandleProps} className="flex items-center px-2 text-slate-300 hover:text-slate-500">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <ProjectCard
                                  project={project}
                                  language={language}
                                  t={t}
                                  isSelectionMode={isSelectionMode}
                                  selectedProjects={selectedProjects}
                                  toggleProjectSelection={toggleProjectSelection}
                                  openProject={openProject}
                                  startProjectAndOpen={startProjectAndOpen}
                                  stopTimer={stopTimer}
                                  getProjectTimer={getProjectTimer}
                                  forceTick={forceTick}
                                  formatDuration={formatDuration}
                                  onToggleFavorite={toggleFavorite}
                                  onToggleHidden={toggleHidden}
                                  onEdit={openEditProject}
                                  isFavorite={false}
                                  stats={projectStats?.[project.id]}
                                  compact
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {nonFavoriteProjects.map((project, index) => (
                        <Draggable draggableId={project.id} index={index} key={project.id}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              <ProjectCard
                                project={project}
                                language={language}
                                t={t}
                                isSelectionMode={isSelectionMode}
                                selectedProjects={selectedProjects}
                                toggleProjectSelection={toggleProjectSelection}
                                openProject={openProject}
                                startProjectAndOpen={startProjectAndOpen}
                                stopTimer={stopTimer}
                                getProjectTimer={getProjectTimer}
                                forceTick={forceTick}
                                formatDuration={formatDuration}
                                onToggleFavorite={toggleFavorite}
                                onToggleHidden={toggleHidden}
                                onEdit={openEditProject}
                                isFavorite={false}
                                stats={projectStats?.[project.id]}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  language,
  t,
  isSelectionMode,
  selectedProjects,
  toggleProjectSelection,
  openProject,
  startProjectAndOpen,
  stopTimer,
  getProjectTimer,
  forceTick,
  formatDuration,
  onToggleFavorite,
  onToggleHidden,
  onEdit,
  isFavorite,
  stats,
  compact = false,
}) {
  const timer = getProjectTimer(project.id);
  const running = timer.isRunning;
  const totalMs = timer.totalMs + (running ? Math.max(0, Date.now() - timer.startedAt) : 0);
  const lastWorkedAt = timer.lastWorkedAt;

  const feedCount = stats?.posts || 0;
  const activeModules = stats?.activeModules || 0;

  return (
    <Card
      className={`hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:border-indigo-300 relative ${
        selectedProjects.includes(project.id) ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
      }`}
      onClick={() => isSelectionMode ? toggleProjectSelection(project.id) : openProject(project)}
    >
      {isSelectionMode && (
        <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleProjectSelection(project.id)}
            className="p-1 bg-white rounded border-2 border-slate-300 hover:border-indigo-500"
          >
            {selectedProjects.includes(project.id) ? (
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      )}
      {project.cover_image && !compact && (
        <div className="w-full h-32 bg-slate-100 flex items-center justify-center p-4">
          <img 
            src={project.cover_image} 
            alt={project.name}
            className="w-24 h-24 object-cover rounded-full shadow-lg"
          />
        </div>
      )}
      <CardHeader className={compact ? "py-3" : undefined}>
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-3">
            <FolderOpen className="w-6 h-6 text-white" />
          </div>
          {!isSelectionMode && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(project.id);
                  forceTick((v) => v + 1);
                }}
                title={isFavorite ? "Unfavorite" : "Favorite"}
                className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                  isFavorite
                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    : "bg-white border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200"
                }`}
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(project);
                }}
                title="Edit project"
                className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleHidden(project.id);
                }}
                title="Hide project"
                className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (running) {
                    stopTimer({ reason: "manual" });
                  } else {
                    startProjectAndOpen(project);
                  }
                  forceTick((v) => v + 1);
                }}
                title={running ? "Stop timer" : "Start timer"}
                className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                  running
                    ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                }`}
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
          )}
        </div>
        <CardTitle className={compact ? "text-base" : "text-xl"}>{project.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {project.description || t('noDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : undefined}>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{(project.members?.length || 0) + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(project.created_date).toLocaleDateString(language === 'de' ? 'de' : 'en')}</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
          <span>
            {language === "de" ? "Zeit gesamt" : "Total time"}: <span className="font-medium text-slate-700">{formatDuration(totalMs)}</span>
          </span>
          <span className="truncate max-w-[55%] text-right">
            {lastWorkedAt
              ? (language === "de" ? "Zuletzt" : "Last") + ": " + new Date(lastWorkedAt).toLocaleString(language === "de" ? "de" : "en")
              : (language === "de" ? "Noch nie getrackt" : "Not tracked yet")}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Feeds: <span className="font-medium text-slate-700">{feedCount}</span>
          </span>
          <span className="text-slate-500">
            {language === "de" ? "Aktive Module" : "Active modules"}: <span className="font-medium text-slate-700">{activeModules}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectsList() {
  return (
    <LanguageProvider>
      <ProjectsListContent />
    </LanguageProvider>
  );
}