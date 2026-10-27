import { TOOLS } from './introContent';
import { BAND, BODY, CARD, CARD_TITLE, EYEBROW, INNER, SECTION_HEADER, SECTION_TITLE } from './introShared';

/** Everyday bench tools. Six tiles in a 3-column grid on laptops, 2 on tablets, 1 on phones. */
export function NeuroSection() {
  return (
    <section id="tools" data-section="tools" aria-labelledby="tools-title" className={BAND}>
      <div className={`${INNER} flex flex-col gap-12`}>
        <div data-reveal className={SECTION_HEADER}>
          <p className={EYEBROW}>Tools for the bench</p>
          <h2 id="tools-title" className={SECTION_TITLE}>
            Everyday bench tools, from cell culture to neuroscience.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => (
            <li key={t.title} data-reveal style={{ ['--reveal-delay' as string]: `${(i % 3) * 100}ms` }} className={CARD}>
              <h3 className={CARD_TITLE}>{t.title}</h3>
              <p className={BODY}>{t.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
