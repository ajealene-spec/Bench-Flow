import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OPT_OUT_KEY,
  dismissKeyFor,
  dismissLiteratureFor,
  isLiteratureDismissedFor,
  isLiteratureOptedOut,
  optOutOfLiterature,
  shouldOfferLiterature,
} from './literatureOptOut';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('literature opt-out', () => {
  it('offers the card by default', () => {
    expect(isLiteratureOptedOut()).toBe(false);
    expect(shouldOfferLiterature('t1')).toBe(true);
  });

  it('"Don\'t ask again" stores the global flag and hides the card for every template', () => {
    optOutOfLiterature();
    expect(localStorage.getItem(OPT_OUT_KEY)).toBe('1');
    expect(shouldOfferLiterature('t1')).toBe(false);
    expect(shouldOfferLiterature('t2')).toBe(false);
  });

  it('"No thanks" only hides the card for that template', () => {
    dismissLiteratureFor('t1');
    expect(localStorage.getItem(dismissKeyFor('t1'))).toBe('1');
    expect(isLiteratureDismissedFor('t1')).toBe(true);
    expect(shouldOfferLiterature('t1')).toBe(false);
    expect(shouldOfferLiterature('t2')).toBe(true);
  });

  it('treats any other stored value as not opted out', () => {
    localStorage.setItem(OPT_OUT_KEY, 'no');
    expect(isLiteratureOptedOut()).toBe(false);
  });

  it('does not throw when localStorage throws, and falls back to offering the card', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', broken);
    expect(() => optOutOfLiterature()).not.toThrow();
    expect(() => dismissLiteratureFor('t1')).not.toThrow();
    expect(isLiteratureOptedOut()).toBe(false);
    expect(shouldOfferLiterature('t1')).toBe(true);
  });
});
