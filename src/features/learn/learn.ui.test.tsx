import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlossaryText } from './GlossaryText';
import { RridField } from '../neuro/RridField';

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

describe('GlossaryText', () => {
  it('underlines a known term and opens its definition on tap', async () => {
    await act(async () => root.render(<GlossaryText text="Wash in TBST for 5 min." />));
    const button = container.querySelector('button[aria-label="TBST: definition"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('TBST');
    expect(container.textContent).toContain('Wash in ');
    await act(async () => button.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Tween');
  });
});

describe('RridField', () => {
  it('shows an error for a malformed RRID and does not save it', async () => {
    let saved: string | null = null;
    await act(async () =>
      root.render(<RridField value="" onChange={(v) => (saved = v)} searchName="anti GFAP" />),
    );
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'RRID:AB_xyz');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Check and save')!;
    await act(async () => save.click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(saved).toBeNull();
    expect(container.querySelector('a[href*="scicrunch.org"]')).not.toBeNull();
  });
});
