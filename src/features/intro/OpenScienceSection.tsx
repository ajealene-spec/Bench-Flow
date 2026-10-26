import { CARD, EYEBROW } from './introShared';

const ITEMS = [
  { title: 'MIT license', body: 'The code is free to read, use, change and share.' },
  { title: 'CC BY protocols', body: 'Protocols you share can be reused with credit to you.' },
  { title: 'Share links', body: 'Send a read-only link to a protocol or a run.' },
  { title: 'Zenodo DOI', body: 'Archive a release on Zenodo to get a citable DOI.' },
  { title: 'Accessible', body: 'Large touch targets, a dyslexia-friendly font, light and dark themes, and reduced motion.' },
];

const FAIR = [
  { title: 'Findable', body: 'Every protocol and run has its own record.' },
  { title: 'Accessible', body: 'Open formats, and the notebook works offline.' },
  { title: 'Interoperable', body: 'Standard identifiers such as RRIDs.' },
  { title: 'Reusable', body: 'Licensed, versioned, with methods written out.' },
];

export function OpenScienceSection() {
  return (
    <section id="open" data-section="open" aria-labelledby="open-title" className="flex flex-col gap-10 py-20">
      <div data-reveal className="max-w-3xl">
        <p className={EYEBROW}>Open science</p>
        <h2 id="open-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Open by default, so others can repeat what you did.
        </h2>
      </div>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ITEMS.map((item, i) => (
          <li
            key={item.title}
            data-reveal
            style={{ ['--reveal-delay' as string]: `${(i % 2) * 120}ms` }}
            className={`${CARD} flex flex-col gap-2 ${i === ITEMS.length - 1 ? 'md:col-span-2 md:mx-auto md:max-w-md' : ''}`}
          >
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="leading-relaxed text-text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <div data-reveal>
        <h3 className="text-lg font-semibold">FAIR principles</h3>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FAIR.map((f) => (
            <li key={f.title} className="rounded-2xl border border-border bg-surface-2 p-4">
              <p className="font-semibold text-accent-text">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
