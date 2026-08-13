import React, { useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { de as dateFnsDe, enUS as dateFnsEn } from "date-fns/locale";
import { 
  LayoutGrid,
  LayoutDashboard,
  ListTodo, 
  FileText, 
  Shapes, 
  MessageSquare, 
  FolderOpen,
  Settings,
  Bell,
  Search,
  User,
  LogOut,
  Languages,
  Menu,
  X,
  Moon,
  Sun,
  Puzzle,
  CalendarDays,
  CreditCard,
  Lightbulb,
  Rocket,
  Video
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createPageUrl } from "@/utils";
import { api } from "@/api/apiClient";
import { hasFirebaseConfig } from "@/lib/firebase";
import {
  useProjectRealtimeSync,
  teamActivityPathForEntity,
} from "@/hooks/useProjectRealtimeSync";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import VoiceAgent from "@/components/VoiceAgent";
import TextToTicketPopup from "@/components/TextToTicketPopup";
import { PageTransition } from "@/components/PageTransition";
import { startTimer, getActiveTimer, setTrackedTimeSyncHandler } from "@/lib/projectTimer";

const DEFAULT_ADMIN_EMAILS = ["gudfransen@gmail.com", "jey.afandiyev@gmail.com"];

function getAdminEmails() {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv])];
}

// Random avatar URLs for new users
const RANDOM_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Noah',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ella',
];

function teamActivityLucideIcon(entityName) {
  switch (entityName) {
    case "Post":
    case "PostComment":
      return LayoutGrid;
    case "Message":
      return MessageSquare;
    case "Task":
    case "Subtask":
    case "TaskComment":
      return ListTodo;
    case "Document":
      return FileText;
    case "FileRecord":
    case "Folder":
      return FolderOpen;
    case "CanvasItem":
    case "CanvasConnection":
      return Shapes;
    case "CustomIntegration":
      return Puzzle;
    case "Event":
      return CalendarDays;
    case "StartupStep":
    case "StartupJourney":
      return Rocket;
    case "ProductIdea":
      return Lightbulb;
    default:
      return Bell;
  }
}

