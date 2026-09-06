import React, { useState } from "react";
import { api, isAdminEmail } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import {
  getMaxProjectsForPlan,
  getIdeaHubListLimit,
  canCreateProject as canCreateProjectByPlan,
} from "@/lib/planLimits";
import {
  Lightbulb,
  Plus,
  ArrowLeft,
  Languages,
  MoreVertical,
  Trash2,
  Pencil,
  Rocket,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { askDelete } from '@/lib/confirmDelete';


function IdeasHubContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, requestLanguageChange, prefetchSalute, t } = useLanguage();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", description: "" });

  const { data: user, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
    retry: false,
  });

  React.useEffect(() => {
    if (userError || (!userLoading && !user)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [user, userLoading, userError]);

  const userEmailLower = user?.email?.toLowerCase();

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideaHub", userEmailLower, user?.plan],
    queryFn: async () => {
      const limit = getIdeaHubListLimit(user?.plan);
      const all = await api.entities.IdeaHub.list("-created_date", limit);
      const list = Array.isArray(all) ? all : [];
      if (user?.uid) return list;
      return list.filter(
        (i) =>
          i.created_by &&
          userEmailLower &&
          String(i.created_by).toLowerCase() === userEmailLower,
      );
    },
    enabled: !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", userEmailLower],
    queryFn: async () => {
      const all = await api.entities.Project.list("-created_date", 200);
      return (Array.isArray(all) ? all : []).filter((p) => {
        const createdByMatch =
          p.created_by &&
          userEmailLower &&
          p.created_by.toLowerCase() === userEmailLower;
        const memberMatch =
          p.members &&
          Array.isArray(p.members) &&
          userEmailLower &&
          p.members.some((m) => m && m.toLowerCase() === userEmailLower);
        return createdByMatch || memberMatch;
      });
    },
    enabled: !!user,
  });

  const userCreatedProjects = projects.filter(
    (p) =>
      p.created_by &&
      userEmailLower &&
      p.created_by.toLowerCase() === userEmailLower,
  );
  const isAdmin = isAdminEmail(user?.email);
  const maxProjects = getMaxProjectsForPlan(user?.plan);
  const canCreateProject = canCreateProjectByPlan(
    user?.plan,
    userCreatedProjects.length,
    isAdmin,
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft({ title: "", description: "" });
    setIsFormOpen(true);
  };

  const openEdit = (idea) => {
    setEditingId(idea.id);
    setDraft({
      title: idea.title || "",
      description: idea.description || "",
    });
    setIsFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const title = draft.title?.trim();
      if (!title) throw new Error(t("ideaHubTitleRequired"));
      const payload = {
        title,
        description: draft.description?.trim() || "",
        status: "open",
      };
      if (editingId) {
        return api.entities.IdeaHub.update(editingId, payload);
      }
      return api.entities.IdeaHub.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideaHub"] });
      setIsFormOpen(false);
      setDraft({ title: "", description: "" });
      setEditingId(null);
    },
    onError: (err) => {
      toast({
        title: t("ideaHubSaveFailed"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.IdeaHub.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ideaHub"] }),
    onError: (err) => {
      toast({
        title: t("ideaHubDeleteFailed"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (idea) => {
      if (!canCreateProject) {
        throw new Error(
          language === "de"
            ? `Projekt-Limit erreicht (${maxProjects}).`
            : `Project limit reached (${maxProjects}).`,
        );
      }
      const newProj = await api.entities.Project.create({
        name: idea.title,
        description: idea.description || "",
        members: user?.email
          ? [String(user.email).trim().toLowerCase()]
          : [],
      });
      await api.entities.IdeaHub.update(idea.id, {
        status: "converted",
        project_id: newProj.id,
      });
      return newProj;
    },
    onSuccess: (newProj) => {
      queryClient.invalidateQueries({ queryKey: ["ideaHub"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: t("ideaHubProjectCreated"),
        description: newProj.name,
      });
      navigate(createPageUrl("SocialBoard") + `?project=${newProj.id}`);
    },
    onError: (err) => {
      toast({
        title: t("ideaHubConvertFailed"),
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const openIdeas = ideas.filter((i) => i.status !== "converted");
  const convertedIdeas = ideas.filter((i) => i.status === "converted");

  if (userLoading || !user) {
    return (
      <motion.div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ef5a24]" />
      </motion.div>
    );
  }

  return (
    <motion.div className="min-h-screen bg-[#f5f5f5]" initial={false}>
      <div className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("ProjectsList"))}
              aria-label={t("ideaHubBack")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <motion.div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                {t("ideaHubTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {t("ideaHubSubtitle")}
              </p>
            </motion.div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => requestLanguageChange(language === "en" ? "de" : "en")}
              onPointerEnter={prefetchSalute}
              onFocus={prefetchSalute}
            >
              <Languages className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              onClick={openCreate}
              className="bg-[#ef5a24] text-white hover:opacity-95"
              aria-label={t("ideaHubAdd")}
              title={t("ideaHubAdd")}
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("ideaHubAdd")}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {user && !user.uid && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            {t("ideaHubLocalOnlyHint")}
          </div>
        )}

        {isLoading ? (
          <p className="text-slate-500 text-center py-16">{t("ideaHubLoading")}</p>
        ) : openIdeas.length === 0 && convertedIdeas.length === 0 ? (
          <motion.div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#ef5a24] flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              {t("ideaHubEmptyTitle")}
            </h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              {t("ideaHubEmptyDesc")}
            </p>
            <Button
              type="button"
              onClick={openCreate}
              className="bg-[#ef5a24] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("ideaHubAddFirst")}
            </Button>
          </motion.div>
        ) : (
          <>
            {openIdeas.length > 0 && (
              <section className="mb-10">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  {t("ideaHubOpenSection")} ({openIdeas.length})
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {openIdeas.map((idea, index) => (
                      <IdeaHubCard
                        key={idea.id}
                        idea={idea}
                        index={index}
                        language={language}
                        t={t}
                        canCreateProject={canCreateProject}
                        isConverting={
                          convertMutation.isPending &&
                          convertMutation.variables?.id === idea.id
                        }
                        onEdit={() => openEdit(idea)}
                        onDelete={async () => { if (await askDelete({ kind: 'idea', itemName: idea.title })) deleteMutation.mutate(idea.id); }}
                        onConvert={() => convertMutation.mutate(idea)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {convertedIdeas.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  {t("ideaHubConvertedSection")} ({convertedIdeas.length})
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {convertedIdeas.map((idea, index) => (
                    <IdeaHubCard
                      key={idea.id}
                      idea={idea}
                      index={index}
                      language={language}
                      t={t}
                      converted
                      onOpenProject={() =>
                        idea.project_id &&
                        navigate(
                          createPageUrl("SocialBoard") +
                            `?project=${idea.project_id}`,
                        )
                      }
                      onDelete={async () => { if (await askDelete({ kind: 'idea', itemName: idea.title })) deleteMutation.mutate(idea.id); }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("ideaHubEdit") : t("ideaHubAdd")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t("ideaHubFieldTitle")}
              </label>
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder={t("ideaHubFieldTitlePlaceholder")}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t("ideaHubFieldDesc")}
              </label>
              <Textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                placeholder={t("ideaHubFieldDescPlaceholder")}
                className="mt-1 min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-[#ef5a24] hover:bg-black text-white"
              >
                {saveMutation.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function IdeaHubCard({
  idea,
  index,
  language,
  t,
  converted,
  canCreateProject,
  isConverting,
  onEdit,
  onDelete,
  onConvert,
  onOpenProject,
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow group relative"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">💡</span>
          <h3 className="font-semibold text-slate-900 line-clamp-2">
            {idea.title}
          </h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!converted && onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                {t("ideaHubEdit")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {idea.description ? (
        <p className="text-sm text-slate-600 line-clamp-3 mb-3">
          {idea.description}
        </p>
      ) : (
        <p className="text-sm text-slate-400 italic mb-3">
          {t("ideaHubNoDescription")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {idea.created_date
            ? format(new Date(idea.created_date), "dd.MM.yyyy")
            : ""}
        </span>
        {converted ? (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {t("ideaHubStatusConverted")}
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-50 text-amber-800">
            {t("ideaHubStatusOpen")}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {converted && idea.project_id && onOpenProject && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenProject}
            className="flex-1 min-w-[140px]"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            {t("ideaHubOpenProject")}
          </Button>
        )}
        {!converted && onConvert && (
          <Button
            type="button"
            size="sm"
            disabled={!canCreateProject || isConverting}
            onClick={onConvert}
            className="flex-1 min-w-[140px] bg-[#ef5a24] text-white hover:opacity-95"
            title={
              !canCreateProject
                ? language === "de"
                  ? "Projekt-Limit erreicht"
                  : "Project limit reached"
                : undefined
            }
          >
            <Rocket className="w-4 h-4 mr-1" />
            {isConverting ? t("saving") : t("ideaHubStartProject")}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

export default function IdeasHub() {
  return (
    <LanguageProvider>
      <IdeasHubContent />
    </LanguageProvider>
  );
}
