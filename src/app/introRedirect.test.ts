import { describe, expect, it } from 'vitest';
import { INTRO_SEEN_KEY, hasSeenIntro, markIntroSeen, shouldRedirectToIntro, type KeyValueStorage } from './introRedirect';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('shouldRedirectToIntro', () => {
  it('redirects a first-time visitor from the home route', () => {
    expect(shouldRedirectToIntro('/', memoryStorage())).toBe(true);
  });

  it('does not redirect once the flag is set', () => {
    expect(shouldRedirectToIntro('/', memoryStorage({ [INTRO_SEEN_KEY]: '1' }))).toBe(false);
  });

  it('only applies to the home route', () => {
    expect(shouldRedirectToIntro('/intro', memoryStorage())).toBe(false);
    expect(shouldRedirectToIntro('/library', memoryStorage())).toBe(false);
  });

  it('does not trap the visitor when storage is blocked', () => {
    expect(shouldRedirectToIntro('/', throwingStorage)).toBe(false);
    expect(shouldRedirectToIntro('/', null)).toBe(false);
  });
});

describe('hasSeenIntro and markIntroSeen', () => {
  it('writes the flag under bf.introSeen', () => {
    const storage = memoryStorage();
    expect(hasSeenIntro(storage)).toBe(false);
    markIntroSeen(storage);
    expect(storage.data.get('bf.introSeen')).toBe('1');
    expect(hasSeenIntro(storage)).toBe(true);
  });

  it('does not throw when storage refuses the write', () => {
    expect(() => markIntroSeen(throwingStorage)).not.toThrow();
    expect(() => markIntroSeen(null)).not.toThrow();
  });
});
