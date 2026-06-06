import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sequenceApi } from '../api/sequences';
import { materialApi } from '../api/materials';
import type { TriggerKind } from '../types';

export function useSequenceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('campaign_join');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const [newStepMaterialId, setNewStepMaterialId] = useState('');
  const [newStepDelay, setNewStepDelay] = useState(0);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['sequence', id],
    queryFn: () => sequenceApi.get(id!),
    enabled: isEdit,
  });

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ['sequence-steps', id],
    queryFn: () => sequenceApi.listSteps(id!),
    enabled: isEdit,
  });

  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: materialApi.list,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      setTriggerKind(existing.trigger_kind ?? 'campaign_join');
      setIsActive(existing.is_active);
    }
  }, [existing]);

  const create = useMutation({
    mutationFn: sequenceApi.create,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
      navigate(`/sequences/${data.id}/edit`);
    },
    onError: () => setError('Failed to create sequence.'),
  });

  const update = useMutation({
    mutationFn: (data: Parameters<typeof sequenceApi.update>[1]) => sequenceApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
      navigate('/sequences');
    },
    onError: () => setError('Failed to update sequence.'),
  });

  const addStep = useMutation({
    mutationFn: () =>
      sequenceApi.addStep(id!, {
        position: (steps?.length ?? 0) + 1,
        delay_minutes: newStepDelay,
        material_id: newStepMaterialId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequence-steps', id] });
      setNewStepMaterialId('');
      setNewStepDelay(0);
    },
  });

  const deleteStep = useMutation({
    mutationFn: (stepId: string) => sequenceApi.deleteStep(stepId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequence-steps', id] });
      setDeleteStepId(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      description: description || null,
      trigger_kind: triggerKind,
      is_active: isActive,
    };
    if (isEdit) {
      update.mutate(payload);
    } else {
      create.mutate(payload);
    }
  }

  function handleAddStep() {
    addStep.mutate();
  }

  function handleDeleteStep(stepId: string) {
    deleteStep.mutate(stepId);
  }

  function handleCancel() {
    navigate('/sequences');
  }

  return {
    isEdit,
    isLoading,
    stepsLoading,
    name,
    setName,
    description,
    setDescription,
    triggerKind,
    setTriggerKind,
    isActive,
    setIsActive,
    error,
    steps,
    newStepMaterialId,
    setNewStepMaterialId,
    newStepDelay,
    setNewStepDelay,
    deleteStepId,
    setDeleteStepId,
    materials,
    isPending: create.isPending || update.isPending,
    isAddStepPending: addStep.isPending,
    handleSubmit,
    handleAddStep,
    handleDeleteStep,
    handleCancel,
  };
}
