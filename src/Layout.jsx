import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  LayoutGrid, 
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
  Rocket
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
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import VoiceAgent from "@/components/VoiceAgent";
import TextToTicketPopup from "@/components/TextToTicketPopup";
import { recoverActiveTimer, stopTimer, getActiveTimer, setTrackedTimeSyncHandler } from "@/lib/projectTimer";

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
  const isAdmin = getAdminEmails().includes((currentUser?.email || "").toLowerCase());

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
    // If the app reloads while a timer was running, close it immediately (and sync that session).
    recoverActiveTimer();

    return () => setTrackedTimeSyncHandler(null);
  }, [queryClient]);

  // Ensure a running timer is stopped when the tab/page is closed or hidden.
  React.useEffect(() => {
    const stopIfActive = (reason) => {
      const active = getActiveTimer();
      if (active?.projectId) {
        stopTimer({ reason });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopIfActive("visibility_hidden");
      }
    };

    const onPageHide = () => stopIfActive("pagehide");
    const onBeforeUnload = () => stopIfActive("beforeunload");

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
  if (currentPageName === 'ProjectsList' || currentPageName === 'index' || currentPageName === 'Landing' || currentPageName === 'Profile' || currentPageName === 'Subscription' || currentPageName === 'Impressum' || currentPageName === 'AdminUsers') {
        return children;
      }
  
  if (!projectId) {
    return null;
  }

  const navItems = [
    { icon: LayoutGrid, label: t('overview'), path: "SocialBoard", badge: newPostsCount, color: "bg-indigo-500" },
    { icon: ListTodo, label: t('tasks'), path: "ScrumBoard", color: "bg-emerald-500" },
    { icon: FileText, label: t('docs'), path: "Docs", color: "bg-amber-500" },
    { icon: Shapes, label: t('canvas'), path: "Canvas", color: "bg-purple-500" },
    { icon: FolderOpen, label: t('files'), path: "FileHub", color: "bg-orange-500" },
    { icon: Rocket, label: "Startup Builder", path: "StartupBuilder", disabled: true, alpha: true, color: "bg-rose-500" },
    { icon: Puzzle, label: language === 'de' ? "Unsere Tools" : "Our Tools", path: "Integrations", color: "bg-cyan-500" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-64 border-r border-slate-100 dark:border-slate-800 flex flex-col fixed lg:fixed h-full bg-white dark:bg-slate-900 z-50 transition-transform duration-300`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-50 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="text-[11px] sm:text-xs font-extrabold tracking-[0.08em] leading-tight text-slate-900 dark:text-slate-100">
              ORBYLOX - FREE PROJECT MANAGEMENT FOR EVERYONE
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="text-slate-400 hover:text-slate-600"
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
                const navClassName = `
                      relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out group overflow-hidden
                      ${item.color}
                      ${isDisabled
                        ? 'opacity-55 cursor-not-allowed saturate-0'
                        : isActive
                          ? 'ring-2 ring-white/50 shadow-lg scale-[1.01]'
                          : 'hover:scale-[1.02] hover:shadow-xl hover:-translate-y-0.5'}
                    `;
                const navBody = (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-r from-black/10 to-transparent transition-opacity duration-300 ${
                      isDisabled ? 'opacity-20' : 'opacity-0 group-hover:opacity-100'
                    }`} />
                    <item.icon className={`w-6 h-6 text-white relative z-10 transition-transform duration-300 ${
                      isDisabled ? '' : 'group-hover:scale-110'
                    }`} />
                    <span className="text-sm font-medium text-white relative z-10 flex-1">
                      {item.label}
                    </span>
                    {alpha ? (
                      <span className="px-1.5 py-0.5 bg-white/20 text-white text-[8px] font-extrabold tracking-wider rounded backdrop-blur-sm relative z-10">
                        ALPHA
                      </span>
                    ) : item.beta ? (
                      <span className="px-1.5 py-0.5 bg-white/20 text-white text-[8px] font-bold rounded backdrop-blur-sm relative z-10">
                        Beta
                      </span>
                    ) : null}
                    {item.badge > 0 && (
                      <span className="min-w-5 h-5 px-1.5 bg-white text-red-500 text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm relative z-10">
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
                 className="flex items-center gap-3 px-4 py-3 bg-slate-700 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:-translate-y-0.5 group"
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
      <main className={`flex-1 min-w-0 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'} bg-white dark:bg-slate-900 min-h-screen flex flex-col transition-all duration-300`}>
        {/* Header */}
        <header className="h-16 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-white dark:bg-slate-900 z-40">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-base md:text-lg text-slate-800 dark:text-slate-100 truncate">{project?.name || t('overview')}</h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-100">{t('online')}</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
             <button
               type="button"
               className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-accent hidden sm:flex"
               onClick={toggleTheme}
               title={isDark ? 'Light Mode' : 'Dark Mode'}
             >
               {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             <button
               type="button"
               className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-accent hidden sm:flex"
               onClick={() => setLanguage(language === 'en' ? 'de' : 'en')}
               title={language === 'en' ? 'Switch to German' : 'Switch to English'}
             >
               <Languages className="w-5 h-5" />
             </button>
             <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
               <DropdownMenuTrigger asChild>
                 <button type="button" className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-accent relative hidden sm:flex">
                   <Bell className="w-5 h-5" />
                   {(newPostsCount + newMessagesCount) > 0 && (
                     <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                   )}
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-72">
                 <div className="px-3 py-2 border-b border-slate-100">
                   <p className="font-medium text-sm text-slate-900">{t('notifications')}</p>
                 </div>
                 {newPostsCount > 0 && (
                   <DropdownMenuItem asChild>
                     <Link to={createPageUrl('SocialBoard') + location.search} className="cursor-pointer flex items-center gap-2">
                       <LayoutGrid className="w-4 h-4 text-indigo-500" />
                       <span>{newPostsCount} neue Beiträge</span>
                     </Link>
                   </DropdownMenuItem>
                 )}
                 {newMessagesCount > 0 && (
                   <DropdownMenuItem asChild>
                     <Link to={createPageUrl('Chat') + location.search} className="cursor-pointer flex items-center gap-2">
                       <MessageSquare className="w-4 h-4 text-indigo-500" />
                       <span>{newMessagesCount} neue Nachrichten</span>
                     </Link>
                   </DropdownMenuItem>
                 )}
                 {(newPostsCount + newMessagesCount) === 0 && (
                   <div className="px-3 py-4 text-center text-sm text-slate-400">
                     {t('noNotifications')}
                   </div>
                 )}
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
        <div className="p-4 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden animate-in fade-in duration-500">
           {children}
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