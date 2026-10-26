// Bench Flow QA: user flows at 375, 820 and 1440 widths (Playwright, headless).
// Usage: PW_MODULE=/abs/path/to/node_modules/playwright/index.mjs OUT_DIR=/abs/dir node tests/qa/bench-flow-qa.mjs
// Expects the dev server at BASE (default http://localhost:5180). Prints JSON.
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:5180';
const OUT = process.env.OUT_DIR ?? './qa-out';
const WIDTHS = [
  { name: '375', width: 375, height: 812 },
  { name: '820', width: 820, height: 1180 },
  { name: '1440', width: 1440, height: 900 },
];
const TITLE = 'QA WB methanol SDS';
const RUN = 'QA run ' + Date.now().toString().slice(-5);

const NUMBER = '42.5';
const TEXT = [
  '1. Prepare 10 mL of 10% SDS running buffer and 100 mL methanol transfer buffer. Caution: wear gloves.',
  '2. Load 20 ug protein per lane and run the SDS-PAGE gel at 120 V for 1 h.',
  '3. Transfer to PVDF membrane in cold methanol buffer for 1 h at 100 V.',
  '4. Block membrane in 5% milk for 1 h at room temperature.',
].join('\n');

const results = [];
const audits = [];
const consoleErrs = [];
const rec = (w, id, name, ok, detail = '') => results.push({ w, id, name, ok, detail: String(detail).slice(0, 220) });

async function step(w, id, name, fn) {
  try { const d = await fn(); rec(w, id, name, true, d ?? ''); }
  catch (e) { rec(w, id, name, false, String(e.message).split('\n')[0]); }
}

async function audit(page, w, label) {
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=checkbox]')];
    const small = [];
    for (const el of els) {
      if (el.closest('.sr-only')) continue;
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (s.display === 'none' || s.visibility === 'hidden' || b.width === 0 || b.height === 0) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (b.width < 24) small.push('checkbox ' + Math.round(b.width)); continue; }
      if (b.height < 48 || b.width < 48) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { small, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  audits.push({ w, label, small: r.small.length, smallList: r.small.slice(0, 4), overflow: r.overflow });
}

