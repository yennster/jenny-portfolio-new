// Regenerates the LinkedIn QR code, the social image, and the app icons.
//
//   npm i --no-save playwright-core qrcode
//   node scripts/generate-images.mjs
//
// Uses your installed Google Chrome (set CHROME_PATH to override).
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, rmSync } from 'fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: chrome, headless: true });

// LinkedIn QR code as a static SVG, so /connect/ needs no library (and works offline).
// Level-H error correction lets a 9×9 hole in the middle hold a little pixel heart.
const LINKEDIN = 'https://www.linkedin.com/in/jennyplunkett';
function qrSvg(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = modules.size;
  const quiet = 4;
  const size = n + quiet * 2;
  const mid = Math.floor(n / 2);
  const inHole = (r, c) => Math.abs(r - mid) <= 4 && Math.abs(c - mid) <= 4;
  const dark = (r, c) => modules.get(r, c) && !inHole(r, c);
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n;) {
      if (!dark(r, c)) { c++; continue; }
      let run = 1;
      while (c + run < n && dark(r, c + run)) run++;
      d += `M${c + quiet} ${r + quiet}h${run}v1h-${run}z`;
      c += run;
    }
  }
  const heart = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  let h = '';
  heart.forEach((row, y) => [...row].forEach((px, x) => {
    if (px === 'X') h += `M${mid + quiet - 3 + x} ${mid + quiet - 3 + y}h1v1h-1z`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for linkedin.com/in/jennyplunkett">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path fill="#1a0610" d="${d}"/><path fill="#e0115f" d="${h}"/></svg>`;
}
const qr = qrSvg(LINKEDIN);
const withQr = html => html.replace(/<!--QR:start-->[\s\S]*?<!--QR:end-->/, `<!--QR:start-->${qr}<!--QR:end-->`);
for (const file of ['connect/index.html', 'index.html']) {
  const path = join(root, file);
  writeFileSync(path, withQr(readFileSync(path, 'utf8')));
  console.log(`Injected QR into ${file}`);
}

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

// Connect app icons (/connect/): [size, pixels per QR module, output]
const connectTmp = join(here, '.connect-icon-render.html');
writeFileSync(connectTmp, withQr(readFileSync(join(here, 'connect-icon.html'), 'utf8')));
try {
  for (const [size, k, out] of [
    [180, 3, 'connect/icon-180.png'],
    [192, 3, 'connect/icon-192.png'],
    [512, 6, 'connect/icon-512.png'],
  ]) {
    await render(`${pathToFileURL(connectTmp).href}?s=${size}&k=${k}`, size, size, out);
  }
} finally {
  rmSync(connectTmp, { force: true });
}

await browser.close();
