import { useId, useState, type ReactNode } from 'react';

export interface ChartTable {
  headers: string[];
  rows: Array<Array<string | number>>;
}

interface Props {
  title: string;
  desc: string;
  width: number;
  height: number;
  table: ChartTable;
  children: ReactNode;
}

/**
 * A chart with a text title, a description, an SVG with role="img" and a data table behind a toggle.
 * Colors come from theme tokens (CSS variables), so light and dark both work.
 */
export function ChartFigure({ title, desc, width, height, table, children }: Props) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  const titleId = `${id}-t`;
  const descId = `${id}-d`;
  const tableId = `${id}-table`;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-col gap-1">
        <span className="text-lg font-semibold text-text">{title}</span>
        <span className="text-sm text-text-muted">{desc}</span>
      </figcaption>
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-w-xl text-[13px]"
        style={{ fontFamily: 'inherit' }}
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{desc}</desc>
        {children}
      </svg>
      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
        className="min-h-12 w-fit rounded-xl px-3 text-left font-medium text-accent-text underline"
      >
        {showTable ? 'Hide data table' : 'Show data table'}
      </button>
      {showTable && (
        <div id={tableId} className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm text-text">
            <caption className="sr-only">{title}: data</caption>
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-border px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