function LayoutContent({ children, currentPageName }) {
    const { isDark, toggleTheme } = useTheme();
    const location = useLocation();
    const queryClient = useQueryClient();
    const searchParams = new URLSearchParams(location.search);
    const projectId = searchParams.get('project');
    const { language, setLanguage, t } = useLanguage();
    const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

    // Fetch current user
    const { data: currentUser } = useQuery({
      queryKey: ['currentUser'],
      queryFn: async () => {
        const user = await api.auth.me();
        // Assign random avatar if user doesn't have one
        if (!user.avatar_url) {
          const randomAvatar = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)];
          await api.auth.updateMe({ avatar_url: randomAvatar });
          user.avatar_url = randomAvatar;
        }
        return user;
      }
    });

  // Mobile: closed by default, Desktop: open by default
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });
  const [lastSeenPosts, setLastSeenPosts] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lastSeenPosts') || '{}');
    } catch { return {}; }
  });
  const [lastSeenMessages, setLastSeenMessages] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lastSeenMessages') || '{}');
    } catch { return {}; }
  });
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [teamActivityItems, setTeamActivityItems] = React.useState([]);
  const isAdmin = getAdminEmails().includes((currentUser?.email || "").toLowerCase());

  React.useEffect(() => {
    setTeamActivityItems([]);
  }, [projectId]);

  const onTeamActivity = useCallback(({ entityName, messageKey }) => {
    setTeamActivityItems((prev) =>
      [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          entityName,
          messageKey,
          at: Date.now(),
          read: false,
        },
        ...prev,
      ].slice(0, 40),
    );
  }, []);

  useProjectRealtimeSync({
    queryClient,
    projectId,
    currentUser,
    enabled: !!projectId && !!currentUser?.uid && hasFirebaseConfig,
    onTeamActivity,
  });

  const teamActivityUnread = teamActivityItems.filter((i) => !i.read).length;
  const dateLocale = language === "de" ? dateFnsDe : dateFnsEn;

  const handleNotificationsOpenChange = React.useCallback((open) => {
    setShowNotifications(open);
    if (open) {
      setTeamActivityItems((prev) => prev.map((x) => ({ ...x, read: true })));
    }
  }, []);

  const pageTransitionKey = `${location.pathname}${location.search}|${language}`;

  const closeSidebar = React.useCallback((e) => {
    if (e?.stopPropagation) e.stopPropagation();
    setIsSidebarOpen(false);
  }, []);

  const toggleSidebar = React.useCallback((e) => {
    if (e?.stopPropagation) e.stopPropagation();
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Persist timer sessions to the Project document (Firestore) so time syncs across devices.
  React.useEffect(() => {
    setTrackedTimeSyncHandler(async ({ projectId, elapsedMs, lastWorkedAt }) => {
      try {
        await api.entities.Project.addTrackedTimeSession(projectId, elapsedMs, lastWorkedAt);
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["project"] });
      } catch (e) {
        console.error("[timer sync]", e);
      }
    });
    return () => setTrackedTimeSyncHandler(null);
  }, [queryClient]);

  // Auto-start timer when user interacts inside a selected project.
  React.useEffect(() => {
    if (!projectId) return;

    const markActivity = (event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return;
      if (target.closest("aside")) return;
      if (target.closest('[data-timer-ignore="true"]')) return;
      const active = getActiveTimer();
      if (active?.projectId === projectId) return;
      startTimer(projectId, { source: "project_activity_auto" });
    };

    const onKeyDown = (event) => {
      const active = getActiveTimer();
      if (active?.projectId === projectId) return;
      const target = event?.target;
      if (target instanceof Element && target.closest("aside")) return;
      startTimer(projectId, { source: "project_typing_auto" });
    };

    window.addEventListener("pointerdown", markActivity, true);
    window.addEventListener("input", markActivity, true);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", markActivity, true);
      window.removeEventListener("input", markActivity, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [projectId]);

  // Ask before leaving while timer is running. If user leaves, timer continues running.
  React.useEffect(() => {
    const onBeforeUnload = (e) => {
      const active = getActiveTimer();
      if (active?.projectId) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
  
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId
  });

  // Fetch posts for notification indicator - MUST be before any conditional returns
  const { data: posts = [] } = useQuery({
    queryKey: ['posts', projectId],
    queryFn: async () => {
      const allPosts = await api.entities.Post.list('-created_date');
      return allPosts.filter(p => p.project_id === projectId);
    },
    enabled: !!projectId,
    staleTime: 30000
  });

  // Fetch messages for notification indicator - MUST be before any conditional returns
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', projectId],
    queryFn: async () => {
      const allMessages = await api.entities.Message.list('-created_date');
      return allMessages.filter(m => m.project_id === projectId);
    },
    enabled: !!projectId,
    staleTime: 30000
  });

  // Fetch all data immediately when project is selected - force refresh
  useEffect(() => {
    if (projectId) {
      // Force fetch all data with fresh data
      const fetchAll = async () => {
        await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['tasks', projectId],
            queryFn: async () => {
              const allTasks = await api.entities.Task.list('-updated_date');
              return allTasks.filter(t => t.project_id === projectId);
            },
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['allSubtasks', projectId],
            queryFn: () => api.entities.Subtask.list('-created_date'),
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['allComments', projectId],
            queryFn: () => api.entities.TaskComment.list('-created_date'),
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['docs', projectId],
            queryFn: async () => {
              const allDocs = await api.entities.Document.list('-updated_date');
              return allDocs.filter(d => d.project_id === projectId);
            },
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['files', projectId, null],
            queryFn: async () => {
              const allFiles = await api.entities.FileRecord.list('-created_date');
              return allFiles.filter(f => f.project_id === projectId && !f.folder_id);
            },
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['folders', projectId],
            queryFn: async () => {
              const allFolders = await api.entities.Folder.list('-created_date');
              return allFolders.filter(f => f.project_id === projectId);
            },
            staleTime: 0
          }),
          queryClient.fetchQuery({
            queryKey: ['customIntegrations', projectId],
            queryFn: async () => {
              const all = await api.entities.CustomIntegration.list('-created_date');
              return all.filter(i => i.project_id === projectId);
            },
            staleTime: 0
          })
        ]);
      };
      fetchAll();
    }
  }, [projectId, queryClient]);

  // Redirect to projects list if no project selected (but not from standalone pages like Landing, Profile, Login, etc.)
  React.useEffect(() => {
    if (
      !projectId &&
      currentPageName !== 'ProjectsList' &&
      currentPageName !== 'IdeasHub' &&
      currentPageName !== 'index' &&
      currentPageName !== 'Landing' &&
      currentPageName !== 'Profile' &&
      currentPageName !== 'Subscription' &&
      currentPageName !== 'Impressum' &&
      currentPageName !== 'AdminUsers' &&
      currentPageName !== 'login'
    ) {
      window.location.href = createPageUrl('ProjectsList');
    }
  }, [projectId, currentPageName]);

  // Calculate if user is on specific pages RIGHT NOW
  const isOnSocialBoard = location.pathname.includes('SocialBoard');
  const isOnChat = location.pathname.includes('Chat');

  // Mark as seen when visiting page - runs once when page changes
  const currentPath = location.pathname;
  React.useEffect(() => {
    if (currentPath.includes('SocialBoard') && projectId) {
      const futureTime = Date.now() + 60000;
      const updated = { ...JSON.parse(localStorage.getItem('lastSeenPosts') || '{}'), [projectId]: futureTime };
      localStorage.setItem('lastSeenPosts', JSON.stringify(updated));
      setLastSeenPosts(updated);
    }
  }, [currentPath, projectId]);
  
  React.useEffect(() => {
    if (currentPath.includes('Chat') && projectId) {
      const futureTime = Date.now() + 60000;
      const updated = { ...JSON.parse(localStorage.getItem('lastSeenMessages') || '{}'), [projectId]: futureTime };
      localStorage.setItem('lastSeenMessages', JSON.stringify(updated));
      setLastSeenMessages(updated);
    }
  }, [currentPath, projectId]);

  // Force re-render counter to update badges immediately
  const [forceUpdate, setForceUpdate] = React.useState(0);
  
  // Trigger force update when navigating to these pages
  React.useEffect(() => {
    if (isOnSocialBoard || isOnChat) {
      setForceUpdate(prev => prev + 1);
    }
  }, [isOnSocialBoard, isOnChat]);

  // Calculate counts - ALWAYS 0 if on the page, otherwise check localStorage directly
  let newPostsCount = 0;
  let newMessagesCount = 0;
  
  if (!isOnSocialBoard && posts.length > 0) {
    const stored = JSON.parse(localStorage.getItem('lastSeenPosts') || '{}');
    const lastSeen = stored[projectId] || 0;
    newPostsCount = posts.filter(p => new Date(p.created_date).getTime() > lastSeen).length;
  }
  
  if (!isOnChat && messages.length > 0) {
    const stored = JSON.parse(localStorage.getItem('lastSeenMessages') || '{}');
    const lastSeen = stored[projectId] || 0;
    newMessagesCount = messages.filter(m => new Date(m.created_date).getTime() > lastSeen).length;
  }
  
  // Don't show layout on projects list page or standalone pages
  if (currentPageName === 'ProjectsList' || currentPageName === 'IdeasHub' || currentPageName === 'index' || currentPageName === 'Landing' || currentPageName === 'Profile' || currentPageName === 'Subscription' || currentPageName === 'Impressum' || currentPageName === 'AdminUsers') {
    return (
      <PageTransition pageKey={pageTransitionKey} className="min-h-screen w-full">
        {children}
      </PageTransition>
    );
  }
  
  if (!projectId) {
    return null;
  }

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: "Dashboard", color: "bg-sky-500" },
    { icon: LayoutGrid, label: t('overview'), path: "SocialBoard", badge: newPostsCount, color: "bg-indigo-500" },
    { icon: ListTodo, label: t('tasks'), path: "ScrumBoard", color: "bg-emerald-500" },
    { icon: FileText, label: t('docs'), path: "Docs", color: "bg-amber-500" },
    { icon: Shapes, label: t('canvas'), path: "Canvas", color: "bg-purple-500" },
    { icon: FolderOpen, label: t('files'), path: "FileHub", color: "bg-orange-500" },
    { icon: CalendarDays, label: t('calendar'), path: "Calendar", color: "bg-teal-500" },
    { icon: MessageSquare, label: t('chat'), path: "Chat", badge: newMessagesCount, color: "bg-blue-500" },
    { icon: Video, label: language === 'de' ? "Meeting" : "Meeting", path: "Meeting", color: "bg-rose-500" },
    { icon: Rocket, label: "Startup Builder", path: "StartupBuilder", disabled: true, alpha: true, color: "bg-rose-500" },
    { icon: Puzzle, label: language === 'de' ? "Unsere Tools" : "Our Tools", path: "Integrations", color: "bg-cyan-500" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 transition-colors duration-300 ease-out">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity duration-200 ease-out motion-reduce:transition-none"
          onPointerDown={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64 border-r border-slate-100 dark:border-slate-800 flex flex-col fixed lg:fixed h-full bg-white dark:bg-slate-900 z-50 transition-transform duration-300 ease-out motion-reduce:transition-none`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-50 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="text-[11px] sm:text-xs font-extrabold tracking-[0.08em] leading-tight text-slate-900 dark:text-slate-100">
              ORBYLOX - FREE PROJECT MANAGEMENT FOR EVERYONE
            </div>
          </div>
          <button 
            type="button"
            onPointerDown={closeSidebar}
            className="h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname.includes(item.path);
                const isDisabled = !!item.disabled;
                const alpha = !!item.alpha;
                // TaskNow: alle Einträge weiß mit schwarzem Rahmen, aktiv = orange.
                const navClassName = `
                      relative flex items-center gap-3 px-4 py-3 border-2 border-black dark:border-white
                      font-bold uppercase tracking-wide text-sm transition-colors group
                      ${isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-[#ef5a24] text-white border-[#ef5a24]'
                          : 'bg-white text-black dark:bg-transparent dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'}
                    `;
                const navBody = (
                  <>
                    <item.icon className="w-5 h-5 relative z-10 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-wide relative z-10 flex-1">
                      {item.label}
                    </span>
                    {alpha ? (
                      <span className="px-1.5 py-0.5 border border-current text-[8px] font-extrabold tracking-wider relative z-10">
                        ALPHA
                      </span>
                    ) : item.beta ? (
                      <span className="px-1.5 py-0.5 border border-current text-[8px] font-bold relative z-10">
                        Beta
                      </span>
                    ) : null}
                    {item.badge > 0 && (
                      <span className="min-w-5 h-5 px-1.5 bg-[#ef5a24] text-white text-[10px] font-bold flex items-center justify-center relative z-10">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </>
                );
                return isDisabled ? (
                  <div key={item.label} className={navClassName}>
                    {navBody}
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    to={createPageUrl(item.path) + location.search}
                    onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                    className={navClassName}
                  >
                    {navBody}
                  </Link>
                );
              })}
            </div>
          </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
               <Link 
                 to={createPageUrl('ProjectsList')}
                 onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                 className="flex items-center gap-3 px-4 py-3 bg-black text-white border-2 border-black font-bold uppercase tracking-wide text-sm hover:bg-white hover:text-black transition-colors group"
               >
                  <FolderOpen className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-sm font-medium text-white">{t('allProjects')}</span>
               </Link>
               <Link 
                 to={createPageUrl('Settings') + location.search} 
                 onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                 className="flex items-center gap-3 px-4 py-3 bg-slate-500 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 group"
               >
                  <Settings className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-sm font-medium text-white">{t('settings')}</span>
               </Link>
               <button 
                 onClick={() => {
                   api.auth.logout();
                   window.location.href = createPageUrl('login');
                 }} 
                 className="w-full flex items-center gap-3 px-4 py-3 bg-red-500 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 group"
               >
                  <LogOut className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-sm font-medium text-white">{t('logout')}</span>
               </button>
          </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 min-w-0 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'} bg-white dark:bg-slate-900 min-h-screen flex flex-col transition-[margin] duration-300 ease-out motion-reduce:transition-none`}>
        {/* Header */}
        <header className="h-16 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-50 transition-colors duration-300 ease-out motion-reduce:transition-none">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              type="button"
              onPointerDown={toggleSidebar}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-base md:text-lg text-slate-800 dark:text-slate-100 truncate">{project?.name || t('overview')}</h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-100">{t('online')}</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <button
               type="button"
               className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-accent hidden sm:flex transition-colors duration-200 ease-out motion-reduce:transition-none"
               onClick={toggleTheme}
               title={isDark ? 'Light Mode' : 'Dark Mode'}
             >
               {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             <button
               type="button"
               className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-accent hidden sm:flex transition-colors duration-200 ease-out motion-reduce:transition-none"
               onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
               title={language === 'en' ? 'Switch to German' : 'Switch to English'}
             >
               <Languages className="w-5 h-5" />
             </button>
             <DropdownMenu open={showNotifications} onOpenChange={handleNotificationsOpenChange}>
               <DropdownMenuTrigger asChild>
                 <button type="button" className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-accent relative transition-colors duration-200 ease-out motion-reduce:transition-none" aria-label={t('notifications')}>
                   <Bell className="w-5 h-5" />
                   {(newPostsCount + newMessagesCount + teamActivityUnread) > 0 && (
                     <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                   )}
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[min(24rem,calc(100vh-6rem))] overflow-y-auto p-0 dark:border-slate-700 dark:bg-slate-900">
                 <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                   <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{t('notifications')}</p>
                 </div>
                 <div className="py-1">
                   {newPostsCount > 0 && (
                     <DropdownMenuItem asChild>
                       <Link to={createPageUrl('SocialBoard') + location.search} className="cursor-pointer flex items-center gap-2">
                         <LayoutGrid className="w-4 h-4 text-indigo-500 shrink-0" />
                         <span className="text-sm">{t('notificationFeedUnread', { count: newPostsCount })}</span>
                       </Link>
                     </DropdownMenuItem>
                   )}
                   {newMessagesCount > 0 && (
                     <DropdownMenuItem asChild>
                       <Link to={createPageUrl('Chat') + location.search} className="cursor-pointer flex items-center gap-2">
                         <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                         <span className="text-sm">{t('notificationChatUnread', { count: newMessagesCount })}</span>
                       </Link>
                     </DropdownMenuItem>
                   )}
                   {teamActivityItems.length > 0 && (
                     <>
                       <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                         {t('notificationTeamHeading')}
                       </div>
                       {teamActivityItems.map((item) => {
                         const path = teamActivityPathForEntity(item.entityName);
                         const Icon = teamActivityLucideIcon(item.entityName);
                         const rel = formatDistanceToNow(item.at, { addSuffix: true, locale: dateLocale });
                         return (
                           <DropdownMenuItem key={item.id} asChild>
                             <Link
                               to={createPageUrl(path) + location.search}
                               className={`cursor-pointer flex gap-3 items-start py-2.5 ${item.read ? 'opacity-70' : ''}`}
                               onClick={() => setShowNotifications(false)}
                             >
                               <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                               <span className="flex-1 min-w-0 text-sm leading-snug text-slate-800 dark:text-slate-100">
                                 {t(item.messageKey)}
                                 <span className="block text-xs text-slate-400 dark:text-slate-500 mt-1">{rel}</span>
                               </span>
                             </Link>
                           </DropdownMenuItem>
                         );
                       })}
                       <DropdownMenuItem
                         className="text-xs text-slate-500 focus:text-slate-700 dark:text-slate-400 cursor-pointer justify-center"
                         onSelect={() => setTeamActivityItems([])}
                       >
                         {t('notificationClearTeam')}
                       </DropdownMenuItem>
                     </>
                   )}
                   {newPostsCount === 0 && newMessagesCount === 0 && teamActivityItems.length === 0 && (
                     <div className="px-3 py-8 text-center text-sm text-slate-400">
                       {t('noNotifications')}
                     </div>
                   )}
                 </div>
               </DropdownMenuContent>
             </DropdownMenu>

             <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
               <DropdownMenuTrigger asChild>
                 <button className="focus:outline-none">
                   <Avatar className="w-8 h-8 border border-slate-100 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all">
                     <AvatarImage src={currentUser?.avatar_url} />
                     <AvatarFallback className="bg-indigo-100 text-indigo-600">
                       {currentUser?.full_name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
                     </AvatarFallback>
                   </Avatar>
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                     <div className="px-3 py-2 border-b border-slate-100">
                       <p className="font-medium text-sm text-slate-900">{currentUser?.full_name || (language === 'de' ? 'Benutzer' : 'User')}</p>
                       <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                     </div>
                     <DropdownMenuItem asChild>
                       <Link to={createPageUrl('Profile') + location.search} className="cursor-pointer">
                         <User className="w-4 h-4 mr-2" />
                         {t('editProfile')}
                       </Link>
                     </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                      <Link to={createPageUrl('Settings') + location.search} className="cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        {t('settings')}
                      </Link>
                     </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                       <Link to={createPageUrl('Subscription')} className="cursor-pointer">
                         <CreditCard className="w-4 h-4 mr-2" />
                         {t('subscription')}
                       </Link>
                     </DropdownMenuItem>
                     {isAdmin && (
                       <DropdownMenuItem asChild>
                        <Link to={createPageUrl('AdminUsers')} className="cursor-pointer">
                          <Settings className="w-4 h-4 mr-2" />
                          Admin Panel
                        </Link>
                       </DropdownMenuItem>
                     )}
                     <DropdownMenuSeparator />
                     <DropdownMenuItem 
                      onClick={() => {
                        api.auth.logout();
                        window.location.href = createPageUrl('login');
                      }}
                      className="text-red-600 cursor-pointer"
                     >
                      <LogOut className="w-4 h-4 mr-2" />
                      {t('logout')}
                     </DropdownMenuItem>
                   </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden flex-1 overflow-y-auto">
          <PageTransition pageKey={pageTransitionKey} className="w-full min-w-0 max-w-full">
            {children}
          </PageTransition>
        </div>
      </main>

      {/* Voice Agent Widget */}
      <VoiceAgent />

      {/* Text to Ticket Popup */}
      <TextToTicketPopup projectId={projectId} />
    </div>
  );
}

export default function Layout(props) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <LayoutContent {...props} />
      </LanguageProvider>
    </ThemeProvider>
  );
}