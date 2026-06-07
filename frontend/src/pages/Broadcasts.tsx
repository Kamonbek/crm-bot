import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { broadcastApi } from '../api/broadcasts';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import { Plus } from 'lucide-react';
import type { Broadcast } from '../types';

const statusVariant: Record<Broadcast['status'], 'gray' | 'yellow' | 'green' | 'red' | 'blue'> = {
  draft: 'gray',
  scheduled: 'yellow',
  sending: 'blue',
  sent: 'green',
  cancelled: 'gray',
  failed: 'red',
};

export default function Broadcasts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: broadcastApi.list,
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Send message"
        subtitle="Send a message to all your students or a specific group"
        action={
          <Link to="/broadcasts/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Send to everyone
          </Link>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Failed to load broadcasts." />}

      {data && data.length === 0 && (
        <EmptyState title="No broadcasts yet" description="Create a broadcast to send a message to your users." />
      )}

      {data && data.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a2e24]">
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Recipients</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Scheduled</th>
                <th className="text-left px-4 py-3 text-[#4a7060] font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className="table-row">
                  <td className="px-4 py-3 text-[#dff5ea] font-medium">{b.name}</td>
                  <td className="px-4 py-3">
                    <Badge label={b.status} variant={statusVariant[b.status]} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[#4a7060]">
                    {b.success_count}/{b.recipient_count}
                  </td>
                  <td className="px-4 py-3 text-[#4a7060]">
                    {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#4a7060]">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
