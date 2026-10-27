import { Link } from 'react-router-dom';
import { markIntroSeen } from '../../app/introRedirect';
import { BODY, EYEBROW, INNER, STAT } from './introShared';
import { CountUp } from './CountUp';
import { HeroHelix } from './HeroNetwork';
import { HERO_COPY, HERO_STATS } from './introContent';

/** Small inline SVG arrows. Stroke uses currentColor so they follow the text color in both themes. */
function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false" className={className}>
      <path d="M4 10h11m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false" className={className}>
      <path d="M10 4v11m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Each element rises 18px from a blur, staggered by 0.1s. The delay is set per element with --d. */
const RISE = 'hero-rise';

/**
 * Landing hero. The DNA helix sits behind the text at low opacity, with a scrim from the page color so the
 * text keeps AA contrast in both themes. Motion is CSS only (see intro.css) and is off under reduced motion.
 */
export function HeroSection({ reduced }: { reduced: boolean }) {
  return (
    <section id="hero" data-section="hero" aria-labelledby="hero-title" className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 right-0 flex w-full items-center justify-end opacity-[0.2] md:w-[70%] md:opacity-[0.2]">
          <HeroHelix reduced={reduced} className="h-[min(74vh,720px)] w-auto max-w-none" />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--page) 0%, var(--page) 38%, color-mix(in srgb, var(--page) 60%, transparent) 70%, transparent 100%), linear-gradient(180deg, transparent 60%, var(--page) 100%)',
          }}
        />
      </div>

      <div className={`${INNER} relative flex flex-1 flex-col justify-center gap-12 py-16 md:py-20`}>
        <div className="flex max-w-7xl flex-col">
          <span className={`${EYEBROW} ${RISE}`} style={{ ['--d' as string]: '0s' }}>
            {HERO_COPY.tagline}
          </span>

          <h1
            id="hero-title"
            className={`${RISE} mt-6 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl`}
            style={{ ['--d' as string]: '0.1s' }}
          >
            {HERO_COPY.headlineLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p
            className={`${RISE} mt-6 max-w-2xl ${BODY}`}
            style={{ ['--d' as string]: '0.2s' }}
          >
            {HERO_COPY.description}
          </p>

          <div className={`${RISE} mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8`} style={{ ['--d' as string]: '0.3s' }}>
            <Link
              to="/"
              onClick={() => markIntroSeen()}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-8 text-base font-medium leading-6 text-on-accent shadow-card active:bg-accent-hover"
            >
              {HERO_COPY.primary}
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/demo"
              className="group inline-flex min-h-12 items-center gap-2 rounded-md px-1 text-base font-medium leading-6 text-accent-text underline-offset-4 hover:underline"
            >
              {HERO_COPY.secondary}
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <div className={`${RISE} flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between`} style={{ ['--d' as string]: '0.4s' }}>
          <dl className="flex flex-col md:flex-row">
            {HERO_STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col gap-1 py-4 md:px-8 md:py-0 ${i === 0 ? 'md:pl-0' : ''} ${i > 0 ? 'border-t border-border md:border-l md:border-t-0' : ''}`}
              >
                <dt className={`order-2 ${BODY}`}>{stat.label}</dt>
                <dd className={`order-1 ${STAT} text-accent-text`}>
                  <CountUp value={stat.value} reduced={reduced} />
                </dd>
              </div>
            ))}
          </dl>

          <a
            href="#problem"
            className="group inline-flex min-h-12 items-center gap-2 self-start rounded-md px-1 text-base font-medium text-text-muted hover:text-text md:self-auto"
          >
            {HERO_COPY.scroll}
            <ArrowDown className="transition-transform duration-200 group-hover:translate-y-1" />
          </a>
        </div>
      </div>
    </section>
  );
}
