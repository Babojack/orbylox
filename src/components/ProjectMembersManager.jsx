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
    mutationFn: async (email) => {
      const appUrl = window.location.origin;
      const isGerman = language === 'de';
      return api.integrations.Core.SendEmail({
        to: email,
        from_name: "OMNIPLACE Team",
        subject: isGerman 
          ? "🎉 Du wurdest zu einem Projekt in OMNIPLACE eingeladen!"
          : "🎉 You've been invited to a project in OMNIPLACE!",
        body: isGerman ? `
Hallo!

Du wurdest eingeladen, einem Projekt in OMNIPLACE beizutreten - der Plattform für Teamarbeit.

🚀 Was dich erwartet:
• Gemeinsame Arbeit an Aufgaben in Echtzeit
• Visuelles Canvas-Board
• Team-Chat
• Dokumente und Dateien

👉 Klicke hier, um zu starten: ${appUrl}

Bis bald im Projekt!
Dein OMNIPLACE Team
        ` : `
Hello!

You've been invited to join a project in OMNIPLACE - the platform for team collaboration.

🚀 What awaits you:
• Real-time collaborative task management
• Visual Canvas board
• Team chat
• Documents and files

👉 Click here to get started: ${appUrl}

See you in the project!
Your OMNIPLACE Team
        `
      });
    }
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
    
    if (currentMembers.includes(email.toLowerCase())) {
      alert(isGerman ? '⚠️ Dieser Benutzer ist bereits im Projekt' : '⚠️ This user is already in the project');
      return;
    }
    
    setInviting(true);
    
    try {
      // Check if user exists in the system
      const allUsers = await api.entities.User.list();
      const userExists = allUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!userExists) {
        alert(isGerman 
          ? '❌ Dieser Benutzer ist nicht im System registriert.\nBitte lass ihn sich zuerst registrieren!'
          : '❌ This user is not registered in the system.\nPlease ask them to register first!');
        setInviting(false);
        return;
      }
      
      // Add to project
      const newMembers = [...currentMembers, email.toLowerCase()];
      await updateMembersMutation.mutateAsync(newMembers);
      
      // Send invitation email
      try {
        await sendInviteMutation.mutateAsync(email);
        alert(isGerman 
          ? `✅ ${email} wurde zum Projekt hinzugefügt!\nEinladung wurde per E-Mail gesendet.`
          : `✅ ${email} added to project!\nInvitation sent via email.`);
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        alert(isGerman 
          ? `✅ ${email} wurde zum Projekt hinzugefügt!`
          : `✅ ${email} added to project!`);
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

  const members = project?.members || [];

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