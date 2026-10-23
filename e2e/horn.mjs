import { chromium } from 'playwright-core';
// Standing in the road: the cars stop short of her, honk (more and more angrily) and the shouts show over them; when she steps away
// they go on. Start the dev server first. OUT=dir for the screenshot.
import fs from 'node:fs';
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
await page.goto('http://localhost:5300/?world=ekimae&q=low&pause=1&t=8');
await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };
await page.evaluate(() => { const g = window.__game; g.__honks = []; const t = g.traffic, old = t.onHonk; t.onHonk = (c) => { g.__honks.push(c.n); old(c); }; });
// on the main street's lane (west of the crossing), where a car must come by
const spot = [-16, 41.9];
await page.evaluate(([x, z]) => { window.__game.player.teleport(x, z); }, spot);
await frames(2);
const run = (sec) => page.evaluate(([sec, x, z]) => {
  const g = window.__game, t = g.traffic;
  g.simulate(sec);
  let min = 1e9, held = 0;
  const m = new g.scene.children[0].matrix.constructor(), p = new (g.player.pos.constructor)();
  for (const c of t.cars) {
    t.meshes.get(c.kind).getMatrixAt(c.index, m); p.setFromMatrixPosition(m);
    min = Math.min(min, Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z));
    if (c.blockT > 0) held++;
  }
  return { min: +min.toFixed(2), held, honks: g.__honks.slice(), pos: [g.player.pos.x, g.player.pos.z] };
}, [sec, spot[0], spot[1]]);
let r = await run(60);
ok('a car was held up by her', r.held > 0 || r.honks.length > 0, JSON.stringify(r));
ok('and it honked', r.honks.length > 0, r.honks.join(','));
ok('no car ran into her', r.min > 1.2, `closest car ${r.min} m`);
const longest = Math.max(0, ...r.honks);
ok('the honks got angrier (more than three)', longest >= 3, `n up to ${longest}`);
await frames(3);
const tags = await page.evaluate(() => [...document.querySelectorAll('.carTag')].map((e) => e.textContent));
ok('the shouts show over the car', tags.length > 0, tags.join(' | '));
// the shot: the camera on the car
await page.screenshot({ path: `${OUT}/horn.png` });
// she steps aside: the cars go on
await page.evaluate(() => { window.__game.player.teleport(-16, 38.6); __honksReset(); function __honksReset() { window.__game.__honks.length = 0; } });
await frames(2);
r = await run(30);
ok('when she steps aside it is quiet again', r.held === 0, JSON.stringify(r));
// she cannot walk through a moving car: put her in the middle of one, and she is pushed out of it
await page.evaluate(() => {
  const g = window.__game, t = g.traffic;
  const m = new g.scene.children[0].matrix.constructor(), P = () => new (g.player.pos.constructor)();
  const at = (c) => { t.meshes.get(c.kind).getMatrixAt(c.index, m); return P().setFromMatrixPosition(m); };
  // a car in the town's streets (in the walkable area)
  const c = t.cars.find((a) => { if (!a.on) return false; const q = at(a); return q.x > -40 && q.x < 30 && q.z > 30 && q.z < 60; }) ?? t.cars[3];
  const p = at(c);
  g.player.teleport(p.x, p.z); g.player.pos.y = p.y; g.__carAt = [p.x, p.z];
});
await frames(3);
const inside = await page.evaluate(() => { const g = window.__game, p = g.player; p.carBlockers = g.traffic.circlesNear(p.pos.x, p.pos.z, 12, p.pos.y); p.update(0, 0); p.carBlockers = g.traffic.circlesNear(p.pos.x, p.pos.z, 12, p.pos.y); let worst = 1e9; for (const c of p.carBlockers) worst = Math.min(worst, Math.hypot(p.pos.x - c.x, p.pos.z - c.z) - c.r); return { worst: +worst.toFixed(2), n: p.carBlockers.length, at: window.__game.__carAt, pos: [p.pos.x, p.pos.y, p.pos.z], circles: p.carBlockers.map((c) => [+c.x.toFixed(1), +c.z.toFixed(1), c.r]) }; });
ok('a moving car is solid for her', inside.n > 0 && inside.worst > 0.2, JSON.stringify(inside));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
