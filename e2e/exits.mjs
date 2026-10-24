import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Walks the player to the end of every street of the world and checks that the Exit panel is up at the moment she can
// go no further (and not before she is near it), then keeps pushing to prove she is stopped. OUT=dir for screenshots.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
await page.goto('http://localhost:5300/?world=ekimae&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 });
const exits = await page.evaluate(() => window.__game.hud.world.exits.map((e) => ({ name: e.name, at: e.at })));
for (const [i, e] of exits.entries()) {
  const cx = (e.at.x0 + e.at.x1) / 2, cz = (e.at.z0 + e.at.z1) / 2;
  const area = await page.evaluate(() => window.__game.player.bounds);
  // a spot some way back along the street, then walk straight toward the end (camera turned so keys go along the axes)
  const horizontal = e.at.x1 - e.at.x0 < e.at.z1 - e.at.z0 ? false : true; // a vertical strip on a side edge means a street along x
  const side = (cx < (area.x0 + area.x1) / 2) ? -1 : 1, up = (cz < (area.z0 + area.z1) / 2) ? -1 : 1;
  const alongX = (e.at.z1 - e.at.z0) > (e.at.x1 - e.at.x0);
  const start = alongX ? [cx - side * 14, 44] : [0, cz - up * 14];
  const result = await page.evaluate(([start, alongX, side, up]) => {
    const g = window.__game, p = g.player;
    p.teleport(start[0], start[1]);
    p.keys.clear(); p.vel.set(0, 0, 0);
    // key W moves toward -z for camera yaw 0; D toward +x
    const key = alongX ? (side > 0 ? 'KeyD' : 'KeyA') : (up > 0 ? 'KeyS' : 'KeyW');
    p.keys.add(key);
    const log = { panelEarly: false, panelWhenStopped: false };
    let stoppedFor = 0, last = [p.pos.x, p.pos.z];
    for (let i = 0; i < 60 * 25; i++) {
      p.update(1 / 60, 0);
      g.hud.update(1 / 60, 13, 0, p.pos);
      const on = document.getElementById('exit').classList.contains('on');
      const moved = Math.hypot(p.pos.x - last[0], p.pos.z - last[1]);
      last = [p.pos.x, p.pos.z];
      stoppedFor = moved < 0.001 ? stoppedFor + 1 : 0;
      if (stoppedFor === 1 && !on) log.stoppedWithoutPanel = [p.pos.x, p.pos.z];
      if (stoppedFor > 30) { log.panelWhenStopped = on; log.at = [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]; break; }
    }
    log.cameraTarget = [+g.drone.target.x.toFixed(2), +g.drone.target.z.toFixed(2)];
    return log;
  }, [start, alongX, side, up]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/exit-${i}.png` });
  console.log(e.name, JSON.stringify(result));
}
await browser.close();
