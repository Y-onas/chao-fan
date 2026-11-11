/**
 * End-to-end check in real Chrome against the production build:
 *   npm run build && npm run test:e2e
 * Uses CHROME_PATH (default /usr/local/bin/google-chrome). Screenshots go to test-results/.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';

const port = 4000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const out = path.resolve('test-results');
await mkdir(out, { recursive: true });
const dataDir = await mkdtemp(path.join(tmpdir(), 'chaofan-e2e-'));

const server = spawn(process.execPath, ['server/server.ts'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_TOKEN: 'e2e' }, stdio: 'pipe' });
await new Promise<void>((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('ChaoFan Corner on') && resolve());
  server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
});

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
const total = (p: Page) => p.getByTestId('total').first().innerText();
const settle = (p: Page, ms = 2600) => p.waitForTimeout(ms);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  // ------------------------------------------------------------ desktop flow
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(base);
  await page.getByText('Plating up…').waitFor({ state: 'detached', timeout: 30000 });
  check('3D scene loads', (await page.locator('.stage').getAttribute('data-view')) === '3d');
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/1-rice-only.png` });
  check('starts as rice only, nothing priced', (await total(page)) === '0 ETB', await total(page));
  check('review disabled for plain rice', await page.getByRole('button', { name: 'Review order' }).first().isDisabled());
  check('extras disabled until a chaofan is chosen', await page.getByRole('button', { name: 'Add one Chicken leg' }).isDisabled());
  check('unpriced drinks cannot be added', await page.getByRole('button', { name: 'Add one Soft drink' }).isDisabled());

  // rapid base switching must land on the last choice only
  for (const name of ['Chicken', 'Beef', 'Egg', 'Veggie', 'Chicken', 'Egg', 'Beef']) await page.getByRole('radio', { name: new RegExp(`^${name} Chaofan`) }).click();
  check('rapid switching settles on last base', (await total(page)) === '450 ETB', await total(page));
  await settle(page);
  await page.screenshot({ path: `${out}/2-beef.png` });

  await page.getByRole('radio', { name: /^Chicken Chaofan/ }).click();
  await page.getByRole('button', { name: 'Add one Chicken leg' }).click();
  await page.getByRole('button', { name: 'Add one Fried egg' }).click();
  await page.getByRole('button', { name: 'Add one House sauce' }).click();
  check('chicken + leg + egg + sauce = 870', (await total(page)) === '870 ETB', await total(page));
  await settle(page);
  await page.screenshot({ path: `${out}/3-chicken-extras.png` });

  await page.getByRole('radio', { name: /^Takeaway/ }).click();
  check('takeaway adds 40 → 910', (await total(page)) === '910 ETB', await total(page));

  // persisted across reload
  await page.reload();
  await page.getByText('Plating up…').waitFor({ state: 'detached', timeout: 30000 });
  check('order survives reload', (await total(page)) === '910 ETB', await total(page));

  await page.getByRole('button', { name: 'Review order' }).first().click();
  await settle(page, 6000);
  await page.screenshot({ path: `${out}/4-takeaway-packed.png` });
  await page.getByLabel('Your name').fill('Abebe');
  await page.getByLabel('Phone').fill('0911234567');
  await page.getByRole('button', { name: /Place order · 910 ETB/ }).click();
  await page.getByText('Order received').waitFor();
  const placedTotal = await page.locator('.placed-total').innerText();
  check('server confirms 910 ETB', placedTotal === '910 ETB', placedTotal);
  await page.screenshot({ path: `${out}/5-placed.png` });

  // admin: price a drink, then it becomes orderable
  await page.goto(`${base}/#/admin`);
  await page.getByLabel('Admin token').fill('e2e');
  await page.getByLabel('Fresh juice price').fill('120');
  await page.getByRole('button', { name: 'Save menu' }).click();
  await page.getByText('Menu saved').waitFor();
  await page.getByRole('button', { name: 'Load orders' }).click();
  await page.locator('.admin-orders li').first().waitFor({ timeout: 5000 }).catch(() => {});
  check('admin sees the order', (await page.locator('.admin-orders li').count()) === 1);

  await page.goto(base);
  await page.getByRole('button', { name: 'Start a new order' }).click();
  await page.getByRole('radio', { name: /^Dine in/ }).click();
  await page.getByRole('radio', { name: /^Egg Chaofan/ }).click();
  await page.getByRole('button', { name: 'Add one Fresh juice' }).click();
  check('priced drink adds to total (350 + 120)', (await total(page)) === '470 ETB', await total(page));
  await page.getByRole('button', { name: 'Review order' }).first().click();
  await settle(page, 2500);
  await page.screenshot({ path: `${out}/6-dine-in-finish.png` });
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ------------------------------------------------------------ mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await mp.goto(base);
  await mp.getByText('Plating up…').waitFor({ state: 'detached', timeout: 30000 });
  await mp.getByRole('radio', { name: /^Chicken Chaofan/ }).tap();
  await mp.getByRole('button', { name: 'Add one Fried egg' }).tap();
  await settle(mp);
  check('mobile bar shows total', (await mp.locator('.mobile-bar strong').innerText()) === '540 ETB');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('no horizontal overflow on mobile', overflow <= 0, `${overflow}px`);
  await mp.screenshot({ path: `${out}/7-mobile.png` });
  await m.close();

  // ------------------------------------------------------------ no WebGL + reduced motion
  const f = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await f.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith('webgl') ? null : (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  const fp = await f.newPage();
  await fp.goto(base);
  check('falls back to photo preview without WebGL', (await fp.locator('.stage').getAttribute('data-view')) === '2d');
  await fp.getByRole('radio', { name: /^Chicken Chaofan/ }).click();
  await fp.getByRole('button', { name: 'Add one Chicken leg' }).click();
  await fp.waitForTimeout(300);
  await fp.screenshot({ path: `${out}/8-fallback-2d.png` });
  await f.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
