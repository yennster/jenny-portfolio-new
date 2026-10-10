import puppeteer from '/Users/jenny/.nvm/versions/node/v24.11.1/lib/node_modules/mint/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = 'file://' + join(__dirname, 'apple-touch-icon.html');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// 180x180 — Apple Touch Icon
await page.setViewport({ width: 180, height: 180, deviceScaleFactor: 2 });
await page.goto(file, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 500));
const buf180 = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 180, height: 180 } });
writeFileSync(join(__dirname, '..', 'apple-touch-icon.png'), buf180);
console.log('Saved apple-touch-icon.png');

// 192x192 — Android standard
await page.setViewport({ width: 192, height: 192, deviceScaleFactor: 2 });
await page.goto(file, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const buf192 = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 192, height: 192 } });
writeFileSync(join(__dirname, '..', 'images', 'icons', 'icon-192.png'), buf192);
console.log('Saved icon-192.png');

// 512x512 — Android splash / install prompt
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 2 });
await page.goto(file, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 200));
const buf512 = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 512, height: 512 } });
writeFileSync(join(__dirname, '..', 'images', 'icons', 'icon-512.png'), buf512);
console.log('Saved icon-512.png');

await browser.close();
