import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Sparkles, BookOpen, Save, FolderOpen, Plus, Archive } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RoadmapTimeline from '@/components/startup-builder/RoadmapTimeline';
import BlockPalette from '@/components/startup-builder/BlockPalette';
import StepEditDialog from '@/components/startup-builder/StepEditDialog';
import TemplateSelector from '@/components/startup-builder/TemplateSelector';
import StartDecisionDialog from '@/components/startup-builder/StartDecisionDialog';
import JourneyCard from '@/components/startup-builder/JourneyCard';
import JourneyDetailDialog from '@/components/startup-builder/JourneyDetailDialog';
import { BLOCK_TYPES } from '@/components/startup-builder/BlockPalette';
import { useLanguage } from '@/components/LanguageProvider';

export default function StartupBuilder() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('project');
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Auth check
  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (userError || (!userLoading && !currentUser)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [currentUser, userLoading, userError]);

  const [editingStep, setEditingStep] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [showStartDecision, setShowStartDecision] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [journeyName, setJourneyName] = useState('');
  const [journeyDesc, setJourneyDesc] = useState('');
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [viewMode, setViewMode] = useState('builder');
  const [viewingJourney, setViewingJourney] = useState(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState(null);

  // Fetch steps
  const { data: steps = [], isLoading } = useQuery({
    queryKey: ['startupSteps', projectId],
    queryFn: async () => {
      const allSteps = await api.entities.StartupStep.list('order_index', 200);
      return allSteps.filter(s => s.project_id === projectId);
    },
    enabled: !!projectId
  });

  // Fetch saved journeys
  const { data: journeys = [], isLoading: journeysLoading } = useQuery({
    queryKey: ['startupJourneys', projectId],
    queryFn: async () => {
      const all = await api.entities.StartupJourney.list('-created_date', 100);
      return all.filter(j => j.project_id === projectId);
    },
    enabled: !!projectId
  });

  // Show start decision when no steps and no journeys
  useEffect(() => {
    if (!isLoading && !journeysLoading && steps.length === 0 && journeys.length === 0) {
      setShowStartDecision(true);
    }
  }, [isLoading, journeysLoading, steps.length, journeys.length]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => api.entities.StartupStep.create(data),
    onSuccess: () => queryClient.invalidateQueries(['startupSteps', projectId])
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.StartupStep.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['startupSteps', projectId])
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.StartupStep.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['startupSteps', projectId])
  });

  // Journey mutations
  const saveJourneyMutation = useMutation({
    mutationFn: (data) => api.entities.StartupJourney.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['startupJourneys', projectId]);
      setShowSaveDialog(false);
      setJourneyName('');
      setJourneyDesc('');
    }
  });

  const deleteJourneyMutation = useMutation({
    mutationFn: (id) => api.entities.StartupJourney.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['startupJourneys', projectId])
  });

  // Handle reorder
  const handleReorder = async (sourceIndex, destIndex) => {
    const items = Array.from(steps);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destIndex, 0, reorderedItem);

    // Update order_index for all items
    for (let i = 0; i < items.length; i++) {
      if (items[i].order_index !== i) {
        await updateMutation.mutateAsync({ id: items[i].id, data: { order_index: i } });
      }
    }
  };

  // Add new block
  const handleAddBlock = (stepType, color) => {
    const blockType = BLOCK_TYPES.find(b => b.type === stepType);
    const orderIndex = insertAfterIndex !== null ? insertAfterIndex + 1 : steps.length;
    
    setEditingStep({
      step_type: stepType,
      title: blockType?.label || 'Neuer Schritt',
      color: color,
      project_id: projectId,
      order_index: orderIndex,
      status: 'planned'
    });
    setIsDialogOpen(true);
    setInsertAfterIndex(null);
  };

  // Add after specific index
  const handleAddAfter = (index) => {
    setInsertAfterIndex(index);
  };

  // Save step
  const handleSaveStep = async (stepData) => {
    if (stepData.id) {
      await updateMutation.mutateAsync({ id: stepData.id, data: stepData });
    } else {
      // If inserting after a specific index, shift other items
      if (insertAfterIndex !== null) {
        const stepsToUpdate = steps.filter(s => s.order_index > insertAfterIndex);
        for (const s of stepsToUpdate) {
          await updateMutation.mutateAsync({ id: s.id, data: { order_index: s.order_index + 1 } });
        }
      }
      await createMutation.mutateAsync(stepData);
    }
    setInsertAfterIndex(null);
  };

  // Delete step
  const handleDeleteStep = (stepId) => {
    deleteMutation.mutate(stepId);
  };

  // Update todo
  const handleUpdateTodo = async (stepId, todoId) => {
    const step = steps.find(s => s.id === stepId);
    if (!step || !step.todos) return;
    
    const updatedTodos = step.todos.map(t => 
      t.id === todoId ? { ...t, completed: !t.completed } : t
    );
    
    await updateMutation.mutateAsync({ id: stepId, data: { todos: updatedTodos } });
  };

  // Apply template
  const handleApplyTemplate = async (templateSteps, templateId) => {
    setCurrentTemplateId(templateId);
    for (let i = 0; i < templateSteps.length; i++) {
      await createMutation.mutateAsync({
        ...templateSteps[i],
        project_id: projectId,
        order_index: steps.length + i,
        status: 'planned'
      });
    }
  };

  // Save journey and archive (clear current steps)
  const handleSaveJourney = async (shouldArchive = false) => {
    const completedCount = steps.filter(s => s.status === 'completed').length;
    const progressValue = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

    await saveJourneyMutation.mutateAsync({
      project_id: projectId,
      name: journeyName,
      description: journeyDesc,
      template_used: currentTemplateId,
      steps_snapshot: steps,
      progress: progressValue,
      status: shouldArchive ? 'archived' : (progressValue === 100 ? 'completed' : 'active')
    });

    // If archiving, delete all current steps in parallel for instant clear
    if (shouldArchive) {
      await Promise.all(steps.map(step => deleteMutation.mutateAsync(step.id)));
      setCurrentTemplateId(null);
      setShowStartDecision(true);
    }
  };

  // Delete journey
  const handleDeleteJourney = (id) => {
    deleteJourneyMutation.mutate(id);
    if (viewingJourney?.id === id) setViewingJourney(null);
  };

  // Start new from decision
  const handleChooseTemplate = () => {
    setShowStartDecision(false);
    setIsTemplateOpen(true);
  };

  const handleChooseSelfBuild = () => {
    setShowStartDecision(false);
    setViewMode('builder');
  };

  // Calculate progress
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  if (isLoading || userLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Start Decision Dialog */}
      <StartDecisionDialog
        isOpen={showStartDecision}
        onChooseTemplate={handleChooseTemplate}
        onChooseSelfBuild={handleChooseSelfBuild}
        onClose={() => setShowStartDecision(false)}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {t('startupBuilderTitle')}
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Beta</span>
              </h1>
              <p className="text-slate-500">{t('documentYourJourney')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Toggle */}
            <div className="bg-slate-100 rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('builder')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'builder' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t('builder')}
              </button>
              <button
                onClick={() => setViewMode('journeys')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${viewMode === 'journeys' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <FolderOpen className="w-4 h-4" />
                {t('saved')} {journeys.length > 0 && `(${journeys.length})`}
              </button>
            </div>

            {viewMode === 'builder' && steps.length > 0 && (
              <Button 
                onClick={() => setShowSaveDialog(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-2"
              >
                <Save className="w-4 h-4" />
                {t('save')}
              </Button>
            )}

            {viewMode === 'builder' && (
              <Button 
                onClick={() => setIsTemplateOpen(true)}
                variant="outline"
                className="gap-2"
              >
                <BookOpen className="w-4 h-4" />
                {t('template')}
              </Button>
            )}

            {viewMode === 'journeys' && (
              <Button 
                onClick={() => { setViewMode('builder'); setShowStartDecision(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('newRoadmap')}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {viewMode === 'builder' && steps.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">{t('progress')}</span>
              <span className="text-sm font-bold text-indigo-600">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {completedCount} {t('stepsCompleted')} {steps.length}
            </p>
          </div>
        )}
      </div>

      {/* Journeys View */}
      {viewMode === 'journeys' && (
        <div className="space-y-6">
          {journeys.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
              <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('noSavedRoadmaps')}</h3>
              <p className="text-slate-500 mb-4">{t('createFirstRoadmap')}</p>
              <Button onClick={() => { setViewMode('builder'); setShowStartDecision(true); }} variant="outline">
                {t('createRoadmap')}
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {journeys.map((journey, index) => (
                  <JourneyCard
                    key={journey.id}
                    journey={journey}
                    index={index}
                    onView={setViewingJourney}
                    onDelete={(id) => {
                      if (window.confirm('Roadmap wirklich löschen?')) {
                        handleDeleteJourney(id);
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Builder View */}
      {viewMode === 'builder' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-2">
            {steps.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('startYourRoadmap')}</h3>
                <p className="text-slate-500 mb-4">{t('chooseBlockFromPalette')}</p>
                <Button onClick={() => setShowStartDecision(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('startNow')}
                </Button>
              </div>
            ) : (
              <RoadmapTimeline
                steps={steps}
                onEdit={(step) => { setEditingStep(step); setIsDialogOpen(true); }}
                onDelete={handleDeleteStep}
                onReorder={handleReorder}
                onAddAfter={handleAddAfter}
                onUpdateTodo={handleUpdateTodo}
              />
            )}
          </div>

          {/* Palette */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <BlockPalette onAddBlock={handleAddBlock} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <StepEditDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setEditingStep(null); setInsertAfterIndex(null); }}
        step={editingStep}
        onSave={handleSaveStep}
        onDelete={handleDeleteStep}
      />

      {/* Template Selector */}
      <TemplateSelector
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onSelectTemplate={(templateSteps, templateId) => handleApplyTemplate(templateSteps, templateId)}
      />

      {/* Save Journey Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-emerald-600" />
              {t('saveRoadmap')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('name')} *</label>
              <Input
                value={journeyName}
                onChange={(e) => setJourneyName(e.target.value)}
                placeholder={t('roadmapNamePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
              <Textarea
                value={journeyDesc}
                onChange={(e) => setJourneyDesc(e.target.value)}
                placeholder={t('shortDescription')}
                rows={3}
              />
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              <p><strong>{steps.length}</strong> {t('stepsWillBeSaved')}</p>
              <p><strong>{progress}%</strong> {t('progress')}</p>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                {t('cancel')}
              </Button>
              <Button 
                onClick={() => handleSaveJourney(false)} 
                disabled={!journeyName || saveJourneyMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {t('save')}
              </Button>
              <Button 
                onClick={() => handleSaveJourney(true)} 
                disabled={!journeyName || saveJourneyMutation.isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                <Archive className="w-4 h-4 mr-2" />
                {t('archive')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Journey Detail Dialog */}
      <JourneyDetailDialog
        journey={viewingJourney}
        isOpen={!!viewingJourney}
        onClose={() => setViewingJourney(null)}
        onDelete={handleDeleteJourney}
      />
    </div>
  );
}