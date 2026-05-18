import React, { useMemo, useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, FolderOpen, Users, Calendar, ArrowRight, Languages, Trash2, CheckSquare, Square, Image, X, Lightbulb, Play, Pause, Star, EyeOff, Pencil, LayoutGrid, List, CheckCircle2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from "@/utils";
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { toast } from "@/components/ui/use-toast";
import { getProjectTimer, startTimer, stopTimer, formatDuration } from "@/lib/projectTimer";
import { useProjectsListRealtimeSync } from "@/hooks/useProjectsListRealtimeSync";
import { useProjectListPrefs } from "@/hooks/useProjectListPrefs";
import { hasFirebaseConfig } from "@/lib/firebase";
import { getMaxProjectsForPlan, canCreateProject as canCreateProjectByPlan } from "@/lib/planLimits";

const ADMIN_EMAIL = "gudfransen@gmail.com";
const MAX_MEMBERS_PER_PROJECT = 3;

function toggleInArray(arr, id) {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function uniq(arr) {
  return [...new Set(arr)];
}

function clampMembers(members) {
  return uniq(
    (Array.isArray(members) ? members : [])
      .map((m) => String(m || "").trim().toLowerCase())
      .filter(Boolean)
  ).slice(0, MAX_MEMBERS_PER_PROJECT);
}

/** Owner: Ersteller (E-Mail) oder Firebase-UID auf dem Dokument. */
function isProjectMine(project, userEmailLower, userUid) {
  if (userEmailLower && project?.created_by && String(project.created_by).toLowerCase() === userEmailLower) {
    return true;
  }
  if (userUid && project?.userId === userUid) {
    return true;
  }
  return false;
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
  const [showDecisionMenu, setShowDecisionMenu] = useState(false);
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
  const [editDraft, setEditDraft] = useState({ name: "", description: "", cover_image: "", members: [], is_done: false });
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

  const {
    favoriteIds,
    hiddenIds,
    persistFavorites,
    persistHidden,
  } = useProjectListPrefs(user);

  // Ask only once after login (per user).
  React.useEffect(() => {
    if (!userEmailLower) return;
    const key = `orbylox_decision_menu_seen_v1:${userEmailLower}`;
    let seen = false;
    try {
      seen = window.localStorage.getItem(key) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      setShowDecisionMenu(true);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    }
  }, [userEmailLower]);

  // Nach Umstieg auf Google/Firebase: Projekte lagen noch im Browser-localStorage — einmal in Firestore übernehmen.
  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.auth.migrateLocalDataFromBrowser();
        if (cancelled || !r) return;
        if (!r.ok && r.error) {
          toast({
            title: "Cloud-Übernahme fehlgeschlagen",
            description: String(r.error),
            variant: "destructive",
          });
          return;
        }
        if ((r.migratedProjects || 0) > 0 || (r.migratedDocs || 0) > 0) {
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          toast({
            title: "Daten übernommen",
            description:
              (r.migratedProjects || 0) > 0
                ? `${r.migratedProjects} Projekt(e) und zugehörige Daten wurden aus dem Browser-Speicher in die Cloud übernommen.`
                : `${r.migratedDocs} Einträge wurden aus dem Browser-Speicher in die Cloud übernommen.`,
          });
        }
      } catch (e) {
        console.error("[migrateLocalDataFromBrowser]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, queryClient]);

  useProjectsListRealtimeSync({
    queryClient,
    currentUser: user,
    enabled: !!user?.uid && hasFirebaseConfig,
  });

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
    refetchOnWindowFocus: true,
  });

  const userCreatedProjects = projects.filter(p =>
    p.created_by && userEmailLower && p.created_by.toLowerCase() === userEmailLower
  );
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const maxProjects = getMaxProjectsForPlan(user?.plan);
  const canCreateProject = canCreateProjectByPlan(
    user?.plan,
    userCreatedProjects.length,
    isAdmin,
  );

  const createProjectMutation = useMutation({
    mutationFn: (projectData) => api.entities.Project.create({
      ...projectData,
      members: user?.email ? [String(user.email).trim().toLowerCase()] : [],
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
        title: t('projectCreateFailedTitle'),
        description: err?.message || t('projectCreateFailedDesc'),
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
      toast({
        title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Delete failed',
        description:
          err?.message ||
          (language === 'de'
            ? 'Nur der Projekt-Ersteller kann löschen. In allen Browsern mit demselben Google-Konto anmelden.'
            : 'Only the project owner can delete. Sign in with the same Google account everywhere.'),
        variant: 'destructive',
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Project.update(id, data),
    onSuccess: (updated, variables) => {
      const key = ['projects', userEmailLower];
      queryClient.setQueryData(key, (old) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (variables?.closeEdit !== false) {
        setIsEditOpen(false);
        setEditProjectId(null);
      }
    },
    onError: (err) => {
      toast({
        title: t('projectCreateFailedTitle'),
        description: err?.message || t('tryAgain'),
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
      is_done: !!project?.is_done,
    });
    setIsEditOpen(true);
  };

  const toggleProjectDone = (project) => {
    updateProjectMutation.mutate({
      id: project.id,
      data: { is_done: !project.is_done },
      closeEdit: false,
    });
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

  const toggleFavorite = (projectId) => persistFavorites(toggleInArray(favoriteIds, projectId));
  const toggleHidden = (projectId) => persistHidden(toggleInArray(hiddenIds, projectId));

  const visibleProjects = useMemo(() => {
    const base = projects.filter((p) => !hiddenIds.includes(p.id));
    return base;
  }, [projects, hiddenIds]);

  const myVisibleProjects = useMemo(
    () => visibleProjects.filter((p) => isProjectMine(p, userEmailLower, user?.uid)),
    [visibleProjects, userEmailLower, user?.uid]
  );

  const sharedVisibleProjects = useMemo(
    () => visibleProjects.filter((p) => !isProjectMine(p, userEmailLower, user?.uid)),
    [visibleProjects, userEmailLower, user?.uid]
  );

  const myFavoriteProjects = useMemo(
    () => myVisibleProjects.filter((p) => favoriteIds.includes(p.id)),
    [myVisibleProjects, favoriteIds]
  );

  const myNonFavoriteProjects = useMemo(
    () => myVisibleProjects.filter((p) => !favoriteIds.includes(p.id)),
    [myVisibleProjects, favoriteIds]
  );

  const sharedFavoriteProjects = useMemo(
    () => sharedVisibleProjects.filter((p) => favoriteIds.includes(p.id)),
    [sharedVisibleProjects, favoriteIds]
  );

  const sharedNonFavoriteProjects = useMemo(
    () => sharedVisibleProjects.filter((p) => !favoriteIds.includes(p.id)),
    [sharedVisibleProjects, favoriteIds]
  );

  // Workspace removed by request.

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

  // Drag & Drop removed by request.

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
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(createPageUrl('IdeasHub'))}
              className="inline-flex border-amber-200 text-amber-900 hover:bg-amber-50 shrink-0"
              aria-label={language === 'de' ? 'Ideen Hub' : 'Ideas Hub'}
              title={language === 'de' ? 'Ideen Hub' : 'Ideas Hub'}
            >
              <Lightbulb className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">
                {language === 'de' ? 'Ideen Hub' : 'Ideas Hub'}
              </span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
              title={language === 'en' ? 'Switch to German' : 'Switch to English'}
              className="text-slate-600 hover:text-slate-900"
            >
              <Languages className="w-5 h-5" />
            </Button>
            <span className="hidden md:inline text-sm text-slate-600 truncate max-w-[140px] lg:max-w-none">
              👋 {user?.email}
            </span>
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
                <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('decideWhatToDo')}</h2>
                <p className="text-slate-500">{t('chooseOptionToStart')}</p>
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
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{t('createProject')}</h3>
                  <p className="text-slate-600 text-sm">
                    {canCreateProject 
                      ? (language === 'de'
                        ? 'Starte ein neues Projekt mit Tasks, Docs, Chat und mehr'
                        : 'Start a new project with tasks, docs, chat and more')
                      : `Limit erreicht (${userCreatedProjects.length}/${maxProjects})`}
                  </p>
                </motion.button>

                {/* Ideas Hub */}
                <motion.button
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowDecisionMenu(false);
                    navigate(createPageUrl('IdeasHub'));
                  }}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 hover:border-amber-400 rounded-2xl p-6 text-left transition-all group"
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform bg-gradient-to-br from-amber-500 to-orange-500 group-hover:scale-110">
                    <Lightbulb className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {language === 'de' ? 'Ideen Hub' : 'Ideas Hub'}
                  </h3>
                  <p className="text-slate-600 text-sm">
                    {language === 'de'
                      ? 'Ideen sammeln und später als Projekt starten'
                      : 'Collect ideas and start as a project when ready'}
                  </p>
                </motion.button>
              </div>

              {/* Skip to projects */}
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowDecisionMenu(false)}
                  className="text-slate-500 hover:text-slate-700 text-sm underline"
                >
                  {t('toMyProjects')} →
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
            {language === 'de'
              ? 'Daten liegen nur in diesem Browser (localStorage). Für Chrome, Brave & andere Geräte: mit Google anmelden.'
              : 'Data is stored only in this browser (localStorage). Sign in with Google to sync across Chrome, Brave, and other devices.'}
          </div>
        )}
        {user?.uid && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
            {language === 'de'
              ? 'Cloud-Sync aktiv: Projekte, Favoriten und Ausblenden werden in Firebase gespeichert. Überall dasselbe Google-Konto nutzen (nicht E-Mail-Login). Änderungen erscheinen in Safari, Brave & Co. nach kurzer Zeit automatisch.'
              : 'Cloud sync on: projects, favorites, and hidden state are stored in Firebase. Use the same Google account everywhere (not email login). Changes appear in Safari, Brave, and other browsers shortly.'}
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
              onClick={() => setShowDecisionMenu(true)}
              className="shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shrink-0"
              aria-label={
                language === 'de'
                  ? 'Neu: Projekt oder Ideen Hub'
                  : 'New: project or Ideas Hub'
              }
            >
              <Plus className="w-5 h-5 sm:mr-2" />
              <span className="hidden sm:inline">
                Neu {!isAdmin && `(${userCreatedProjects.length}/${maxProjects})`}
              </span>
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
                      toast({ title: t('enterProjectName'), variant: "destructive" });
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
                {t('editProject')}
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
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-project-done" className="text-sm font-medium text-slate-800">
                    {t('projectMarkDoneLabel')}
                  </Label>
                  <p className="text-xs text-slate-500">{t('projectMarkDoneHint')}</p>
                </div>
                <Switch
                  id="edit-project-done"
                  checked={!!editDraft.is_done}
                  onCheckedChange={(checked) => setEditDraft((d) => ({ ...d, is_done: checked }))}
                />
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
                    is_done: !!editDraft.is_done,
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
                {viewMode === "grid" ? t('viewToggleList') : t('viewToggleGrid')}
              </Button>
              <Button
                variant="outline"
                className="border-slate-300"
                onClick={() => {
                  persistHidden([]);
                  persistFavorites([]);
                }}
                title="Ansicht zurücksetzen"
              >
                {t('reset')}
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              {statsLoading ? t('statsLoading') : ""}
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
            <Button onClick={() => refetchProjects()} variant="outline" className="mr-2">
              {t('retry')}
            </Button>
            <Button
              onClick={() => setShowDecisionMenu(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('createFirstProjectCta')}
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
                {t('showHidden')} ({hiddenIds.length})
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
          <>
            {/* Meine Projekte */}
            <div className="mb-10 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span className="text-base font-semibold text-slate-800">{t('projectsMine')}</span>
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-800">
                    {myVisibleProjects.length}
                  </Badge>
                </div>
                {hiddenIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300"
                    onClick={() => persistHidden([])}
                    title={t('showHidden')}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    {t('showHidden')} ({hiddenIds.length})
                  </Button>
                )}
              </div>

              {myVisibleProjects.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">{t('noOwnProjectsYet')}</p>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {myFavoriteProjects.length > 0 && (
                      <motion.div layout className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-semibold text-slate-700">{t('favorites')}</span>
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                            {myFavoriteProjects.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {myFavoriteProjects.map((project) => (
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
                              onToggleDone={toggleProjectDone}
                              isOwner
                              isFavorite
                              stats={projectStats?.[project.id]}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-700">{t('projects')}</span>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                      {myNonFavoriteProjects.length}
                    </Badge>
                  </div>

                  {viewMode === "list" ? (
                    <div className="space-y-3">
                      {myNonFavoriteProjects.map((project) => (
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
                          onToggleDone={toggleProjectDone}
                          isOwner
                          isFavorite={false}
                          stats={projectStats?.[project.id]}
                          compact
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myNonFavoriteProjects.map((project) => (
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
                          onToggleDone={toggleProjectDone}
                          isOwner
                          isFavorite={false}
                          stats={projectStats?.[project.id]}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mit mir geteilt */}
            {sharedVisibleProjects.length > 0 && (
              <div className="mb-6 space-y-4 border-t border-slate-200 pt-10">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Share2 className="w-5 h-5 text-sky-600 shrink-0" />
                    <span className="text-base font-semibold text-slate-800">{t('projectsSharedWithMe')}</span>
                    <Badge variant="secondary" className="bg-sky-50 text-sky-800">
                      {sharedVisibleProjects.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t('projectsSharedHint')}</p>
                </div>

                <AnimatePresence mode="popLayout">
                  {sharedFavoriteProjects.length > 0 && (
                    <motion.div layout className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-700">{t('favorites')}</span>
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                          {sharedFavoriteProjects.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sharedFavoriteProjects.map((project) => (
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
                            onToggleDone={toggleProjectDone}
                            isOwner={false}
                            isFavorite
                            stats={projectStats?.[project.id]}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-700">{t('projects')}</span>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                    {sharedNonFavoriteProjects.length}
                  </Badge>
                </div>

                {viewMode === "list" ? (
                  <div className="space-y-3">
                    {sharedNonFavoriteProjects.map((project) => (
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
                        onToggleDone={toggleProjectDone}
                        isOwner={false}
                        isFavorite={false}
                        stats={projectStats?.[project.id]}
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sharedNonFavoriteProjects.map((project) => (
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
                        onToggleDone={toggleProjectDone}
                        isOwner={false}
                        isFavorite={false}
                        stats={projectStats?.[project.id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
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
  onToggleDone,
  isOwner = true,
  isFavorite,
  stats,
  compact = false,
}) {
  const timer = getProjectTimer(project.id, project);
  const running = timer.isRunning;
  const totalMs = timer.totalMs + (running ? Math.max(0, Date.now() - timer.startedAt) : 0);
  const lastWorkedAt = timer.lastWorkedAt;

  const feedCount = stats?.posts || 0;
  const activeModules = stats?.activeModules || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
    >
      <Card
        className={`hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 relative ${
          project.is_done
            ? "border-emerald-200/80 hover:border-emerald-300 bg-emerald-50/30"
            : "hover:border-indigo-300"
        } ${
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isOwner && (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleDone(project);
                    forceTick((v) => v + 1);
                  }}
                  title={project.is_done ? t('markProjectActive') : t('markProjectDone')}
                  className={`h-8 w-8 rounded-full border flex items-center justify-center transition-colors ${
                    project.is_done
                      ? "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200"
                      : "bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200"
                  }`}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </motion.button>
              )}
              <motion.button
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
                whileTap={{ scale: 0.9, rotate: isFavorite ? -10 : 10 }}
                whileHover={{ scale: 1.06 }}
              >
                <Star className="w-4 h-4" />
              </motion.button>
              {isOwner && (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(project);
                  }}
                  title="Edit project"
                  className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <Pencil className="w-4 h-4" />
                </motion.button>
              )}
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleHidden(project.id);
                }}
                title="Hide project"
                className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
              >
                <EyeOff className="w-4 h-4" />
              </motion.button>
              <motion.button
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
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </motion.button>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
          )}
        </div>
        <CardTitle className={`${compact ? "text-base" : "text-xl"} flex items-center gap-2 flex-wrap`}>
          <span>{project.name}</span>
          {project.is_done && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-semibold shrink-0">
              {t('projectDoneBadge')}
            </Badge>
          )}
        </CardTitle>
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
            {t('totalTime')}: <span className="font-medium text-slate-700">{formatDuration(totalMs)}</span>
          </span>
          <span className="truncate max-w-[55%] text-right">
            {lastWorkedAt
              ? t('last') + ": " + new Date(lastWorkedAt).toLocaleString(language === "de" ? "de" : "en")
              : t('notTrackedYet')}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {t('feeds')}: <span className="font-medium text-slate-700">{feedCount}</span>
          </span>
          <span className="text-slate-500">
            {t('activeModules')}: <span className="font-medium text-slate-700">{activeModules}</span>
          </span>
        </div>
      </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ProjectsList() {
  return (
    <LanguageProvider>
      <ProjectsListContent />
    </LanguageProvider>
  );
}