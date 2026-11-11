/**
 * End-to-end check in real Chrome against the production build:
 *   npm run build && npm run test:e2e
 * Uses CHROME_PATH (default /usr/local/bin/google-chrome). Screenshots go to test-results/.
 * Follows the acceptance walkthrough in the build brief (rice → beef → leg → egg → sauce → takeaway …).
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
/** The receipt total animates; its data-value is the exact amount. */
const total = async (p: Page) => Number(await p.getByTestId('total').first().getAttribute('data-value'));
const settle = (p: Page, ms = 1800) => p.waitForTimeout(ms);
const tile = (p: Page, name: RegExp) => p.locator('.rail').getByRole('button', { name });
const ready = (p: Page) => p.getByText('Setting the table…').waitFor({ state: 'detached', timeout: 60000 });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  // ------------------------------------------------------------ desktop walkthrough
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(base);
  await ready(page);
  check('1. live 3D builder loads first', (await page.locator('.stage').getAttribute('data-view')) === '3d');
  await settle(page);
  await page.screenshot({ path: `${out}/1-rice-only.png` });
  check('   rice only, nothing billed', (await total(page)) === 0, String(await total(page)));
  check('   cannot finish plain rice', await page.getByRole('button', { name: /Plate it up/ }).first().isDisabled());
  check('   unpriced drinks cannot be added', await tile(page, /^Coca-Cola/).isDisabled());

  // rapid base switching must land on the last choice only
  for (const n of ['Chicken', 'Beef', 'Egg', 'Veggie', 'Chicken', 'Egg', 'Beef']) await tile(page, new RegExp(`^${n} Chaofan`)).click();
  check('2. Beef → 450 (after rapid switching)', (await total(page)) === 450, String(await total(page)));
  await tile(page, /^Chicken leg/).click();
  check('3. + chicken leg → 730', (await total(page)) === 730, String(await total(page)));
  await tile(page, /^Fried egg/).click();
  check('4. + fried egg → 770', (await total(page)) === 770, String(await total(page)));
  await tile(page, /^House sauce/).click();
  check('5. + house sauce → 820', (await total(page)) === 820, String(await total(page)));
  await settle(page, 2500);
  await page.screenshot({ path: `${out}/2-beef-leg-egg-sauce.png` });
  check('   sauce meter fills when sauce is added', (await page.getByTestId('sauce-meter').innerText()).includes('100%'), await page.getByTestId('sauce-meter').innerText());

  await page.getByRole('radio', { name: /^Takeaway/ }).click();
  check('6. takeaway → 860', (await total(page)) === 860, String(await total(page)));
  await tile(page, /^Chicken Chaofan/).click();
  check('8. Beef → Chicken keeps extras → 910', (await total(page)) === 910, String(await total(page)));
  await tile(page, /^Chicken leg/).click();
  check('9. remove leg → 630', (await total(page)) === 630, String(await total(page)));
  await page.getByRole('radio', { name: /^Dine in/ }).click();
  check('10. dine-in drops the box → 590', (await total(page)) === 590, String(await total(page)));

  // drag a tile onto the bowl adds one (like the reference)
  const from = await tile(page, /^Chicken leg/).boundingBox();
  const to = await page.locator('.stage').boundingBox();
  if (from && to) {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y - 60, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
  }
  check('    dragging the leg tile onto the bowl adds it → 870', (await total(page)) === 870, String(await total(page)));

  await page.getByRole('radio', { name: /^Takeaway/ }).click();
  check('    back to takeaway → 910', (await total(page)) === 910, String(await total(page)));

  // persisted across reload
  await page.reload();
  await ready(page);
  check('    order survives reload', (await total(page)) === 910, String(await total(page)));

  await page.getByRole('button', { name: /Box it up/ }).first().click();
  await settle(page, 4500);
  await page.screenshot({ path: `${out}/3-boxed.png` });
  await page.getByRole('button', { name: 'Checkout' }).first().click();
  await page.getByLabel('Your name').fill('Abebe Kebede');
  await page.getByLabel('Phone').fill('0911234567');
  await page.getByRole('button', { name: /Place order · 910 ETB/ }).click();
  await page.getByText('Order up!').waitFor({ timeout: 10000 });
  const card = await page.locator('.orderup').innerText();
  check('11. server confirms 910 ETB with an order number', card.includes('910 ETB') && /Order Nº CF-/.test(card), card.split('\n').slice(0, 3).join(' / '));
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/4-order-up.png` });

  // admin: price a drink, then it becomes orderable
  await page.goto(`${base}/#/admin`);
  await page.getByLabel('Admin token').fill('e2e');
  await page.getByLabel('Mojito price').fill('120');
  await page.getByRole('button', { name: 'Save menu' }).click();
  await page.getByText('Menu saved').waitFor();
  await page.getByRole('button', { name: 'Load orders' }).click();
  await page.locator('.admin-orders li').first().waitFor({ timeout: 5000 }).catch(() => {});
  check('    admin sees the order', (await page.locator('.admin-orders li').count()) === 1);

  await page.goto(base);
  await ready(page);
  await page.getByRole('button', { name: 'Build another' }).first().click();
  await settle(page, 1600);
  check('    start over clears the bowl', (await total(page)) === 0, String(await total(page)));
  await page.getByRole('radio', { name: /^Dine in/ }).click();
  await tile(page, /^Egg Chaofan/).click();
  await tile(page, /^Mojito/).click();
  check('7. priced drink adds to total (350 + 120)', (await total(page)) === 470, String(await total(page)));
  await page.getByRole('button', { name: /Plate it up/ }).first().click();
  await settle(page, 3000);
  await page.screenshot({ path: `${out}/5-dine-in-mojito.png` });
  check('    no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // ------------------------------------------------------------ mobile
  for (const width of [390, 320]) {
    const m = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const mp = await m.newPage();
    await mp.goto(base);
    await ready(mp);
    await tile(mp, /^Chicken Chaofan/).tap();
    await tile(mp, /^Fried egg/).tap();
    await settle(mp);
    check(`12. ${width}px: sticky bar shows total`, (await mp.locator('.mobile-total strong').innerText()) === '540 ETB', await mp.locator('.mobile-total strong').innerText());
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`    ${width}px: no horizontal overflow`, overflow <= 0, `${overflow}px`);
    await mp.screenshot({ path: `${out}/6-mobile-${width}.png` });
    await m.close();
  }

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
  check('    without WebGL: simplified preview, labelled as such', (await fp.locator('.stage').getAttribute('data-view')) === '2d' && (await fp.getByText(/Simplified photo preview/).count()) === 1);
  await tile(fp, /^Chicken Chaofan/).click();
  await tile(fp, /^Chicken leg/).click();
  check('    without WebGL ordering still works → 780', (await total(fp)) === 780, String(await total(fp)));
  await fp.screenshot({ path: `${out}/7-fallback-2d.png` });
  await f.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
