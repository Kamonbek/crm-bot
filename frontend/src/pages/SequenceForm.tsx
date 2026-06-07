import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ConfirmModal from '../components/ConfirmModal';
import type { TriggerKind } from '../types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useSequenceForm } from '../hooks/useSequenceForm';

const TRIGGER_KINDS: TriggerKind[] = ['campaign_join', 'manual', 'tag_added'];

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  campaign_join: 'Someone joins via invite link',
  manual: 'Triggered manually',
  tag_added: 'Tag is added',
};

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Sends immediately';
  if (minutes < 60) return `Sends after ${minutes} min`;
  if (minutes < 1440) return `Sends after ${minutes / 60} hour${minutes / 60 === 1 ? '' : 's'}`;
  const days = minutes / 1440;
  return `Sends after ${days} day${days === 1 ? '' : 's'}`;
}

export default function SequenceForm() {
  const {
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
    isPending,
    isAddStepPending,
    handleSubmit,
    handleAddStep,
    handleDeleteStep,
    handleCancel,
  } = useSequenceForm();

  if (isEdit && isLoading) return <div className="p-6"><LoadingState /></div>;

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title={isEdit ? 'Edit Auto-flow' : 'New Auto-flow'} />

      <form onSubmit={handleSubmit} className="card p-6 space-y-4 mb-6">
        <div>
          <label className="label">Name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Start this flow when…</label>
          <select className="input-field" value={triggerKind} onChange={(e) => setTriggerKind(e.target.value as TriggerKind)}>
            {TRIGGER_KINDS.map((k) => <option key={k} value={k}>{TRIGGER_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="seq_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-brand-500"
          />
          <label htmlFor="seq_active" className="text-sm text-[#8aab96]">Active</label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create & add steps'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>

      {isEdit && (
        <div>
          <h2 className="text-base font-semibold text-[#dff5ea] mb-3">Message steps</h2>

          {stepsLoading && <LoadingState />}

          {steps && steps.length === 0 && (
            <p className="text-[#4a7060] text-sm mb-4">No steps yet. Add the first step below.</p>
          )}

          {steps && steps.length > 0 && (
            <div className="card overflow-hidden mb-4">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#1a2e24] last:border-0">
                  <GripVertical size={14} className="text-[#2a4030] shrink-0" />
                  <span className="w-5 text-center text-xs font-mono text-[#4a7060]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#dff5ea] truncate">
                      {materials?.find((m) => m.id === step.material_id)?.name ?? step.material_id}
                    </p>
                    <p className="text-xs text-[#4a7060]">
                      {formatDelay(step.delay_minutes)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteStepId(step.id)}
                    className="p-1.5 rounded hover:bg-red-900/20 text-[#4a7060] hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[#4a7060] mb-3">Messages are sent in order, with the delays you set.</p>

          <div className="card p-4">
            <p className="text-xs font-medium text-[#4a7060] uppercase tracking-wider mb-3">Add a message step</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Material</label>
                <select
                  className="input-field"
                  value={newStepMaterialId}
                  onChange={(e) => setNewStepMaterialId(e.target.value)}
                >
                  <option value="">Select material…</option>
                  {materials?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="w-36">
                <label className="label">Delay (min)</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={newStepDelay}
                  onChange={(e) => setNewStepDelay(Number(e.target.value))}
                />
              </div>
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5 text-sm shrink-0"
                disabled={!newStepMaterialId || isAddStepPending}
                onClick={handleAddStep}
              >
                <Plus size={14} /> Add step
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteStepId && (
        <ConfirmModal
          title="Remove step?"
          message="This will remove the step from the sequence."
          confirmLabel="Remove"
          danger
          onConfirm={() => handleDeleteStep(deleteStepId)}
          onCancel={() => setDeleteStepId(null)}
        />
      )}
    </div>
  );
}
