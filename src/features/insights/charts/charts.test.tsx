import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarPlot } from './BarPlot';
import { LinePlot } from './LinePlot';
import { StripPlot } from './StripPlot';

const table = { headers: ['A', 'B'], rows: [['x', 1]] };

describe('chart markup', () => {
  it('LinePlot labels the SVG with a title and description and draws the band', () => {
    const html = renderToStaticMarkup(
      <LinePlot
        title="Concentration"
        desc="Three runs"
        xLabel="Run"
        yLabel="mg/mL"
        points={[
          { x: 0, y: 2, label: 'r1' },
          { x: 1, y: 3, label: 'r2' },
        ]}
        xTicks={[{ value: 0, label: 'Jan 1' }]}
        band={{ mean: 2.5, sd: 0.5 }}
        table={table}
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('<title id=');
    expect(html).toContain('Concentration');
    expect(html).toContain('fill-opacity="0.14"');
    expect(html).toContain('var(--accent-text)');
    expect(html).toContain('Show data table');
  });

  it('BarPlot renders one bar per row with a tooltip carrying the note', () => {
    const html = renderToStaticMarkup(
      <BarPlot title="Timers" desc="Drift" valueLabel="%" bars={[{ label: 'Incubate overnight step', value: 12.5, note: '1 of 2 outside 10%' }]} table={table} />,
    );
    expect(html).toContain('Incubate overnigh…');
    expect(html).toContain('1 of 2 outside 10%');
  });

  it('StripPlot shows the reference line label', () => {
    const html = renderToStaticMarkup(
      <StripPlot
        title="Ra and Rm"
        desc="Cells"
        yLabel="MΩ"
        groups={[
          { label: 'Ra', values: [{ value: 12, label: 'r1, c1' }] },
          { label: 'Rm', values: [{ value: 300, label: 'r1, c1' }] },
        ]}
        reference={{ value: 25, label: '25 MΩ' }}
        table={table}
      />,
    );
    expect(html).toContain('25 MΩ');
    expect(html).toContain('stroke-dasharray="5 4"');
  });
});
