import { useEffect, useState } from 'react';
import { useAppSelector } from '@vaybooks/store';

type Props = {
  attachmentId: string;
  alt: string;
  className?: string;
};

/** Loads boutique attachment bytes with Bearer auth (bare img src cannot send headers). */
export function AuthenticatedAttachmentImg({ attachmentId, alt, className }: Props) {
  const token = useAppSelector((s) => s.session.accessToken);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setSrc('');
    setFailed(false);

    (async () => {
      try {
        const res = await fetch(`/api/boutique/attachments/${attachmentId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          if (!cancelled) setFailed(true);
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, token]);

  if (failed) {
    return (
      <div
        className={className}
        style={{
          display: 'grid',
          placeItems: 'center',
          background: 'var(--ow-surface-2, #f0f2f4)',
          color: 'var(--ow-muted)',
          fontSize: 11,
          minHeight: 64,
        }}
      >
        Unavailable
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={className}
        style={{
          background: 'var(--ow-surface-2, #f0f2f4)',
          minHeight: 64,
        }}
        aria-hidden
      />
    );
  }

  return <img className={className} src={src} alt={alt} />;
}
