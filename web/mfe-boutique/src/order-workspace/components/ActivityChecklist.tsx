import { ErrorText, TextInput } from '@vaybooks/ui-kit';

type Props = {
  activities: Record<string, unknown>[];
  value: Record<string, boolean>;
  hours: Record<string, number>;
  onChange: (next: Record<string, boolean>) => void;
  onHoursChange: (next: Record<string, number>) => void;
  disabled?: boolean;
};

function isInHouse(act: Record<string, unknown>): boolean {
  if (typeof act.is_in_house === 'boolean') return act.is_in_house;
  const category = String(act.activity_category || '').toLowerCase();
  return category.includes('in_house') || category.includes('in-house');
}

function kindLabel(act: Record<string, unknown>): string {
  if (isInHouse(act)) {
    return act.requires_time_tracking ? 'In-house · timed' : 'In-house';
  }
  return 'Outsourced';
}

export function ActivityChecklist({
  activities,
  value,
  hours,
  onChange,
  onHoursChange,
  disabled,
}: Props) {
  if (!activities.length) {
    return (
      <ErrorText>
        No boutique activities configured. Add customization activities in Settings first.
      </ErrorText>
    );
  }

  const selectedInHouse = activities.filter((act) => {
    const name = String(act.activity_name || act.name || '');
    return name && value[name] && isInHouse(act);
  });
  const totalHours = selectedInHouse.reduce((sum, act) => {
    const name = String(act.activity_name || act.name || '');
    return sum + (Number(hours[name]) || 0);
  }, 0);

  return (
    <div className="ow-act-picker">
      <div className="ow-act-picker-hint">
        Choose the work this garment needs. In-house rows ask for estimated hours so the floor
        can plan capacity.
      </div>
      <div className="ow-act-list" role="group" aria-label="Required activities">
        {activities.map((act) => {
          const name = String(act.activity_name || act.name || '');
          if (!name) return null;
          const checked = Boolean(value[name]);
          const inHouse = isInHouse(act);
          const id = `ow-act-${String(act.id || name).replace(/\s+/g, '-')}`;
          return (
            <div
              key={String(act.id || name)}
              className={`ow-act-row${checked ? ' is-on' : ''}${inHouse ? ' is-inhouse' : ''}`}
            >
              <label className="ow-act-toggle" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    onChange({ ...value, [name]: nextChecked });
                    if (!nextChecked && name in hours) {
                      const nextHours = { ...hours };
                      delete nextHours[name];
                      onHoursChange(nextHours);
                    }
                  }}
                />
                <span className="ow-act-copy">
                  <span className="ow-act-name">{name}</span>
                  <span className="ow-act-kind">{kindLabel(act)}</span>
                </span>
              </label>

              {checked && inHouse ? (
                <div className="ow-act-hours">
                  <label htmlFor={`${id}-hrs`}>Est. hours</label>
                  <div className="ow-act-hours-field">
                    <TextInput
                      id={`${id}-hrs`}
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0"
                      placeholder="0"
                      disabled={disabled}
                      value={Number.isFinite(hours[name]) ? String(hours[name]) : ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          onHoursChange({ ...hours, [name]: 0 });
                          return;
                        }
                        const n = Number(raw);
                        onHoursChange({
                          ...hours,
                          [name]: Number.isFinite(n) ? Math.max(0, n) : 0,
                        });
                      }}
                      aria-label={`Estimated hours for ${name}`}
                    />
                    <span className="ow-act-hours-unit" aria-hidden>
                      hrs
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {selectedInHouse.length > 0 ? (
        <div className="ow-act-footer">
          <span>
            {selectedInHouse.length} in-house · {totalHours.toFixed(2).replace(/\.00$/, '')} hrs
            planned
          </span>
        </div>
      ) : null}
    </div>
  );
}
