import { chromium } from 'playwright-core';
// Floods the home with the player's own movement rules from where she arrives and checks that every room (and the
// spots in front of the main furniture) can be reached.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://localhost:5300/?shot=1&world=home&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
const res = await page.evaluate(() => {
  const g = window.__game, pl = g.player, b = pl.bounds, H = 0.1;
  const key = (i, j) => i + ',' + j, seen = new Map();
  const V = pl.pos.constructor;
  const q = [[Math.round(pl.pos.x / H), Math.round(pl.pos.z / H)]];
  seen.set(key(...q[0]), pl.groundY(pl.pos.x, pl.pos.z));
  while (q.length) {
    const [i, j] = q.pop(), y = seen.get(key(i, j));
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k)) continue;
      const x = ni * H, z = nj * H;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      const t = new V(x, 0, z); pl.collide(t);
      if (Math.hypot(t.x - x, t.z - z) > 0.02) continue;
      const ny = pl.groundY(x, z);
      if (Math.abs(ny - y) > 0.32) continue;
      seen.set(k, ny); q.push([ni, nj]);
    }
  }
  const reach = (x, z, r = 0.25) => { for (let dx = -r; dx <= r; dx += H) for (let dz = -r; dz <= r; dz += H) if (seen.has(key(Math.round((x + dx) / H), Math.round((z + dz) / H)))) return true; return false; };
  const spots = { genkan: [-3.1, -3.6], hall: [-3.1, -1.0], 'in front of the shoe cabinet': [-2.8, -3.7], kitchen: [-0.5, -3.3], 'at the dining table': [-0.5, -1.0], 'in front of the TV': [2.6, -3.6], kotatsu: [2.7, -0.9], living: [3.2, 0.3], bedroom: [0.9, 1.6], 'at the desk': [2.0, 2.4], 'by the bed': [-0.8, 2.5], 'by the wardrobe': [3.0, 3.0], bathroom: [-3.15, 2.5], 'by the tub': [-2.62, 3.1], 'by the basin': [-3.2, 1.5] };
  const out = {};
  for (const [k, [x, z]] of Object.entries(spots)) out[k] = reach(x, z);
  return { cells: seen.size, out, area: Math.round(seen.size * H * H) };
});
console.log(res.cells, 'cells', res.area, 'm²');
let bad = 0;
for (const [k, v] of Object.entries(res.out)) { if (!v) bad++; console.log(v ? 'OK  ' : 'FAIL', k); }
console.log(bad ? 'SOME UNREACHABLE' : 'ALL REACHABLE');
await browser.close();
