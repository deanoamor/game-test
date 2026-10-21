import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Floods the world from the player's start with the player's own movement rules and draws what she can reach
// (green) over a top view: whatever is left plain and is not inside a building is somewhere she cannot get to.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const [cx, cz, dist] = (process.env.VIEW || '-7,44,100').split(',').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13&tx=${cx}&tz=${cz}&yaw=0&pitch=89.5&dist=${dist}`);
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
await page.evaluate(() => { const d = window.__game.drone; d.clearance = false; d.update(0); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/reach-base.png` });
const res = await page.evaluate(() => {
  const g = window.__game, pl = g.player, cam = g.drone.camera, b = pl.bounds, H = 0.15;
  const V = cam.position.constructor;
  const P = (x, y, z) => { const v = new V(x, y, z).project(cam); return [(v.x + 1) * 700, (1 - v.y) * 500]; };
  const key = (i, j) => i + ',' + j;
  const seen = new Map();
  const i0 = Math.round(pl.pos.x / H), j0 = Math.round(pl.pos.z / H);
  const q = [[i0, j0]];
  seen.set(key(i0, j0), pl.groundY(i0 * H, j0 * H));
  while (q.length) {
    const [i, j] = q.pop();
    const y = seen.get(key(i, j));
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k)) continue;
      const x = ni * H, z = nj * H;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      // the player's own move: pushed out of solids, and no step bigger than a curb
      const t = pl.pos.constructor ? new pl.pos.constructor(x, 0, z) : null;
      pl.collide(t);
      if (Math.hypot(t.x - x, t.z - z) > 0.05) continue;
      const ny = pl.groundY(x, z);
      if (Math.abs(ny - y) > 0.32) continue;
      seen.set(k, ny);
      q.push([ni, nj]);
    }
  }
  // every flight of stairs: can its landing be reached on foot from where she starts?
  const flights = [...new Set([...pl.grid.values()].flat())].filter((w) => w.t === 'walk' && w.x > b.x0 - 8 && w.x < b.x1 + 8 && w.z > b.z0 - 12 && w.z < b.z1 + 12).map((w) => {
    const L = w.len + w.land, tx = w.x + w.dx * (L - 0.3), tz = w.z + w.dz * (L - 0.3);
    let near = 0, top = 0;
    for (const [k, y] of seen) {
      const [i, j] = k.split(',').map(Number), x = i * H, z = j * H;
      if (Math.hypot(x - tx, z - tz) < 1.2 && y > w.y1 - 0.5) top++;
      if (Math.hypot(x - w.x, z - w.z) < 2.5) near++;
    }
    return { at: [+w.x.toFixed(1), +w.z.toFixed(1)], dir: [w.dx, w.dz].map((v) => +v.toFixed(1)), footReached: near, landingReached: top };
  });
  const pts = [], hs = [];
  for (const [k, y] of seen) { const [i, j] = k.split(',').map(Number); pts.push(P(i * H, y, j * H)); hs.push(y); }
  return { pts, hs, n: seen.size, ymax: Math.max(...hs), flights };
});
fs.writeFileSync(`${OUT}/reach.json`, JSON.stringify(res));
console.log('cells', res.n, 'highest', res.ymax.toFixed(2));
for (const f of res.flights) console.log(JSON.stringify(f));
await browser.close();
