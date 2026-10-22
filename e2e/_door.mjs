import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 520 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=medium&pause=1&t=12');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
console.log(JSON.stringify(await page.evaluate(() => { const e = window.__game.hud.world.exits.find((x) => x.door); return { door: e.at, info: e.door, out: window.__game.hud.world.spawns.home }; })));
const d = await page.evaluate(() => { const e = window.__game.hud.world.exits.find((x) => x.door); return [(e.at.x0 + e.at.x1) / 2, (e.at.z0 + e.at.z1) / 2, e.door.minY + 0.5]; });
let n = 0;
for (const [yaw, dist, pitch] of [[-60, 6, 22], [-110, 5, 18]]) {
  await page.evaluate(([d, yaw, dist, pitch]) => { const g = window.__game, p = g.player; p.teleport(d[0], d[1] + 0.9); g.drone.following = false; g.drone.clearance = false; g.drone.setView(d[0] + 0.6, d[1], yaw, pitch, dist); g.drone.target.y = d[2] + 1.0; g.drone.camera.lookAt(g.drone.target); }, [d, yaw, dist, pitch]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: process.env.OUT + `/door${n++}.png` });
}
console.log(errs.slice(0, 5));
await browser.close();
