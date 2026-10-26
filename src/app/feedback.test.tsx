import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addToast, askConfirm, FeedbackProvider, MAX_TOASTS, toastDuration } from './feedback';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('toast queue', () => {
  it('keeps only the newest toasts', () => {
    let list: ReturnType<typeof addToast> = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = addToast(list, { id: i, message: `m${i}` });
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[0].id).toBe(3);
  });

  it('stays longer when it offers an action such as Undo', () => {
    expect(toastDuration({})).toBeLessThan(toastDuration({ actionLabel: 'Undo' }));
  });
});

describe('askConfirm', () => {
  it('answers no when no provider is mounted, so nothing is deleted silently', async () => {
    await expect(askConfirm({ title: 'Delete?' })).resolves.toBe(false);
  });

  it('resolves true when the confirm button is pressed and shows an accessible alert dialog', async () => {
    let answer: Promise<boolean> | undefined;
    await act(async () =>
      root.render(
        <FeedbackProvider>
          <button type="button" onClick={() => (answer = askConfirm({ title: 'Delete this photo?', confirmLabel: 'Delete', danger: true }))}>
            open
          </button>
        </FeedbackProvider>,
      ),
    );
    await act(async () => container.querySelector('button')!.click());
    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    // Destructive prompts start with Cancel focused.
    expect(document.activeElement?.textContent).toBe('Cancel');

    const deleteButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Delete') as HTMLButtonElement;
    await act(async () => deleteButton.click());
    await expect(answer).resolves.toBe(true);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('resolves false on Escape', async () => {
    let answer: Promise<boolean> | undefined;
    await act(async () =>
      root.render(
        <FeedbackProvider>
          <button type="button" onClick={() => (answer = askConfirm({ title: 'Restore?' }))}>
            open
          </button>
        </FeedbackProvider>,
      ),
    );
    await act(async () => container.querySelector('button')!.click());
    const dialog = container.querySelector('[role="alertdialog"]') as HTMLElement;
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(answer).resolves.toBe(false);
  });
});
