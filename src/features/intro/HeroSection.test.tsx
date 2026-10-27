import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HeroSection } from './HeroSection';
import { HERO_COPY, HERO_STATS } from './introContent';

function render(reduced = false): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <HeroSection reduced={reduced} />
    </MemoryRouter>,
  );
}

describe('HeroSection', () => {
  it('renders the two-line headline, tagline and description', () => {
    const html = render();
    expect(html).toContain('id="hero-title"');
    for (const line of HERO_COPY.headlineLines) expect(html).toContain(line);
    expect(html).toContain(HERO_COPY.tagline);
    expect(html).toContain(HERO_COPY.description);
  });

  it('links the primary CTA to / and the secondary to /demo', () => {
    const html = render();
    expect(html).toMatch(/href="\/"[^>]*>Enter the lab/);
    expect(html).toMatch(/href="\/demo"[^>]*>Take the 2-minute tour/);
  });

  it('renders every stat and the scroll link to the next section', () => {
    const html = render();
    for (const stat of HERO_STATS) {
      expect(html).toContain(stat.value);
      expect(html).toContain(stat.label.replace(/&/g, '&amp;'));
    }
    expect(html).toContain(HERO_COPY.scroll);
    expect(html).toContain('href="#problem"');
  });

  it('keeps the helix decorative, and the entrance animation is class-based so reduced motion can switch it off', () => {
    const html = render(true);
    expect(html).toMatch(/aria-hidden="true" class="pointer-events-none/);
    expect(html).toContain('hero-rise');
    expect(html).not.toMatch(/<animate /);
  });
});
