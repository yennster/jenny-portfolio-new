// Regenerates the social image and app icons from the HTML templates in this folder.
//
//   npm i --no-save playwright-core
//   node scripts/generate-images.mjs
//
// Uses your installed Google Chrome (set CHROME_PATH to override).
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, rmSync } from 'fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: chrome, headless: true });

async function render(url, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, out), clip: { x: 0, y: 0, width, height } });
  await page.close();
  console.log(`Saved ${out} (${width}×${height})`);
}

// Social / Open Graph image: inject the pixel-art icon sprite from index.html into the template
const sprite = readFileSync(join(root, 'index.html'), 'utf8').match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0];
const tmp = join(here, '.og-render.html');
writeFileSync(tmp, readFileSync(join(here, 'og-image.html'), 'utf8').replace('<!--SPRITE-->', sprite));
try {
  await render(pathToFileURL(tmp).href, 1200, 630, 'og-image.png');
} finally {
  rmSync(tmp, { force: true });
}

// App icons: [size, pixel scale, output]
const icon = pathToFileURL(join(here, 'app-icon.html')).href;
for (const [size, k, out] of [
  [180, 4, 'apple-touch-icon.png'],
  [192, 4, 'images/icons/icon-192.png'],
  [512, 10, 'images/icons/icon-512.png'],
]) {
  await render(`${icon}?s=${size}&k=${k}`, size, size, out);
}

await browser.close();
