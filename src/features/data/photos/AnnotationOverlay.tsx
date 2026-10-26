import type { PhotoAnnotation } from '../../../types';

/**
 * Labels and arrows drawn over a photo. Uses a 0 to 100 viewBox that stretches to the picture, so it lines up
 * at any size and prints the same as on screen. Text sits on a white halo so it reads on dark images.
 */
export function AnnotationOverlay({ annotations }: { annotations: PhotoAnnotation[] }) {
  if (annotations.length === 0) return null;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {annotations.map((a) =>
        a.type === 'arrow' ? <ArrowMark key={a.id} arrow={a} /> : (
          <text
            key={a.id}
            x={a.x * 100}
            y={a.y * 100}
            fontSize="5"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            stroke="#0f172a"
            strokeWidth="1.2"
            paintOrder="stroke"
          >
            {a.text}
          </text>
        ),
      )}
    </svg>
  );
}

function ArrowMark({ arrow }: { arrow: Extract<PhotoAnnotation, { type: 'arrow' }> }) {
  const angle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1);
  const head = 4;
  const tip = { x: arrow.x2 * 100, y: arrow.y2 * 100 };
  const left = { x: tip.x - head * Math.cos(angle - Math.PI / 7), y: tip.y - head * Math.sin(angle - Math.PI / 7) };
  const right = { x: tip.x - head * Math.cos(angle + Math.PI / 7), y: tip.y - head * Math.sin(angle + Math.PI / 7) };
  return (
    <g>
      <line x1={arrow.x1 * 100} y1={arrow.y1 * 100} x2={tip.x} y2={tip.y} stroke="#facc15" strokeWidth="0.8" strokeLinecap="round" />
      <polygon points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`} fill="#facc15" />
      {arrow.text && (
        <text x={arrow.x1 * 100} y={arrow.y1 * 100 - 2.5} fontSize="5" textAnchor="middle" fill="#fff" stroke="#0f172a" strokeWidth="1.2" paintOrder="stroke">
          {arrow.text}
        </text>
      )}
    </g>
  );
}
