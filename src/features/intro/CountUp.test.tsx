import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountUp } from './CountUp';
import { HERO_STATS } from './introContent';

describe('CountUp', () => {
  it('server markup shows the final value, so nothing is blank before scripts run', () => {
    for (const stat of HERO_STATS) {
      const html = renderToStaticMarkup(<CountUp value={stat.value} reduced={false} />);
      expect(html).toContain(`>${stat.value}<`);
    }
  });

  it('keeps the final value under reduced motion', () => {
    const html = renderToStaticMarkup(<CountUp value="100%" reduced />);
    expect(html).toBe('<span>100%</span>');
  });
});
