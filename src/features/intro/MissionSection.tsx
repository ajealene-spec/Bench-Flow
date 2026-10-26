import { MISSION_PILLARS, MISSION_SENTENCE } from './introContent';
import { AudienceSpectrum } from './AudienceSpectrum';
import { BAND, EYEBROW, INNER } from './introShared';

/** Mission right after the hero: one bold sentence, three pillars, and the audience spectrum graphic. */
export function MissionSection({ reduced }: { reduced: boolean }) {
  return (
    <section id="mission" data-section="mission" aria-labelledby="mission-title" className={`${BAND} bg-surface-2`}>
      <div className={`${INNER} flex flex-col gap-12`}>
        <div data-reveal className="flex max-w-4xl flex-col gap-4">
          <p className={EYEBROW}>Our mission</p>
          <h2 id="mission-title" className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {MISSION_SENTENCE}
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {MISSION_PILLARS.map((pillar, i) => (
            <li
              key={pillar}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${i * 100}ms` }}
              className="flex min-h-24 items-center gap-4 rounded-2xl bg-accent px-6 py-5 text-on-accent shadow-card"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-on-accent text-base font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-xl font-semibold leading-snug">{pillar}</span>
            </li>
          ))}
        </ul>

        <div data-reveal className="mx-auto w-full max-w-3xl">
          <AudienceSpectrum reduced={reduced} />
        </div>
      </div>
    </section>
  );
}
