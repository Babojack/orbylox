import React, { useState } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Sparkles, ArrowRight, ArrowLeft, Loader2, 
  Lightbulb, BookOpen, Trash2, Save, X, Image 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import MethodologyCard, { METHODOLOGIES } from "@/components/validation/MethodologyCard";
import RoadmapDisplay from "@/components/validation/RoadmapDisplay";
import IdeaCard from "@/components/validation/IdeaCard";
import { askDelete } from '@/lib/confirmDelete';

export default function ProductValidation() {
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

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [generatedRoadmap, setGeneratedRoadmap] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [viewIdea, setViewIdea] = useState(null);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['productIdeas', projectId],
    queryFn: async () => {
      return api.entities.ProductIdea.listByProject(projectId, '-created_date');
    },
    enabled: !!projectId
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ProductIdea.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['productIdeas', projectId]);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ProductIdea.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['productIdeas', projectId])
  });

  const resetForm = () => {
    setShowCreate(false);
    setStep(1);
    setTitle('');
    setDescription('');
    setSelectedMethod(null);
    setGeneratedRoadmap(null);
    setGeneratedImage(null);
  };

  const generateRoadmap = async () => {
    setIsGenerating(true);
    
    const methodInfo = METHODOLOGIES[selectedMethod];
    const prompt = `You are an expert in product validation and the "${methodInfo.name}" methodology by ${methodInfo.author}.

Product idea: "${title}"
Description: "${description}"

Create a detailed roadmap to validate this product idea using the ${methodInfo.name} methodology.

The roadmap should be practical and actionable with concrete tasks and timeframes.`;

    const response = await api.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Short summary of the validation strategy" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                duration: { type: "string" },
                description: { type: "string" },
                tasks: { type: "array", items: { type: "string" } },
                deliverables: { type: "array", items: { type: "string" } }
              }
            }
          },
          keyMetrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                target: { type: "string" }
              }
            }
          }
        }
      }
    });

    setGeneratedRoadmap(response);
    setIsGenerating(false);
    setStep(3);
    
    // Generate image in parallel
    generateRoadmapImage(response);
  };

  const generateRoadmapImage = async (roadmap) => {
    setIsGeneratingImage(true);
    const methodInfo = METHODOLOGIES[selectedMethod];
    
    const imagePrompt = `Create a professional, modern infographic visualization for a product roadmap. 
Title: "${title}" 
Methodology: ${methodInfo.name}
Phases: ${roadmap.phases.map(p => p.title).join(', ')}

Style: Clean, minimal, corporate design with gradient colors (${selectedMethod === 'lean_startup' ? 'emerald/teal' : selectedMethod === 'design_thinking' ? 'purple/violet' : selectedMethod === 'jobs_to_be_done' ? 'blue/indigo' : selectedMethod === 'blue_ocean' ? 'cyan/blue' : 'amber/orange'}). 
Show a timeline or flowchart visualization with icons. Modern tech startup aesthetic. White background.`;

    const { url } = await api.integrations.Core.GenerateImage({ prompt: imagePrompt });
    setGeneratedImage(url);
    setIsGeneratingImage(false);
  };

  const handleSave = () => {
    createMutation.mutate({
      title,
      description,
      methodology: selectedMethod,
      roadmap: { ...generatedRoadmap, image_url: generatedImage },
      status: 'validated',
      project_id: projectId
    });
  };

  const handleDelete = async (id) => {
    if (await askDelete({ kind: 'ideaProduct' })) {
      deleteMutation.mutate(id);
      if (viewIdea?.id === id) setViewIdea(null);
    }
  };

  if (userLoading || !currentUser) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-7 h-7 text-amber-500" />
            Product Validation
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Beta</span>
          </h1>
          <p className="text-slate-500 mt-1">Validate your product ideas with proven methods</p>
        </div>
        <Button 
          onClick={() => setShowCreate(true)}
          className="bg-[#ef5a24] hover:bg-black shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Validate new idea
        </Button>
      </div>

      {/* Ideas Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ef5a24]" />
        </div>
      ) : ideas.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
        >
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">No ideas yet</h3>
          <p className="text-slate-500 mb-6">Start your first product validation</p>
          <Button onClick={() => setShowCreate(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create first idea
          </Button>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {ideas.map((idea, index) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                index={index}
                onView={setViewIdea}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ef5a24]" />
              Validate product idea
            </DialogTitle>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <motion.div
                  animate={{ 
                    scale: step === s ? 1.1 : 1,
                    backgroundColor: step >= s ? '#6366f1' : '#e2e8f0'
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                >
                  {s}
                </motion.div>
                {s < 3 && (
                  <motion.div 
                    animate={{ backgroundColor: step > s ? '#6366f1' : '#e2e8f0' }}
                    className="w-12 h-1 rounded"
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <ScrollArea className="max-h-[60vh] pr-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Idea Input */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Product name / Idea
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Smart fitness app"
                      className="text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                      Description
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your product idea in detail. What problem does it solve? Who is the target audience? What makes it unique?"
                      rows={5}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 2: Methodology Selection */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-slate-600 text-center mb-4">
                    Choose a validation method for your idea
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {Object.keys(METHODOLOGIES).map((key) => (
                      <MethodologyCard
                        key={key}
                        methodKey={key}
                        selected={selectedMethod}
                        onSelect={setSelectedMethod}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Generated Roadmap */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      >
                        <Sparkles className="w-12 h-12 text-[#ef5a24]" />
                      </motion.div>
                      <p className="text-slate-600 mt-4">Generating your roadmap...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Generated Image */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                      >
                        {isGeneratingImage ? (
                          <div className="h-64 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                              <Image className="w-10 h-10 text-[#ef5a24]" />
                            </motion.div>
                            <p className="text-sm text-slate-500 mt-3">Generating image...</p>
                          </div>
                        ) : generatedImage ? (
                          <img 
                            src={generatedImage} 
                            alt="Roadmap Visualization" 
                            className="w-full h-auto"
                          />
                        ) : null}
                      </motion.div>
                      
                      <RoadmapDisplay roadmap={generatedRoadmap} methodology={selectedMethod} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => step === 1 ? resetForm() : setStep(step - 1)}
              disabled={isGenerating}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => {
                  if (step === 1 && title && description) setStep(2);
                  else if (step === 2 && selectedMethod) {
                    setStep(3);
                    generateRoadmap();
                  }
                }}
                disabled={
                  (step === 1 && (!title || !description)) ||
                  (step === 2 && !selectedMethod)
                }
                className="bg-[#ef5a24] hover:bg-black"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={isGenerating || createMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Idea Dialog */}
      <Dialog open={!!viewIdea} onOpenChange={() => setViewIdea(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{METHODOLOGIES[viewIdea?.methodology]?.icon}</span>
              {viewIdea?.title}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-500 mb-1">Beschreibung</p>
                <p className="text-slate-700">{viewIdea?.description}</p>
              </div>
              
              {viewIdea?.roadmap?.image_url && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl overflow-hidden border border-slate-200"
                >
                  <img 
                    src={viewIdea.roadmap.image_url} 
                    alt="Roadmap Visualization" 
                    className="w-full h-auto"
                  />
                </motion.div>
              )}
              
              {viewIdea?.roadmap && (
                <RoadmapDisplay roadmap={viewIdea.roadmap} methodology={viewIdea.methodology} />
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => handleDelete(viewIdea?.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Löschen
            </Button>
            <Button onClick={() => setViewIdea(null)}>
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}