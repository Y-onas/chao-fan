/**
 * Renders the ingredient-rail pictures from the same 3D models used on the bowl.
 *   npm run dev            (in another shell)
 *   npm run tiles [-- http://127.0.0.1:5173]
 * Needs Chrome (CHROME_PATH, default /usr/local/bin/google-chrome) and ffmpeg with libwebp.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import menu from '../src/data/menu.default.json' with { type: 'json' };

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = path.resolve('public/assets/tiles');
await mkdir(out, { recursive: true });

const items = [...menu.bases.map((b) => `base-${b.id}`), ...menu.extras.map((e) => `extra-${e.id}`), ...menu.drinks.map((d) => `drink-${d.id}`)];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  for (const item of items) {
    await page.goto(`${base}/#/thumbs?item=${item}`);
    await page.reload(); // a hash-only navigation would keep the previous item mounted
    await page.waitForSelector('body[data-thumb-ready]', { timeout: 30000 });
    const png = path.join(out, `${item}.png`);
    await page.locator('#thumb').screenshot({ path: png, omitBackground: true });
    const webp = path.join(out, `${item}.webp`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=160:160', '-c:v', 'libwebp', '-quality', '88', '-pix_fmt', 'yuva420p', webp]);
    await rm(png);
    console.log('✓', item);
  }
} finally {
  await browser.close();
}
