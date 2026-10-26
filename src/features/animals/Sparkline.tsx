/** Tiny line chart of a series, for weight trends. Pure SVG, no chart library. */

export interface SparkPoint {
  x: number;
  y: number;
}

/** Scales values to the box. Time spreads the x axis; equal times or a single point sit at the middle. */
export function sparklinePoints(series: { at: number; value: number }[], width = 160, height = 48, pad = 4): SparkPoint[] {
  if (series.length === 0) return [];
  const sorted = [...series].sort((a, b) => a.at - b.at);
  const times = sorted.map((s) => s.at);
  const values = sorted.map((s) => s.value);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const v0 = Math.min(...values);
  const v1 = Math.max(...values);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return sorted.map((s) => {
    const x = t1 === t0 ? width / 2 : pad + ((s.at - t0) / (t1 - t0)) * innerW;
    const y = v1 === v0 ? height / 2 : pad + (1 - (s.value - v0) / (v1 - v0)) * innerH;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
}

export function Sparkline({ series, label }: { series: { at: number; value: number }[]; label: string }) {
  if (series.length < 2) {
    return <p className="text-sm text-text-muted">Add two or more weights to see a trend.</p>;
  }
  const points = sparklinePoints(series);
  return (
    <svg role="img" aria-label={label} viewBox="0 0 160 48" className="h-12 w-40 text-accent-text">
      <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="currentColor" />
      ))}
    </svg>
  );
}
