import { Link } from 'react-router-dom';

export const REPO_URL = 'https://github.com/ajealene-spec/Bench-Flow';

const FEATURES: Array<{ title: string; body: string }> = [
  {
    title: 'Guided protocols',
    body: 'Paste a protocol or upload a PDF and get numbered steps, with timers, reagents and cautions pulled out for you.',
  },
  {
    title: 'Timers that survive',
    body: 'Timers keep running through page reloads and device sleep, and alert you when a step is due.',
  },
  {
    title: 'Numbers, notes and photos',
    body: 'Record measurements and times against the step they belong to. Everything rolls up into one summary.',
  },
  {
    title: 'Inventory with expiry',
    body: 'Keep lots, expiry dates and antibody host species together, with warnings for expired items and cross-reactivity.',
  },
  {
    title: 'Reports you can keep',
    body: 'Finish a run and get a report of exact parameters, recorded data, deviations and reagent lots, ready to print.',
  },
  {
    title: 'Works offline',
    body: 'Your notebook lives in the browser. The network is optional, and an AI key is optional too.',
  },
];

/** Public front page: what the project is, why it is open, and where the code lives. */
export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-14 p-4 pb-16 sm:p-6">
      <section aria-labelledby="about-hero" className="flex flex-col gap-6 pt-8 sm:pt-12">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Free and open source</span>
        <h1 id="about-hero" className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
          A digital lab notebook that is free, open, and works offline.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Bench Flow walks you through a protocol one step at a time and keeps your timers, numbers and notes with the experiment they belong
          to. It is built for beginners learning a technique and for experienced researchers who want a notebook that stays out of the way.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/" className="inline-flex min-h-12 items-center rounded-xl bg-accent px-5 font-medium text-white active:bg-accent-hover">
            Open the notebook
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            View the code on GitHub
          </a>
        </div>
      </section>

      <section aria-labelledby="about-mission" className="flex flex-col gap-4">
        <h2 id="about-mission" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Why it exists
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-slate-700 dark:text-slate-300">
          Electronic lab notebooks often cost money per seat, and many stop working when the connection drops, which is common at the bench.
          Bench Flow is a free, open alternative. Your data is stored on your device first. Syncing across devices is a planned, optional extra, and
          finished runs produce a printable report.
        </p>
      </section>

      <section aria-labelledby="about-features" className="flex flex-col gap-5">
        <h2 id="about-features" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          What it does
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex flex-col gap-2 rounded-2xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{feature.title}</h3>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-privacy" className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 id="about-privacy" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Your data, your device
          </h2>
          <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
            Notebook entries are stored locally in your browser. If you add an AI key, it is kept on this device too and is used only for the
            AI features you choose. Nothing is sent to us, and no one profiles your work.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Open science</h2>
          <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
            The code, the protocol format and the documentation are public so labs can read, fork and improve them. Protocols can carry their
            authors, license and source, so credit travels with the work.
          </p>
        </div>
      </section>

      <section aria-labelledby="about-license" className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 id="about-license" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          License
        </h2>
        <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
          Bench Flow is released under the MIT License. Use it, change it and share it, including in commercial work, as long as the notice is
          kept. See the LICENSE file in the repository.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Copyright (c) 2026 Bench Flow contributors</p>
      </section>

      <footer className="flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p>Roadmap: sync across devices, voice control in run mode, and photo annotation are planned for later releases.</p>
        <p>
          Source: <a className="text-accent underline" href={REPO_URL} target="_blank" rel="noreferrer">github.com/ajealene-spec/Bench-Flow</a>
        </p>
      </footer>
    </main>
  );
}
