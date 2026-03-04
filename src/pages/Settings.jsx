import React from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import ProjectMembersManager from "@/components/ProjectMembersManager";
import BackupManager from "@/components/backup/BackupManager";
import { useLanguage } from "@/components/LanguageProvider";

export default function Settings() {
  const { t } = useLanguage();
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('project');
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await api.entities.Project.list();
      return projects.find(p => p.id === projectId) || { name: "ZenHub", description: "Loading..." };
    },
    enabled: !!projectId
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me()
  });

  const updateProjectMutation = useMutation({
      mutationFn: (data) => api.entities.Project.update(projectId, data)
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => api.auth.updateMe(data),
    onSuccess: () => queryClient.invalidateQueries(['currentUser'])
  });

  const textToTicketEnabled = currentUser?.text_to_ticket_enabled !== false;

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('projectSettings')}</h2>
        <p className="text-slate-500">{t('managePreferences')}</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>{t('generalInfo')}</CardTitle>
            <CardDescription>{t('updateDetails')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-1">
                <Label>{t('projectName')}</Label>
                <Input 
                    defaultValue={project?.name} 
                    onBlur={(e) => updateProjectMutation.mutate({ name: e.target.value })}
                />
            </div>
            <div className="space-y-1">
                <Label>{t('description')}</Label>
                <Input 
                    defaultValue={project?.description} 
                    onBlur={(e) => updateProjectMutation.mutate({ description: e.target.value })}
                />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>{t('teamMembers')}</CardTitle>
            <CardDescription>{t('inviteFriends')}</CardDescription>
        </CardHeader>
        <CardContent>
            <ProjectMembersManager projectId={projectId} />
        </CardContent>
      </Card>
      
      {/* Features Section */}
      <Card>
        <CardHeader>
            <CardTitle>{t('features')}</CardTitle>
            <CardDescription>{t('enableDisableFeatures')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('textToTicket')}</Label>
                <p className="text-sm text-slate-500">{t('textToTicketDesc')}</p>
              </div>
              <Switch
                checked={textToTicketEnabled}
                onCheckedChange={(checked) => updateUserMutation.mutate({ text_to_ticket_enabled: checked })}
              />
            </div>
        </CardContent>
      </Card>

      {/* Backup Section */}
      <Card>
        <CardHeader>
            <CardTitle>{t('backupRestore')}</CardTitle>
            <CardDescription>{t('createBackups')}</CardDescription>
        </CardHeader>
        <CardContent>
            <BackupManager 
              projectId={projectId} 
              project={project} 
              currentUser={currentUser}
            />
        </CardContent>
      </Card>

      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardHeader>
            <CardTitle className="text-indigo-900">🎯 {t('howToInvite')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
            <p>{t('inviteStep1')}</p>
            <p>{t('inviteStep2')}</p>
            <p>{t('inviteStep3')}</p>
            <p>{t('inviteStep4')}</p>
        </CardContent>
      </Card>
    </div>
  );
}