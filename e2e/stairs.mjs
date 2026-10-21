import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Walks the player up every flight of outside stairs in the world's bounds and reports how high she got.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.goto(`http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13&steps=${process.env.STEPS || 700}`);
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
const walks = await page.evaluate(() => {
  const p = window.__game.player, b = p.bounds;
  return [...new Set([...p.grid.values()].flat())].filter((s) => s.t === 'walk' && s.x > b.x0 && s.x < b.x1 && s.z > b.z0 && s.z < b.z1).map((s) => ({ ...s }));
});
let n = 0;
for (const w of walks) {
  const r = await page.evaluate((w) => {
    const g = window.__game, p = g.player;
    // from the pavement in front of the flight, walk straight up it and on to the end of the landing
    p.teleport(w.x - w.dx * 1.5, w.z - w.dz * 1.5);
    const start = p.pos.y;
    p.keys.clear();
    // keys are relative to the camera: with the camera turned to look along the stairs, W goes up them
    const yaw = Math.atan2(-w.dx, -w.dz);
    p.keys.add('KeyW');
    let top = start;
    const steps = +(new URLSearchParams(location.search).get('steps') ?? 700);
    for (let i = 0; i < steps; i++) { p.update(1 / 60, yaw); top = Math.max(top, p.pos.y); }
    p.keys.clear();
    for (let i = 0; i < 30; i++) p.update(1 / 60, yaw);
    g.drone.following = false; g.drone.clearance = false;
    g.drone.setView(p.pos.x, p.pos.z, -45, 35, 8);
    g.drone.target.y = p.pos.y + 0.7; g.drone.camera.lookAt(g.drone.target);
    return { start: +start.toFixed(2), top: +top.toFixed(2), want: +w.y1.toFixed(2), end: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(2)) };
  }, w);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/stairs-${n++}.png` });
  console.log(JSON.stringify(r));
}
await browser.close();
