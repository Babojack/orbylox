import React from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useContactCare } from "@/hooks/useContactCare";
import { INTERVAL_CHOICES } from "@/api/contactCare";
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
  const contactCare = useContactCare(currentUser);

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">{t('projectSettings')}</h2>
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

      {/* Kontaktpflege — persoenliche Einstellung, gilt fuer alle Projekte */}
      <Card>
        <CardHeader>
          <CardTitle>{t('contactCareTitle')}</CardTitle>
          <CardDescription>{t('contactCareSettingDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="contact-care-enabled" className="font-medium">
              {t('contactCareEnable')}
            </Label>
            <Switch
              id="contact-care-enabled"
              checked={!!contactCare.prefs.enabled}
              onCheckedChange={(v) => contactCare.setEnabled(!!v)}
            />
          </div>
          {contactCare.prefs.enabled && (
            <div>
              <Label className="font-medium block mb-2">{t('contactCareInterval')}</Label>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_CHOICES.map((days) => {
                  const active = contactCare.prefs.intervalDays === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => contactCare.setIntervalDays(days)}
                      className={`h-10 px-3 text-xs font-bold uppercase tracking-wide border-2 transition-colors ${
                        active
                          ? 'bg-black border-black text-white'
                          : 'bg-white border-black text-black hover:bg-[#f5f5f5]'
                      }`}
                      aria-pressed={active}
                    >
                      {t('contactCareEvery').replace('{n}', String(days))}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

      <Card className="border-[#ef5a24]/30 bg-[#f5f5f5]">
        <CardHeader>
            <CardTitle className="text-[#ef5a24]">🎯 {t('howToInvite')}</CardTitle>
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