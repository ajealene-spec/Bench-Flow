import { ChartFigure, type ChartTable } from './ChartFigure';
import { formatTick, linearScale, niceTicks } from './scale';

export interface StripGroup {
  label: string;
  values: Array<{ value: number; label: string }>;
}

interface Props {
  title: string;
  desc: string;
  yLabel: string;
  groups: StripGroup[];
  reference?: { value: number; label: string };
  table: ChartTable;
}

const W = 420;
const H = 260;
const M = { l: 52, r: 14, t: 14, b: 40 };

/** Strip plot: one column of dots per group. Dots are spread sideways by a fixed pattern so they do not overlap. */
export function StripPlot({ title, desc, yLabel, groups, reference, table }: Props) {
  const all = groups.flatMap((g) => g.values.map((v) => v.value));
  if (reference) all.push(reference.value);
  const yNice = niceTicks(Math.min(0, ...all), Math.max(...all, 1), 4);
  const y = linearScale(yNice.domain, [H - M.b, M.t]);
  const colW = (W - M.l - M.r) / Math.max(1, groups.length);
  const jitter = [0, -0.25, 0.25, -0.12, 0.12, -0.37, 0.37];
  return (
    <ChartFigure title={title} desc={desc} width={W} height={H} table={table}>
      {yNice.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={M.l - 6} y={y(t)} textAnchor="end" dominantBaseline="central" fill="var(--text-muted)">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--border-strong)" />
      <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--text-muted)">
        {yLabel}
      </text>
      {reference && (
        <g>
          <line x1={M.l} x2={W - M.r} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--text)" strokeDasharray="5 4" strokeWidth={1.25} />
          <text x={W - M.r} y={y(reference.value) - 5} textAnchor="end" fill="var(--text)">
            {reference.label}
          </text>
        </g>
      )}
      {groups.map((g, gi) => {
        const cx = M.l + colW * (gi + 0.5);
        return (
          <g key={g.label}>
            <text x={cx} y={H - M.b + 18} textAnchor="middle" fill="var(--text)">
              {g.label}
            </text>
            {g.values.map((v, i) => (
              <circle
                key={`${g.label}-${i}`}
                cx={cx + jitter[i % jitter.length] * colW * 0.6}
                cy={y(v.value)}
                r={5}
                fill="var(--accent-text)"
                fillOpacity={0.75}
                stroke="var(--surface)"
              >
                <title>{`${g.label} ${formatTick(v.value)} MΩ, ${v.label}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </ChartFigure>
  );
}
