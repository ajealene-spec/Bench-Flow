// Phase 1 end-to-end QA driver (Playwright). Not part of `npm test`.
//
// Usage (dev server must be running on 5173, or set BASE_URL):
//   PW_MODULE=/abs/path/to/node_modules/playwright/index.mjs \
//   OUT_DIR=/abs/path/to/docs/qa/phase1 node tests/qa/phase1-e2e.mjs
//
// Offline mode (needs `vite preview --port 4173` on a fresh build):
//   MODE=offline BASE_URL=http://localhost:4173 ... node tests/qa/phase1-e2e.mjs
//
// Prints one JSON result per check to stdout.

const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT_DIR ?? './qa-out';
const MODE = process.env.MODE ?? 'online';

const PROC =
  '1. Prepare 10 mL lysis buffer on ice. Caution: wear gloves.\n' +
  '2. Centrifuge at 12,000 g for 10 min at 4 C.\n' +
  '3. Incubate overnight at 37 C.\n' +
  '4. Run gel for 1 h 30 min.';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'ipad', width: 820, height: 1180 },
  { name: 'laptop', width: 1440, height: 900 },
];

const results = [];
const consoleErrors = [];

function rec(vp, id, name, ok, detail = '') {
  results.push({ vp, id, name, status: ok ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 400) });
}

async function check(vp, id, name, fn) {
  try {
    const detail = await fn();
    rec(vp.name, id, name, true, detail ?? '');
  } catch (e) {
    rec(vp.name, id, name, false, String(e.message).split('\n')[0]);
  }
}

// Visible buttons, links and inputs under 48px in either dimension.
function touchAudit(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a[href], input, select, textarea')];
    const small = [];
    for (const el of els) {
      if (el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
      if (r.height < 48 || r.width < 48) {
        const label = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40);
        small.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return small;
  });
}

