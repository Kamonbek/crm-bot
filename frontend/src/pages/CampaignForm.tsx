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
    handleSlugChange,
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
      <PageHeader title={isEdit ? 'Edit Invite Link' : 'New Invite Link'} />

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">Link name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Link keyword</label>
          <input className="input-field font-mono" value={slug} onChange={(e) => handleSlugChange(e.target.value)} required placeholder="my-campaign" />
          {slug && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-[#0a1510] rounded-lg border border-[#1a2e24]">
              <span className="text-xs text-brand-400 font-mono flex-1 truncate">t.me/YourBot?start={slug}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(`https://t.me/YourBot?start=${slug}`)}
                className="text-xs text-[#4a7060] hover:text-brand-400 shrink-0 px-2 py-1 rounded hover:bg-brand-500/10">
                Copy
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Auto-flow on join</label>
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
          <p className="text-xs text-[#4a7060] mt-1">The messages your bot sends automatically when someone joins via this link.</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-brand-500' : 'bg-[#1a2e24]'}`}
            onClick={() => setIsActive(!isActive)}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm text-[#8aab96]">Active</span>
        </label>

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
