import { useId } from 'react';
import { ATLAS_BREGMA_LAMBDA_MM, formatCoordinate } from './stereotax';
import {
  atlasWarnings,
  CORONAL_FRAME,
  CORONAL_OUTLINE,
  coronalPoint,
  coronalTrack,
  lambdaPoint,
  outlinePath,
  SAGITTAL_FRAME,
  SAGITTAL_OUTLINE,
  sagittalPoint,
  type AtlasTarget,
  type Point2,
} from './brainAtlas';

export const ALLEN_ATLAS_URL = 'https://atlas.brain-map.org/';

interface Props extends AtlasTarget {
  /** Measured bregma–lambda distance in mm. Lambda is drawn at this distance. */
  bregmaLambdaMm?: number;
  /** AP after skull scaling. Drawn as a hollow marker when it differs from the atlas AP. */
  scaledAp?: number;
}

/** Schematic sagittal and coronal views with the target, bregma, lambda and any angled track. */
export function BrainAtlasPreview({ ap, ml, dv, angleDeg = 0, scaledAp, bregmaLambdaMm }: Props) {
  const warnings = atlasWarnings({ ap, ml, dv, angleDeg });
  const lambdaMm = bregmaLambdaMm ?? ATLAS_BREGMA_LAMBDA_MM;
  const track = ml !== undefined && dv !== undefined ? coronalTrack(ml, dv, angleDeg) : undefined;
  const showScaled = scaledAp !== undefined && ap !== undefined && Math.abs(scaledAp - ap) > 0.005;

  return (
    <section aria-label="Brain atlas preview" className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-lg font-semibold">Brain atlas preview</h4>
        <p className="text-sm text-text-muted">Schematic, not to scale. The outlines are simplified; check real targets against the atlas below.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AtlasFigure
          title="Sagittal view (midline)"
          desc={`Anterior is to the left. Bregma at the origin, lambda ${lambdaMm.toFixed(2)} mm behind it.${
            ap !== undefined && dv !== undefined ? ` Target AP ${ap} mm, DV ${dv} mm.` : ''
          }`}
        >
          <path d={outlinePath(SAGITTAL_OUTLINE, (a, b) => sagittalPoint(a, b))} fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.5} />
          <Axes view="sagittal" />
          {ap !== undefined && dv !== undefined && <Track from={sagittalPoint(ap, 0)} to={sagittalPoint(ap, dv)} />}
          <Marker label="Bregma" at={sagittalPoint(0, 0)} />
          <Marker label="Lambda" at={lambdaPoint(lambdaMm)} small />
          {showScaled && ap !== undefined && <Marker label="Scaled AP" at={sagittalPoint(scaledAp, dv ?? 0)} hollow />}
          {ap !== undefined && dv !== undefined && <Marker label="Target" at={sagittalPoint(ap, dv)} />}
          <text x={SAGITTAL_FRAME.width - 10} y={SAGITTAL_FRAME.height - 8} textAnchor="end" fill="var(--text-muted)" fontSize={12}>
            Angled tracks show in the coronal view.
          </text>
        </AtlasFigure>

        <AtlasFigure
          title="Coronal view"
          desc={`Right hemisphere on the right of the drawing. ${
            ml !== undefined && dv !== undefined ? `Target ML ${ml} mm, DV ${dv} mm.` : ''
          }${track ? ` Angled track of ${angleDeg}° enters at ML ${track.entryMl.toFixed(2)} mm.` : ''}`}
        >
          <path d={outlinePath(CORONAL_OUTLINE, (a, b) => coronalPoint(a, b))} fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.5} />
          <line x1={CORONAL_FRAME.originX} x2={CORONAL_FRAME.originX} y1={CORONAL_FRAME.originY} y2={CORONAL_FRAME.originY + 5.1 * CORONAL_FRAME.pxPerMm} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Axes view="coronal" />
          {track && <Track from={track.entry} to={track.tip} accent />}
          {track && <Marker label="Entry" at={track.entry} small labelBelow />}
          <Marker label="Bregma" at={coronalPoint(0, 0)} />
          {ml !== undefined && dv !== undefined && <Marker label="Target" at={coronalPoint(ml, dv)} />}
        </AtlasFigure>
      </div>

      {warnings.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 text-base text-amber-800 dark:text-amber-200">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {ap !== undefined && ml !== undefined && dv !== undefined && (
        <p className="text-base text-text-muted">
          Target {formatCoordinate('AP', ap)} · {formatCoordinate('ML', ml)} · {formatCoordinate('DV', dv)}
          {angleDeg ? ` · ${angleDeg}° approach` : ''}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <a
          href={ALLEN_ATLAS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-fit items-center rounded-lg px-3 font-medium text-accent-text underline"
        >
          Open in Allen Brain Atlas
        </a>
        <p className="text-sm text-text-muted">
          The Allen Mouse Brain Common Coordinate Framework is the reference for exact targets.
        </p>
      </div>
    </section>
  );
}

function AtlasFigure({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-base font-medium">{title}</figcaption>
      <svg
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
        viewBox={`0 0 ${SAGITTAL_FRAME.width} ${SAGITTAL_FRAME.height}`}
        className="h-auto w-full"
        style={{ fontFamily: 'inherit' }}
      >
        <title id={`${id}-t`}>{title}, schematic, not to scale</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {children}
      </svg>
    </figure>
  );
}

function Axes({ view }: { view: 'sagittal' | 'coronal' }) {
  if (view === 'sagittal') {
    return (
      <text x={12} y={18} fill="var(--text-muted)" fontSize={12}>
        Anterior ←
      </text>
    );
  }
  return (
    <>
      <text x={12} y={18} fill="var(--text-muted)" fontSize={12}>
        Left
      </text>
      <text x={CORONAL_FRAME.width - 12} y={18} textAnchor="end" fill="var(--text-muted)" fontSize={12}>
        Right
      </text>
    </>
  );
}

function Track({ from, to, accent = false }: { from: Point2; to: Point2; accent?: boolean }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={accent ? 'var(--accent-text)' : 'var(--text)'}
      strokeWidth={3}
      strokeLinecap="round"
      strokeOpacity={0.85}
    />
  );
}

function Marker({
  label,
  at,
  small = false,
  hollow = false,
  labelBelow = false,
}: {
  label: string;
  at: Point2;
  small?: boolean;
  hollow?: boolean;
  labelBelow?: boolean;
}) {
  const r = small ? 4 : 6;
  return (
    <g>
      <circle
        cx={at.x}
        cy={at.y}
        r={r}
        fill={hollow ? 'none' : 'var(--accent-text)'}
        stroke={hollow ? 'var(--accent-text)' : 'var(--surface)'}
        strokeWidth={hollow ? 2 : 1.5}
        strokeDasharray={hollow ? '3 2' : undefined}
      >
        <title>{label}</title>
      </circle>
      <text x={at.x + 9} y={labelBelow ? at.y + 16 : at.y - 7} fill="var(--text)" fontSize={12}>
        {label}
      </text>
    </g>
  );
}
