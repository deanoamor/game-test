import { chromium } from 'playwright-core';
import fs from 'node:fs';
// A top view of a world with the player's obstacles drawn over it (red: buildings, blue: street furniture).
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const [cx, cz, dist] = (process.env.VIEW || '-7,44,95').split(',').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13&tx=${cx}&tz=${cz}&yaw=0&pitch=89.5&dist=${dist}`);
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
await page.evaluate(() => { const d = window.__game.drone; d.clearance = false; d.update(0); });
await page.waitForTimeout(500);
const shapes = await page.evaluate(() => {
  const g = window.__game, cam = g.drone.camera, o = g.player.obstacles;
  const V = cam.position.constructor;
  const P = (x, y, z) => { const v = new V(x, y, z).project(cam); return [(v.x + 1) * 700, (1 - v.y) * 500]; };
  const y = g.player.pos.y;
  const all = [...new Set([...g.player.grid.values()].flat())];
  const corner = (s, u, v) => { const a = (s.a * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a); return P(s.x + u * cs + v * sn, y, s.z - u * sn + v * cs); };
  return {
    boxes: all.filter((s) => s.t === 'box').map((s) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => corner(s, a * s.hw, b * s.hd))),
    walks: all.filter((s) => s.t === 'walk').map((s) => { const L = s.len + s.land, nx = s.dz, nz = -s.dx; return [[0, -1], [L, -1], [L, 1], [0, 1]].map(([t, k]) => P(s.x + s.dx * t + nx * k * s.hw, y, s.z + s.dz * t + nz * k * s.hw)); }),
    player: P(g.player.pos.x, y, g.player.pos.z),
    // edges she cannot step over (more than a curb up or down), on a 0.25 m grid over the world's bounds
    steps: (() => {
      const pl = g.player, b = pl.bounds, out = [];
      for (let z = b.z0; z <= b.z1; z += 0.25) for (let x = b.x0; x <= b.x1; x += 0.25) {
        const h = pl.groundY(x, z);
        if (Math.abs(pl.groundY(x + 0.25, z) - h) > 0.32 || Math.abs(pl.groundY(x, z + 0.25) - h) > 0.32) out.push(P(x, y, z));
      }
      return out;
    })(),
  };
});
await page.screenshot({ path: `${OUT}/obstacles-base.png` });
fs.writeFileSync(`${OUT}/obstacles.json`, JSON.stringify(shapes));
await browser.close();
