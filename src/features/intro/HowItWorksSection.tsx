import type { ReactNode } from 'react';
import { CARD, EYEBROW } from './introShared';
import { useActiveAnchor } from './introHooks';

const STEPS = [
  { title: 'Paste a protocol', body: 'Paste the text or upload a PDF. Bench Flow turns it into numbered steps with timers, reagents and cautions.' },
  { title: 'Run it hands-free', body: 'Work one step at a time. Timers keep running through page reloads and screen sleep.' },
  { title: 'Every deviation logged', body: 'Change a temperature or a volume and note why, on the step where it happened.' },
  { title: 'Methods + FAIR package', body: 'Get a methods write-up and a package of protocol, data and metadata, organized around the FAIR principles.' },
];

/** Four phone screens, one per step. Each is HTML and CSS built from the theme tokens. */
const SCREENS: Array<() => ReactNode> = [
  () => (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">New protocol</p>
      <div className="rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-text-muted">
        Warm buffer to 37 °C. Load 20 µL per well. Incubate 60 min, protect from light.
      </div>
      <div className="rounded-xl bg-accent py-3 text-center text-sm font-semibold text-on-accent">Turn into steps</div>
      <ol className="flex flex-col gap-2 text-xs">
        {['Warm buffer', 'Load wells', 'Incubate 60 min'].map((s, i) => (
          <li key={s} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-text">
            <span className="grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  ),
  () => (
    <div className="flex h-full flex-col gap-4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">Step 3 of 8</p>
      <p className="text-lg font-semibold">Incubate in the dark</p>
      <p className="text-center text-5xl font-semibold tabular-nums text-text">24:59</p>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-2/5 rounded-full bg-accent" />
      </div>
      <div className="mt-auto min-h-12 rounded-xl bg-accent py-3 text-center text-sm font-semibold text-on-accent">Next step</div>
    </div>
  ),
  () => (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">Deviations</p>
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Step 4 · 10:42</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">Logged</span>
        </div>
        <p className="mt-2 text-sm font-medium">Incubator at 35 °C for 3 min</p>
        <p className="mt-1 text-xs text-text-muted">Reason: incubator door opened</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="text-[11px] text-text-muted">Step 6 · 11:05</div>
        <p className="mt-2 text-sm font-medium">Volume 18 µL instead of 20 µL</p>
        <p className="mt-1 text-xs text-text-muted">Reason: well 3 leaked</p>
      </div>
    </div>
  ),
  () => (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">Methods</p>
      <p className="rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-text">
        Samples were incubated at 37 °C for 60 min (protocol v3, reagent lot AB-2291). One deviation, a 3 min drop to 35 °C at step 4, is logged.
      </p>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {['Findable', 'Accessible', 'Interoperable', 'Reusable'].map((t) => (
          <span key={t} className="rounded-full border border-border bg-surface px-2 py-1 text-text">{t}</span>
        ))}
      </div>
      <div className="mt-auto min-h-12 rounded-xl border border-border bg-surface py-3 text-center text-sm font-semibold text-text">Export package</div>
    </div>
  ),
];

/** Sticky-scroll sequence. The phone on the right swaps screens as the matching step reaches the middle of the viewport. */
export function HowItWorksSection() {
  const active = useActiveAnchor('[data-step-index]', 'stepIndex', '-45% 0px -45% 0px');
  const index = active === null ? 0 : Number(active);
  const Screen = SCREENS[index] ?? SCREENS[0];

  return (
    <section id="how" data-section="how" aria-labelledby="how-title" className="py-20">
      <div data-reveal className="max-w-3xl">
        <p className={EYEBROW}>How it works</p>
        <h2 id="how-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          From protocol to methods in four steps.
        </h2>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              data-step-index={i}
              className="flex min-h-[40vh] items-center lg:min-h-[70vh]"
              aria-current={i === index ? 'step' : undefined}
            >
              <div className={`${CARD} w-full transition-opacity duration-500 ${i === index ? 'opacity-100' : 'opacity-60'}`}>
                <p className="text-sm font-semibold text-accent-text">Step {i + 1}</p>
                <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="order-first flex items-start justify-center lg:order-none lg:sticky lg:top-8 lg:h-[calc(100dvh-4rem)] lg:items-center">
          <div aria-hidden="true" className="w-full max-w-[280px] rounded-[2.25rem] border-[6px] border-text-muted bg-page p-2 shadow-card">
            <div className="h-[440px] overflow-hidden rounded-[1.6rem] bg-page lg:h-[480px]">
              <div key={index} className="screen-enter h-full">
                <Screen />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