function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openStepList(page) {
  const toggle = page.getByRole('button', { name: /All steps/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

async function parseCounter(page) {
  const txt = await page.getByText(/^Step \d+ of \d+$/).first().innerText();
  const m = txt.match(/Step (\d+) of (\d+)/);
  return { cur: Number(m[1]), total: Number(m[2]) };
}

// New protocol → paste → parse → save → Start experiment from the library → run page.
async function createAndStartRun(page, protocolTitle, runTitle) {
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: 'New experiment' }).click();
  await page.getByRole('link', { name: 'Paste a new protocol' }).click();
  await page.waitForURL(/\/library\/new$/);
  await page.locator('#procedure-text').fill(PROC);
  await page.getByRole('button', { name: 'Parse steps' }).click();
  await page.getByRole('status').filter({ hasText: 'Parsed with' }).waitFor();
  await page.getByLabel('Protocol title').fill(protocolTitle);
  await page.getByRole('button', { name: 'Save protocol' }).click();
  await page.waitForURL(/\/library\/(?!new$)[^/]+$/);
  await page.getByRole('heading', { name: 'Edit protocol' }).waitFor();
  await page.getByRole('link', { name: 'Back to library' }).click();
  await page.waitForURL(/\/library$/);
  const card = page.locator('li').filter({ hasText: protocolTitle });
  await card.getByRole('button', { name: 'Start experiment' }).click();
  await card.getByLabel('Run title').fill(runTitle);
  await card.getByRole('button', { name: 'Start run' }).click();
  await page.waitForURL(/\/run$/);
  return page.url();
}

async function runViewport(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    permissions: ['notifications'],
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push({ vp: vp.name, text: m.text().slice(0, 300) });
  });
  page.on('pageerror', (e) => consoleErrors.push({ vp: vp.name, text: 'pageerror: ' + e.message.slice(0, 300) }));
  const shot = (n) => page.screenshot({ path: `${OUT}/${vp.name}-${n}.png`, fullPage: true });

  // a. Workspace and New experiment
  await check(vp, 'a1', 'Workspace loads', async () => {
    await page.goto(BASE + '/');
    await page.getByRole("heading", { name: "Experiments", exact: true }).waitFor();
    await shot('01-workspace-empty');
    return 'heading visible';
  });
  await check(vp, 'a2', 'New experiment offers a picker with Paste a new protocol', async () => {
    await page.getByRole('button', { name: 'New experiment' }).click();
    await page.getByRole('link', { name: 'Paste a new protocol' }).click();
    await page.waitForURL(/\/library\/new$/);
    await page.locator('#procedure-text').waitFor();
    return page.url();
  });

  // b. Paste, parse, review, edit, save
  await check(vp, 'b1', 'Parse uses local parser (labeled)', async () => {
    await page.locator('#procedure-text').fill(PROC);
    await page.getByRole('button', { name: 'Parse steps' }).click();
    const status = page.getByRole('status').filter({ hasText: 'Parsed with' });
    await status.waitFor();
    const txt = (await status.innerText()).replace(/\s+/g, ' ');
    if (!/local parser/i.test(txt)) throw new Error(`not labeled as local parser: ${txt}`);
    await shot('02-review');
    return txt.slice(0, 160);
  });
  await check(vp, 'b2', 'Step count = 4', async () => {
    const n = await page.getByLabel('Title', { exact: true }).count();
    if (n !== 4) throw new Error(`found ${n} step cards`);
    return n;
  });
  await check(vp, 'b3', 'Durations detected (step 2 = 10 min, step 4 = 90 min)', async () => {
    const n = await page.getByLabel('Duration amount').count();
    const vals = [];
    for (let i = 0; i < n; i++) {
      const amt = await page.getByLabel('Duration amount').nth(i).inputValue();
      const unit = await page.getByLabel('Duration unit').nth(i).inputValue();
      vals.push(amt ? `${amt} ${unit}` : '');
    }
    const ok = vals[1] === '10 min' && (vals[3] === '90 min' || vals[3] === '1.5 h');
    if (!ok) throw new Error(`durations per step: ${JSON.stringify(vals)}`);
    return JSON.stringify(vals);
  });
  await check(vp, 'b4', 'Caution detected on step 1', async () => {
    const body = await page.locator('body').innerText();
    if (!/gloves/i.test(body)) throw new Error('caution text not present on review');
    return 'caution text present';
  });
  await check(vp, 'b5', 'Edit step title and protocol title, save creates a template', async () => {
    await page.getByLabel('Title', { exact: true }).first().fill('Prepare lysis buffer (QA edit)');
    await page.getByLabel('Protocol title').fill('QA Western blot');
    await page.getByRole('button', { name: 'Save protocol' }).click();
    await page.waitForURL(/\/library\/(?!new$)[^/]+$/);
    await page.getByRole('heading', { name: 'Edit protocol' }).waitFor();
    await shot('02b-template-saved');
    return page.url();
  });
  await check(vp, 'b6', 'Start experiment from the library opens the run', async () => {
    await page.getByRole('link', { name: 'Back to library' }).click();
    await page.waitForURL(/\/library$/);
    const card = page.locator('li').filter({ hasText: 'QA Western blot' });
    await card.getByRole('button', { name: 'Start experiment' }).click();
    await card.getByLabel('Run title').fill('QA run');
    await card.getByRole('button', { name: 'Start run' }).click();
    await page.waitForURL(/\/run$/);
    await page.getByRole('heading', { name: 'Prepare lysis buffer (QA edit)' }).waitFor();
    return page.url();
  });

  // c. Run mode
  await check(vp, 'c1', 'Run starts at step 1 of 4', async () => {
    const c = await parseCounter(page);
    if (c.cur !== 1 || c.total !== 4) throw new Error(JSON.stringify(c));
    await shot('03-run-step1');
    return JSON.stringify(c);
  });
  await check(vp, 'c2', 'Next / Back move between steps; Back disabled on step 1', async () => {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    if ((await parseCounter(page)).cur !== 2) throw new Error('Next did not reach step 2');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    if ((await parseCounter(page)).cur !== 1) throw new Error('Back did not return to step 1');
    if (!(await page.getByRole('button', { name: 'Back', exact: true }).isDisabled())) throw new Error('Back enabled on step 1');
    return 'ok';
  });
  await check(vp, 'c3', 'Mark complete updates progress bar', async () => {
    await page.getByRole('button', { name: /^Mark complete/ }).click();
    const bar = page.getByRole('progressbar', { name: 'Procedure progress' });
    const now = await bar.getAttribute('aria-valuenow');
    if (now !== '1') throw new Error(`aria-valuenow=${now}`);
    return `aria-valuenow=${now}, counter=${await page.getByText(/complete$/).first().innerText()}`;
  });
  await check(vp, 'c4', 'Jump via step list', async () => {
    await openStepList(page);
    await page.locator('#step-list li').nth(3).getByRole('button').click();
    const c = await parseCounter(page);
    if (c.cur !== 4) throw new Error(`jump landed on ${c.cur}`);
    return 'landed on step 4';
  });
  await check(vp, 'c5', 'Progress bar width tracks completion', async () => {
    await page.locator('#step-list li').nth(1).getByRole('button').click();
    await page.getByRole('button', { name: /^Mark complete/ }).click();
    const w = await page
      .getByRole('progressbar', { name: 'Procedure progress' })
      .locator('div')
      .evaluate((el) => el.style.width);
    if (w !== '50%') throw new Error(`bar width ${w}`);
    await shot('04-run-progress');
    return w;
  });
  await check(vp, 'c6', 'Touch audit + horizontal scroll on run page', async () => {
    await openStepList(page);
    const small = await touchAudit(page);
    const overflow = await horizontalOverflow(page);
    results.push({ vp: vp.name, id: 'g1', name: 'Run page touch targets >= 48px', status: small.length ? 'FAIL' : 'PASS', detail: small.join('; ') || 'none' });
    results.push({ vp: vp.name, id: 'g2', name: 'Run page no horizontal scroll', status: overflow > 0 ? 'FAIL' : 'PASS', detail: `overflow=${overflow}px` });
    return 'see g1/g2';
  });

  // d. Timers and reload resume (step 2 has a 10 min timer)
  await check(vp, 'd1', 'Start timer on step 2', async () => {
    // Mark complete auto-advances, so jump explicitly back to step 2 first.
    await openStepList(page);
    await page.locator('#step-list li').nth(1).getByRole('button').click();
    if ((await parseCounter(page)).cur !== 2) throw new Error('could not reach step 2');
    await page.getByRole('button', { name: /Start timer/ }).click();
    const tray = page.getByRole('region', { name: 'Running timers' });
    await tray.waitFor();
    return (await tray.innerText()).replace(/\s+/g, ' ').slice(0, 160);
  });
  let beforeReload = '';
  await check(vp, 'd2', 'Timer ticks down while running', async () => {
    await page.waitForTimeout(3000);
    beforeReload = (await page.getByRole('region', { name: 'Running timers' }).innerText()).replace(/\s+/g, ' ');
    return beforeReload.slice(0, 160);
  });
  await check(vp, 'd3', 'Reload: timer still running with correct remaining time', async () => {
    await page.reload();
    const tray = page.getByRole('region', { name: 'Running timers' });
    await tray.waitFor();
    const txt = (await tray.innerText()).replace(/\s+/g, ' ');
    const m = txt.match(/(\d+):(\d{2})(?::(\d{2}))?/);
    if (!m) throw new Error(`no clock in tray: ${txt}`);
    const secs = m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
    if (!(secs > 0 && secs < 600 && secs > 540)) throw new Error(`remaining ${secs}s after reload, expected ~540-597s`);
    await shot('05-after-reload');
    return txt.slice(0, 160);
  });
  await check(vp, 'd4', 'Reload restores current step (step 2)', async () => {
    const c = await parseCounter(page);
    if (c.cur !== 2) throw new Error(`restored to step ${c.cur}, expected 2`);
    const h = await page.getByRole('heading', { level: 1 }).innerText();
    return `${c.cur}/${c.total} ${h}`;
  });
  await check(vp, 'd5', 'Timer tray visible on workspace page', async () => {
    await page.getByRole('link', { name: 'Experiments', exact: true }).click();
    await page.waitForURL(BASE + '/');
    const tray = page.getByRole('region', { name: 'Running timers' });
    await tray.waitFor();
    await shot('06-workspace-with-tray');
    return (await tray.innerText()).replace(/\s+/g, ' ').slice(0, 160);
  });

  // e. Finish all steps, experiment shows done
  await check(vp, 'e1', 'Complete all steps', async () => {
    await page.getByRole('link', { name: 'QA run' }).first().click();
    await page.waitForURL(/\/experiment\/[^/]+$/);
    await page.getByRole('link', { name: 'Continue run' }).click();
    await page.waitForURL(/\/run$/);
    await openStepList(page);
    for (let i = 0; i < 4; i++) {
      await page.locator('#step-list li').nth(i).getByRole('button').click();
      await page.getByRole('button', { name: /^Mark complete/ }).click();
    }
    const now = await page.getByRole('progressbar', { name: 'Procedure progress' }).getAttribute('aria-valuenow');
    if (now !== '4') throw new Error(`aria-valuenow=${now}`);
    await shot('07-run-complete');
    return 'progress 4/4';
  });
  await check(vp, 'e2', 'Workspace shows experiment as Done', async () => {
    await page.getByRole('link', { name: 'Experiments', exact: true }).click();
    await page.waitForURL(BASE + '/');
    const card = page.locator('ul li a').filter({ hasText: 'Done' });
    await card.first().waitFor();
    await shot('08-workspace-done');
    return (await card.first().innerText()).replace(/\s+/g, ' ').slice(0, 120);
  });

  // g. Touch and layout audit on the other pages
  await check(vp, 'g3', 'Workspace touch targets and overflow', async () => {
    const small = await touchAudit(page);
    const overflow = await horizontalOverflow(page);
    results.push({ vp: vp.name, id: 'g3a', name: 'Workspace touch targets >= 48px', status: small.length ? 'FAIL' : 'PASS', detail: small.join('; ') || 'none' });
    results.push({ vp: vp.name, id: 'g3b', name: 'Workspace no horizontal scroll', status: overflow > 0 ? 'FAIL' : 'PASS', detail: `overflow=${overflow}px` });
    return 'see g3a/g3b';
  });
  await check(vp, 'g4', 'Import page touch targets and overflow', async () => {
    await page.goto(BASE + '/library/new');
    await page.locator('#procedure-text').waitFor();
    const small0 = await touchAudit(page);
    const of0 = await horizontalOverflow(page);
    await page.locator('#procedure-text').fill(PROC);
    await page.getByRole('button', { name: 'Parse steps' }).click();
    await page.getByRole('status').filter({ hasText: 'Parsed with' }).waitFor();
    const small1 = await touchAudit(page);
    const of1 = await horizontalOverflow(page);
    results.push({ vp: vp.name, id: 'g4a', name: 'Import text state touch targets >= 48px', status: small0.length ? 'FAIL' : 'PASS', detail: small0.join('; ') || 'none' });
    results.push({ vp: vp.name, id: 'g4b', name: 'Import review touch targets >= 48px', status: small1.length ? 'FAIL' : 'PASS', detail: small1.join('; ') || 'none' });
    results.push({ vp: vp.name, id: 'g4c', name: 'Import no horizontal scroll', status: of0 > 0 || of1 > 0 ? 'FAIL' : 'PASS', detail: `text=${of0}px review=${of1}px` });
    return 'see g4a-c';
  });

  await ctx.close();
}

