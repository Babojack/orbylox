import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Puzzle, 
  Webhook,
  MessageSquare,
  Calendar,
  FileText,
  GitBranch,
  Mail,
  Database,
  Cloud,
  Zap,
  Plus,
  Trash2,
  Link,
  Star
} from 'lucide-react';

const AVAILABLE_INTEGRATIONS = [
  {
    name: "Slack",
    description: "Send notifications and updates to Slack channels",
    icon: MessageSquare,
    url: "https://slack.com/apps",
    category: "Communication",
    color: "bg-[#ef5a24]/10 text-[#ef5a24]"
  },
  {
    name: "Google Calendar",
    description: "Sync tasks and deadlines with Google Calendar",
    icon: Calendar,
    url: "https://calendar.google.com",
    category: "Productivity",
    color: "bg-blue-100 text-blue-600"
  },
  {
    name: "Notion",
    description: "Import and export documents from Notion",
    icon: FileText,
    url: "https://www.notion.so/integrations",
    category: "Productivity",
    color: "bg-slate-100 text-slate-600"
  },
  {
    name: "GitHub",
    description: "Link tasks to GitHub issues and pull requests",
    icon: GitBranch,
    url: "https://github.com/apps",
    category: "Development",
    color: "bg-gray-100 text-gray-600"
  },
  {
    name: "Zapier",
    description: "Connect with 5000+ apps via Zapier automations",
    icon: Zap,
    url: "https://zapier.com/apps",
    category: "Automation",
    color: "bg-orange-100 text-orange-600"
  },
  {
    name: "Make (Integromat)",
    description: "Create powerful automations with Make scenarios",
    icon: Webhook,
    url: "https://www.make.com/en/integrations",
    category: "Automation",
    color: "bg-[#ef5a24]/10 text-[#ef5a24]"
  },
  {
    name: "Gmail",
    description: "Send task notifications via Gmail",
    icon: Mail,
    url: "https://mail.google.com",
    category: "Communication",
    color: "bg-red-100 text-red-600"
  },
  {
    name: "Airtable",
    description: "Sync data with Airtable databases",
    icon: Database,
    url: "https://airtable.com/integrations",
    category: "Database",
    color: "bg-green-100 text-green-600"
  },
  {
    name: "Google Drive",
    description: "Attach files from Google Drive to tasks",
    icon: Cloud,
    url: "https://www.google.com/drive/",
    category: "Storage",
    color: "bg-yellow-100 text-yellow-600"
  },
  {
    name: "Dropbox",
    description: "Sync files with Dropbox storage",
    icon: Cloud,
    url: "https://www.dropbox.com/developers",
    category: "Storage",
    color: "bg-blue-100 text-blue-600"
  },
  {
    name: "Trello",
    description: "Import boards and cards from Trello",
    icon: Puzzle,
    url: "https://trello.com/power-ups",
    category: "Productivity",
    color: "bg-sky-100 text-sky-600"
  },
  {
    name: "Jira",
    description: "Sync issues with Jira projects",
    icon: Puzzle,
    url: "https://www.atlassian.com/software/jira/marketplace",
    category: "Development",
    color: "bg-[#ef5a24]/10 text-[#ef5a24]"
  }
];

const categories = [...new Set(AVAILABLE_INTEGRATIONS.map(i => i.category))];

export default function Integrations() {
  const queryClient = useQueryClient();
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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: '', url: '', description: '' });

  // Fetch custom integrations
  const { data: customIntegrations = [] } = useQuery({
    queryKey: ['customIntegrations', projectId],
    queryFn: async () => {
      return api.entities.CustomIntegration.listByProject(projectId, '-created_date');
    },
    enabled: !!projectId
  });

  // Add custom integration
  const addIntegrationMutation = useMutation({
    mutationFn: (data) => api.entities.CustomIntegration.create({
      ...data,
      project_id: projectId
    }),
    onMutate: async (data) => {
      await queryClient.cancelQueries(['customIntegrations', projectId]);
      const previous = queryClient.getQueryData(['customIntegrations', projectId]);
      queryClient.setQueryData(['customIntegrations', projectId], old => [
        { ...data, id: 'temp_' + Date.now(), project_id: projectId },
        ...(old || [])
      ]);
      setIsAddOpen(false);
      setNewIntegration({ name: '', url: '', description: '' });
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['customIntegrations', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['customIntegrations', projectId]);
    }
  });

  // Delete custom integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: (id) => api.entities.CustomIntegration.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries(['customIntegrations', projectId]);
      const previous = queryClient.getQueryData(['customIntegrations', projectId]);
      queryClient.setQueryData(['customIntegrations', projectId], old =>
        (old || []).filter(i => i.id !== id)
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['customIntegrations', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['customIntegrations', projectId]);
    }
  });

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Laden...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Unsere Tools</h2>
          <p className="text-slate-500">
            Füge deine Tools hinzu, die dein Team nutzt, um schnellen Zugriff zu haben.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#ef5a24] hover:bg-black">
              <Plus className="w-4 h-4 mr-2" /> Add Tool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Your Tool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Tool Name</label>
                <Input
                  placeholder="e.g. Miro, Figma, Notion..."
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Link</label>
                <Input
                  placeholder="https://..."
                  value={newIntegration.url}
                  onChange={(e) => setNewIntegration({ ...newIntegration, url: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Input
                  placeholder="What is this tool for?"
                  value={newIntegration.description}
                  onChange={(e) => setNewIntegration({ ...newIntegration, description: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => addIntegrationMutation.mutate(newIntegration)}
                disabled={!newIntegration.name.trim() || !newIntegration.url.trim()}
              >
                Add Tool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* My Tools Section */}
      {customIntegrations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            My Tools
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customIntegrations.map((integration) => (
              <Card 
                key={integration.id} 
                className="hover:shadow-lg transition-all group border-[#ef5a24]/30 bg-[#f5f5f5]"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ef5a24]/10 text-[#ef5a24]">
                      <Link className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteIntegrationMutation.mutate(integration.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-[#ef5a24]"
                        onClick={() => window.open(integration.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base mt-3">{integration.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 truncate">{integration.description || integration.url}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}