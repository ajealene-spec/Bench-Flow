import { PROBLEMS } from './introContent';
import { BAND, BODY, CARD, CARD_TITLE, EYEBROW, INNER, SECTION_HEADER, SECTION_TITLE } from './introShared';

/** Down arrow between the problem and the fix. Stroke uses currentColor, so it follows the accent in both themes. */
function ArrowDown() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" className="text-accent-text">
      <path d="M10 4v11m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The problem, then the fix: three cards, each a plain problem above the Bench Flow answer. */
export function ProblemSection() {
  return (
    <section id="problem" data-section="problem" aria-labelledby="problem-title" className={BAND}>
      <div className={`${INNER} flex flex-col gap-12`}>
        <div data-reveal className={SECTION_HEADER}>
          <p className={EYEBROW}>The problem</p>
          <h2 id="problem-title" className={SECTION_TITLE}>
            The details that make an experiment repeatable are easy to lose.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PROBLEMS.map((card, i) => (
            <li key={card.problem} data-reveal style={{ ['--reveal-delay' as string]: `${i * 120}ms` }} className={CARD}>
              <div className="flex flex-col gap-2">
                <p className={EYEBROW}>Problem</p>
                <p className={BODY}>{card.problem}</p>
              </div>
              <div className="mt-auto flex flex-col gap-3">
                <ArrowDown />
                <p className={EYEBROW}>Bench Flow</p>
                <p className={CARD_TITLE}>{card.solution}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