async function run(vp) {
  const w = vp.name;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_CONNECTION_REFUSED/.test(m.text())) consoleErrs.push(`[${w}] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => consoleErrs.push(`[${w}] pageerror ${e.message.slice(0, 160)}`));
  const snap = (n) => page.screenshot({ path: `${OUT}/${w}-${n}.png`, fullPage: true }).catch(() => {});

  let url = '';
  let expId = '';
  let tplId = '';

  // 1. Template by paste
  await step(w, '1a', 'Paste Western blot text and parse', async () => {
    await page.goto(BASE + '/library/new');
    await page.locator('#procedure-text').fill(TEXT);
    await page.getByRole('button', { name: 'Parse steps' }).click();
    await page.getByRole('status').filter({ hasText: 'Parsed with' }).waitFor();
    await audit(page, w, 'import review');
    await snap('01-review');
    return 'parsed';
  });
  await step(w, '1b', 'Save template with title', async () => {
    await page.getByLabel('Protocol title').fill(TITLE);
    await page.getByRole('button', { name: 'Save protocol' }).click();
    await page.waitForURL(/\/library\/(?!new$)[^/]+$/);
    tplId = page.url().split('/library/')[1];
    return tplId;
  });

  // 2. Library shows it
  await step(w, '2', 'Protocol Library lists the template', async () => {
    await page.goto(BASE + '/library');
    const card = page.locator('li').filter({ hasText: TITLE }).first();
    await card.waitFor();
    await audit(page, w, 'library');
    await snap('02-library');
    return 'listed';
  });

  // 3. Start experiment
  await step(w, '3', 'Start experiment creates run and opens it', async () => {
    const card = page.locator('li').filter({ hasText: TITLE }).first();
    await card.getByRole('button', { name: 'Start experiment' }).click();
    await card.getByLabel('Run title').fill(RUN);
    await card.getByRole('button', { name: 'Start run' }).click();
    await page.waitForURL(/\/experiment\/[^/]+\/run$/);
    expId = page.url().split('/experiment/')[1].split('/')[0];
    return page.url();
  });

  // 4. Safety gate blocks step 1
  await step(w, '4a', 'Safety gate blocks step 1 until all items checked', async () => {
    const gate = page.getByRole('heading', { name: 'Safety & PPE checklist' });
    await gate.waitFor();
    const boxes = page.getByRole('checkbox');
    const n = await boxes.count();
    const confirm = page.getByRole('button', { name: 'Confirm and begin' });
    if (!(await confirm.isDisabled())) throw new Error('Confirm enabled with 0 checked');
    for (let i = 0; i < n - 1; i++) await boxes.nth(i).check();
    if (!(await confirm.isDisabled())) throw new Error(`Confirm enabled with ${n - 1}/${n} checked`);
    await audit(page, w, 'safety gate');
    await snap('03-gate-partial');
    await boxes.nth(n - 1).check();
    if (await confirm.isDisabled()) throw new Error('Confirm still disabled with all checked');
    return `${n} items; confirm disabled until last checked`;
  });
  await step(w, '4b', 'Confirm unlocks step 1', async () => {
    await page.getByRole('button', { name: 'Confirm and begin' }).click();
    await page.getByRole('heading', { name: 'Safety & PPE checklist' }).waitFor({ state: 'detached' });
    await page.getByText(/^Step 1 of 4$/).first().waitFor();
    await page.getByRole('button', { name: /Focus mode/ }).click();
    await page.getByRole('button', { name: 'Focus mode: Off' }).waitFor({ timeout: 4000 });
    await page.getByRole('button', { name: /Record data/ }).first().waitFor({ timeout: 4000 });
    return 'step 1 of 4 visible; focus off, data panel shown';
  });

  // 5. Calculator renders once per step
  let calcSnip = '';
  await step(w, '5', 'Step calculators render once', async () => {
    const counts = [];
    for (let s = 1; s <= 4; s++) {
      const n = await page.getByText('Calculator', { exact: false }).count();
      counts.push(n);
      if (s === 1) { const snip = await page.locator('main').evaluate(m => (m.innerText.match(/.{0,40}Calculator.{0,40}/g) || []).map(x => x.replace(/\n/g, ' / ')).join(' || ')); calcSnip = snip; }
      if (s < 4) { await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText(new RegExp(`^Step ${s + 1} of 4$`)).first().waitFor(); }
    }
    if (counts.every((c) => c === 0)) throw new Error('no calculator rendered on any step');
    await audit(page, w, 'run calc');
    return 'calc text counts per step: ' + counts.join(',') + ' | step1: ' + calcSnip.slice(0, 260);
  });

  // 6. Start timer
  await step(w, '6', 'Start timer on a step', async () => {
    await page.getByText(/^Step 2 of 4$/).first().waitFor().catch(async () => {
      await page.getByRole('button', { name: 'Back', exact: true }).click().catch(() => {});
    });
    const timer = page.getByRole('button', { name: /Start timer/ }).first();
    if (await timer.count() === 0) {
      // go to step 2 if timers are there
      await page.getByRole('button', { name: 'Next', exact: true }).click().catch(() => {});
    }
    const t = page.getByRole('button', { name: /Start timer/ }).first();
    await t.waitFor();
    const label = await t.innerText();
    await t.click();
    await page.getByText(/Running|remaining|left/i).first().waitFor({ timeout: 4000 }).catch(() => {});
    await snap('06-timer');
    return label.replace(/\s+/g, ' ');
  });

  // 7. Record a number on step 2
  await step(w, '7', 'Record a number on the step', async () => {
    await page.getByRole('button', { name: /Record data/ }).first().click({ timeout: 4000 }).catch(async (e) => { const labels = await page.locator('button').evaluateAll(bs => bs.map(x => x.textContent.trim().slice(0, 30))); throw new Error('no Record data button; ' + labels.join(' | ')); });
    const valueInput = page.locator('label').filter({ hasText: /^Value/ }).locator('input').first();
    await valueInput.fill(NUMBER);
    await page.locator('label').filter({ hasText: /^Label/ }).locator('input').first().fill('OD');
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await page.getByText(NUMBER).first().waitFor();
    await audit(page, w, 'record data');
    return 'saved ' + NUMBER;
  });

  // 8. Finish: complete every step
  await step(w, '8', 'Complete all steps and finish', async () => {
    const log = [];
    for (let k = 0; k < 4; k++) { const back = page.getByRole('button', { name: 'Back', exact: true }).first(); if (await back.isEnabled().catch(() => false)) await back.click(); }
    for (let i = 0; i < 8; i++) {
      const btn = page.getByRole('button', { name: /^Mark complete/ });
      const cur = (await page.getByText(/^Step \d+ of 4$/).first().innerText().catch(() => '?'));
      if (await btn.count() === 0) { log.push(cur + ' no-btn'); break; }
      const label = (await btn.first().innerText()).trim();
      log.push(cur + ' [' + label + ']');
      await btn.first().click();
      await page.waitForTimeout(300);
    }
    const link = page.getByRole('link', { name: 'View report' });
    if (!(await link.isVisible().catch(() => false))) throw new Error('no View report link; log: ' + log.join(' > '));
    await audit(page, w, 'run finished');
    await snap('08-finished');
    return 'finished: ' + log.join(' > ');
  });

  // 9. Report shows the number
  await step(w, '9', 'Report page shows recorded number', async () => {
    await page.goto(`${BASE}/experiment/${expId}/report`);
    await page.getByText(NUMBER).first().waitFor();
    await audit(page, w, 'report');
    await snap('09-report');
    return 'number present';
  });

  // 10. Inventory with expiry
  await step(w, '10', 'Inventory item with expiry shows badge', async () => {
    await page.goto(BASE + '/inventory');
    await page.getByRole('button', { name: 'Add item' }).click();
    const form = page.getByRole('form', { name: 'Add inventory item' });
    await form.waitFor();
    await form.getByLabel('Name', { exact: true }).fill('QA anti-GAPDH');
    await form.getByLabel('Expiry date').fill('2020-01-01');
    await form.getByRole('button', { name: 'Save' }).click();
    const row = page.getByText('QA anti-GAPDH').first();
    await row.waitFor();
    const body = await page.locator('main, body').first().innerText();
    const badge = /expired|expir/i.test(body);
    await audit(page, w, 'inventory');
    await snap('10-inventory');
    if (!badge) throw new Error('no expiry badge text on page');
    return 'badge text found';
  });

  // 11. Troubleshoot offline tips
  await step(w, '11', 'Troubleshoot offline tips without API key', async () => {
    await page.goto(`${BASE}/experiment/${expId}`);
    await page.getByRole('button', { name: 'High background' }).first().click();
    await page.getByRole('button', { name: 'Get suggestions' }).click();
    await page.getByText(/Offline tips/i).first().waitFor();
    await audit(page, w, 'experiment troubleshoot');
    await snap('11-troubleshoot');
    return 'offline tips shown';
  });

  // 12. Literature No thanks hides
  await step(w, '12', 'Literature card "No thanks" hides it', async () => {
    // The card only renders when the AI server reports a key. Mock that GET on the local dev host.
    await page.route('**/api/assist', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { configured: true }, contentType: 'application/json' }) : r.continue()));
    await page.goto(BASE + '/library/' + tplId);
    const no = page.getByRole('button', { name: 'No thanks' });
    await no.waitFor({ timeout: 6000 });
    await audit(page, w, 'literature card');
    await snap('12-literature');
    await no.click();
    await no.waitFor({ state: 'detached', timeout: 4000 });
    await page.reload();
    await page.waitForTimeout(800);
    const still = await page.getByRole('button', { name: 'No thanks' }).count();
    await page.unroute('**/api/assist');
    if (still !== 0) throw new Error('card came back after reload');
    return 'hidden and stays hidden after reload';
  });

  // 13. Deletes
  await step(w, '13a', 'Delete experiment (with confirm)', async () => {
    await page.goto(`${BASE}/experiment/${expId}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete experiment' }).click();
    await page.waitForURL((u) => !u.pathname.includes(expId), { timeout: 8000 });
    return 'deleted';
  });
  await step(w, '13b', 'Delete protocol (with confirm)', async () => {
    await page.goto(`${BASE}/library/${tplId}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete protocol' }).click();
    await page.waitForURL(/\/library$/, { timeout: 8000 });
    await page.locator('li').filter({ hasText: TITLE }).first().waitFor({ state: 'detached' });
    return 'deleted';
  });

  await ctx.close();
}

const browser = await chromium.launch();
for (const vp of WIDTHS) await run(vp);
await browser.close();
console.log(JSON.stringify({ results, audits, consoleErrs }, null, 1));
