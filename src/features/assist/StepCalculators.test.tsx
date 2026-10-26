import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import type { Step } from '../../types';
import { StepCalculators } from './StepCalculators';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wbStep: Step = {
  id: 'step-primary',
  title: 'Primary antibody incubation',
  instructions: 'Dilute primary antibody (anti-GAPDH) 1:1000 in 10 mL of 5% milk in TBST. Incubate overnight at 4 °C.',
  timers: [],
  reagents: [],
  dataFields: [],
  cautions: [],
};

let container: HTMLDivElement;
let root: Root;

function buttonWithText(text: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  if (!match) throw new Error(`No button "${text}"`);
  return match;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

async function render(step: Step) {
  await act(async () => {
    root.render(<StepCalculators step={step} experimentId="exp-1" />);
  });
}

beforeEach(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await db.stepRecords.clear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('StepCalculators', () => {
  it('shows a prefilled antibody calculator with its result', async () => {
    await render(wbStep);
    const card = container.querySelector('section[aria-label="Calculator: Antibody dilution 1:N"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Primary antibody volume');
    expect(card?.textContent).toContain('10 µL');
    expect(card?.textContent).toContain('9990 µL');
  });

  it('saves the main result as a number record on the step', async () => {
    await render(wbStep);
    await click(buttonWithText('Save to step'));
    // Dexie writes asynchronously, so wait for the status line instead of assuming the write is done.
    for (let i = 0; i < 50 && !container.textContent?.includes('Saved to this step.'); i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }

    const records = await db.stepRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      experimentId: 'exp-1',
      stepId: 'step-primary',
      kind: 'number',
      label: 'Primary antibody volume',
      value: 10,
      unit: 'µL',
    });
    expect(records[0].note).toContain('1:1000');
    expect(container.textContent).toContain('Saved to this step.');
  });

  it('collapses and expands a card', async () => {
    await render(wbStep);
    const toggle = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Save to step');
  });

  it('adds any calculator by hand from the + Calculator menu', async () => {
    await render({ ...wbStep, id: 'plain', instructions: 'Rinse the membrane briefly.' });
    expect(container.textContent).toContain('No calculation detected for this step.');

    await click(buttonWithText('+ Calculator'));
    const item = Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent === 'Serial dilution');
    expect(item).toBeDefined();
    await click(item as HTMLElement);

    expect(container.querySelector('section[aria-label="Calculator: Serial dilution"]')).not.toBeNull();
    expect(container.textContent).toContain('Start');
  });

  it('shows the input error instead of a result when a number is missing', async () => {
    await render({ ...wbStep, id: 'plain', instructions: 'Rinse the membrane briefly.' });
    await click(buttonWithText('+ Calculator'));
    const item = Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent === 'Master mix');
    await click(item as HTMLElement);
    const save = buttonWithText('Save to step');
    expect(save.disabled).toBe(true);
    expect(container.textContent).toContain('Add at least one component');
  });
});
