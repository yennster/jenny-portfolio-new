import puppeteer from '/Users/jenny/.nvm/versions/node/v24.11.1/lib/node_modules/mint/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = 'file://' + join(__dirname, 'og-image.html');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
await page.goto(file, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 500)); // let fonts settle

const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
writeFileSync(join(__dirname, '..', 'og-image.png'), buf);
await browser.close();
console.log('Saved og-image.png (2400x1260 @2x)');
