import { ChartFigure, type ChartTable } from './ChartFigure';
import { formatTick, linearScale, niceTicks } from './scale';

export interface LinePoint {
  x: number;
  y: number;
  label: string;
}

interface Props {
  title: string;
  desc: string;
  xLabel: string;
  yLabel: string;
  points: LinePoint[];
  /** Tick labels on the x axis, at the given x values. */
  xTicks: Array<{ value: number; label: string }>;
  /** Mean with a ±SD band drawn across the plot. */
  band?: { mean: number; sd: number };
  table: ChartTable;
}

const W = 420;
const H = 260;
const M = { l: 52, r: 14, t: 14, b: 44 };

/** Dot and line plot over runs, with an optional mean ± SD band. */
export function LinePlot({ title, desc, xLabel, yLabel, points, xTicks, band, table }: Props) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  if (band) {
    ys.push(band.mean - band.sd, band.mean + band.sd);
  }
  // Half a unit of padding either side keeps single points and the first and last runs off the axes.
  const x = linearScale([Math.min(...xs) - 0.5, Math.max(...xs) + 0.5], [M.l, W - M.r]);
  const yNice = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const y = linearScale(yNice.domain, [H - M.b, M.t]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');

  return (
    <ChartFigure title={title} desc={desc} width={W} height={H} table={table}>
      {band && (
        <g aria-hidden="true">
          <rect
            x={M.l}
            y={y(band.mean + band.sd)}
            width={W - M.l - M.r}
            height={Math.max(0, y(band.mean - band.sd) - y(band.mean + band.sd))}
            fill="var(--accent-text)"
            fillOpacity={0.14}
          />
          <line x1={M.l} x2={W - M.r} y1={y(band.mean)} y2={y(band.mean)} stroke="var(--accent-text)" strokeDasharray="6 4" strokeWidth={1.5} />
        </g>
      )}
      {yNice.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={M.l - 6} y={y(t)} textAnchor="end" dominantBaseline="central" fill="var(--text-muted)">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--border-strong)" />
      <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--border-strong)" />
      {xTicks.map((t) => (
        <text key={`x${t.value}`} x={x(t.value)} y={H - M.b + 16} textAnchor="middle" fill="var(--text-muted)">
          {t.label}
        </text>
      ))}
      <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--text-muted)">
        {yLabel}
      </text>
      {points.length > 1 && <path d={path} fill="none" stroke="var(--accent-text)" strokeWidth={1.5} />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.x)} cy={y(p.y)} r={5} fill="var(--accent-text)" stroke="var(--surface)" strokeWidth={1.5}>
          <title>{p.label}</title>
        </circle>
      ))}
    </ChartFigure>
  );
}
