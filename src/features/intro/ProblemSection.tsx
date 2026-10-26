import { PROBLEMS } from './introContent';
import { BAND, CARD, EYEBROW, INNER, SECTION_TITLE } from './introShared';

/** The problem, then the fix: three cards, each a plain problem on the left and the Bench Flow answer on the right. */
export function ProblemSection() {
  return (
    <section id="problem" data-section="problem" aria-labelledby="problem-title" className={BAND}>
      <div className={`${INNER} flex flex-col gap-8`}>
        <div data-reveal className="max-w-3xl">
          <p className={EYEBROW}>The problem</p>
          <h2 id="problem-title" className={SECTION_TITLE}>
            The details that make an experiment repeatable are easy to lose.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROBLEMS.map((card, i) => (
            <li
              key={card.problem}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${i * 120}ms` }}
              className={`${CARD} flex flex-col gap-4`}
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">Problem</p>
                <p className="text-lg text-text-muted">{card.problem}</p>
              </div>
              <span aria-hidden="true" className="text-2xl leading-none text-accent-text">
                ↓
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-accent-text">Bench Flow</p>
                <p className="text-lg font-semibold text-text">{card.solution}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
