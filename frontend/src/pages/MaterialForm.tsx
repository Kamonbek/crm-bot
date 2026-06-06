import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import type { MaterialKind, ParseMode } from '../types';
import { useMaterialForm } from '../hooks/useMaterialForm';

const KINDS: MaterialKind[] = ['text', 'photo', 'video', 'document', 'link'];
const PARSE_MODES: ParseMode[] = ['HTML', 'MarkdownV2', 'none'];

export default function MaterialForm() {
  const {
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
    isPending,
    handleSubmit,
    handleCancel,
  } = useMaterialForm();

  if (isEdit && isLoading) return <div className="p-6"><LoadingState /></div>;

  return (
    <div className="p-6 max-w-xl">
      <PageHeader title={isEdit ? 'Edit Material' : 'New Material'} />

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Kind</label>
          <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Body (text content)</label>
          <textarea className="input-field font-mono text-sm" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message text…" />
        </div>
        {kind !== 'text' && (
          <>
            <div>
              <label className="label">Telegram File ID</label>
              <input className="input-field font-mono text-sm" value={fileId} onChange={(e) => setFileId(e.target.value)} placeholder="AgACAgIAAxkB…" />
            </div>
            <div>
              <label className="label">File URL</label>
              <input className="input-field" type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" />
            </div>
          </>
        )}
        <div>
          <label className="label">Link URL (optional)</label>
          <input className="input-field" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Parse Mode</label>
          <select className="input-field" value={parseMode} onChange={(e) => setParseMode(e.target.value as ParseMode)}>
            {PARSE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="disable_preview"
            checked={disablePreview}
            onChange={(e) => setDisablePreview(e.target.checked)}
            className="accent-brand-500"
          />
          <label htmlFor="disable_preview" className="text-sm text-[#8aab96]">Disable web page preview</label>
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
