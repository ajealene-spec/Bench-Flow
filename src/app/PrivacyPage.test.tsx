import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPage, { PRIVACY_ISSUES_URL } from './PrivacyPage';

describe('PrivacyPage', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );

  it('states the core promises in plain language', () => {
    expect(html).toContain('Your data stays on your device');
    expect(html).toContain('No tracking or analytics');
    expect(html).toContain('does not store your text or your key');
  });

  it('links to the GitHub issues page for contact', () => {
    expect(PRIVACY_ISSUES_URL).toBe('https://github.com/ajealene-spec/Bench-Flow/issues');
    expect(html).toContain(`href="${PRIVACY_ISSUES_URL}"`);
  });
});
