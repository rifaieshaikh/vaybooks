import { WORKSPACE_STEPS, type WorkspaceStep } from '../types';

type DraftDone = Partial<Record<WorkspaceStep, boolean>>;

type Props = {
  step: WorkspaceStep;
  orderId: string;
  draftDone: DraftDone;
  onChange: (step: WorkspaceStep) => void;
  opsUnlocked: boolean;
};

export function WorkspaceStepper({ step, orderId, draftDone, onChange, opsUnlocked }: Props) {
  return (
    <nav className="ow-stepper" aria-label="Order workspace steps">
      {WORKSPACE_STEPS.map((s, i) => {
        const isOps = s.id === 'ops';
        const locked = isOps ? !opsUnlocked : !orderId && s.id !== 'customer';
        const isCurrent = step === s.id;
        const isDone = Boolean(draftDone[s.id]) && !isCurrent;
        return (
          <button
            key={s.id}
            type="button"
            className={`ow-step${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
            disabled={locked}
            onClick={() => onChange(s.id)}
          >
            <span className="ow-step-num">{s.short}</span>
            <span className="ow-step-label">
              {i + 1}. {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
