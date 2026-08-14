import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { motion } from 'framer-motion';
import {
  Database, Download, Upload, Clock, Check, X,
  AlertTriangle, Users, RefreshCw, Trash2, Shield, HardDrive, FileWarning
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import {
  createBackup as createFullBackup,
  listBackups,
  deleteBackup as deleteFullBackup,
  downloadBackup,
  restoreBackup,
} from "@/lib/projectBackup";

const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupManager({ projectId, project, currentUser }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const autoBackupTriedRef = useRef(false);

  const memberCount = (project?.members?.length || 0) + 1; // +1 for creator
  const needsMultipleConfirmations = memberCount > 2;

  const {
    data: backups = [],
    isLoading: backupsLoading,
    isError: backupsError,
    error: backupsErrorObj,
    refetch: refetchBackups,
  } = useQuery({
    queryKey: ['backups', projectId],
    queryFn: () => listBackups(projectId),
    enabled: !!projectId && isOpen,
    staleTime: 10000,
  });

  const { data: restoreRequests = [] } = useQuery({
    queryKey: ['restoreRequests', projectId],
    queryFn: async () => {
      const all = await api.entities.RestoreRequest.list('-created_date', 20);
      return all.filter(r => r.project_id === projectId && r.status === 'pending');
    },
    enabled: !!projectId && isOpen,
  });

  // Daily automatic backup, checked once per mounted project.
  useEffect(() => {
    if (!projectId || !project || autoBackupTriedRef.current) return;
    autoBackupTriedRef.current = true;

    (async () => {
      try {
        const existing = await listBackups(projectId);
        const last = existing[0];
        const due = !last || (Date.now() - new Date(last.created_date).getTime()) > AUTO_BACKUP_INTERVAL_MS;
        if (!due) return;
        await createFullBackup({
          projectId,
          project,
          name: `Auto-Backup ${new Date().toLocaleDateString('de-DE')}`,
          type: 'auto',
        });
        queryClient.invalidateQueries({ queryKey: ['backups', projectId] });
      } catch (err) {
        // Silent: a missing endpoint should not block the project view.
        console.error('[Backup] Auto-Backup fehlgeschlagen:', err?.message || err);
      }
    })();
  }, [projectId, project, queryClient]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const meta = await createFullBackup({
        projectId,
        project,
        name: backupName.trim(),
        type: 'manual',
      });
      setBackupName('');
      queryClient.invalidateQueries({ queryKey: ['backups', projectId] });
      toast({
        title: 'Backup erstellt',
        description: `${meta.included_files || 0} Datei(en), ${formatBytes(meta.size)}`,
      });
    } catch (err) {
      toast({ title: 'Backup fehlgeschlagen', description: err?.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const performRestore = async (backup) => {
    setRestoreStatus('Wiederherstellung startet…');
    try {
      const result = await restoreBackup({
        projectId,
        id: backup.id,
        onProgress: (message) => setRestoreStatus(message),
      });
      queryClient.invalidateQueries();
      toast({
        title: 'Wiederherstellung abgeschlossen',
        description: `${result.restoredFiles} Datei(en) zurueckgespielt.`,
      });
      setIsOpen(false);
    } catch (err) {
      toast({ title: 'Wiederherstellung fehlgeschlagen', description: err?.message, variant: 'destructive' });
    } finally {
      setRestoreStatus(null);
    }
  };

  const requestRestore = async (backup) => {
    if (!window.confirm(
      'Wiederherstellung ueberschreibt den aktuellen Stand des Projekts vollstaendig. Fortfahren?'
    )) return;

    if (needsMultipleConfirmations) {
      await api.entities.RestoreRequest.create({
        project_id: projectId,
        backup_id: backup.id,
        requested_by: currentUser?.email,
        required_confirmations: 2,
        confirmed_by: [currentUser?.email],
        status: 'pending',
      });
      queryClient.invalidateQueries({ queryKey: ['restoreRequests', projectId] });
      return;
    }
    await performRestore(backup);
  };

  const confirmRestore = async (request) => {
    const confirmed = [...(request.confirmed_by || [])];
    if (!confirmed.includes(currentUser?.email)) confirmed.push(currentUser?.email);

    if (confirmed.length >= request.required_confirmations) {
      const backup = backups.find(b => b.id === request.backup_id);
      if (backup) {
        await performRestore(backup);
        await api.entities.RestoreRequest.update(request.id, { status: 'restored', confirmed_by: confirmed });
      }
    } else {
      await api.entities.RestoreRequest.update(request.id, { confirmed_by: confirmed });
    }
    queryClient.invalidateQueries({ queryKey: ['restoreRequests', projectId] });
  };

  const cancelRestore = async (request) => {
    await api.entities.RestoreRequest.update(request.id, { status: 'cancelled' });
    queryClient.invalidateQueries({ queryKey: ['restoreRequests', projectId] });
  };

  const handleDelete = async (backup) => {
    if (!window.confirm('Backup wirklich löschen?')) return;
    try {
      await deleteFullBackup(projectId, backup.id);
      queryClient.invalidateQueries({ queryKey: ['backups', projectId] });
    } catch (err) {
      toast({ title: 'Löschen fehlgeschlagen', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDownload = async (backup) => {
    try {
      await downloadBackup(projectId, backup.id);
    } catch (err) {
      toast({ title: 'Download fehlgeschlagen', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
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
              <Database className="w-5 h-5 text-[#ef5a24]" />
              Backup & Wiederherstellung
            </DialogTitle>
          </DialogHeader>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
            <HardDrive className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">
              Jedes Backup enthält alle Projektdaten <strong>und</strong> die hochgeladenen Dateien als ZIP.
              Beim Wiederherstellen landen die Dateien wieder unter ihren Original-Pfaden, alle Links stimmen also weiterhin.
            </p>
          </div>

          {needsMultipleConfirmations && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-700">
                Bei mehr als 2 Teammitgliedern müssen mindestens 2 Personen eine Wiederherstellung bestätigen.
              </p>
            </div>
          )}

          {restoreStatus && (
            <div className="bg-[#f5f5f5] border border-[#ef5a24]/30 rounded-lg p-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#ef5a24] animate-spin" />
              <p className="text-sm text-[#ef5a24]">{restoreStatus}</p>
            </div>
          )}

          {restoreRequests.length > 0 && (
            <div className="bg-[#f5f5f5] border border-[#ef5a24]/30 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-[#ef5a24] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Offene Wiederherstellungsanfragen
              </h3>
              {restoreRequests.map(request => {
                const backup = backups.find(b => b.id === request.backup_id);
                const hasConfirmed = request.confirmed_by?.includes(currentUser?.email);
                return (
                  <div key={request.id} className="bg-white rounded-lg p-3 border border-[#ef5a24]/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{backup?.name || 'Backup'}</p>
                        <p className="text-xs text-slate-500">Angefragt von {request.requested_by}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-600">
                            {request.confirmed_by?.length || 0} / {request.required_confirmations} Bestätigungen
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!hasConfirmed ? (
                          <Button size="sm" onClick={() => confirmRestore(request)} className="bg-green-600 hover:bg-green-700">
                            <Check className="w-4 h-4 mr-1" />
                            Bestätigen
                          </Button>
                        ) : (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="w-3 h-3 mr-1" />
                            Bestätigt
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => cancelRestore(request)} className="text-red-600">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Backup-Name (optional)"
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={isCreating} className="bg-[#ef5a24] hover:bg-black">
              {isCreating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              {isCreating ? 'Wird gepackt…' : 'Backup erstellen'}
            </Button>
          </div>

          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-2">
              {backupsError ? (
                <div className="text-center py-8 px-4">
                  <FileWarning className="w-10 h-10 mx-auto mb-2 text-red-300" />
                  <p className="text-sm text-red-600">{backupsErrorObj?.message}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => refetchBackups()}>
                    Erneut laden
                  </Button>
                </div>
              ) : backupsLoading ? (
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
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-[#ef5a24] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900 truncate">{backup.name || 'Backup'}</h4>
                          <Badge variant="outline" className={
                            backup.backup_type === 'auto'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-[#f5f5f5] text-[#ef5a24] border-[#ef5a24]/30'
                          }>
                            {backup.backup_type === 'auto' ? 'Auto' : 'Manuell'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(backup.created_date).toLocaleString('de-DE')}
                          </span>
                          <span>{backup.included_files ?? 0} Dateien</span>
                          <span>{formatBytes(backup.size)}</span>
                          {backup.missing_files > 0 && (
                            <span className="text-amber-600">{backup.missing_files} Datei(en) fehlten</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(backup)}
                          title="ZIP herunterladen"
                          className="text-slate-600"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => requestRestore(backup)}
                          disabled={!!restoreStatus}
                          className="text-[#ef5a24] border-[#ef5a24]/30 hover:bg-[#f5f5f5]"
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Wiederherstellen
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(backup)}
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

          <p className="text-xs text-slate-400 text-center">
            Automatisches Backup einmal täglich beim Öffnen des Projekts · alle Stände bleiben erhalten
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
