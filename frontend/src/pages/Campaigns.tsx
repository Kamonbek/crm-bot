import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { campaignApi } from '../api/campaigns';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import ConfirmModal from '../components/ConfirmModal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function Campaigns() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignApi.list,
  });

  const remove = useMutation({
    mutationFn: campaignApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setDeleteId(null);
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Invite links"
        subtitle="Track where your students come from"
        action={
          <Link to="/campaigns/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> New Invite Link
          </Link>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Failed to load campaigns." />}

      {data && data.length === 0 && (
        <EmptyState title="No invite links yet" description="Create an invite link to generate deep-link URLs." />
      )}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2e24]">
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Keyword</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3 text-[#dff5ea] font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-[#4a7060] text-xs">{c.slug}</td>
                  <td className="px-4 py-3">
                    <Badge label={c.is_active ? 'Active' : 'Inactive'} variant={c.is_active ? 'green' : 'gray'} />
                  </td>
                  <td className="px-4 py-3 text-[#4a7060]">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/campaigns/${c.id}/edit`} className="p-1.5 rounded hover:bg-[#1a2e24] text-[#4a7060] hover:text-brand-400 transition-colors">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-red-900/20 text-[#4a7060] hover:text-red-400 transition-colors">
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
          title="Delete campaign?"
          message="This will permanently delete the campaign. This action cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
