import { TOOLS } from './introContent';
import { BAND, CARD, EYEBROW, INNER, SECTION_TITLE } from './introShared';

/** Everyday bench tools, with a neuroscience flavor. Six tiles in a 3-column grid on laptops, 2 on tablets, 1 on phones. */
export function NeuroSection() {
  return (
    <section id="tools" data-section="tools" aria-labelledby="tools-title" className={BAND}>
      <div className={`${INNER} flex flex-col gap-8`}>
        <div data-reveal className="max-w-3xl">
          <p className={EYEBROW}>Tools for the bench</p>
          <h2 id="tools-title" className={SECTION_TITLE}>
            Tools for the everyday bench, from cell culture to neuroscience.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => (
            <li
              key={t.title}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${(i % 3) * 100}ms` }}
              className={`${CARD} flex flex-col gap-2`}
            >
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p className="leading-relaxed text-text-muted">{t.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
