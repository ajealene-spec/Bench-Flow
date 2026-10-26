import { describe, expect, it } from 'vitest';
import { corsHeaders } from './cors';
import { API_KEY_HEADER } from './apiKey';

describe('corsHeaders', () => {
  it('allows the Capacitor and localhost app origins', () => {
    for (const origin of ['capacitor://localhost', 'https://localhost']) {
      const headers = corsHeaders(origin);
      expect(headers['Access-Control-Allow-Origin']).toBe(origin);
      expect(headers['Access-Control-Allow-Headers']).toContain(API_KEY_HEADER);
      expect(headers['Access-Control-Allow-Headers']).toContain('content-type');
    }
  });

  it('sends nothing for other origins', () => {
    expect(corsHeaders('https://evil.example')).toEqual({});
    expect(corsHeaders('http://localhost')).toEqual({});
    expect(corsHeaders(undefined)).toEqual({});
  });
});
