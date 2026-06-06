import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignApi } from '../api/campaigns';
import { sequenceApi } from '../api/sequences';

export function useCampaignForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [defaultSequenceId, setDefaultSequenceId] = useState('');
  const [error, setError] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignApi.get(id!),
    enabled: isEdit,
  });

  const { data: sequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: sequenceApi.list,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSlug(existing.slug);
      setDescription(existing.description ?? '');
      setIsActive(existing.is_active);
      setDefaultSequenceId(existing.default_sequence_id ?? '');
    }
  }, [existing]);

  const create = useMutation({
    mutationFn: campaignApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
    onError: () => setError('Failed to create campaign.'),
  });

  const update = useMutation({
    mutationFn: ({ data }: { data: Parameters<typeof campaignApi.update>[1] }) =>
      campaignApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
    onError: () => setError('Failed to update campaign.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      slug,
      description: description || null,
      is_active: isActive,
      default_sequence_id: defaultSequenceId || null,
    };
    if (isEdit) {
      update.mutate({ data: payload });
    } else {
      create.mutate(payload);
    }
  }

  function handleCancel() {
    navigate('/campaigns');
  }

  return {
    isEdit,
    isLoading,
    name,
    setName,
    slug,
    setSlug,
    description,
    setDescription,
    isActive,
    setIsActive,
    defaultSequenceId,
    setDefaultSequenceId,
    error,
    sequences,
    isPending: create.isPending || update.isPending,
    handleSubmit,
    handleCancel,
  };
}
