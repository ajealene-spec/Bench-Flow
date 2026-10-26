import { describe, expect, it } from 'vitest';
import { appendNote, literatureNoteText, troubleshootNoteText } from './assistNotes';

const when = new Date('2026-10-26T09:00:00Z');

describe('appendNote', () => {
  it('keeps existing notes and adds the entry after a blank line', () => {
    expect(appendNote('First line\n', 'Entry')).toBe('First line\n\nEntry');
  });

  it('writes the entry alone when there are no notes yet', () => {
    expect(appendNote(undefined, 'Entry')).toBe('Entry');
    expect(appendNote('   ', 'Entry')).toBe('Entry');
  });
});

describe('troubleshootNoteText', () => {
  it('writes a dated summary with the top three causes', () => {
    const text = troubleshootNoteText(
      {
        causes: [
          { cause: 'A', evidence: '', adjustments: ['a1', 'a2'] },
          { cause: 'B', evidence: '', adjustments: ['b1'] },
          { cause: 'C', evidence: '', adjustments: ['c1'] },
          { cause: 'D', evidence: '', adjustments: ['d1'] },
        ],
        quickChecks: [],
      },
      { symptom: 'High background', problemText: 'grey', when },
    );
    expect(text.split('\n')[0]).toBe('[2026-10-26] Troubleshooting (High background)');
    expect(text).toContain('Problem: grey');
    expect(text).toContain('- A: a1 a2');
    expect(text).toContain('- C: c1');
    expect(text).not.toContain('- D:');
  });

  it('says so when there are no causes', () => {
    expect(troubleshootNoteText({ causes: [], quickChecks: ['x'] }, { when })).toContain('No specific causes suggested.');
  });
});

describe('literatureNoteText', () => {
  it('records the change, reason and sources without applying anything', () => {
    const text = literatureNoteText(
      {
        title: 'Longer blocking',
        change: 'Block 1 h',
        rationale: 'Less background',
        citations: [{ title: 'Paper', url: 'https://example.org/p' }],
      },
      when,
    );
    expect(text).toContain('[2026-10-26] Literature suggestion: Longer blocking');
    expect(text).toContain('Change: Block 1 h');
    expect(text).toContain('Sources: Paper (https://example.org/p)');
  });
});
