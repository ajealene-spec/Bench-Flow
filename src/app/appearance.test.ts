import { describe, expect, it } from 'vitest';
import { applyAppearance, resolveTheme } from './appearance';

describe('resolveTheme', () => {
  it('keeps explicit choices and follows the system only for "system"', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('applyAppearance', () => {
  it('sets the dark class and the dyslexia font class on the root element', () => {
    const root = document.createElement('html');
    applyAppearance({ theme: 'dark', dyslexiaFont: true }, root, false);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('font-dyslexia')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');

    applyAppearance({ theme: 'light', dyslexiaFont: false }, root, true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('font-dyslexia')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});
