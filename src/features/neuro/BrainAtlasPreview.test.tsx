import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALLEN_ATLAS_URL, BrainAtlasPreview } from './BrainAtlasPreview';

describe('BrainAtlasPreview', () => {
  it('labels the views as schematic and links out to the Allen atlas', () => {
    const html = renderToStaticMarkup(<BrainAtlasPreview ap={-2} ml={1.5} dv={3} angleDeg={10} />);
    expect(html).toContain('Schematic, not to scale');
    expect(html).toContain('Open in Allen Brain Atlas');
    expect(html).toContain(`href="${ALLEN_ATLAS_URL}"`);
    expect(html).toContain('Common Coordinate Framework');
    expect(html).toContain('Bregma');
    expect(html).toContain('Lambda');
    expect(html).toContain('10° approach');
  });

  it('warns when the target is outside the schematic and omits the target without numbers', () => {
    const warned = renderToStaticMarkup(<BrainAtlasPreview ap={9} />);
    expect(warned).toContain('outside the schematic');
    const empty = renderToStaticMarkup(<BrainAtlasPreview />);
    expect(empty).not.toContain('Target AP');
    expect(empty).toContain('Bregma');
  });
});
