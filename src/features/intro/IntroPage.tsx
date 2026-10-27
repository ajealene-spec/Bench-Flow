import { BAND, BODY, CARD, EnterLink, INNER, SECTION_HEADER, SECTION_TITLE, EYEBROW } from './introShared';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { NeuroSection } from './NeuroSection';
import { OpenScienceSection } from './OpenScienceSection';
import { ProblemSection } from './ProblemSection';
import { useActiveAnchor, usePrefersReducedMotion, useRevealOnScroll, useScrollFrame } from './introHooks';
import './intro.css';

export const REPO_URL = 'https://github.com/ajealene-spec/Bench-Flow';

const SECTIONS = [
  { id: 'hero', label: 'Top' },
  { id: 'problem', label: 'The problem' },
  { id: 'how', label: 'How it works' },
  { id: 'tools', label: 'Tools for the bench' },
  { id: 'open', label: 'Open science' },
  { id: 'enter', label: 'Enter the lab' },
];

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
        <HeroSection reduced={reduced} />

        <ProblemSection />
        <HowItWorksSection reduced={reduced} />
        <NeuroSection />
        <OpenScienceSection />

        <section id="enter" data-section="enter" aria-labelledby="enter-title" className={BAND}>
          <div className={INNER}>
            <div data-reveal className={`${CARD} gap-8 sm:p-10`}>
              <div className={SECTION_HEADER}>
                <p className={EYEBROW}>Get started</p>
                <h2 id="enter-title" className={SECTION_TITLE}>
                  Your notebook is ready when you are.
                </h2>
                <p className={BODY}>Nothing is required to start. Your notes stay in this browser, and the network is optional.</p>
              </div>
              <div>
                <EnterLink />
              </div>
            </div>
          </div>
        </section>

        <footer className={`${INNER} pb-12`}>
          <div className={`flex flex-col gap-2 border-t border-border pt-6 ${BODY}`}>
            <p>
              MIT licensed. <a className="text-accent-text underline" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
