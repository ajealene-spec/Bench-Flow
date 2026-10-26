import { describe, expect, it } from 'vitest';
import { describeVoiceCommand, parseVoiceCommand } from './voiceCommands';

describe('parseVoiceCommand', () => {
  it('recognizes navigation phrases regardless of case, spacing or trailing punctuation', () => {
    expect(parseVoiceCommand('Next.')).toEqual({ type: 'next' });
    expect(parseVoiceCommand('  next   step  ')).toEqual({ type: 'next' });
    expect(parseVoiceCommand('Back')).toEqual({ type: 'back' });
    expect(parseVoiceCommand('previous step!')).toEqual({ type: 'back' });
  });

  it('recognizes timer phrases', () => {
    expect(parseVoiceCommand('start timer')).toEqual({ type: 'start-timer' });
    expect(parseVoiceCommand('Start the timer')).toEqual({ type: 'start-timer' });
    expect(parseVoiceCommand('stop timer')).toEqual({ type: 'stop-timer' });
    expect(parseVoiceCommand('pause my timer')).toEqual({ type: 'stop-timer' });
  });

  it('recognizes repeat and read-step phrases', () => {
    expect(parseVoiceCommand('repeat')).toEqual({ type: 'read-step' });
    expect(parseVoiceCommand('Read step')).toEqual({ type: 'read-step' });
    expect(parseVoiceCommand('read this step')).toEqual({ type: 'read-step' });
  });

  it('keeps the dictated note text as spoken', () => {
    expect(parseVoiceCommand('add note Pellet was pink, Looks OK.')).toEqual({
      type: 'add-note',
      text: 'Pellet was pink, Looks OK.',
    });
    expect(parseVoiceCommand('Add a note: 25 microliters loaded')).toEqual({
      type: 'add-note',
      text: '25 microliters loaded',
    });
  });

  it('returns null for an empty note or unknown speech', () => {
    expect(parseVoiceCommand('add note')).toBeNull();
    expect(parseVoiceCommand('add note   ')).toBeNull();
    expect(parseVoiceCommand('what time is it')).toBeNull();
    expect(parseVoiceCommand('   ')).toBeNull();
    expect(parseVoiceCommand('nextdoor')).toBeNull();
  });
});

describe('describeVoiceCommand', () => {
  it('gives a confirmation for every command type', () => {
    expect(describeVoiceCommand({ type: 'next' })).toBe('Next step');
    expect(describeVoiceCommand({ type: 'add-note', text: 'x' })).toBe('Note added');
  });
});
