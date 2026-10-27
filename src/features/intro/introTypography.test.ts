import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Keeps the intro on its five type roles. Scans every intro source file for font sizes and weights outside the
 * shared scale. Overline, section title, card title, body and stat are the only roles.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(DIR).filter((f) => /\.(tsx|ts)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

// Sizes the roles use. The hero display headline also uses 4xl, 5xl and 7xl.
const ALLOWED_SIZES = new Set(['xs', 'base', 'lg', '3xl', '4xl', '5xl', '7xl']);
// Tailwind size names. Other text-* tokens are colors or alignment and are checked elsewhere.
const SIZE_NAME = /^(xs|sm|base|lg|xl|\d?xl)$/;
const ALLOWED_WEIGHTS = new Set(['light', 'normal', 'medium', 'semibold']);

function classTokens(source: string, prefix: string): string[] {
  const pattern = new RegExp(`(?<![\\w-])${prefix}-(\\[[^\\]\\s"'\`]+\\]|[a-z0-9]+)(?![\\w-])`, 'g');
  return Array.from(source.matchAll(pattern), (m) => m[1]);
}

describe('intro typography', () => {
  it('finds the intro source files', () => {
    expect(SOURCES.length).toBeGreaterThan(5);
    expect(SOURCES).not.toContain('AudienceSpectrum.tsx');
  });

  it('uses only the five type roles for font sizes', () => {
    for (const file of SOURCES) {
      const source = readFileSync(join(DIR, file), 'utf8');
      for (const size of classTokens(source, 'text').filter((t) => t.startsWith('[') || SIZE_NAME.test(t))) {
        expect(size.startsWith('[') ? `arbitrary ${size}` : ALLOWED_SIZES.has(size) ? 'ok' : size, `${file}: text-${size}`).toBe('ok');
      }
    }
  });

  it('uses only the allowed font weights, with no bold or extrabold', () => {
    for (const file of SOURCES) {
      const source = readFileSync(join(DIR, file), 'utf8');
      for (const weight of classTokens(source, 'font')) {
        expect(ALLOWED_WEIGHTS.has(weight), `${file}: font-${weight}`).toBe(true);
      }
    }
  });
});
