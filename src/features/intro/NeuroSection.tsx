import { CARD, EYEBROW } from './introShared';

const TILES = [
  { title: 'Stereotaxic targets', body: 'Keep coordinates from bregma, the atlas reference and the injection angle with the run they belong to.' },
  { title: 'Slice ephys Ra flags', body: 'Flags access resistance (Ra) that drifts during a whole-cell recording, so you can decide what to keep.' },
  { title: 'Animals and post-op', body: 'Track animals, procedures and post-op checks in one place.' },
  { title: 'RRIDs', body: 'Record Research Resource Identifiers for antibodies, animals and software.' },
  { title: 'Glossary for beginners', body: 'Plain-language definitions for the terms a protocol assumes you already know.' },
];

/** Brain outline that draws itself in on reveal, plus the neuroscience feature tiles. */
export function NeuroSection() {
  return (
    <section id="neuro" data-section="neuro" aria-labelledby="neuro-title" className="flex flex-col gap-10 py-20">
      <div data-reveal className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className={EYEBROW}>Built for neuroscience</p>
          <h2 id="neuro-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tools for the work between the bench and the brain.
          </h2>
        </div>
        <svg viewBox="0 0 200 140" className="mx-auto w-40 md:w-48" aria-hidden="true" focusable="false">
          <path
            className="brain-line"
            pathLength={1}
            d="M100 12 C135 4 180 20 186 58 C192 92 176 120 146 126 C128 130 116 122 100 126 C84 122 72 130 54 126 C24 120 8 92 14 58 C20 20 65 4 100 12 Z"
          />
          <path className="brain-line brain-line-2" pathLength={1} d="M100 12 C96 40 104 70 98 126" />
          <path className="brain-line brain-line-2" pathLength={1} d="M40 60 C60 52 70 72 90 64 M110 64 C130 56 146 72 162 62" />
          <path className="brain-line brain-line-2" pathLength={1} d="M30 96 C50 88 64 104 80 96 M140 118 C150 132 168 128 172 114" />
        </svg>
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TILES.map((t, i) => (
          <li
            key={t.title}
            data-reveal
            style={{ ['--reveal-delay' as string]: `${(i % 2) * 120}ms` }}
            className={`${CARD} flex flex-col gap-2 ${i === TILES.length - 1 && TILES.length % 2 === 1 ? 'md:col-span-2 md:mx-auto md:max-w-md' : ''}`}
          >
            <h3 className="text-lg font-semibold">{t.title}</h3>
            <p className="leading-relaxed text-text-muted">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
