import React, { useRef, useState } from 'react';
import { api } from "@/api/apiClient";
import { previewablePdfUrl, describeFileUrl, checkFileReachable } from "@/lib/fileUrls";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, File, UploadCloud, MoreVertical, Download, Trash2, FileImage, FileText, FolderPlus, CloudUpload, Eye, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { askDelete } from '@/lib/confirmDelete';

export default function FileHub() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewStatus, setPreviewStatus] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [draggingFileId, setDraggingFileId] = useState(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState(null);
  
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

  const { data: files, isLoading } = useQuery({
    queryKey: ['files', projectId, currentFolderId],
    queryFn: async () => {
      const projectFiles = await api.entities.FileRecord.listByProject(projectId, '-created_date');
      return projectFiles.filter(f =>
        currentFolderId ? f.folder_id === currentFolderId : !f.folder_id
      );
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !!projectId
  });

  const { data: folders } = useQuery({
    queryKey: ['folders', projectId],
    queryFn: async () => {
      return api.entities.Folder.listByProject(projectId, '-created_date');
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !!projectId
  });

  // Check availability whenever a preview opens, so a dead link says why.
  React.useEffect(() => {
    if (!previewFile?.url) {
      setPreviewStatus(null);
      return;
    }
    let cancelled = false;
    setPreviewStatus(null);
    checkFileReachable(previewFile.url).then((status) => {
      if (!cancelled && !status.ok) setPreviewStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [previewFile]);

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      return api.entities.FileRecord.create({
        name: file.name,
        url: file_url,
        type: file.type,
        size: file.size,
        project_id: projectId,
        folder_id: currentFolderId
      });
    },
    onMutate: async (file) => {
      setUploadingCount((c) => c + 1);
      await queryClient.cancelQueries(['files', projectId, currentFolderId]);
      const previous = queryClient.getQueryData(['files', projectId, currentFolderId]);
      const tempFile = {
        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        project_id: projectId,
        folder_id: currentFolderId,
        created_date: new Date().toISOString()
      };
      queryClient.setQueryData(['files', projectId, currentFolderId], old => [tempFile, ...(old || [])]);
      return { previous };
    },
    onError: (err, file, context) => {
      queryClient.setQueryData(['files', projectId, currentFolderId], context.previous);
      console.error("[FileHub] Upload failed:", err);
      toast({
        title: `Upload fehlgeschlagen: ${file?.name || "Datei"}`,
        description: err?.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(['files', projectId, currentFolderId]);
      setUploadingCount((c) => Math.max(0, c - 1));
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: (folderName) => api.entities.Folder.create({
      name: folderName,
      project_id: projectId
    }),
    onMutate: async (folderName) => {
      await queryClient.cancelQueries(['folders', projectId]);
      const previous = queryClient.getQueryData(['folders', projectId]);
      const tempFolder = {
        id: 'temp_' + Date.now(),
        name: folderName,
        project_id: projectId,
        created_date: new Date().toISOString()
      };
      queryClient.setQueryData(['folders', projectId], old => [tempFolder, ...(old || [])]);
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      return { previous };
    },
    onError: (err, folderName, context) => {
      queryClient.setQueryData(['folders', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['folders', projectId]);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id) => api.entities.FileRecord.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries(['files', projectId, currentFolderId]);
      const previous = queryClient.getQueryData(['files', projectId, currentFolderId]);
      queryClient.setQueryData(['files', projectId, currentFolderId], old => (old || []).filter(f => f.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['files', projectId, currentFolderId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['files', projectId, currentFolderId]);
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id) => api.entities.Folder.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries(['folders', projectId]);
      const previous = queryClient.getQueryData(['folders', projectId]);
      queryClient.setQueryData(['folders', projectId], old => (old || []).filter(f => f.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['folders', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['folders', projectId]);
    }
  });

  const moveFileToFolderMutation = useMutation({
    mutationFn: ({ fileId, folderId }) => api.entities.FileRecord.update(fileId, { folder_id: folderId }),
    onMutate: async ({ fileId, folderId }) => {
      await queryClient.cancelQueries(['files', projectId, currentFolderId]);
      const previous = queryClient.getQueryData(['files', projectId, currentFolderId]);
      queryClient.setQueryData(['files', projectId, currentFolderId], old => (old || []).filter(f => f.id !== fileId));
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['files', projectId, currentFolderId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['files', projectId]);
    }
  });

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    selected.forEach((file) => uploadMutation.mutate(file));
    // allow selecting same file again
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(file => uploadMutation.mutate(file));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getIcon = (type) => {
    if (type?.includes('image')) return <FileImage className="w-8 h-8 text-[#ef5a24]" />;
    if (type?.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    return <File className="w-8 h-8 text-blue-500" />;
  };

  const canPreview = (file) => {
    const type = file.type || '';
    const name = file.name?.toLowerCase() || '';
    return type.includes('image') || 
           type.includes('pdf') || 
           name.endsWith('.pdf') ||
           type.includes('video') ||
           type.includes('audio') ||
           type.includes('text') ||
           name.endsWith('.txt') ||
           name.endsWith('.md') ||
           name.endsWith('.json') ||
           name.endsWith('.csv');
  };

  const getPreviewContent = (file) => {
    const type = file.type || '';
    const name = file.name?.toLowerCase() || '';
    
    if (type.includes('image')) {
      return (
        <div className="flex items-center justify-center h-full">
          <img 
            src={file.url} 
            alt={file.name} 
            className="max-w-full max-h-full object-contain transition-transform"
            style={{ transform: `scale(${zoom / 100})` }}
          />
        </div>
      );
    }
    
    if (type.includes('pdf') || name.endsWith('.pdf')) {
      // Cloudinary: PDFs oft mit Content-Disposition: attachment → eingebettete Vorschau bricht ab.
      // previewablePdfUrl setzt fl_inline, damit <object> / Viewer die gleiche URL wie der Download nutzen kann.
      const pdfViewUrl = previewablePdfUrl(file.url) || file.url;
      const boxStyle = { height: "min(78vh, 920px)", minHeight: "420px" };
      return (
        <object
          key={pdfViewUrl}
          data={pdfViewUrl}
          type="application/pdf"
          className="w-full border-0 bg-white"
          style={boxStyle}
          aria-label={file.name}
        >
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-slate-600" style={boxStyle}>
            <p className="text-sm text-center max-w-md">
              Vorschau nicht darstellbar — z. B. während des Uploads (Blob-URL) oder durch Browsereinstellungen.
            </p>
            <a
              href={pdfViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ef5a24] font-medium hover:underline"
            >
              PDF in neuem Tab öffnen
            </a>
          </div>
        </object>
      );
    }
    
    if (type.includes('video')) {
      return (
        <div className="flex items-center justify-center h-full">
          <video 
            src={file.url} 
            controls 
            className="max-w-full max-h-full"
          />
        </div>
      );
    }
    
    if (type.includes('audio')) {
      return (
        <div className="flex items-center justify-center h-full">
          <audio src={file.url} controls className="w-full max-w-md" />
        </div>
      );
    }
    
    // Text files
    if (type.includes('text') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.csv')) {
      return <TextFilePreview url={file.url} />;
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <File className="w-24 h-24 mb-4" />
        <p>{t('previewUnavailable')}</p>
        <a href={previewablePdfUrl(file.url) || file.url} download={file.name || true} className="mt-4 text-[#ef5a24] hover:underline">
          {t('downloadFile')}
        </a>
      </div>
    );
  };

  const currentFileIndex = previewFile ? files?.findIndex(f => f.id === previewFile.id) : -1;
  const previewableFiles = files?.filter(canPreview) || [];
  const currentPreviewIndex = previewFile ? previewableFiles.findIndex(f => f.id === previewFile.id) : -1;

  const goToPrevFile = () => {
    if (currentPreviewIndex > 0) {
      setPreviewFile(previewableFiles[currentPreviewIndex - 1]);
      setZoom(100);
    }
  };

  const goToNextFile = () => {
    if (currentPreviewIndex < previewableFiles.length - 1) {
      setPreviewFile(previewableFiles[currentPreviewIndex + 1]);
      setZoom(100);
    }
  };

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Laden...</div>;
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0">
        <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Dateien</h2>
            <p className="text-slate-500 text-sm sm:text-base">Verwalten Sie Dateien und Dokumente</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                  <FolderPlus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Ordner erstellen</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-auto">
                <DialogHeader>
                  <DialogTitle>{t('newFolder')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Input 
                    placeholder={t('folderName')} 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                  />
                  <Button 
                    className="w-full"
                    onClick={() => createFolderMutation.mutate(newFolderName)}
                    disabled={!newFolderName.trim()}
                  >
                    Erstellen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
                className="bg-[#ef5a24] hover:bg-black flex-1 sm:flex-none text-xs sm:text-sm"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCount > 25}
            >
                <UploadCloud className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {uploadingCount > 0 ? t('uploadingCount', { count: uploadingCount }) : t('uploadFiles')}
                </span>
                <span className="sm:hidden">{uploadingCount > 0 ? `…(${uploadingCount})` : 'Upload'}</span>
            </Button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple
                onChange={handleFileSelect}
            />
            <Button 
              variant="destructive"
              size="sm"
              className="text-xs sm:text-sm"
              onClick={async () => {
                if (await askDelete({ kind: 'allFiles' })) {
                  const currentFiles = files || [];
                  await Promise.all(currentFiles.map(f => api.entities.FileRecord.delete(f.id)));
                  queryClient.invalidateQueries(['files', projectId, currentFolderId]);
                }
              }}
            >
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Alles löschen</span>
            </Button>
        </div>
      </div>

      {/* Drag & Drop Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-[#ef5a24] bg-[#f5f5f5]' 
            : 'border-slate-300 bg-slate-50 hover:border-[#ef5a24]'
        }`}
      >
        <CloudUpload className={`w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-4 ${isDragging ? 'text-[#ef5a24]' : 'text-slate-400'}`} />
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1 sm:mb-2">
          {isDragging ? t('dropFilesHere') : t('tapToUpload')}
        </h3>
        <p className="text-slate-500 text-sm hidden sm:block">oder Dateien per Drag & Drop</p>
      </div>

      {/* Breadcrumb / Back Button */}
      {currentFolderId && (
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentFolderId(null)}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('backToOverview')}
          </Button>
          <span className="text-slate-500">
            / {folders?.find(f => f.id === currentFolderId)?.name || 'Ordner'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
        {/* Drop zone for moving files back to root */}
        {currentFolderId && (
          <Card 
            className={`p-4 flex flex-col items-center justify-center aspect-square border-2 border-dashed transition-all cursor-pointer ${
              dropTargetFolderId === 'root' 
                ? 'border-[#ef5a24] bg-[#f5f5f5] scale-105' 
                : 'border-slate-300 bg-slate-50 hover:border-[#ef5a24]'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingFileId) setDropTargetFolderId('root');
            }}
            onDragLeave={() => setDropTargetFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingFileId) {
                moveFileToFolderMutation.mutate({ fileId: draggingFileId, folderId: null });
                setDraggingFileId(null);
                setDropTargetFolderId(null);
              }
            }}
            onClick={() => setCurrentFolderId(null)}
          >
            <ChevronLeft className="w-10 h-10 text-slate-400 mb-2" />
            <span className="text-sm text-slate-500 text-center">Zurück / Hierher verschieben</span>
          </Card>
        )}

        {/* Folders - only show when not inside a folder */}
        {!currentFolderId && folders?.map((folder) => (
          <Card 
            key={folder.id} 
            className={`p-4 flex flex-col items-center justify-center aspect-square bg-[#f5f5f5] border-[#ef5a24]/30 hover:bg-[#ef5a24]/10 transition-colors cursor-pointer group text-center relative ${
              dropTargetFolderId === folder.id ? 'ring-2 ring-[#ef5a24] bg-[#ef5a24]/10 scale-105' : ''
            }`}
            onClick={() => setCurrentFolderId(folder.id)}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingFileId) {
                setDropTargetFolderId(folder.id);
              }
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDropTargetFolderId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingFileId) {
                moveFileToFolderMutation.mutate({ fileId: draggingFileId, folderId: folder.id });
                setDraggingFileId(null);
                setDropTargetFolderId(null);
              }
            }}
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); if (await askDelete({ kind: 'folder', itemName: folder.name })) deleteFolderMutation.mutate(folder.id); }} className="text-red-600">
                    <Trash2 className="w-3 h-3 mr-2" /> Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Folder className={`w-12 h-12 text-[#ef5a24] mb-2 group-hover:scale-110 transition-transform ${dropTargetFolderId === folder.id ? 'text-[#ef5a24]' : ''}`} />
            <span className="font-medium text-[#ef5a24]">{folder.name}</span>
          </Card>
        ))}
        
        {/* File List */}
        {isLoading ? <div>{t('loadingShort')}</div> : files?.map((file) => (
             <Card 
               key={file.id} 
               draggable
               onDragStart={(e) => {
                 setDraggingFileId(file.id);
                 e.dataTransfer.effectAllowed = 'move';
               }}
               onDragEnd={() => {
                 setDraggingFileId(null);
                 setDropTargetFolderId(null);
               }}
               className={`p-4 flex flex-col items-center justify-between aspect-square hover:shadow-md transition-all relative group bg-white cursor-pointer ${
                 draggingFileId === file.id ? 'opacity-50 scale-95' : ''
               }`}
               onClick={() => canPreview(file) && setPreviewFile(file)}
             >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {canPreview(file) && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}>
                                <Eye className="w-3 h-3 mr-2" /> Vorschau
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <a href={previewablePdfUrl(file.url) || file.url} download={file.name || true} className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <Download className="w-3 h-3 mr-2" /> Herunterladen
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async (e) => { e.stopPropagation(); if (await askDelete({ kind: 'file', itemName: file.name })) deleteFileMutation.mutate(file.id); }} className="text-red-600">
                                <Trash2 className="w-3 h-3 mr-2" /> Löschen
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                {canPreview(file) && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                )}
                
                <div className="flex-1 flex items-center justify-center">
                    {file.type?.includes('image') ? (
                        <img src={file.url} alt={file.name} className="max-w-full max-h-24 rounded object-contain" />
                    ) : getIcon(file.type)}
                </div>
                
                <div className="text-center w-full mt-2">
                    <p className="font-medium text-sm truncate text-slate-700" title={file.name}>{file.name}</p>
                    {describeFileUrl(file.url).ok ? (
                      <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center justify-center gap-1" title={describeFileUrl(file.url).hint}>
                        <AlertTriangle className="w-3 h-3" /> {t('fileMissing')}
                      </p>
                    )}
                </div>
             </Card>
        ))}
      </div>

      {/* File Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent
          hideCloseButton
          aria-describedby={undefined}
          className="w-[95vw] sm:max-w-6xl h-[85vh] sm:h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        >
          <DialogTitle className="sr-only">
            {previewFile ? `Dateivorschau: ${previewFile.name}` : "Dateivorschau"}
          </DialogTitle>
          {previewFile && (
            <>
              {/* Header: eigene Schließen-Taste neben Download (kein Konflikt mit Dialog-X) */}
              <div className="flex items-center justify-between p-2 sm:p-4 border-b bg-white gap-3 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="shrink-0 hidden sm:block">{getIcon(previewFile.type)}</div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base truncate">{previewFile.name}</h3>
                    <p className="text-xs text-slate-500">{formatSize(previewFile.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {previewFile.type?.includes('image') && (
                    <div className="hidden sm:flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(25, zoom - 25))}>
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-slate-600 w-10 text-center">{zoom}%</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(300, zoom + 25))}>
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <a href={previewablePdfUrl(previewFile.url) || previewFile.url} download={previewFile.name || true}>
                    <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm">
                      <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Download</span>
                    </Button>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setPreviewFile(null)}
                    aria-label="Vorschau schließen"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {previewStatus && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 shrink-0">
                  <p className="font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Diese Datei ist nicht mehr abrufbar
                  </p>
                  <p className="mt-0.5 text-amber-800">{previewStatus.reason}</p>
                  {previewStatus.hint && <p className="text-amber-800">{previewStatus.hint}</p>}
                  <p className="mt-1 text-[11px] text-amber-700 break-all">Gespeicherter Link: {previewFile.url}</p>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-h-0 bg-slate-100 overflow-hidden relative flex flex-col">
                <div className="flex-1 min-h-0 relative overflow-auto">
                {getPreviewContent(previewFile)}
                </div>
                
                {/* Navigation arrows */}
                {previewableFiles.length > 1 && (
                  <>
                    {currentPreviewIndex > 0 && (
                      <button 
                        onClick={goToPrevFile}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                    )}
                    {currentPreviewIndex < previewableFiles.length - 1 && (
                      <button 
                        onClick={goToNextFile}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    )}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                      {currentPreviewIndex + 1} / {previewableFiles.length}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Text file preview component
function TextFilePreview({ url }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent('Fehler beim Laden der Datei');
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-6 text-sm font-mono whitespace-pre-wrap bg-white m-4 rounded-lg shadow">
        {content}
      </pre>
    </ScrollArea>
  );
}