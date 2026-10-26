import { describe, expect, it } from 'vitest';
import { isEditableTarget, shortcutFor, type ShortcutContext } from './shortcuts';

const plain: ShortcutContext = { editable: false, modifier: false };

describe('shortcutFor', () => {
  it('maps the documented keys', () => {
    expect(shortcutFor('n', plain)).toBe('next');
    expect(shortcutFor('ArrowRight', plain)).toBe('next');
    expect(shortcutFor('p', plain)).toBe('back');
    expect(shortcutFor('ArrowLeft', plain)).toBe('back');
    expect(shortcutFor(' ', plain)).toBe('toggle-timer');
    expect(shortcutFor('c', plain)).toBe('complete');
    expect(shortcutFor('?', plain)).toBe('help');
  });

  it('ignores keys that are not shortcuts', () => {
    expect(shortcutFor('x', plain)).toBeNull();
    expect(shortcutFor('Enter', plain)).toBeNull();
    expect(shortcutFor('ArrowUp', plain)).toBeNull();
  });

  it('does nothing while typing in a text field', () => {
    expect(shortcutFor('n', { editable: true, modifier: false })).toBeNull();
    expect(shortcutFor(' ', { editable: true, modifier: false })).toBeNull();
  });

  it('leaves browser shortcuts (Ctrl, Cmd, Alt) alone', () => {
    expect(shortcutFor('c', { editable: false, modifier: true })).toBeNull();
    expect(shortcutFor('n', { editable: false, modifier: true })).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('treats text inputs and textareas as editable, buttons and checkboxes as not', () => {
    const input = { tagName: 'INPUT', type: 'text', isContentEditable: false } as unknown as HTMLElement;
    const checkbox = { tagName: 'INPUT', type: 'checkbox', isContentEditable: false } as unknown as HTMLElement;
    const textarea = { tagName: 'TEXTAREA', isContentEditable: false } as unknown as HTMLElement;
    const button = { tagName: 'BUTTON', isContentEditable: false } as unknown as HTMLElement;
    const editable = { tagName: 'DIV', isContentEditable: true } as unknown as HTMLElement;
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
