import { chromium } from 'playwright-core';
import fs from 'node:fs';
// A strip of frames of the player walking and running, seen from the side (start the dev server first; OUT=dir).
const OUT = process.env.OUT || 'e2e/out';
const VIEW = +(process.env.VIEW || 0); // the camera's turn: 0 from the side, 90 from the front (she walks toward +x)
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
for (const [mode, keys] of [['walk', ['KeyD']], ['run', ['KeyD', 'ShiftLeft']]]) {
  // put her back at the start, then step the simulation by hand (shot mode: the loop does not move her)
  await page.evaluate((keys) => {
    const g = window.__game, p = g.player;
    p.teleport(-30, 38.6);
    p.keys.clear();
    for (const k of keys) p.keys.add(k);
    for (let i = 0; i < 60; i++) p.update(1 / 60, 0);
  }, keys);
  for (let f = 0; f < 8; f++) {
    await page.evaluate((view) => {
      const g = window.__game, p = g.player;
      for (let i = 0; i < 5; i++) p.update(1 / 60, 0);
      g.drone.following = false;
      g.drone.clearance = false;
      g.drone.setView(p.pos.x, p.pos.z, view, 8, 4.2);
      g.drone.target.y = p.pos.y + 0.75;
      g.drone.camera.lookAt(g.drone.target);
    }, VIEW);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/gait-${mode}-${VIEW}-${f}.png`, clip: { x: 110, y: 60, width: 200, height: 330 } });
  }
}
await browser.close();
