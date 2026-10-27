import { OPEN_ITEMS, ORGANIZED } from './introContent';
import { BAND, BODY, CARD, CARD_TITLE, EYEBROW, INNER, SECTION_HEADER, SECTION_TITLE } from './introShared';

/** Open science: an even grid of six tiles, then the plain-language version of how the data is organized. */
export function OpenScienceSection() {
  return (
    <section id="open" data-section="open" aria-labelledby="open-title" className={`${BAND} bg-surface-2`}>
      <div className={`${INNER} flex flex-col gap-12`}>
        <div data-reveal className={SECTION_HEADER}>
          <p className={EYEBROW}>Open science</p>
          <h2 id="open-title" className={SECTION_TITLE}>
            Open by default, so others can repeat what you did.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OPEN_ITEMS.map((item, i) => (
            <li key={item.title} data-reveal style={{ ['--reveal-delay' as string]: `${(i % 3) * 100}ms` }} className={CARD}>
              <h3 className={CARD_TITLE}>{item.title}</h3>
              <p className={BODY}>{item.body}</p>
            </li>
          ))}
        </ul>

        <div data-reveal className="flex flex-col gap-6">
          <h3 className={CARD_TITLE}>How the data is organized</h3>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ORGANIZED.map((f, i) => (
              <li key={f.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }} className={CARD}>
                <h4 className={CARD_TITLE}>{f.title}</h4>
                <p className={BODY}>{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
