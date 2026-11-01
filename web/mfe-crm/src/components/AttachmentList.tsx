import { useMemo, useState } from 'react';
import {
  useAppSelector,
  useDeleteCrmAttachmentMutation,
  useGetCrmAttachmentMetaQuery,
  useUploadCrmAttachmentMutation,
} from '@vaybooks/store';
import { Button, ErrorText } from '@vaybooks/ui-kit';
import { extractError } from '../utils';

export type CrmAttachmentEntityType = 'lead' | 'enquiry' | 'activity';

type Props = {
  entityType: CrmAttachmentEntityType;
  entityId: string;
  attachmentIds: string[];
  /** Called after upload/delete so the parent can refetch the entity. */
  onChanged?: () => void;
  readOnly?: boolean;
};

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadWithAuth(attachmentId: string, token: string | null) {
  const res = await fetch(`/api/crm/attachments/${attachmentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `attachment-${attachmentId}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AttachmentRow({
  id,
  busyId,
  readOnly,
  removeLoading,
  onDownload,
  onDelete,
}: {
  id: string;
  busyId: string;
  readOnly?: boolean;
  removeLoading: boolean;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { data: meta, isLoading } = useGetCrmAttachmentMetaQuery(id);
  const name = meta?.name || (isLoading ? 'Loading…' : shortId(id));
  const typeLabel = meta?.content_type || '';
  const sizeLabel = formatSize(meta?.size_bytes);

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 10px',
        border: '1px solid var(--vb-color-border, #e5e7eb)',
        borderRadius: 6,
      }}
    >
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span
          title={meta?.name || id}
          style={{
            fontWeight: 550,
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span className="el-muted" style={{ fontSize: '0.8rem' }}>
          {[typeLabel, sizeLabel].filter(Boolean).join(' · ') || shortId(id)}
        </span>
      </span>
      <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Button
          type="button"
          variant="ghost"
          disabled={busyId === id}
          onClick={() => void onDownload(id)}
        >
          Download
        </Button>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busyId === id || removeLoading}
            onClick={() => void onDelete(id)}
          >
            Delete
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/** Lists CRM attachment ids with upload / download / delete. */
export function AttachmentList({
  entityType,
  entityId,
  attachmentIds,
  onChanged,
  readOnly,
}: Props) {
  const token = useAppSelector((s) => s.session.accessToken);
  const [upload, uploadState] = useUploadCrmAttachmentMutation();
  const [remove, removeState] = useDeleteCrmAttachmentMutation();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const ids = useMemo(
    () => (Array.isArray(attachmentIds) ? attachmentIds.map(String).filter(Boolean) : []),
    [attachmentIds],
  );

  async function onUpload(file: File | null) {
    if (!file || !entityId) return;
    setError('');
    try {
      await upload({ entity_type: entityType, entity_id: entityId, file }).unwrap();
      onChanged?.();
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function onDownload(id: string) {
    setError('');
    setBusyId(id);
    try {
      await downloadWithAuth(id, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : extractError(e));
    } finally {
      setBusyId('');
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this attachment?')) return;
    setError('');
    setBusyId(id);
    try {
      await remove(id).unwrap();
      onChanged?.();
    } catch (e) {
      setError(extractError(e));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {!readOnly ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            disabled={!entityId || uploadState.isLoading}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              void onUpload(file);
              e.target.value = '';
            }}
          />
          {uploadState.isLoading ? <span className="el-muted">Uploading…</span> : null}
        </div>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {ids.length === 0 ? (
        <p className="el-muted" style={{ margin: 0 }}>
          No files attached.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {ids.map((id) => (
            <AttachmentRow
              key={id}
              id={id}
              busyId={busyId}
              readOnly={readOnly}
              removeLoading={removeState.isLoading}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
