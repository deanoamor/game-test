import { chromium } from 'playwright-core';
// Screenshots of the crossing as the signal cycle runs (start the dev server first; OUT=dir).
const OUT = process.env.OUT || 'e2e/out';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=medium&pause=1&t=13&tx=0&tz=44&yaw=0&pitch=72&dist=55');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
for (const [i, sec] of [[0, 14], [1, 4], [2, 3], [3, 6], [4, 6], [5, 8]]) {
  const light = await page.evaluate((s) => { window.__game.simulate(s); return [window.__game.signals.light('main'), window.__game.signals.light('cross')]; }, sec);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/live-${i}.png` });
  console.log(i, light);
}
await browser.close();
