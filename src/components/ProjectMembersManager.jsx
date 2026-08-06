import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageProvider";

// Максимум участников в проекте (не считая создателя)
const MAX_MEMBERS_PER_PROJECT = 3;

export default function ProjectMembersManager({ projectId }) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      try {
        const projects = await api.entities.Project.list();
        let foundProject = projects.find(p => p.id === projectId);
        
        if (!foundProject) {
          // Create new project
          const newProject = await api.entities.Project.create({
            name: "ZenHub",
            description: "Main project",
            members: []
          });
          return newProject;
        }
        return foundProject;
      } catch (error) {
        console.error('Error loading project:', error);
        return { id: projectId, name: "ZenHub", members: [] };
      }
    }
  });

  const updateMembersMutation = useMutation({
    mutationFn: async (members) => {
      if (!project?.id) {
        throw new Error('Project not found');
      }
      return api.entities.Project.update(project.id, { members });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', projectId]);
      queryClient.invalidateQueries(['project']);
    }
  });

  const sendInviteMutation = useMutation({
    // Subject and body are built by the server template, so every invite looks
    // the same and stays translatable in one place.
    mutationFn: async (email) => api.integrations.Core.SendEmail({
      to: email,
      projectId,
      appUrl: window.location.origin,
      language: language === 'en' ? 'en' : 'de',
      projectName: project?.name || '',
      inviterName: currentUser?.full_name || currentUser?.displayName || currentUser?.email || '',
    }),
  });

  const addMember = async () => {
    const isGerman = language === 'de';
    if (!email.trim() || !email.includes('@')) {
      alert(isGerman ? '❌ Bitte gib eine gültige E-Mail-Adresse ein' : '❌ Please enter a valid email address');
      return;
    }
    
    const currentMembers = project?.members || [];
    
    // Проверка лимита участников
    if (currentMembers.length >= MAX_MEMBERS_PER_PROJECT) {
      alert(isGerman 
        ? `❌ Maximale Teilnehmeranzahl erreicht (${MAX_MEMBERS_PER_PROJECT})!`
        : `❌ Maximum members limit reached (${MAX_MEMBERS_PER_PROJECT})!`);
      return;
    }
    
    if (email.trim().toLowerCase() === (currentUser?.email || '').toLowerCase()) {
      alert(isGerman ? '⚠️ Du bist bereits im Projekt' : '⚠️ You are already in this project');
      return;
    }

    if (currentMembers.includes(email.toLowerCase())) {
      alert(isGerman ? '⚠️ Dieser Benutzer ist bereits im Projekt' : '⚠️ This user is already in the project');
      return;
    }
    
    setInviting(true);
    
    try {
      // Add to project (also works for not-yet-registered emails)
      const newMembers = [...currentMembers, email.toLowerCase()];
      await updateMembersMutation.mutateAsync(newMembers);
      
      // Send invitation email
      try {
        await sendInviteMutation.mutateAsync(email);
        alert(isGerman 
          ? `✅ ${email} wurde zum Projekt hinzugefügt!\nEinladung wurde per E-Mail gesendet.`
          : `✅ ${email} added to project!\nInvitation sent via email.`);
      } catch (emailError) {
        // Silently pretending the invite went out is how a broken mail setup
        // stays unnoticed for weeks — say what actually happened.
        console.error('Email send failed:', emailError);
        const reason = emailError?.message || 'Unbekannter Fehler';
        alert(isGerman
          ? `✅ ${email} wurde zum Projekt hinzugefügt.\n\n⚠️ Die Einladungs-E-Mail konnte NICHT gesendet werden:\n${reason}\n\nBitte den Link manuell weitergeben:\n${window.location.origin}/login?project=${encodeURIComponent(projectId)}`
          : `✅ ${email} added to project.\n\n⚠️ The invitation email could NOT be sent:\n${reason}\n\nPlease share this link manually:\n${window.location.origin}/login?project=${encodeURIComponent(projectId)}`);
      }
      setEmail("");
    } catch (error) {
      console.error('Add member error:', error);
      alert(isGerman 
        ? `❌ Fehler: ${error.message || 'Konnte Teilnehmer nicht hinzufügen'}`
        : `❌ Error: ${error.message || 'Could not add member'}`);
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberEmail) => {
    const isGerman = language === 'de';
    if (!confirm(isGerman 
      ? `Möchtest du ${memberEmail} wirklich aus dem Projekt entfernen?`
      : `Are you sure you want to remove ${memberEmail} from the project?`)) return;
    const currentMembers = project?.members || [];
    await updateMembersMutation.mutateAsync(currentMembers.filter(m => m !== memberEmail));
  };

  // Never count or list the owner as an invited member — they are the project.
  const members = (project?.members || []).filter(
    (email) => (email || '').toLowerCase() !== (currentUser?.email || '').toLowerCase()
  );

  if (isLoading) {
    return <div className="text-sm text-slate-500">{language === 'de' ? 'Laden...' : 'Loading...'}</div>;
  }

  const canAddMore = members.length < MAX_MEMBERS_PER_PROJECT;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <UserPlus className="w-4 h-4" />
          {t('inviteToProject')} ({members.length}/{MAX_MEMBERS_PER_PROJECT})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{language === 'de' ? 'Projektteam' : 'Project Team'}</DialogTitle>
        </DialogHeader>

        <div className={`border rounded-lg p-3 mb-2 ${canAddMore ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm ${canAddMore ? 'text-indigo-900' : 'text-amber-900'}`}>
            {canAddMore 
              ? (language === 'de' 
                  ? `💡 Gib die E-Mail deines Freundes ein (${members.length}/${MAX_MEMBERS_PER_PROJECT} Plätze belegt)`
                  : `💡 Enter your friend's email (${members.length}/${MAX_MEMBERS_PER_PROJECT} slots used)`)
              : (language === 'de'
                  ? `⚠️ Maximale Teilnehmeranzahl erreicht (${MAX_MEMBERS_PER_PROJECT})`
                  : `⚠️ Maximum members limit reached (${MAX_MEMBERS_PER_PROJECT})`)}
          </p>
          <p className="text-xs text-slate-600 mt-2 leading-snug">
            {language === 'de'
              ? 'Wichtig: Die Person muss sich mit Google anmelden — mit genau dieser E-Mail. Ohne Google-Login (Firestore) gibt es keinen Projektzugriff.'
              : 'Important: They must sign in with Google using exactly this email address. Without Google sign-in (cloud), the project will not appear.'}
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !inviting && canAddMore && addMember()}
              disabled={inviting || !canAddMore}
            />
            <Button 
              onClick={addMember} 
              disabled={!email.trim() || inviting || !canAddMore}
              className={canAddMore ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400"}
            >
              {inviting 
                ? (language === 'de' ? 'Senden...' : 'Sending...') 
                : (language === 'de' ? 'Einladen' : 'Invite')}
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((memberEmail) => (
              <div
                key={memberEmail}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                      {memberEmail[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-slate-700">{memberEmail}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removeMember(memberEmail)}
                  title={language === 'de' ? 'Aus Projekt entfernen' : 'Remove from project'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {members.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                {language === 'de' 
                  ? 'Noch keine Mitglieder. Lade Freunde ein!'
                  : 'No members yet. Invite friends!'}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}