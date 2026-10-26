import { describe, expect, it } from 'vitest';
import { cleanExtractedText, pageToLines, reconstructPages, type PdfTextItem } from './pdfText';

/** A run of text at (x, y) with a rough width of 6 points per character. */
function run(str: string, x: number, y: number): PdfTextItem {
  return { str, x, y, width: str.length * 6, height: 10 };
}

describe('pageToLines', () => {
  it('joins runs on the same baseline left to right and keeps lines top to bottom', () => {
    const lines = pageToLines({
      width: 612,
      items: [
        run('2.', 72, 600),
        run('Add buffer', 90, 600),
        run('1.', 72, 700),
        run('Thaw', 90, 700),
        run('reagents', 120, 700),
      ],
    });
    expect(lines).toEqual(['1. Thaw reagents', '2. Add buffer']);
  });

  it('reads two columns column by column between full-width lines', () => {
    const left = (text: string, y: number) => run(text, 50, y);
    const right = (text: string, y: number) => run(text, 330, y);
    const lines = pageToLines({
      width: 600,
      items: [
        { ...run('Western blot protocol', 50, 750), width: 500 },
        left('Left one', 700),
        right('Right one', 700),
        left('Left two', 686),
        right('Right two', 686),
        left('Left three', 672),
        right('Right three', 672),
        left('Left four', 658),
        right('Right four', 658),
      ],
    });
    expect(lines).toEqual([
      'Western blot protocol',
      'Left one',
      'Left two',
      'Left three',
      'Left four',
      'Right one',
      'Right two',
      'Right three',
      'Right four',
    ]);
  });

  it('does not treat a single column of ragged text as two columns', () => {
    const lines = pageToLines({
      width: 600,
      items: [
        run('Line one of the text', 50, 700),
        run('Line two of the text', 50, 686),
        run('short', 50, 672),
        run('tail words that reach the middle of the page', 50, 658),
      ],
    });
    expect(lines).toEqual([
      'Line one of the text',
      'Line two of the text',
      'short',
      'tail words that reach the middle of the page',
    ]);
  });
});

describe('cleanExtractedText', () => {
  it('removes headers and footers that repeat on most pages, keeping distinct lines', () => {
    const text = [
      'Lab Guide Rev 2',
      'Procedure step one.',
      '2',
      '[[page 2]]',
      'Lab Guide Rev 2',
      'Procedure step two.',
      '3',
      '[[page 3]]',
      'Lab Guide Rev 2',
      'Procedure step three.',
      '4',
    ].join('\n');
    expect(cleanExtractedText(text)).toBe('Procedure step one.\nProcedure step two.\nProcedure step three.');
  });

  it('removes page numbers such as "Page 2 of 9" when the number changes per page', () => {
    const text = ['Step A.', '[[page 2]]', 'Page 2 of 3', 'Step B.', '[[page 3]]', 'Page 3 of 3', 'Step C.'].join('\n');
    expect(cleanExtractedText(text)).toBe('Step A.\nStep B.\nStep C.');
  });

  it('drops URLs, copyright lines and figure captions', () => {
    const text = [
      'Dilute the antibody as described at https://example.com/datasheet.',
      'For more information, visit www.example.com/protocols',
      '© 2026 Example Co. All rights reserved.',
      'Figure 3. Membrane layout',
      'Incubate for 1 h.',
    ].join('\n');
    expect(cleanExtractedText(text)).toBe('Dilute the antibody as described at\nIncubate for 1 h.');
  });

  it('joins a word hyphenated across a line break', () => {
    expect(cleanExtractedText('Blot the mem-\nbrane for 1 h.')).toBe('Blot the membrane for 1 h.');
    expect(cleanExtractedText('Use 10-\nfold dilution.')).toBe('Use 10-\nfold dilution.');
  });
});

describe('reconstructPages', () => {
  it('builds clean text from positioned items across pages', () => {
    const header = run('Guide header', 50, 780);
    const text = reconstructPages([
      { width: 600, items: [header, run('1. Block membrane', 50, 700)] },
      { width: 600, items: [header, run('2. Wash membrane', 50, 700)] },
      { width: 600, items: [header, run('3. Detect signal', 50, 700)] },
    ]);
    expect(text).toBe('1. Block membrane\n2. Wash membrane\n3. Detect signal');
  });
});
