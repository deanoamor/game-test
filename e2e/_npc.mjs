import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5300/?world=npclab&hud=1&q=medium&pause=1&t=12');
await page.waitForFunction(() => window.__game && window.__game.frames() > 8, null, { timeout: 240000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: process.env.OUT + '/npc0.png' });
console.log(errs.slice(0, 5), await page.evaluate(() => [window.__game.npcs.length, window.__game.npcs[0].pos.toArray()]));
await browser.close();
