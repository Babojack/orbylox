import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Plus, Trash2, Pin, PinOff, Grid3X3, List, Search, Palette, Smile, MoreVertical, Copy, Archive, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NOTE_COLORS = [
  { name: 'Default', bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800' },
  { name: 'Yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' },
  { name: 'Green', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' },
  { name: 'Blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
  { name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
  { name: 'Pink', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900' },
  { name: 'Orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  { name: 'Red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' },
];

const EMOJIS = ['📝', '💡', '⭐', '🎯', '📌', '🔥', '💪', '🎉', '📚', '💼', '🏠', '❤️', '✅', '⚡', '🌟', '🚀'];

const NOTE_TYPES = [
  { id: 'note', label: 'Notiz', icon: '📝', prefix: '' },
  { id: 'meeting', label: 'Meeting', icon: '📅', prefix: 'Meeting' },
  { id: 'idea', label: 'Idee', icon: '💡', prefix: 'Idee' },
  { id: 'feedback', label: 'Feedback', icon: '💬', prefix: 'Feedback' },
  { id: 'suggestion', label: 'Anregung', icon: '✨', prefix: 'Anregung' },
  { id: 'todo', label: 'To-Do Liste', icon: '✅', prefix: 'To-Do' },
  { id: 'decision', label: 'Entscheidung', icon: '⚖️', prefix: 'Entscheidung' },
];

export default function Docs() {
    const queryClient = useQueryClient();
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [viewMode, setViewMode] = useState('timeline'); // 'grid' or 'list' or 'timeline'
    const [searchQuery, setSearchQuery] = useState('');
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const debounceTimer = React.useRef(null);

    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get('project');

    // Auth check
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

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['docs', projectId],
    queryFn: async () => {
      const allDocs = await api.entities.Document.filter({ project_id: projectId }, '-updated_date', 200);
      return allDocs;
    },
    staleTime: 30000,
    enabled: !!projectId
  });

  const createDocWithType = async (noteType) => {
    setShowTypeSelector(false);
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const title = noteType.prefix ? `${noteType.prefix} ${today}` : "Neue Notiz";
    
    const tempId = 'temp_' + Date.now();
    const tempDoc = {
      id: tempId,
      title,
      content: "",
      icon: noteType.icon,
      project_id: projectId,
      created_date: new Date().toISOString()
    };
    
    await queryClient.cancelQueries(['docs', projectId]);
    const previous = queryClient.getQueryData(['docs', projectId]);
    queryClient.setQueryData(['docs', projectId], old => [tempDoc, ...(old || [])]);
    setSelectedDocId(tempId);
    setEditTitle(title);
    
    try {
      const newDoc = await api.entities.Document.create({
        title,
        content: "",
        project_id: projectId,
        icon: noteType.icon
      });
      queryClient.setQueryData(['docs', projectId], old =>
        (old || []).map(d => d.id === tempId ? newDoc : d)
      );
      setSelectedDocId(newDoc.id);
    } catch (err) {
      queryClient.setQueryData(['docs', projectId], previous);
    }
    queryClient.invalidateQueries(['docs', projectId]);
  };

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (String(id).startsWith('temp_')) return Promise.resolve();
      return api.entities.Document.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries(['docs', projectId]);
      const previous = queryClient.getQueryData(['docs', projectId]);
      queryClient.setQueryData(['docs', projectId], old =>
        (old || []).map(d => d.id === id ? { ...d, ...data, updated_date: new Date().toISOString() } : d)
      );
      return { previous, id };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['docs', projectId], context.previous);
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id) => api.entities.Document.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries(['docs', projectId]);
      const previous = queryClient.getQueryData(['docs', projectId]);
      queryClient.setQueryData(['docs', projectId], old => (old || []).filter(d => d.id !== id));
      if (selectedDocId === id) setSelectedDocId(null);
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['docs', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['docs', projectId]);
    }
  });

  const duplicateDoc = async (doc) => {
    await api.entities.Document.create({
      title: doc.title + ' (Kopie)',
      content: doc.content,
      project_id: projectId,
      icon: doc.icon,
      parent_id: doc.parent_id
    });
    queryClient.invalidateQueries(['docs', projectId]);
  };

  const selectedDoc = docs?.find(d => d.id === selectedDocId);
  const [localContent, setLocalContent] = useState("");

  React.useEffect(() => {
    if (selectedDoc) {
      setLocalContent(selectedDoc.content || "");
      setEditTitle(selectedDoc.title || "");
    }
  }, [selectedDocId]);

  const handleContentChange = (content) => {
    setLocalContent(content);
    if (selectedDoc) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        updateDocMutation.mutate({ id: selectedDoc.id, data: { content } });
      }, 500);
    }
  };

  const handleTitleChange = (e) => {
    setEditTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    if (selectedDoc && editTitle !== selectedDoc.title) {
      updateDocMutation.mutate({ id: selectedDoc.id, data: { title: editTitle } });
    }
  };

  const getColorClasses = (colorName) => {
    const color = NOTE_COLORS.find(c => c.name === colorName) || NOTE_COLORS[0];
    return color;
  };

  // Filter and sort notes
  const filteredDocs = docs?.filter(doc => {
    if (!searchQuery) return true;
    return doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  // Sort: pinned first, then by date
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (a.parent_id === 'pinned' && b.parent_id !== 'pinned') return -1;
    if (b.parent_id === 'pinned' && a.parent_id !== 'pinned') return 1;
    return new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date);
  });

  const pinnedNotes = sortedDocs.filter(d => d.parent_id === 'pinned');
  const otherNotes = sortedDocs.filter(d => d.parent_id !== 'pinned');

  const NoteCard = ({ doc }) => {
    const colorClasses = getColorClasses(doc.icon?.startsWith?.('#') ? doc.icon : null);
    const isPinned = doc.parent_id === 'pinned';
    const noteColor = NOTE_COLORS.find(c => c.name === doc.parent_id) || NOTE_COLORS[0];
    
    return (
      <Card 
        className={`group relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${noteColor.bg} ${noteColor.border} border-2 overflow-hidden`}
        onClick={() => { setSelectedDocId(doc.id); setEditTitle(doc.title); }}
      >
        {isPinned && (
          <div className="absolute top-2 left-2">
            <Pin className="w-4 h-4 text-red-500 fill-red-500" />
          </div>
        )}
        
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { 
                e.stopPropagation(); 
                updateDocMutation.mutate({ id: doc.id, data: { parent_id: isPinned ? null : 'pinned' } });
              }}>
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Loslösen' : 'Anpinnen'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateDoc(doc); }}>
                <Copy className="w-4 h-4 mr-2" /> Duplizieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 rounded-sm" onClick={(e) => e.stopPropagation()}>
                    <Palette className="w-4 h-4 mr-2" /> Farbe ändern
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-4 gap-2">
                    {NOTE_COLORS.map(color => (
                      <button
                        key={color.name}
                        className={`w-8 h-8 rounded-full ${color.bg} ${color.border} border-2 hover:scale-110 transition-transform`}
                        onClick={() => updateDocMutation.mutate({ id: doc.id, data: { parent_id: color.name === 'Default' ? (isPinned ? 'pinned' : null) : color.name } })}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); deleteDocMutation.mutate(doc.id); }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-4 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{doc.icon || '📝'}</span>
            <h3 className={`font-semibold line-clamp-2 break-words min-w-0 ${noteColor.text}`}>{doc.title || 'Ohne Titel'}</h3>
          </div>
          <div 
            className={`text-sm ${noteColor.text} opacity-70 line-clamp-3`}
            dangerouslySetInnerHTML={{ __html: doc.content?.replace(/<[^>]*>/g, ' ').slice(0, 150) || 'Keine Inhalte...' }}
          />
          <div className="mt-3 text-xs text-slate-400">
            {new Date(doc.updated_date || doc.created_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      </Card>
    );
  };

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Laden...</div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <StickyNote className="w-7 h-7 text-yellow-500" />
              Notizen
            </h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
          <span>Notizen werden geladen...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <StickyNote className="w-7 h-7 text-yellow-500" />
            Notizen
          </h2>
          <p className="text-slate-500">{docs?.length || 0} Notizen</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Notizen suchen..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
              title="Grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode('list')}
              title="Liste"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'timeline' ? 'default' : 'ghost'} 
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode('timeline')}
              title="Timeline"
            >
              <Clock className="w-4 h-4" />
            </Button>
          </div>
          <Popover open={showTypeSelector} onOpenChange={setShowTypeSelector}>
            <PopoverTrigger asChild>
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                <Plus className="w-4 h-4 mr-2" /> Neue Notiz
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-1">
                {NOTE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => createDocWithType(type)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left"
                  >
                    <span className="text-xl">{type.icon}</span>
                    <span className="font-medium text-slate-700">{type.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && sortedDocs.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[6.25rem] sm:left-[8.1rem] top-0 bottom-0 w-0.5 bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-200" />
          
          <div className="space-y-6">
            {sortedDocs.map((doc, index) => {
              const noteColor = NOTE_COLORS.find(c => c.name === doc.parent_id) || NOTE_COLORS[0];
              const isPinned = doc.parent_id === 'pinned';
              const date = new Date(doc.updated_date || doc.created_date);
              
              return (
                <div key={doc.id} className="relative flex gap-3 sm:gap-4 pl-0">
                  {/* Date column - left side */}
                  <div className="w-20 sm:w-28 flex-shrink-0 text-right pr-2 pt-1">
                    <div className="text-xs sm:text-sm font-semibold text-slate-700">
                      {date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-400">
                      {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-xs ${
                      isPinned ? 'bg-red-500' : 'bg-yellow-400'
                    }`}>
                      {isPinned && <Pin className="w-2 h-2 text-white" />}
                    </div>
                  </div>
                  
                  {/* Content card */}
                  <div 
                    className={`flex-1 group cursor-pointer ${noteColor.bg} ${noteColor.border} border-2 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
                    onClick={() => { setSelectedDocId(doc.id); setEditTitle(doc.title); }}
                  >
                    {/* Actions */}
                    <div className="flex items-center justify-end mb-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { 
                            e.stopPropagation(); 
                            updateDocMutation.mutate({ id: doc.id, data: { parent_id: isPinned ? null : 'pinned' } });
                          }}>
                            {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                            {isPinned ? 'Loslösen' : 'Anpinnen'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateDoc(doc); }}>
                            <Copy className="w-4 h-4 mr-2" /> Duplizieren
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteDocMutation.mutate(doc.id); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Title with icon */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{doc.icon || '📝'}</span>
                      <h3 className={`font-semibold text-lg break-words min-w-0 [overflow-wrap:anywhere] ${noteColor.text}`}>{doc.title || 'Ohne Titel'}</h3>
                    </div>
                    
                    {/* Content preview */}
                    <div 
                      className={`text-sm ${noteColor.text} opacity-70 line-clamp-2`}
                      dangerouslySetInnerHTML={{ __html: doc.content?.replace(/<[^>]*>/g, ' ').slice(0, 200) || 'Keine Inhalte...' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned Notes (Grid/List view) */}
      {viewMode !== 'timeline' && pinnedNotes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Pin className="w-4 h-4" /> Angepinnt
          </h3>
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-2"
          }>
            {pinnedNotes.map(doc => <NoteCard key={doc.id} doc={doc} />)}
          </div>
        </div>
      )}

      {/* Other Notes (Grid/List view) */}
      {viewMode !== 'timeline' && otherNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Weitere Notizen
            </h3>
          )}
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-2"
          }>
            {otherNotes.map(doc => <NoteCard key={doc.id} doc={doc} />)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedDocs.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <StickyNote className="w-12 h-12 text-yellow-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {searchQuery ? 'Keine Notizen gefunden' : 'Noch keine Notizen'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchQuery ? 'Versuche einen anderen Suchbegriff' : 'Erstelle deine erste Notiz!'}
          </p>
          {!searchQuery && (
            <Popover>
              <PopoverTrigger asChild>
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Neue Notiz erstellen
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2">
                <div className="space-y-1">
                  {NOTE_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => createDocWithType(type)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-left"
                    >
                      <span className="text-xl">{type.icon}</span>
                      <span className="font-medium text-slate-700">{type.label}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!selectedDocId} onOpenChange={(open) => !open && setSelectedDocId(null)}>
        <DialogContent className="flex flex-col p-0 gap-0 h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] rounded-none border-0 sm:border left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-4xl sm:w-[95vw] sm:h-[min(90dvh,56rem)] sm:max-h-[90dvh] sm:rounded-lg">
          {selectedDoc && (
            <>
              <DialogHeader className="p-4 sm:p-6 pb-0 shrink-0 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-4xl hover:scale-110 transition-transform">
                        {selectedDoc.icon || '📝'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3">
                      <div className="grid grid-cols-8 gap-2">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            className="text-2xl hover:scale-125 transition-transform"
                            onClick={() => updateDocMutation.mutate({ id: selectedDoc.id, data: { icon: emoji } })}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input 
                    value={editTitle}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    className="text-2xl font-bold border-none focus-visible:ring-0 px-0 placeholder:text-slate-300 h-auto min-w-0 flex-1 break-words"
                    placeholder="Titel der Notiz"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Palette className="w-4 h-4 mr-2" /> Farbe
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2">
                      <div className="grid grid-cols-4 gap-2">
                        {NOTE_COLORS.map(color => (
                          <button
                            key={color.name}
                            className={`w-8 h-8 rounded-full ${color.bg} ${color.border} border-2 hover:scale-110 transition-transform`}
                            onClick={() => updateDocMutation.mutate({ 
                              id: selectedDoc.id, 
                              data: { parent_id: color.name === 'Default' ? null : color.name } 
                            })}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => updateDocMutation.mutate({ 
                      id: selectedDoc.id, 
                      data: { parent_id: selectedDoc.parent_id === 'pinned' ? null : 'pinned' } 
                    })}
                  >
                    {selectedDoc.parent_id === 'pinned' ? (
                      <><PinOff className="w-4 h-4 mr-2" /> Loslösen</>
                    ) : (
                      <><Pin className="w-4 h-4 mr-2" /> Anpinnen</>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="hidden sm:flex"
                    onClick={() => duplicateDoc(selectedDoc)}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Duplizieren
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteDocMutation.mutate(selectedDoc.id)}
                  >
                    <Trash2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Löschen</span>
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 min-h-0 basis-0">
                  <div className="p-4 sm:p-6 pt-4 min-w-0 max-w-full overflow-x-hidden">
                    <ReactQuill 
                      theme="snow" 
                      value={localContent} 
                      onChange={handleContentChange}
                      className="docs-quill-editor h-full border-none max-w-full [&_.ql-container]:border-none [&_.ql-container]:max-w-full [&_.ql-editor]:max-w-full [&_.ql-toolbar]:flex-wrap [&_.ql-toolbar]:border-none [&_.ql-toolbar]:bg-slate-50 [&_.ql-toolbar]:rounded-lg [&_.ql-toolbar]:mb-4 [&_.ql-toolbar]:gap-0.5 [&_.ql-editor]:text-base [&_.ql-editor]:text-slate-700 [&_.ql-editor]:leading-relaxed [&_.ql-editor]:min-h-[min(50dvh,320px)] [&_.ql-editor]:overflow-x-hidden"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'color': [] }, { 'background': [] }],
                          [{'list': 'ordered'}, {'list': 'bullet'}, {'list': 'check'}],
                          ['blockquote', 'code-block'],
                          ['link', 'image'],
                          ['clean']
                        ]
                      }}
                      placeholder="Schreibe deine Notiz..."
                    />
                    <div className="mt-4 text-xs text-slate-400 flex items-center gap-4">
                      {updateDocMutation.isPending && <span>Speichern...</span>}
                      {!updateDocMutation.isPending && <span>✓ Gespeichert</span>}
                      <span>Zuletzt bearbeitet: {new Date(selectedDoc.updated_date || selectedDoc.created_date).toLocaleString('de-DE')}</span>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}