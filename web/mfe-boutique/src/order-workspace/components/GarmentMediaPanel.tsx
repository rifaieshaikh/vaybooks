import { useEffect, useMemo, useState } from 'react';
import {
  useDeleteBoutiqueAttachmentMutation,
  useListBoutiqueItemAttachmentsQuery,
  useUploadBoutiqueItemAttachmentMutation,
} from '@vaybooks/store';
import { Button, ErrorText, FormRow } from '@vaybooks/ui-kit';
import { asCaption, extractError } from '../../utils';
import { AuthenticatedAttachmentImg } from './AuthenticatedAttachmentImg';

const CATEGORIES = [
  { id: 'reference', label: 'Reference' },
  { id: 'design', label: 'Design' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'file_out', label: 'File out' },
] as const;

type Props = {
  orderId: string;
  itemId: string;
  readOnly?: boolean;
  onCountChange?: (count: number) => void;
};

export function GarmentMediaPanel({ orderId, itemId, readOnly, onCountChange }: Props) {
  const [category, setCategory] = useState<string>('reference');
  const [error, setError] = useState('');
  const { data: attachments = [], refetch } = useListBoutiqueItemAttachmentsQuery(
    { orderId, itemId },
    { skip: !orderId || !itemId },
  );
  const [upload, uploadState] = useUploadBoutiqueItemAttachmentMutation();
  const [remove] = useDeleteBoutiqueAttachmentMutation();

  useEffect(() => {
    onCountChange?.(attachments.length);
  }, [attachments.length, onCountChange]);

  const byCategory = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    for (const c of CATEGORIES) map[c.id] = [];
    for (const a of attachments) {
      const cat = String(a.category || 'reference');
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    }
    return map;
  }, [attachments]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setError('');
    try {
      await upload({ orderId, itemId, file, category }).unwrap();
      refetch();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this attachment?')) return;
    setError('');
    try {
      await remove(id).unwrap();
      refetch();
    } catch (e) {
      setError(extractError(e));
    }
  }

  const totalCount = attachments.length;

  return (
    <div className="ow-grid">
      <strong>Reference media</strong>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!readOnly ? (
        <div className="ow-grid two">
          <FormRow label="Category">
            <select
              className="vb-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Upload">
            <input
              type="file"
              className="vb-control"
              disabled={uploadState.isLoading}
              onChange={(e) => {
                void onUpload(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </FormRow>
        </div>
      ) : null}

      {totalCount === 0 && readOnly ? (
        <div className="ow-empty" style={{ padding: '0.75rem' }}>
          No reference media for this garment.
        </div>
      ) : null}

      {CATEGORIES.map((c) => {
        const rows = byCategory[c.id] || [];
        if (!rows.length && readOnly) return null;
        return (
          <div key={c.id}>
            <div style={{ fontSize: 13, color: 'var(--ow-muted)', marginBottom: 6 }}>
              {c.label} ({rows.length})
            </div>
            {rows.length === 0 ? (
              <div className="ow-empty" style={{ padding: '0.75rem' }}>
                None yet — upload a {c.label.toLowerCase()} image.
              </div>
            ) : (
              <div className="ow-media-grid">
                {rows.map((a) => {
                  const id = String(a.id);
                  return (
                    <div key={id} className="ow-media-thumb" title={asCaption(a.filename || a.name)}>
                      <AuthenticatedAttachmentImg
                        attachmentId={id}
                        alt={asCaption(a.filename || c.label)}
                      />
                      {!readOnly ? (
                        <Button
                          type="button"
                          variant="ghost"
                          style={{
                            position: 'absolute',
                            right: 2,
                            bottom: 2,
                            padding: '0.15rem 0.4rem',
                            fontSize: 11,
                            background: 'rgba(255,255,255,0.9)',
                          }}
                          onClick={() => void onDelete(id)}
                        >
                          ×
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