async function runOffline(browser) {
  const vp = VIEWPORTS[0];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push({ vp: 'offline', text: m.text().slice(0, 300) });
  });
  page.on('pageerror', (e) => consoleErrors.push({ vp: 'offline', text: 'pageerror: ' + e.message.slice(0, 300) }));

  await check(vp, 'f1', 'Preview build loads online and creates an experiment', async () => {
    return createAndStartRun(page, 'Offline protocol', 'Offline run');
  });
  await check(vp, 'f2', 'Service worker active and controlling page', async () => {
    await page.goto(BASE + '/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    if (!controlled) throw new Error('no SW controller after reload');
    await page.waitForTimeout(1500);
    return 'controlled';
  });
  await check(vp, 'f3', 'Offline reload: app shell loads and existing experiment displays', async () => {
    await ctx.setOffline(true);
    await page.goto(BASE + '/');
    await page.getByRole("heading", { name: "Experiments", exact: true }).waitFor();
    const card = page.locator('ul li a').first();
    await card.waitFor();
    await page.screenshot({ path: `${OUT}/offline-workspace.png`, fullPage: true });
    return (await card.innerText()).replace(/\s+/g, ' ').slice(0, 120);
  });
  await check(vp, 'f4', 'Offline: open experiment run page from workspace', async () => {
    await page.locator("ul li a").first().click();
    await page.waitForURL(/\/experiment\/[^/]+$/);
    await page.getByRole("link", { name: "Continue run" }).click();
    await page.waitForURL(/\/run$/);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const c = await parseCounter(page);
    await page.screenshot({ path: `${OUT}/offline-run.png`, fullPage: true });
    return JSON.stringify(c);
  });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  if (MODE === 'offline') {
    await runOffline(browser);
  } else {
    for (const vp of VIEWPORTS) await runViewport(browser, vp);
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ results, consoleErrors }, null, 2));
