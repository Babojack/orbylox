import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FolderOpen, Users, Calendar, ArrowRight, Languages, Trash2, CheckSquare, Square, Image, X, Lightbulb, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from "@/utils";
import { useNavigate } from 'react-router-dom';
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { toast } from "@/components/ui/use-toast";

const ADMIN_EMAIL = "gudfransen@gmail.com";
const MAX_PROJECTS_BASIC = 2;
const MAX_PROJECTS_PREMIUM = 10;
const MAX_MEMBERS_PER_PROJECT = 3;

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
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 mb-2">{t('noProjects')}</h3>
            <p className="text-slate-600 mb-6">{t('noProjectsDesc')}</p>
            <Button
              onClick={() => setShowDecisionMenu(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('createFirstProject')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
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
                {project.cover_image && (
                  <div className="w-full h-32 bg-slate-100 flex items-center justify-center p-4">
                    <img 
                      src={project.cover_image} 
                      alt={project.name}
                      className="w-24 h-24 object-cover rounded-full shadow-lg"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-3">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    {!isSelectionMode && (
                      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    )}
                  </div>
                  <CardTitle className="text-xl">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || t('noDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsList() {
  return (
    <LanguageProvider>
      <ProjectsListContent />
    </LanguageProvider>
  );
}