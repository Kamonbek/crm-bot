import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialApi } from '../api/materials';
import type { MaterialKind, ParseMode } from '../types';

export function useMaterialForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [kind, setKind] = useState<MaterialKind>('text');
  const [body, setBody] = useState('');
  const [fileId, setFileId] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [parseMode, setParseMode] = useState<ParseMode>('HTML');
  const [disablePreview, setDisablePreview] = useState(false);
  const [error, setError] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['material', id],
    queryFn: () => materialApi.get(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setKind(existing.kind);
      setBody(existing.body ?? '');
      setFileId(existing.file_id ?? '');
      setFileUrl(existing.file_url ?? '');
      setLinkUrl(existing.link_url ?? '');
      setParseMode(existing.parse_mode ?? 'HTML');
      setDisablePreview(existing.disable_web_page_preview ?? false);
    }
  }, [existing]);

  const create = useMutation({
    mutationFn: materialApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      navigate('/materials');
    },
    onError: () => setError('Failed to create material.'),
  });

  const update = useMutation({
    mutationFn: (data: Parameters<typeof materialApi.update>[1]) => materialApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      navigate('/materials');
    },
    onError: () => setError('Failed to update material.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      kind,
      body: body || null,
      file_id: fileId || null,
      file_url: fileUrl || null,
      link_url: linkUrl || null,
      parse_mode: parseMode,
      disable_web_page_preview: disablePreview,
    };
    if (isEdit) {
      update.mutate(payload);
    } else {
      create.mutate(payload);
    }
  }

  function handleCancel() {
    navigate('/materials');
  }

  return {
    isEdit,
    isLoading,
    name,
    setName,
    kind,
    setKind,
    body,
    setBody,
    fileId,
    setFileId,
    fileUrl,
    setFileUrl,
    linkUrl,
    setLinkUrl,
    parseMode,
    setParseMode,
    disablePreview,
    setDisablePreview,
    error,
    isPending: create.isPending || update.isPending,
    handleSubmit,
    handleCancel,
  };
}
