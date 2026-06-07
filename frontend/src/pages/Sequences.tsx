import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { sequenceApi } from '../api/sequences';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Sequences() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sequences'],
    queryFn: sequenceApi.list,
  });

  const remove = useMutation({
    mutationFn: (id: string) => sequenceApi.update(id, { is_active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); setDeleteId(null); },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Auto-flows"
        subtitle="Automated message drip auto-flows"
        action={
          <Link to="/sequences/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> New Auto-flow
          </Link>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Failed to load sequences." />}

      {data && data.length === 0 && (
        <EmptyState title="No auto-flows yet" description="Create an auto-flow to automate follow-up messages." />
      )}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2e24]">
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Trigger</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="px-4 py-3 text-[#dff5ea] font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge label={s.trigger_kind ?? 'manual'} variant="blue" />
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={s.is_active ? 'Active' : 'Inactive'} variant={s.is_active ? 'green' : 'gray'} />
                  </td>
                  <td className="px-4 py-3 text-[#4a7060]">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/sequences/${s.id}/edit`} className="p-1.5 rounded hover:bg-[#1a2e24] text-[#4a7060] hover:text-brand-400 transition-colors">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded hover:bg-red-900/20 text-[#4a7060] hover:text-red-400 transition-colors">
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
          title="Deactivate sequence?"
          message="This will deactivate the sequence. Existing scheduled messages will still be sent."
          confirmLabel="Deactivate"
          danger
          onConfirm={() => remove.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
