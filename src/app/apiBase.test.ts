import { describe, expect, it } from 'vitest';
import { apiUrl, NATIVE_API_BASE } from './apiBase';

describe('apiUrl', () => {
  it('keeps relative paths in the browser', () => {
    expect(apiUrl('/api/parse', false)).toBe('/api/parse');
  });

  it('points at the Vercel deployment in the native app', () => {
    expect(apiUrl('/api/assist', true)).toBe(`${NATIVE_API_BASE}/api/assist`);
    expect(NATIVE_API_BASE).toBe('https://bench-flow.vercel.app');
  });
});
