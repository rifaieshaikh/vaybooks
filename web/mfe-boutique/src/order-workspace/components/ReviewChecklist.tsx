import type { Blocker } from '../validation';
import type { WorkspaceStep } from '../types';

type Props = {
  blockers: Blocker[];
  hints: string[];
  onJump?: (step: WorkspaceStep) => void;
};

export function ReviewChecklist({ blockers, hints, onJump }: Props) {
  return (
    <div className="ow-review-list">
      {blockers.length === 0 ? (
        <div className="ow-review-item" style={{ borderColor: '#b7e0c8', background: '#e7f6ee' }}>
          <span>Ready to confirm</span>
          <strong style={{ color: 'var(--ow-ok)' }}>All hard checks passed</strong>
        </div>
      ) : (
        blockers.map((b) => (
          <div key={`${b.step}:${b.message}`} className="ow-review-item">
            <span>{b.message}</span>
            {onJump ? (
              <button
                type="button"
                className="ow-chip"
                style={{ cursor: 'pointer' }}
                onClick={() => onJump(b.step)}
              >
                Fix
              </button>
            ) : null}
          </div>
        ))
      )}
      {hints.map((h) => (
        <div key={h} className="ow-review-item" style={{ opacity: 0.85 }}>
          <span>{h}</span>
          <span className="ow-chip">Hint</span>
        </div>
      ))}
    </div>
  );
}
