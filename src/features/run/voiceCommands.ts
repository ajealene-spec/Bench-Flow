/*
 * Pure parser for run-mode voice commands. The Web Speech API hands over a transcript string;
 * this turns it into one command or null. Kept free of browser APIs so it can be tested directly.
 */

export type VoiceCommand =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'start-timer' }
  | { type: 'stop-timer' }
  | { type: 'read-step' }
  | { type: 'add-note'; text: string };

const NEXT = /^(next|next step|go next|go to next|forward|next please)$/;
const BACK = /^(back|previous|previous step|go back|go to previous)$/;
const START_TIMER = /^(start|begin|run) (the |a |my |this )?timer$/;
const STOP_TIMER = /^(stop|pause|cancel|end) (the |a |my |this )?timer$/;
const READ_STEP = /^(repeat|repeat step|say again|read step|read this step|read the step|read it)$/;
const NOTE_PREFIX = /^(?:add|make|take|record) (?:a |an )?note[:,]?\s+/i;

/**
 * Turns a transcript into a command. Matching ignores case, extra spaces and trailing punctuation
 * the recognizer adds. Returns null for anything it does not recognize, so stray speech does nothing.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const raw = transcript.trim();
  if (!raw) return null;

  // "add note ..." keeps the dictated text as spoken (case and punctuation), only trimmed.
  const note = raw.match(NOTE_PREFIX);
  if (note) {
    const body = raw.slice(note[0].length).trim();
    return body ? { type: 'add-note', text: body } : null;
  }

  const phrase = raw
    .toLowerCase()
    .replace(/[.!?,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (NEXT.test(phrase)) return { type: 'next' };
  if (BACK.test(phrase)) return { type: 'back' };
  if (START_TIMER.test(phrase)) return { type: 'start-timer' };
  if (STOP_TIMER.test(phrase)) return { type: 'stop-timer' };
  if (READ_STEP.test(phrase)) return { type: 'read-step' };
  return null;
}

/** Short spoken and on-screen confirmation for each command. */
export function describeVoiceCommand(command: VoiceCommand): string {
  switch (command.type) {
    case 'next':
      return 'Next step';
    case 'back':
      return 'Previous step';
    case 'start-timer':
      return 'Starting timer';
    case 'stop-timer':
      return 'Stopping timer';
    case 'read-step':
      return 'Reading step';
    case 'add-note':
      return 'Note added';
  }
}
