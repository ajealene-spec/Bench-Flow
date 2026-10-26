import { CARD, EYEBROW } from './introShared';

const STATS = [
  { word: 'Often', text: 'Methods sections omit the details needed to repeat an experiment.' },
  { word: 'Scattered', text: 'Parameters, reagent lots and changes end up in paper notes, spreadsheets and memory.' },
  { word: 'Unlogged', text: 'Deviations from a protocol are rarely written down at the moment they happen.' },
];

/** The problem: scroll-revealed statements (no invented figures) and a notebook-to-step-card morph. */
export function ProblemSection() {
  return (
    <section id="problem" data-section="problem" aria-labelledby="problem-title" className="flex flex-col gap-10 py-20">
      <div data-reveal className="max-w-3xl">
        <p className={EYEBROW}>The problem</p>
        <h2 id="problem-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          The details that make an experiment repeatable are easy to lose.
        </h2>
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STATS.map((s, i) => (
          <li key={s.word} data-reveal style={{ ['--reveal-delay' as string]: `${i * 120}ms` }} className={`${CARD} flex flex-col gap-3`}>
            <span className="text-3xl font-semibold tracking-tight text-accent-text">{s.word}</span>
            <p className="leading-relaxed text-text-muted">{s.text}</p>
          </li>
        ))}
      </ul>

      <figure data-reveal className="grid items-center gap-8 md:grid-cols-2">
        <div className="morph" role="img" aria-label="A messy paper notebook page becomes a clean step card">
          <div className="morph-messy" aria-hidden="true">
            <div
              className="relative mx-auto h-72 w-full max-w-sm rotate-[-2deg] rounded-md p-6 shadow-md"
              style={{ background: '#F5EFDD', color: '#3B3A36', fontFamily: 'Georgia, serif' }}
            >
              <p className="text-lg">inc 37?? (or 35)</p>
              <p className="mt-3 text-base line-through opacity-70">2 uL per well</p>
              <p className="mt-2 text-base">lot ??? check fridge</p>
              <p className="mt-4 text-sm">3 min door open, redo</p>
              <svg viewBox="0 0 200 40" className="absolute bottom-6 left-6 w-40" fill="none" stroke="#3B3A36" strokeWidth="2">
                <path d="M4 20 C30 4 50 36 80 16 S130 34 160 14 S190 30 196 20" />
              </svg>
              <span className="absolute right-4 top-4 size-14 rounded-full border-4 border-[#B9A77A] opacity-60" />
            </div>
          </div>
          <div className="morph-clean">
            <div className="mx-auto flex h-72 w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-card">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">Step 4 of 8</p>
              <p className="text-xl font-semibold">Incubate at 37 °C for 60 min</p>
              <p className="text-text-muted">Lot AB-2291 · 2 µL per well</p>
              <p className="mt-auto rounded-xl bg-surface-2 p-3 text-sm text-text">Deviation logged: 35 °C for 3 min, incubator door opened.</p>
            </div>
          </div>
        </div>
        <figcaption className="text-text-muted">
          Notes made at the bench become a step card: the parameters, the lot, and what changed, attached to the step where it happened.
        </figcaption>
      </figure>
    </section>
  );
}
