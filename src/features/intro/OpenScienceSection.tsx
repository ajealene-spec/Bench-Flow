import { OPEN_ITEMS, ORGANIZED } from './introContent';
import { BAND, CARD, EYEBROW, INNER, SECTION_TITLE } from './introShared';

/** Open science: an even grid of six tiles, then the plain-language version of how the data is organized. */
export function OpenScienceSection() {
  return (
    <section id="open" data-section="open" aria-labelledby="open-title" className={`${BAND} bg-surface-2`}>
      <div className={`${INNER} flex flex-col gap-8`}>
        <div data-reveal className="max-w-3xl">
          <p className={EYEBROW}>Open science</p>
          <h2 id="open-title" className={SECTION_TITLE}>
            Open by default, so others can repeat what you did.
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OPEN_ITEMS.map((item, i) => (
            <li
              key={item.title}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${(i % 3) * 100}ms` }}
              className={`${CARD} flex flex-col gap-2`}
            >
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="leading-relaxed text-text-muted">{item.body}</p>
            </li>
          ))}
        </ul>

        <div data-reveal className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">How the data is organized</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ORGANIZED.map((f) => (
              <li key={f.title} className="rounded-2xl border border-border bg-surface p-4">
                <p className="font-semibold text-accent-text">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
