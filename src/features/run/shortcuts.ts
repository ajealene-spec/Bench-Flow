/*
 * Keyboard shortcuts for advanced run mode. The mapping is pure so it can be tested without a DOM.
 */

export type ShortcutAction = 'next' | 'back' | 'toggle-timer' | 'complete' | 'help';

export interface ShortcutContext {
  /** True when focus is in a text field, where typing must not trigger shortcuts. */
  editable: boolean;
  /** Ctrl, Cmd or Alt held. Those belong to the browser, so no shortcut applies. Shift is allowed ("?" needs it). */
  modifier: boolean;
}

export const SHORTCUT_HELP: Array<{ keys: string; action: string }> = [
  { keys: 'n or →', action: 'Next step' },
  { keys: 'p or ←', action: 'Previous step' },
  { keys: 'Space', action: 'Start or stop the current step timer' },
  { keys: 'c', action: 'Mark the current step complete' },
  { keys: '?', action: 'Show or hide this list' },
];

/** Returns the action for a key press, or null when the key should be left alone. */
export function shortcutFor(key: string, context: ShortcutContext): ShortcutAction | null {
  if (context.editable || context.modifier) return null;
  switch (key) {
    case 'n':
    case 'ArrowRight':
      return 'next';
    case 'p':
    case 'ArrowLeft':
      return 'back';
    case ' ':
    case 'Spacebar':
      return 'toggle-timer';
    case 'c':
      return 'complete';
    case '?':
      return 'help';
    default:
      return null;
  }
}

/** True when an element is a text field or can take typed text. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    // Checkboxes, radios and buttons do not take text, so shortcuts still work when they are focused.
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
  }
  return false;
}
