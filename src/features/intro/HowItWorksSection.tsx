import type { ReactNode } from 'react';
import { HOW_STEPS } from './introContent';
import { BAND, EYEBROW, INNER, SECTION_TITLE } from './introShared';

/** Small inline UI sketch per step. HTML and CSS built from the theme tokens, no phone frame. */
const SKETCHES: Array<() => ReactNode> = [
  () => (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-page p-2 text-xs leading-snug text-text-muted">
        Warm buffer to 37 °C. Load 20 µL per well.
      </div>
      <div className="rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-on-accent">Turn into steps</div>
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-xs text-text">
        <span className="grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">1</span>
        Warm buffer
      </div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">Step 3 of 8</p>
      <p className="text-center text-3xl font-semibold tabular-nums text-text">24:59</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-2/5 rounded-full bg-accent" />
      </div>
      <div className="rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-on-accent">Next step</div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-page p-2">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Step 4 · 10:42</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">Logged</span>
        </div>
        <p className="mt-1 text-xs font-medium text-text">Incubator at 35 °C for 3 min</p>
        <p className="text-[11px] text-text-muted">Reason: door opened</p>
      </div>
      <div className="rounded-lg border border-border bg-page p-2 text-xs text-text-muted">Volume 18 µL instead of 20 µL</div>
    </div>
  ),
  () => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {['Protocol', 'Data', 'Photos', 'Methods'].map((t) => (
          <span key={t} className="rounded-full border border-border bg-page px-2 py-1 text-text">
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-page p-2 text-xs leading-snug text-text">
        Incubated at 37 °C for 60 min. One logged deviation at step 4.
      </div>
      <div className="rounded-lg bg-accent py-1.5 text-center text-xs font-semibold text-on-accent">Export package (.zip)</div>
    </div>
  ),
];

/** Four steps across the full width: a stepper on laptops, two columns on tablets, a stack on phones. */
export function HowItWorksSection() {
  return (
    <section id="how" data-section="how" aria-labelledby="how-title" className={`${BAND} bg-surface-2`}>
      <div className={`${INNER} flex flex-col gap-10`}>
        <div data-reveal className="max-w-3xl">
          <p className={EYEBROW}>How it works</p>
          <h2 id="how-title" className={SECTION_TITLE}>
            From protocol to methods in four steps.
          </h2>
        </div>

        <ol className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((step, i) => {
            const Sketch = SKETCHES[i];
            return (
              <li key={step.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-base font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <span aria-hidden="true" className="hidden h-0.5 flex-1 rounded-full bg-border lg:block" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-text-muted">{step.body}</p>
                </div>
                <div aria-hidden="true" className="mt-auto rounded-2xl border border-border bg-surface p-4 shadow-card">
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
