import { describe, expect, it } from 'vitest';
import { needsWelcome } from './welcomeOptions';

describe('needsWelcome', () => {
  it('shows the welcome until onboarding is finished', () => {
    expect(needsWelcome('/', undefined)).toBe(true);
    expect(needsWelcome('/library', undefined)).toBe(true);
    expect(needsWelcome('/', 1234)).toBe(false);
  });

  it('never blocks the welcome itself or the About page', () => {
    expect(needsWelcome('/welcome', undefined)).toBe(false);
    expect(needsWelcome('/about', undefined)).toBe(false);
  });

  it('keeps the shared-protocol page open too, and ignores a trailing slash', () => {
    expect(needsWelcome('/shared', undefined)).toBe(false);
    expect(needsWelcome('/about/', undefined)).toBe(false);
    expect(needsWelcome('/library/', undefined)).toBe(true);
  });

  it('does not trap a user who has finished onboarding on any route', () => {
    for (const path of ['/', '/animals', '/experiment/abc/report', '/welcome']) {
      expect(needsWelcome(path, 1)).toBe(false);
    }
  });
});
