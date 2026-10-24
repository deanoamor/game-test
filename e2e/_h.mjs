import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto('http://localhost:5300/?world=home&hud=1&q=medium&pause=1&t=' + (process.env.T || 12));
await page.waitForFunction(() => window.__game && window.__game.frames() > 8, null, { timeout: 240000 });
await page.waitForTimeout(800);
await page.screenshot({ path: process.env.OUT + '/h0.png' });
const views = [[-3, 0, 30], [1.5, -1, 30], [0, 2, 200], [0, 0, -40]];
let n = 1;
for (const [x, z, yaw] of views) {
  await page.evaluate(([x, z, yaw]) => { const g = window.__game, d = g.drone; g.player.teleport(x, z); d.follow(g.player.pos.x, g.player.pos.z, g.player.pos.y); d.yawGoal = d.yaw = (yaw * Math.PI) / 180; for (let i = 0; i < 100; i++) { g.stage.step(1 / 30, 0, d.target, d.yaw, true); d.update(1 / 30); } }, [x, z, yaw]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.OUT + `/h${n++}.png` });
}
console.log(errs.slice(0, 8));
await browser.close();
