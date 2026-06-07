import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { materialApi } from '../api/materials';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { MaterialKind } from '../types';

const kindVariant: Record<MaterialKind, 'blue' | 'green' | 'yellow' | 'gray'> = {
  text: 'gray',
  photo: 'blue',
  video: 'yellow',
  document: 'green',
  link: 'blue',
};

const kindLabel: Record<MaterialKind, string> = {
  text: 'Text',
  photo: 'Photo',
  video: 'Video',
  document: 'File',
  link: 'Link',
};

export default function Materials() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['materials'],
    queryFn: materialApi.list,
  });

  const remove = useMutation({
    mutationFn: materialApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materials'] }); setDeleteId(null); },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Messages"
        subtitle="Your message library"
        action={
          <Link to="/materials/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> New Message
          </Link>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Failed to load materials." />}

      {data && data.length === 0 && (
        <EmptyState title="No messages yet" description="Create messages to send in auto-flows and broadcasts." />
      )}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2e24]">
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Type</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Preview</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className="table-row">
                  <td className="px-4 py-3 text-[#dff5ea] font-medium">{m.name}</td>
                  <td className="px-4 py-3">
                    <Badge label={kindLabel[m.kind] ?? m.kind} variant={kindVariant[m.kind] ?? 'gray'} />
                  </td>
                  <td className="px-4 py-3 text-[#4a7060] max-w-xs truncate">
                    {m.body?.slice(0, 60) ?? (m.file_id ? 'File attached' : '—')}
                  </td>
                  <td className="px-4 py-3 text-[#4a7060]">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/materials/${m.id}/edit`} className="p-1.5 rounded hover:bg-[#1a2e24] text-[#4a7060] hover:text-brand-400 transition-colors">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => setDeleteId(m.id)} className="p-1.5 rounded hover:bg-red-900/20 text-[#4a7060] hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          title="Delete message?"
          message="This will permanently delete the message."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
