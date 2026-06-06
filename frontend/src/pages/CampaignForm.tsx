import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import { useCampaignForm } from '../hooks/useCampaignForm';

export default function CampaignForm() {
  const {
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
    isPending,
    handleSubmit,
    handleCancel,
  } = useCampaignForm();

  if (isEdit && isLoading) return <div className="p-6"><LoadingState /></div>;

  return (
    <div className="p-6 max-w-xl">
      <PageHeader title={isEdit ? 'Edit Campaign' : 'New Campaign'} />

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Slug</label>
          <input className="input-field font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="my-campaign" />
          <p className="text-xs text-[#4a7060] mt-1">Used in Telegram deep-link: ?start=slug</p>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Default Sequence (optional)</label>
          <select
            className="input-field"
            value={defaultSequenceId}
            onChange={(e) => setDefaultSequenceId(e.target.value)}
          >
            <option value="">None</option>
            {sequences?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-brand-500"
          />
          <label htmlFor="is_active" className="text-sm text-[#8aab96]">Active</label>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
