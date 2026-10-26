import { ChartFigure, type ChartTable } from './ChartFigure';
import { formatTick, linearScale, niceTicks } from './scale';

export interface BarDatum {
  label: string;
  value: number;
  /** Shown after the value, for example "3 of 4 outside 10%". */
  note?: string;
}

interface Props {
  title: string;
  desc: string;
  valueLabel: string;
  bars: BarDatum[];
  table: ChartTable;
}

const W = 420;
const LABEL_W = 132;
const ROW = 32;
const M = { t: 8, r: 58, b: 34 };

/** Horizontal bars, one per step. Labels are truncated on screen; the full label is in the tooltip and the table. */
export function BarPlot({ title, desc, valueLabel, bars, table }: Props) {
  const height = bars.length * ROW + M.t + M.b;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const scale = niceTicks(0, max, 4);
  const x = linearScale(scale.domain, [LABEL_W, W - M.r]);
  const short = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
  return (
    <ChartFigure title={title} desc={desc} width={W} height={height} table={table}>
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={M.t} y2={height - M.b} stroke="var(--border)" />
          <text x={x(t)} y={height - M.b + 16} textAnchor="middle" fill="var(--text-muted)">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <text x={(LABEL_W + W - M.r) / 2} y={height - 4} textAnchor="middle" fill="var(--text-muted)">
        {valueLabel}
      </text>
      {bars.map((b, i) => {
        const cy = M.t + i * ROW + ROW / 2;
        const barH = ROW * 0.6;
        return (
          <g key={`${b.label}-${i}`}>
            <text x={LABEL_W - 8} y={cy} textAnchor="end" dominantBaseline="central" fill="var(--text)">
              <title>{b.label}</title>
              {short(b.label)}
            </text>
            <rect x={LABEL_W} y={cy - barH / 2} width={Math.max(0, x(b.value) - LABEL_W)} height={barH} rx={3} fill="var(--accent-text)">
              <title>{`${b.label}: ${formatTick(b.value)}${b.note ? ` (${b.note})` : ''}`}</title>
            </rect>
            <text x={x(b.value) + 6} y={cy} dominantBaseline="central" fill="var(--text)">
              {formatTick(b.value)}
            </text>
          </g>
        );
      })}
    </ChartFigure>
  );
}
