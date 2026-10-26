import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Reads the color tokens declared in one CSS block, such as :root or :root.dark. */
function readTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing block ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

// Each pair: [foreground token, background token, minimum ratio]. Text needs 4.5:1 (WCAG AA);
// form control borders and focus rings need 3:1 against what they sit on (WCAG 1.4.11). Decorative
// card borders (--border) are subtle by design and are not checked.
const PAIRS: Array<[string, string, number]> = [
  ['text', 'surface', 4.5],
  ['text', 'surface-2', 4.5],
  ['text', 'page', 4.5],
  ['text-muted', 'page', 4.5],
  ['text', 'surface-2', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-2', 4.5],
  ['accent-text', 'surface', 4.5],
  ['accent-text', 'surface-2', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['border-strong', 'surface', 3],
  ['border-strong', 'page', 3],
  ['focus', 'surface', 3],
  ['focus', 'page', 3],
];

describe('theme tokens meet WCAG AA contrast', () => {
  for (const [mode, selector] of [
    ['light', ':root'],
    ['dark', ':root.dark'],
  ] as const) {
    it(`${mode} pairs`, () => {
      const tokens = readTokens(css, selector);
      for (const [fg, bg, min] of PAIRS) {
        expect(tokens[fg], `${mode} token --${fg}`).toBeDefined();
        expect(tokens[bg], `${mode} token --${bg}`).toBeDefined();
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        expect(ratio, `${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
