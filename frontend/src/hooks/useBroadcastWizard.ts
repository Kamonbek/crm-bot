import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastApi } from '../api/broadcasts';
import { materialApi } from '../api/materials';
import { sequenceApi } from '../api/sequences';

export type Step = 'compose' | 'preview' | 'send';

export function useBroadcastWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('compose');
  const [name, setName] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: materials } = useQuery({ queryKey: ['materials'], queryFn: materialApi.list });
  const { data: sequences } = useQuery({ queryKey: ['sequences'], queryFn: sequenceApi.list });

  const preview = useMutation({
    mutationFn: () => broadcastApi.preview(segmentId || null),
    onSuccess: (data) => {
      setPreviewCount(data.recipient_count);
      setStep('preview');
    },
    onError: () => setError('Failed to get preview.'),
  });

  const create = useMutation({
    mutationFn: () =>
      broadcastApi.create({
        name,
        material_id: materialId,
        segment_id: segmentId || null,
        scheduled_at: scheduledAt || null,
      }),
    onSuccess: (data) => {
      setBroadcastId(data.id);
      setStep('send');
    },
    onError: () => setError('Failed to create broadcast.'),
  });

  const send = useMutation({
    mutationFn: () => broadcastApi.send(broadcastId!, scheduledAt || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcasts'] });
      navigate('/broadcasts');
    },
    onError: () => setError('Failed to send broadcast.'),
  });

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name || !materialId) {
      setError('Name and material are required.');
      return;
    }
    preview.mutate();
  }

  function handleCreate() {
    create.mutate();
  }

  function handleSend() {
    send.mutate();
  }

  function handleBack() {
    setStep('compose');
  }

  function handleCancel() {
    navigate('/broadcasts');
  }

  return {
    step,
    name,
    setName,
    materialId,
    setMaterialId,
    segmentId,
    setSegmentId,
    scheduledAt,
    setScheduledAt,
    previewCount,
    error,
    materials,
    sequences,
    isPreviewPending: preview.isPending,
    isCreatePending: create.isPending,
    isSendPending: send.isPending,
    handlePreview,
    handleCreate,
    handleSend,
    handleBack,
    handleCancel,
  };
}
