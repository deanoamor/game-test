import { chromium } from 'playwright-core';
import fs from 'node:fs';

// Takes screenshots of the world from several views. Start the dev server first (npm run dev -- --port 5300).
const URL = process.env.URL || 'http://localhost:5300/';
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = (process.env.SHOTS || 'downtown:11.5,shrine:11.5,fuji:11.5').split(',').map((s) => s.split(':'));
const Q = process.env.Q || 'medium';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
const t0 = Date.now();
for (const [view, hour, extra] of SHOTS) {
  const qs = `?shot=1&pause=1&q=${Q}&t=${hour}&view=${view}${extra ? '&' + extra : ''}${process.env.HUD ? '' : '&hud=0'}`;
  await page.goto(URL + qs);
  await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
  await page.waitForTimeout(600);
  const file = `${OUT}/${view}-${hour}${extra ? '-' + extra.replace(/[&=]/g, '_') : ''}.png`;
  await page.screenshot({ path: file });
  const st = await page.evaluate(() => window.__game.stats());
  console.log(file, JSON.stringify(st), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (errs.length) console.log('ERRORS', errs.slice(0, 5));
await browser.close();
