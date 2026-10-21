import { chromium } from 'playwright-core';
// Every flight of stairs in the world, approached the way a player does: from several spots on the pavement, with the
// camera turned every which way, steering with the 8 keyboard directions toward the top of the flight.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
const out = await page.evaluate(() => {
  const g = window.__game, p = g.player, b = p.bounds;
  const walks = [...new Set([...p.grid.values()].flat())].filter((s) => s.t === 'walk' && s.x > b.x0 && s.x < b.x1 && s.z > b.z0 - 8 && s.z < b.z1 + 8);
  const results = [];
  for (const w of walks) {
    const L = w.len + w.land, nx = w.dz, nz = -w.dx;
    let ok = 0, tot = 0; const fails = [];
    for (const back of [1.5, 3]) for (const side of [-1.5, -0.75, 0, 0.75, 1.5]) for (const camDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      tot++;
      p.teleport(w.x - w.dx * back + nx * side, w.z - w.dz * back + nz * side);
      p.keys.clear(); p.vel.set(0, 0, 0);
      const cam = (camDeg * Math.PI) / 180, topX = w.x + w.dx * L, topZ = w.z + w.dz * L;
      let reached = false;
      for (let i = 0; i < 60 * 14; i++) {
        // the direction to the foot first, then the top: quantised to the 8 key directions as seen from the camera
        const foot = p.pos.y < w.y0 + 0.3 && Math.hypot(p.pos.x - w.x, p.pos.z - w.z) > 0.35 && ((p.pos.x - w.x) * w.dx + (p.pos.z - w.z) * w.dz) < 0;
        const tx = foot ? w.x : topX, tz = foot ? w.z : topZ;
        const dx = tx - p.pos.x, dz = tz - p.pos.z;
        // ground vector -> screen keys: the key vector is (ix cos + iz sin, -ix sin + iz cos), so invert it
        const ix = dx * Math.cos(cam) - dz * Math.sin(cam), iz = dx * Math.sin(cam) + dz * Math.cos(cam);
        const a = Math.atan2(iz, ix), q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
        const kx = Math.round(Math.cos(q)), kz = Math.round(Math.sin(q));
        p.keys.clear();
        if (kz < 0) p.keys.add('KeyW'); if (kz > 0) p.keys.add('KeyS'); if (kx < 0) p.keys.add('KeyA'); if (kx > 0) p.keys.add('KeyD');
        p.update(1 / 60, cam);
        if (p.pos.y > w.y1 - 0.4) { reached = true; break; }
      }
      if (reached) ok++; else fails.push({ back, side, camDeg, at: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)] });
    }
    results.push({ at: [+w.x.toFixed(1), +w.z.toFixed(1)], dir: [w.dx.toFixed(1), w.dz.toFixed(1)], ok, tot, fails: fails.slice(0, 4) });
  }
  return results;
});
for (const r of out) console.log(JSON.stringify(r));
await browser.close();
