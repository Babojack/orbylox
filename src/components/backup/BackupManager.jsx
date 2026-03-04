import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, Download, Upload, Clock, Check, X, 
  AlertTriangle, Users, RefreshCw, Trash2, Shield
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BackupManager({ projectId, project, currentUser }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const memberCount = (project?.members?.length || 0) + 1; // +1 for creator
  const needsMultipleConfirmations = memberCount > 2;

  // Fetch backups
  const { data: backups = [], isLoading: backupsLoading } = useQuery({
    queryKey: ['backups', projectId],
    queryFn: async () => {
      const all = await api.entities.ProjectBackup.list('-created_date', 50);
      return all.filter(b => b.project_id === projectId);
    },
    enabled: !!projectId && isOpen
  });

  // Fetch restore requests
  const { data: restoreRequests = [] } = useQuery({
    queryKey: ['restoreRequests', projectId],
    queryFn: async () => {
      const all = await api.entities.RestoreRequest.list('-created_date', 20);
      return all.filter(r => r.project_id === projectId && r.status === 'pending');
    },
    enabled: !!projectId && isOpen
  });

  // Auto backup effect
  useEffect(() => {
    if (!projectId || !project) return;
    
    const autoBackup = async () => {
      // Check last backup
      const backups = await api.entities.ProjectBackup.list('-created_date', 1);
      const lastBackup = backups.find(b => b.project_id === projectId);
      
      // Auto backup every 24 hours
      const shouldBackup = !lastBackup || 
        (new Date() - new Date(lastBackup.created_date)) > 24 * 60 * 60 * 1000;
      
      if (shouldBackup) {
        await createBackup('auto');
      }
    };

    autoBackup();
  }, [projectId, project]);

  const createBackup = async (type = 'manual') => {
    setIsCreating(true);
    
    // Fetch all project data
    const [tasks, documents, files, posts, messages, events, canvasItems, startupSteps] = await Promise.all([
      api.entities.Task.list('-created_date', 500).then(all => all.filter(t => t.project_id === projectId)),
      api.entities.Document.list('-created_date', 200).then(all => all.filter(d => d.project_id === projectId)),
      api.entities.FileRecord.list('-created_date', 200).then(all => all.filter(f => f.project_id === projectId)),
      api.entities.Post.list('-created_date', 200).then(all => all.filter(p => p.project_id === projectId)),
      api.entities.Message.list('-created_date', 500).then(all => all.filter(m => m.project_id === projectId)),
      api.entities.Event.list('-created_date', 200).then(all => all.filter(e => e.project_id === projectId)),
      api.entities.CanvasItem.list('-created_date', 200).then(all => all.filter(c => c.project_id === projectId)),
      api.entities.StartupStep.list('-created_date', 100).then(all => all.filter(s => s.project_id === projectId))
    ]);

    await api.entities.ProjectBackup.create({
      project_id: projectId,
      project_data: project,
      tasks_data: tasks,
      documents_data: documents,
      files_data: files,
      posts_data: posts,
      messages_data: messages,
      events_data: events,
      canvas_items_data: canvasItems,
      startup_steps_data: startupSteps,
      backup_type: type,
      backup_name: backupName || `Backup ${new Date().toLocaleDateString('de')}`
    });

    setIsCreating(false);
    setBackupName('');
    queryClient.invalidateQueries(['backups', projectId]);
  };

  const requestRestore = async (backup) => {
    if (needsMultipleConfirmations) {
      // Create restore request that needs confirmations
      await api.entities.RestoreRequest.create({
        project_id: projectId,
        backup_id: backup.id,
        requested_by: currentUser.email,
        required_confirmations: 2,
        confirmed_by: [currentUser.email],
        status: 'pending'
      });
      queryClient.invalidateQueries(['restoreRequests', projectId]);
    } else {
      // Direct restore for <= 2 members
      await performRestore(backup);
    }
  };

  const confirmRestore = async (request) => {
    const updatedConfirmed = [...(request.confirmed_by || [])];
    if (!updatedConfirmed.includes(currentUser.email)) {
      updatedConfirmed.push(currentUser.email);
    }

    if (updatedConfirmed.length >= request.required_confirmations) {
      // Enough confirmations - perform restore
      const backup = backups.find(b => b.id === request.backup_id);
      if (backup) {
        await performRestore(backup);
        await api.entities.RestoreRequest.update(request.id, { 
          status: 'restored',
          confirmed_by: updatedConfirmed 
        });
      }
    } else {
      await api.entities.RestoreRequest.update(request.id, { 
        confirmed_by: updatedConfirmed 
      });
    }
    queryClient.invalidateQueries(['restoreRequests', projectId]);
  };

  const cancelRestore = async (request) => {
    await api.entities.RestoreRequest.update(request.id, { status: 'cancelled' });
    queryClient.invalidateQueries(['restoreRequests', projectId]);
  };

  const performRestore = async (backup) => {
    setIsRestoring(true);

    // Delete current data
    const [tasks, documents, files, posts, messages, events, canvasItems, startupSteps] = await Promise.all([
      api.entities.Task.list('-created_date', 500).then(all => all.filter(t => t.project_id === projectId)),
      api.entities.Document.list('-created_date', 200).then(all => all.filter(d => d.project_id === projectId)),
      api.entities.FileRecord.list('-created_date', 200).then(all => all.filter(f => f.project_id === projectId)),
      api.entities.Post.list('-created_date', 200).then(all => all.filter(p => p.project_id === projectId)),
      api.entities.Message.list('-created_date', 500).then(all => all.filter(m => m.project_id === projectId)),
      api.entities.Event.list('-created_date', 200).then(all => all.filter(e => e.project_id === projectId)),
      api.entities.CanvasItem.list('-created_date', 200).then(all => all.filter(c => c.project_id === projectId)),
      api.entities.StartupStep.list('-created_date', 100).then(all => all.filter(s => s.project_id === projectId))
    ]);

    // Delete all current data
    await Promise.all([
      ...tasks.map(t => api.entities.Task.delete(t.id)),
      ...documents.map(d => api.entities.Document.delete(d.id)),
      ...files.map(f => api.entities.FileRecord.delete(f.id)),
      ...posts.map(p => api.entities.Post.delete(p.id)),
      ...messages.map(m => api.entities.Message.delete(m.id)),
      ...events.map(e => api.entities.Event.delete(e.id)),
      ...canvasItems.map(c => api.entities.CanvasItem.delete(c.id)),
      ...startupSteps.map(s => api.entities.StartupStep.delete(s.id))
    ]);

    // Restore from backup (without IDs so new ones are generated)
    const stripId = (item) => {
      const { id, created_date, updated_date, ...rest } = item;
      return rest;
    };

    await Promise.all([
      ...(backup.tasks_data || []).map(t => api.entities.Task.create(stripId(t))),
      ...(backup.documents_data || []).map(d => api.entities.Document.create(stripId(d))),
      ...(backup.files_data || []).map(f => api.entities.FileRecord.create(stripId(f))),
      ...(backup.posts_data || []).map(p => api.entities.Post.create(stripId(p))),
      ...(backup.messages_data || []).map(m => api.entities.Message.create(stripId(m))),
      ...(backup.events_data || []).map(e => api.entities.Event.create(stripId(e))),
      ...(backup.canvas_items_data || []).map(c => api.entities.CanvasItem.create(stripId(c))),
      ...(backup.startup_steps_data || []).map(s => api.entities.StartupStep.create(stripId(s)))
    ]);

    // Restore project data
    if (backup.project_data) {
      const { id, created_date, updated_date, created_by, ...projectData } = backup.project_data;
      await api.entities.Project.update(projectId, projectData);
    }

    setIsRestoring(false);
    queryClient.invalidateQueries();
    setIsOpen(false);
  };

  const deleteBackup = async (backupId) => {
    if (window.confirm('Backup wirklich löschen?')) {
      await api.entities.ProjectBackup.delete(backupId);
      queryClient.invalidateQueries(['backups', projectId]);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Database className="w-4 h-4" />
        Backups
        {restoreRequests.length > 0 && (
          <Badge className="bg-amber-500 text-white ml-1">{restoreRequests.length}</Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Backup & Wiederherstellung
            </DialogTitle>
          </DialogHeader>

          {/* Info Banner */}
          {needsMultipleConfirmations && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-700">
                Bei mehr als 2 Teammitgliedern müssen mindestens 2 Personen eine Wiederherstellung bestätigen.
              </p>
            </div>
          )}

          {/* Pending Restore Requests */}
          {restoreRequests.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-indigo-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Offene Wiederherstellungsanfragen
              </h3>
              {restoreRequests.map(request => {
                const backup = backups.find(b => b.id === request.backup_id);
                const hasConfirmed = request.confirmed_by?.includes(currentUser?.email);
                return (
                  <div key={request.id} className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {backup?.backup_name || 'Backup'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Angefragt von {request.requested_by}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-600">
                            {request.confirmed_by?.length || 0} / {request.required_confirmations} Bestätigungen
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!hasConfirmed && (
                          <Button 
                            size="sm" 
                            onClick={() => confirmRestore(request)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Bestätigen
                          </Button>
                        )}
                        {hasConfirmed && (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Bestätigt
                          </Badge>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => cancelRestore(request)}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Backup */}
          <div className="flex gap-2">
            <Input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Backup-Name (optional)"
              className="flex-1"
            />
            <Button 
              onClick={() => createBackup('manual')}
              disabled={isCreating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isCreating ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Backup erstellen
            </Button>
          </div>

          {/* Backups List */}
          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-2">
              {backupsLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Laden...
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Database className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  Keine Backups vorhanden
                </div>
              ) : (
                backups.map((backup) => (
                  <motion.div
                    key={backup.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900">
                            {backup.backup_name || 'Backup'}
                          </h4>
                          <Badge variant="outline" className={
                            backup.backup_type === 'auto' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }>
                            {backup.backup_type === 'auto' ? 'Auto' : 'Manuell'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(backup.created_date).toLocaleString('de')}
                          </span>
                          <span>{backup.tasks_data?.length || 0} Tasks</span>
                          <span>{backup.documents_data?.length || 0} Docs</span>
                          <span>{backup.posts_data?.length || 0} Posts</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => requestRestore(backup)}
                          disabled={isRestoring}
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          {isRestoring ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          Wiederherstellen
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteBackup(backup.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Info */}
          <p className="text-xs text-slate-400 text-center">
            Automatische Backups werden alle 24 Stunden erstellt
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}