import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Step } from '../../types';
import { StepText } from './StepText';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const step: Step = {
  id: 'step-ab',
  title: 'Primary antibody',
  instructions: 'Dilute primary antibody 1:1000 in 10 mL of 5% milk in TBST.',
  timers: [],
  reagents: [],
  dataFields: [],
  cautions: [],
};

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

async function render(target: Step) {
  await act(async () => {
    root.render(<StepText step={target} textClassName="text-base" />);
  });
}

function chip(label: string): HTMLElement {
  const match = container.querySelector<HTMLElement>(`[aria-label^="${label}"]`);
  if (!match) throw new Error(`No chip starting "${label}"`);
  return match;
}

describe('StepText', () => {
  it('shows each quantity as a chip, with the derived volume calculated', async () => {
    await render(step);
    expect(container.textContent).toContain('Dilute primary antibody');
    expect(chip('1:1000').tagName).toBe('BUTTON');
    expect(chip('primary antibody volume').textContent).toBe('10 µL');
    expect(chip('primary antibody volume').tagName).toBe('SPAN');
  });

  it('gives input chips a 48px minimum touch target', async () => {
    await render(step);
    expect(chip('10 mL').className).toContain('min-h-12');
  });

  it('updates the derived value when an input is typed in, and marks it changed with the plan', async () => {
    await render(step);
    await act(async () => chip('1:1000').click());
    const field = container.querySelector<HTMLInputElement>('input[aria-label="New value for 1:1000"]');
    expect(field?.getAttribute('inputmode')).toBe('decimal');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(field, '500');
      field?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      field?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      field?.blur();
    });

    const derived = chip('primary antibody volume');
    expect(derived.textContent).toBe('20 µL');
    expect(derived.className).toContain('text-accent');
    expect(derived.getAttribute('aria-label')).toContain('Planned 10 µL');
  });
});
