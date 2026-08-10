import { formatInr } from './DocumentEditor';
import './DocumentEditor.css';

export type ReceiveSourceLine = {
  id: string;
  productLabel: string;
  orderedQty: number;
  receivedQty: number;
  rate: number;
};

export type ReceiveGridProps = {
  lines: ReceiveSourceLine[];
  onChange: (lines: ReceiveSourceLine[]) => void;
  disabled?: boolean;
  orderedLabel?: string;
  receivedLabel?: string;
};

export function ReceiveGrid({
  lines,
  onChange,
  disabled,
  orderedLabel = 'Ordered',
  receivedLabel = 'Received',
}: ReceiveGridProps) {
  function updateQty(index: number, receivedQty: number) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, receivedQty } : line)),
    );
  }

  return (
    <div className="de-grid-wrap">
      <table className="de-grid">
        <thead>
          <tr>
            <th>Product</th>
            <th>{orderedLabel}</th>
            <th>{receivedLabel}</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="de-readonly">
                No source lines
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={line.id}>
                <td>{line.productLabel}</td>
                <td className="de-num de-readonly">{line.orderedQty}</td>
                <td>
                  <input
                    className="de-cell-input"
                    type="number"
                    min={0}
                    step="any"
                    value={line.receivedQty}
                    disabled={disabled}
                    onChange={(e) =>
                      updateQty(
                        index,
                        e.target.value === '' ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </td>
                <td className="de-num de-readonly">{formatInr(line.rate)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
