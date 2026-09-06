import React, { useState, useEffect, useRef } from 'react';
import { api } from "@/api/apiClient";
import { hasFirebaseConfig } from "@/lib/firebase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Paperclip, Smile, Trash2, Users, Video } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import VideoCall from '@/components/chat/VideoCall';
import {
  mentionCandidates,
  mentionQueryAt,
  filterCandidates,
  applyMention,
  resolveMentions,
  splitByMentions,
  handleFor,
} from '@/lib/mentions';
import { useLanguage } from '@/components/LanguageProvider';
import { askDelete } from '@/lib/confirmDelete';

export default function Chat() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('project');

  const { data: user, isLoading: userLoading, isError: userError } = useQuery({ 
    queryKey: ['currentUser'], 
    queryFn: () => api.auth.me(),
    retry: false
  });
  const currentUser = user || null;

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (userError || (!userLoading && !user)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [user, userLoading, userError]);

  // Track online users based on recent message activity (last 5 minutes)
  const getOnlineUsers = (msgs, members) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentSenders = new Set();
    (msgs || []).forEach(m => {
      if (new Date(m.created_date).getTime() > fiveMinutesAgo) {
        recentSenders.add(m.sender_email);
      }
    });
    return recentSenders;
  };

  const { data: messages } = useQuery({
    queryKey: ['messages', projectId],
    queryFn: async () => {
      return api.entities.Message.listByProject(projectId, 'created_date');
    },
    refetchInterval:
      user?.uid && hasFirebaseConfig ? false : 4000,
    staleTime: 1000,
    initialData: [],
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

  // The creator's address can also sit in members — without this filter you
  // show up twice: once as "You" and once as a regular member.
  const projectMembers = (project?.members || []).filter(
    (email) => (email || '').toLowerCase() !== (currentUser?.email || '').toLowerCase()
  );

  const sendMessageMutation = useMutation({
    mutationFn: (content) => api.entities.Message.create({
      content,
      project_id: projectId,
      sender_email: currentUser?.email,
      // Aufgeloeste Adressen mitschreiben — im Text steht nur ein Anzeigename,
      // und daraus laesst sich niemand zuverlaessig benachrichtigen.
      mentions: resolveMentions(content, projectMembers, currentUser?.email),
    }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['messages', projectId] });
      const previous = queryClient.getQueryData(['messages', projectId]);
      const tempMessage = {
        id: 'temp_' + Date.now(),
        content,
        project_id: projectId,
        sender_email: currentUser?.email,
        created_date: new Date().toISOString()
      };
      queryClient.setQueryData(['messages', projectId], old => [...(old || []), tempMessage]);
      setMessage("");
      return { previous };
    },
    onError: (err, content, context) => {
      queryClient.setQueryData(['messages', projectId], context.previous);
    },
    onSuccess: (newMessage) => {
      // Replace temp message with real one, keep at the end
      queryClient.setQueryData(['messages', projectId], old => {
        const filtered = (old || []).filter(m => !String(m.id).startsWith('temp_'));
        return [...filtered, newMessage];
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [showMembers, setShowMembers] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);

  // Auswahl fuer die @-Liste
  const allMentionUsers = React.useMemo(
    () => mentionCandidates(projectMembers, currentUser?.email, t('mentionAll')),
    [projectMembers, currentUser?.email, t],
  );

  const filteredMentions = React.useMemo(
    () => filterCandidates(allMentionUsers, mentionFilter),
    [allMentionUsers, mentionFilter],
  );

  /**
   * Die Liste oeffnet sich anhand der Schreibmarke, nicht anhand des letzten @
   * im Text. Sonst springt sie wieder auf, sobald man weiter vorne etwas
   * korrigiert — und eine getippte E-Mail-Adresse loest sie gar nicht erst aus.
   */
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    const found = mentionQueryAt(value, e.target.selectionStart);
    if (found) {
      setMentionFilter(found.query);
      setMentionIndex(0);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (candidate) => {
    const caret = inputRef.current?.selectionStart ?? message.length;
    const { text, caret: nextCaret } = applyMention(message, caret, candidate);
    setMessage(text);
    setShowMentions(false);
    setMentionFilter('');
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange?.(nextCaret, nextCaret);
    });
  };

  /** Pfeiltasten und Enter in der Liste — wie im Messenger gewohnt. */
  const handleMentionKeys = (e) => {
    if (!showMentions || filteredMentions.length === 0) {
      if (e.key === 'Escape') setShowMentions(false);
      return false;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredMentions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredMentions[Math.min(mentionIndex, filteredMentions.length - 1)]);
      return true;
    }
    if (e.key === 'Escape') {
      setShowMentions(false);
      return true;
    }
    return false;
  };

  const knownHandles = React.useMemo(
    () => projectMembers.map((m) => handleFor(m)),
    [projectMembers],
  );

  /** Nachricht mit hervorgehobenen Erwaehnungen darstellen. */
  const renderMessageContent = (content) =>
    splitByMentions(content, knownHandles).map((part, i) =>
      part.type === 'mention' ? (
        <span key={i} className="bg-[#ef5a24]/20 text-[#ef5a24] px-1 rounded font-medium">
          {part.value}
        </span>
      ) : (
        <span key={i}>{part.value}</span>
      ),
    );

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Laden...</div>;
  }

  return (
    <>
    <VideoCall
      isOpen={showVideoCall}
      onClose={() => setShowVideoCall(false)}
      currentUser={currentUser}
      projectId={projectId}
      projectName={project?.name}
    />
    <div className="h-[calc(100dvh-140px)] min-h-[280px] flex bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-w-full">
       {/* Sidebar - Channels & Users - Hidden on mobile */}
       <div className={`${showMembers ? 'absolute inset-0 z-50 flex' : 'hidden'} sm:relative sm:flex w-full sm:w-64 bg-slate-50 border-r border-slate-100 flex-col`}>
          <div className="p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700"># General</h3>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-[#ef5a24] hover:text-[#ef5a24] hover:bg-[#f5f5f5] relative"
                onClick={() => setShowVideoCall(true)}
                title="Video Call starten (Beta)"
              >
                <Video className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 px-1 bg-amber-500 text-white text-[8px] font-bold rounded">β</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-700"
                onClick={async () => {
                  if (await askDelete({ kind: 'allMessages' })) {
                    const currentMessages = messages || [];
                    await Promise.all(currentMessages.map(m => api.entities.Message.delete(m.id)));
                    queryClient.invalidateQueries(['messages', projectId]);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 sm:hidden"
                onClick={() => setShowMembers(false)}
              >
                ✕
              </Button>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
             <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Team Members - {projectMembers.length + 1}
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Avatar className="h-8 w-8 border border-white shadow-sm">
                                <AvatarFallback className="bg-[#ef5a24]/10 text-[#ef5a24] text-xs">
                                  {currentUser.email?.[0]?.toUpperCase() || 'Y'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                        </div>
                        <span className="text-sm font-medium text-slate-700">You</span>
                    </div>
                    {projectMembers.map((memberEmail) => {
                        const onlineUsers = getOnlineUsers(messages, projectMembers);
                        const isOnline = onlineUsers.has(memberEmail);
                        return (
                        <div key={memberEmail} className="flex items-center gap-2">
                            <div className="relative">
                                <Avatar className="h-8 w-8 border border-white shadow-sm">
                                    <AvatarFallback className="bg-[#ef5a24]/10 text-[#ef5a24] text-xs">
                                      {memberEmail[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${isOnline ? 'bg-green-500' : 'bg-slate-300'} border-2 border-white rounded-full`}></span>
                            </div>
                            <span className="text-sm font-medium text-slate-700 truncate" title={memberEmail}>
                              {memberEmail.split('@')[0]}
                            </span>
                        </div>
                    );})}
                </div>
             </div>
          </div>
       </div>

       {/* Chat Area */}
       <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1 p-3 sm:p-6 bg-white">
             <div className="space-y-4">
                {messages?.map((msg, index) => {
                   const isMe = msg.sender_email === currentUser?.email;
                   const isSequence = index > 0 && messages[index - 1].sender_email === msg.sender_email;

                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[min(100%,28rem)] min-w-0 ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
                                {!isSequence && !isMe && (
                                    <Avatar className="h-8 w-8 mt-1">
                                        <AvatarFallback className="bg-[#ef5a24]/10 text-[#ef5a24]">
                                          {msg.sender_email?.[0]?.toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={`min-w-0 ${isSequence ? (isMe ? 'mr-11' : 'ml-11') : ''}`}>
                                    {!isSequence && !isMe && (
                                      <div className="text-xs text-slate-400 mb-1 ml-1">
                                        {msg.sender_email?.split('@')[0] || 'User'}
                                      </div>
                                    )}
                                    <div className={`
                                        p-3 rounded-2xl text-sm shadow-sm break-words [overflow-wrap:anywhere]
                                        ${isMe 
                                            ? 'bg-[#ef5a24] text-white rounded-tr-none' 
                                            : 'bg-slate-100 text-slate-800 rounded-tl-none'}
                                    `}>
                                        {renderMessageContent(msg.content)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
             </div>
          </ScrollArea>

          <div className="p-2 sm:p-4 border-t border-slate-100 bg-white relative">
             {/* Mentions dropdown */}
             {showMentions && filteredMentions.length > 0 && (
               <div className="absolute bottom-full left-2 right-2 sm:left-14 sm:right-14 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                 {filteredMentions.map((user, i) => (
                   <button
                     key={user.email}
                     type="button"
                     data-no-lift
                     onMouseEnter={() => setMentionIndex(i)}
                     onClick={() => insertMention(user)}
                     className={`w-full px-4 py-2 flex items-center gap-2 text-left min-w-0 ${
                       i === mentionIndex ? 'bg-[#ef5a24]/10' : 'hover:bg-[#f5f5f5]'
                     }`}
                   >
                     <Avatar className="h-6 w-6 shrink-0">
                       <AvatarFallback className={`text-xs ${user.isAll ? 'bg-[#ef5a24] text-white' : 'bg-[#ef5a24]/10 text-[#ef5a24]'}`}>
                         {user.isAll ? '@' : user.name[0]?.toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                     <span className="text-sm font-medium shrink-0">{user.name}</span>
                     {!user.isAll && <span className="text-xs text-slate-400 truncate">{user.email}</span>}
                   </button>
                 ))}
               </div>
             )}
             <form onSubmit={handleSubmit} className="flex gap-1 sm:gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 sm:hidden shrink-0"
                  onClick={() => setShowMembers(!showMembers)}
                >
                    <Users className="w-5 h-5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="text-slate-400 hidden sm:flex shrink-0">
                    <Paperclip className="w-5 h-5" />
                </Button>
                <Input 
                    ref={inputRef}
                    value={message}
                    onChange={handleMessageChange}
                    onKeyDown={handleMentionKeys}
                    placeholder={t('chatPlaceholder')} 
                    className="flex-1 min-w-0 rounded-full bg-slate-50 border-slate-200 focus-visible:ring-[#ef5a24] text-sm"
                />
                <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!message.trim()}
                    className="rounded-full bg-[#ef5a24] hover:bg-black w-9 h-9 sm:w-10 sm:h-10 shrink-0"
                >
                    <Send className="w-4 h-4 text-white" />
                </Button>
             </form>
          </div>
       </div>
    </div>
    </>
  );
}