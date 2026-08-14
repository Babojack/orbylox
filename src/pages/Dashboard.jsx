import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { de as dateFnsDe, enUS as dateFnsEn } from "date-fns/locale";
import {
  LayoutDashboard,
  ListTodo,
  CheckCircle2,
  Circle,
  PlayCircle,
  Eye,
  MessageSquare,
  FileText,
  FolderOpen,
  Shapes,
  MessageSquare as ChatIcon,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
  Users,
} from "lucide-react";
import { api } from "@/api/apiClient";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const TASK_STATUS = {
  todo: { labelKey: "dashboardStatusTodo", color: "bg-slate-100 text-slate-700" },
  in_progress: { labelKey: "dashboardStatusProgress", color: "bg-blue-100 text-blue-700" },
  review: { labelKey: "dashboardStatusReview", color: "bg-purple-100 text-purple-700" },
  done: { labelKey: "dashboardStatusDone", color: "bg-green-100 text-green-700" },
};

function filterByProject(items, projectId) {
  if (!projectId || !Array.isArray(items)) return [];
  return items.filter((row) => row.project_id === projectId);
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get("project");
  const projectQuery = projectId ? `?project=${projectId}` : "";
  const dateLocale = language === "de" ? dateFnsDe : dateFnsEn;

  const { data: user, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
    retry: false,
  });

  React.useEffect(() => {
    if (userError || (!userLoading && !user)) {
      api.auth.redirectToLogin(window.location.pathname + window.location.search);
    }
  }, [user, userLoading, userError]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const all = await api.entities.Project.list("-created_date", 200);
      return (Array.isArray(all) ? all : []).find((p) => p.id === projectId) || null;
    },
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const all = await api.entities.Task.list("-updated_date", 300);
      return filterByProject(all, projectId);
    },
    enabled: !!projectId,
    staleTime: 15000,
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: ["dashboardSubtasks", projectId],
    queryFn: async () => {
      const allTasks = await api.entities.Task.list("-updated_date", 300);
      const projectTasks = filterByProject(allTasks, projectId);
      const taskIds = new Set(projectTasks.map((t) => t.id));
      const all = await api.entities.Subtask.list("-updated_date", 500);
      return (Array.isArray(all) ? all : []).filter((s) => taskIds.has(s.task_id));
    },
    enabled: !!projectId,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", projectId],
    queryFn: () => api.entities.Post.filter({ project_id: projectId }, "-created_date", 50),
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["docs", projectId],
    queryFn: () => api.entities.Document.filter({ project_id: projectId }, "-updated_date", 50),
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", projectId],
    queryFn: async () => {
      const all = await api.entities.Message.list("-created_date", 200);
      return filterByProject(all, projectId);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", projectId],
    queryFn: async () => {
      const all = await api.entities.FileRecord.list("-created_date", 200);
      return filterByProject(all, projectId);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: canvasItems = [] } = useQuery({
    queryKey: ["canvasItems", projectId],
    queryFn: async () => {
      const all = await api.entities.CanvasItem.list("-updated_date", 200);
      return filterByProject(all, projectId);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", projectId],
    queryFn: async () => {
      const all = await api.entities.Event.list("-created_date", 100);
      return filterByProject(all, projectId);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const stats = useMemo(() => {
    const byStatus = { todo: 0, in_progress: 0, review: 0, done: 0 };
    let highPriorityOpen = 0;
    tasks.forEach((task) => {
      const st = task.status && TASK_STATUS[task.status] ? task.status : "todo";
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (st !== "done" && task.priority === "high") highPriorityOpen += 1;
    });
    const open = byStatus.todo + byStatus.in_progress + byStatus.review;
    const total = tasks.length;
    const done = byStatus.done;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    const subtasksDone = subtasks.filter((s) => s.completed).length;
    const subtasksOpen = subtasks.length - subtasksDone;

    const myEmail = user?.email?.toLowerCase();
    const assignedToMe = tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.assignee_email &&
        String(task.assignee_email).toLowerCase() === myEmail,
    ).length;

    return {
      byStatus,
      open,
      done,
      total,
      progressPct,
      highPriorityOpen,
      subtasksDone,
      subtasksOpen,
      assignedToMe,
    };
  }, [tasks, subtasks, user?.email]);

  const recentOpenTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== "done")
        .sort(
          (a, b) =>
            new Date(b.updated_date || b.created_date || 0) -
            new Date(a.updated_date || a.created_date || 0),
        )
        .slice(0, 6),
    [tasks],
  );

  const recentDone = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status === "done")
        .sort(
          (a, b) =>
            new Date(b.updated_date || b.created_date || 0) -
            new Date(a.updated_date || a.created_date || 0),
        )
        .slice(0, 5),
    [tasks],
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => e.start_date && new Date(e.start_date).getTime() >= now - 86400000)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 4);
  }, [events]);

  if (!projectId) {
    return (
      <div className="p-6 text-center text-slate-500">
        {t("noProjectAccess")}
      </div>
    );
  }

  if (userLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const statCards = [
    {
      label: t("dashboardTasksDone"),
      value: stats.done,
      icon: CheckCircle2,
      accent: "from-emerald-500 to-teal-600",
    },
    {
      label: t("dashboardTasksOpen"),
      value: stats.open,
      icon: Circle,
      accent: "from-amber-500 to-orange-500",
    },
    {
      label: t("dashboardTasksInProgress"),
      value: stats.byStatus.in_progress,
      icon: PlayCircle,
      accent: "from-blue-500 to-indigo-600",
    },
    {
      label: t("dashboardAssignedToMe"),
      value: stats.assignedToMe,
      icon: Users,
      accent: "from-violet-500 to-purple-600",
    },
  ];

  const moduleCounts = [
    { label: t("overview"), count: posts.length, icon: MessageSquare, path: "SocialBoard" },
    { label: t("docs"), count: docs.length, icon: FileText, path: "Docs" },
    { label: t("files"), count: files.length, icon: FolderOpen, path: "FileHub" },
    { label: t("canvas"), count: canvasItems.length, icon: Shapes, path: "Canvas" },
    { label: t("chat"), count: messages.length, icon: ChatIcon, path: "Chat" },
    { label: t("calendar"), count: events.length, icon: CalendarDays, path: "Calendar" },
  ];

  return (
    <div className="space-y-6 w-full min-w-0 max-w-6xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {t("dashboardTitle")}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {project?.name || t("dashboardTitle")}
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">
            {t("dashboardSubtitle")}
          </p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
          <Link to={createPageUrl("ScrumBoard") + projectQuery}>
            {t("dashboardGoToBoard")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center mb-3`}
              >
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 border-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-emerald-600" />
              {t("dashboardTicketOverview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">{t("dashboardCompletion")}</span>
                <span className="font-semibold text-slate-900">{stats.progressPct}%</span>
              </div>
              <Progress value={stats.progressPct} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">
                {t("dashboardCompletionDetail", {
                  done: stats.done,
                  total: stats.total,
                })}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(TASK_STATUS).map(([key, meta]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-center"
                >
                  <p className="text-xl font-bold text-slate-900">
                    {stats.byStatus[key] || 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t(meta.labelKey)}</p>
                </div>
              ))}
            </div>

            {(stats.subtasksOpen > 0 || stats.subtasksDone > 0) && (
              <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">
                {t("dashboardSubtasks", {
                  done: stats.subtasksDone,
                  open: stats.subtasksOpen,
                })}
              </p>
            )}

            {stats.highPriorityOpen > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {t("dashboardHighPriority", { count: stats.highPriorityOpen })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("dashboardModules")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {moduleCounts.map((mod) => (
              <Link
                key={mod.path}
                to={createPageUrl(mod.path) + projectQuery}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <mod.icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  {mod.label}
                </span>
                <Badge variant="secondary">{mod.count}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("dashboardOpenTickets")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl("ScrumBoard") + projectQuery}>
                {t("dashboardViewAll")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOpenTasks.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {t("dashboardNoOpenTasks")}
              </p>
            ) : (
              <ul className="space-y-2">
                {recentOpenTasks.map((task) => {
                  const st = TASK_STATUS[task.status] || TASK_STATUS.todo;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100"
                    >
                      <span className="text-sm font-medium text-slate-800 truncate flex-1">
                        {task.title || t("dashboardUntitled")}
                      </span>
                      <Badge className={`shrink-0 text-[10px] ${st.color}`}>
                        {t(st.labelKey)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {t("dashboardRecentlyDone")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentDone.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {t("dashboardNoDoneYet")}
              </p>
            ) : (
              <ul className="space-y-2">
                {recentDone.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg bg-emerald-50/50 border border-emerald-100"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      {task.title || t("dashboardUntitled")}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {task.updated_date
                        ? formatDistanceToNow(new Date(task.updated_date), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {upcomingEvents.length > 0 && (
        <Card className="border-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              {t("dashboardUpcomingEvents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {upcomingEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center justify-between text-sm p-2 rounded-lg border border-slate-100"
                >
                  <span className="font-medium text-slate-800">{ev.title || "—"}</span>
                  <span className="text-slate-500 text-xs">
                    {ev.start_date
                      ? format(new Date(ev.start_date), "dd.MM.yyyy HH:mm", {
                          locale: dateLocale,
                        })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
