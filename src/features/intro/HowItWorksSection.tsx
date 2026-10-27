import { useRef, type ReactNode } from 'react';
import { HOW_STEPS } from './introContent';
import { useScrollFrame } from './introHooks';
import { segmentFill, trackProgress } from './introMath';
import { BAND, BODY, CARD_TITLE, EYEBROW, INNER, SECTION_HEADER, SECTION_TITLE } from './introShared';

/*
 * Small UI sketches per step, built from theme tokens and the shared type roles. They are decorative product
 * mockups, so they are hidden from assistive tech.
 */
const SKETCHES: Array<() => ReactNode> = [
  () => (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-page p-3 text-base text-text-muted">Warm buffer to 37 °C. Load 20 µL per well.</div>
      <div className="rounded-lg bg-accent py-2 text-center text-base font-medium text-on-accent">Turn into steps</div>
      <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-base text-text">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-base font-medium text-on-accent">1</span>
        Warm buffer
      </div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-3">
      <p className={EYEBROW}>Step 3 of 8</p>
      <p className="text-center text-4xl font-light tabular-nums text-text">24:59</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-2/5 rounded-full bg-accent" />
      </div>
      <div className="rounded-lg bg-accent py-2 text-center text-base font-medium text-on-accent">Next step</div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-page p-3">
        <div className="flex items-center justify-between gap-2 text-base text-text-muted">
          <span>Step 4 · 10:42</span>
          <span className={`rounded-full bg-surface-2 px-2 py-0.5 ${EYEBROW}`}>Logged</span>
        </div>
        <p className="mt-1 text-base font-medium text-text">Incubator at 35 °C for 3 min</p>
        <p className="text-base text-text-muted">Reason: door opened</p>
      </div>
      <div className="rounded-lg border border-border bg-page p-3 text-base text-text-muted">Volume 18 µL instead of 20 µL</div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-base text-text">
        {['Protocol', 'Data', 'Photos', 'Methods'].map((t) => (
          <span key={t} className="rounded-full border border-border bg-page px-3 py-1">
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-page p-3 text-base text-text-muted">Incubated at 37 °C for 60 min. One logged deviation at step 4.</div>
      <div className="rounded-lg bg-accent py-2 text-center text-base font-medium text-on-accent">Export package (.zip)</div>
    </div>
  ),
];

/**
 * Four steps across the full width: a stepper on laptops, two columns on tablets, a stack on phones.
 * On laptops a track joins the step badges and fills as you scroll through the steps. Reduced motion shows it full.
 */
export function HowItWorksSection({ reduced }: { reduced: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  const segments = HOW_STEPS.length - 1;

  useScrollFrame(() => {
    const list = listRef.current;
    if (!list || reduced) return;
    const progress = trackProgress(list.getBoundingClientRect().top, list.offsetHeight, window.innerHeight);
    list.querySelectorAll<HTMLElement>('[data-seg-fill]').forEach((el, i) => {
      el.style.transform = `scaleX(${segmentFill(progress, i, segments)})`;
    });
  });

  return (
    <section id="how" data-section="how" aria-labelledby="how-title" className={`${BAND} bg-surface-2`}>
      <div className={`${INNER} flex flex-col gap-12`}>
        <div data-reveal className={SECTION_HEADER}>
          <p className={EYEBROW}>How it works</p>
          <h2 id="how-title" className={SECTION_TITLE}>
            From protocol to methods in four steps.
          </h2>
        </div>

        <ol ref={listRef} className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((step, i) => {
            const Sketch = SKETCHES[i];
            const isLast = i === HOW_STEPS.length - 1;
            return (
              <li key={step.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }} className="flex flex-col gap-5">
                <div className="flex items-center">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-lg font-medium text-on-accent">{i + 1}</span>
                  {/* The track runs from this badge to the next one. The negative margin closes the grid gap. */}
                  {!isLast && (
                    <span aria-hidden="true" className="-mr-8 hidden h-0.5 flex-1 overflow-hidden rounded-full bg-border lg:block">
                      <span data-seg-fill className="block h-full origin-left bg-accent" style={{ transform: reduced ? 'scaleX(1)' : 'scaleX(0)' }} />
                    </span>
                  )}
                </div>
                {/* A shared minimum height keeps the sketch tops level across the four steps. */}
                <div className="flex min-h-[9.5rem] flex-col gap-2">
                  <h3 className={CARD_TITLE}>{step.title}</h3>
                  <p className={BODY}>{step.body}</p>
                </div>
                <div aria-hidden="true" className="flex flex-1 flex-col rounded-2xl border border-border bg-surface p-6 shadow-card">
                  <Sketch />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
