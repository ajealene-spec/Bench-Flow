import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../app/feedback';
import { BAND, CARD, EYEBROW, EnterLink, INNER } from './introShared';
import { HeroHelix } from './HeroNetwork';
import { HowItWorksSection } from './HowItWorksSection';
import { MissionSection } from './MissionSection';
import { NeuroSection } from './NeuroSection';
import { OpenScienceSection } from './OpenScienceSection';
import { ProblemSection } from './ProblemSection';
import { useActiveAnchor, usePrefersReducedMotion, useRevealOnScroll, useScrollFrame } from './introHooks';
import './intro.css';

/** Loads the starter content if needed, then opens the demo experiment's report. */
function DemoButton() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function openDemo() {
    setBusy(true);
    try {
      const path: string | null = '/demo';
      if (path) navigate(path);
      else toast('Could not open the demo experiment. Try again from the Protocol Library.', { tone: 'error' });
    } catch {
      toast('Could not open the demo experiment. Try again from the Protocol Library.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openDemo()}
      disabled={busy}
      className={`${HERO_BUTTON} border-border bg-surface text-text shadow-card active:bg-surface-2 disabled:opacity-60`}
    >
      {busy ? 'Opening the tour…' : 'Take the 2-minute tour'}
    </button>
  );
}

export const REPO_URL = 'https://github.com/ajealene-spec/Bench-Flow';

const SECTIONS = [
  { id: 'hero', label: 'Top' },
  { id: 'mission', label: 'Mission' },
  { id: 'problem', label: 'The problem' },
  { id: 'how', label: 'How it works' },
  { id: 'tools', label: 'Tools for the bench' },
  { id: 'open', label: 'Open science' },
  { id: 'enter', label: 'Enter the lab' },
];

/** Shared button sizing so the hero buttons match in height, padding, border width and line height. */
const HERO_BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-6 text-base font-semibold leading-6';

/** Landing page at /intro. Works without onboarding and without the network. */
export default function IntroPage() {
  const reduced = usePrefersReducedMotion();
  useRevealOnScroll(reduced);
  const active = useActiveAnchor('[data-section]', 'section', '-50% 0px -50% 0px');

  // Progress bar: a transform written on each scroll frame, with no React state.
  useScrollFrame((scrollY, max) => {
    const bar = document.getElementById('intro-progress');
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  });

  return (
    <div className="bg-page text-text">
      <div id="intro-progress" className="intro-progress" aria-hidden="true" />

      <nav aria-label="Page sections" className="fixed right-2 top-1/2 z-20 hidden -translate-y-1/2 flex-col xl:flex">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-label={s.label}
            aria-current={active === s.id ? 'true' : undefined}
            className="dot-link inline-flex size-12 items-center justify-center rounded-full"
          >
            <span className="sr-only">{s.label}</span>
          </a>
        ))}
      </nav>

      <main className="flex w-full flex-col">
        <section id="hero" data-section="hero" aria-labelledby="hero-title" className="pb-12 pt-10 md:pb-16 md:pt-16">
          <div className={`${INNER} grid items-center gap-10 md:grid-cols-2`}>
            <div className="flex flex-col text-center md:text-left">
              <span className={`${EYEBROW} mb-6`}>Free and open source</span>
              <h1 id="hero-title" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Bench Flow — the open lab notebook for every bench.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-text-muted">Free, works offline, built for reproducible neuroscience.</p>
              <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4 md:justify-start">
                <EnterLink className="border-2 border-transparent leading-6" />
                <DemoButton />
              </div>
            </div>
            <HeroHelix reduced={reduced} />
          </div>
        </section>

        <MissionSection reduced={reduced} />
        <ProblemSection />
        <HowItWorksSection />
        <NeuroSection />
        <OpenScienceSection />

        <section id="enter" data-section="enter" aria-labelledby="enter-title" className={BAND}>
          <div className={INNER}>
            <div data-reveal className={`${CARD} flex flex-col items-center gap-6 text-center sm:p-10`}>
              <h2 id="enter-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Your notebook is ready when you are.
              </h2>
              <p className="max-w-xl text-text-muted">Nothing is required to start. Your notes stay in this browser, and the network is optional.</p>
              <EnterLink />
            </div>
          </div>
        </section>

        <footer className={`${INNER} pb-12`}>
          <div className="flex flex-col items-center gap-2 border-t border-border pt-6 text-center text-sm text-text-muted">
            <p>
              MIT licensed. <a className="text-accent-text underline" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
