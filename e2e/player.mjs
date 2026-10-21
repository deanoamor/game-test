import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Close-ups of the player standing, walking and running (start the dev server first; OUT=dir).
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5300/?world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 3, null, { timeout: 240000 });
const look = (yaw, pitch = 14, dist = 6.5) => page.evaluate(([yaw, pitch, dist]) => {
  const g = window.__game, p = g.player.pos;
  g.drone.following = false;
  g.drone.clearance = false;
  g.drone.setView(p.x, p.z, yaw, pitch, dist);
  g.drone.target.y = p.y + 0.8;
  g.drone.camera.lookAt(g.drone.target);
}, [yaw, pitch, dist]);
const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/player-${name}.png` }); };
for (const yaw of [0, 90, 180, -90]) { await look(yaw); await shot(`idle-${yaw}`); }
// walk east along the pavement, then run
await page.evaluate(() => { window.__game.drone.yaw = 0; });
const move = async (keys, ms, name, yaw) => {
  for (const k of keys) await page.keyboard.down(k);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { await look(yaw, 12, 6.5); await page.waitForTimeout(120); }
  await page.screenshot({ path: `${OUT}/player-${name}.png` });
  for (const k of keys) await page.keyboard.up(k);
};
await page.evaluate(() => { window.__game.drone.following = true; });
await move(['KeyD'], 2500, 'walk-side', 0);
await move(['KeyA'], 1800, 'walk-side2', 0);
await move(['ShiftLeft', 'KeyA'], 1500, 'run-side', 0);
console.log(JSON.stringify(await page.evaluate(() => { const p = window.__game.player.pos; return [p.x, p.y, p.z]; })), errs.slice(0, 3));
await browser.close();
