import { chromium } from 'playwright-core';
// The people on the pavements of World 1: how many follows the clock, they wait at the kerb for the signal and never walk
// onto a zebra while the cars have the green, they stop for the player, and the cars stop for them. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const load = async (t) => { await page.goto(`http://localhost:5300/?world=ekimae&q=low&pause=1&t=${t}`); await page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 }); await page.waitForFunction(() => window.__game.crowd.ready, null, { timeout: 120000 }); await page.waitForTimeout(1500); };
const counts = {};
for (const h of [3, 8, 12.5, 18, 23]) { await load(h); counts[h] = await page.evaluate(() => window.__game.crowd.active); }
console.log(JSON.stringify(counts));
ok('the morning and the evening are busy, the night is quiet', counts[8] >= 12 && counts[18] >= 12 && counts[3] <= 3 && counts[23] <= 4 && counts[12.5] > counts[3], JSON.stringify(counts));
ok('they are different people', await page.evaluate(() => new Set(window.__game.crowd.walkers.map((w) => w.model)).size >= 16));
await load(8);
ok('no names, no talking: strangers are not NPCs', await page.evaluate(() => window.__game.npcs.length === 0 && !document.querySelector('.npcTag')));
// the clock runs ahead in steps of 1/30 s: nobody is on a zebra while the cars have the green
const run = await page.evaluate(() => {
  const g = window.__game, c = g.crowd, sg = g.signals, tr = g.traffic;
  g.player.teleport(-30, 60);
  let onMainZebra = 0, onCrossZebra = 0, badMain = 0, badCross = 0, waited = 0, crossed = 0, minGapCar = 1e9, ever = new Set();
  const m = new g.scene.children[0].matrix.constructor(), p = new (g.player.pos.constructor)();
  for (let i = 0; i < 30 * 220; i++) {
    sg.step(1 / 30); tr.blockers.length = 0; for (const b of c.blockers) tr.blockers.push(b); tr.step(1 / 30); c.update(1 / 30, sg, g.player.pos);
    for (const w of c.walkers) {
      if (!w.on) continue;
      const x = w.pos.x, z = w.pos.z;
      if (Math.abs(Math.abs(x) - 5.4) < 1.8 && z > 40.6 && z < 47.4) { onMainZebra++; ever.add(w.model); if (sg.light('main') === 'green') badMain++; }
      if (Math.abs(x) < 3.2 && (Math.abs(z - 38.4) < 1.2 || Math.abs(z - 49.6) < 1.2)) { onCrossZebra++; if (sg.light('cross') === 'green') badCross++; }
      if (w.waiting) waited++;
    }
    if (i % 15 === 0) for (const w of c.walkers) { if (!w.on) continue; for (const car of tr.cars) { if (!car.on) continue; tr.meshes.get(car.kind).getMatrixAt(car.index, m); p.setFromMatrixPosition(m); minGapCar = Math.min(minGapCar, Math.hypot(p.x - w.pos.x, p.z - w.pos.z) - car.wid / 2 - 0.3); } }
  }
  return { onMainZebra, onCrossZebra, badMain, badCross, waited, crossedModels: ever.size, minGapCar: +minGapCar.toFixed(2) };
});
console.log(JSON.stringify(run));
ok('they cross the main street (the zebra is used)', run.onMainZebra > 0);
ok('they wait at the kerb for the signal', run.waited > 100);
ok('nobody is on the zebra over the main street while the main cars have green', run.badMain === 0, `${run.badMain} frames`);
ok('nor on the one over the cross street while its cars have green', run.badCross === 0 && run.onCrossZebra > 0, `${run.badCross} frames, ${run.onCrossZebra} on it in all`);
ok('no car drives through anyone', run.minGapCar > -0.25, `${run.minGapCar} m between a car and a person`);
// they stop for the player, and if she stays in the way they get cross (twice) and go round her
const stop = await page.evaluate(() => {
  const g = window.__game, c = g.crowd, p = g.player;
  // a person walking on the open pavement, with room in front of it for her to stand (she is not pushed off by a wall)
  let w = null, hx = 0, hz = 0;
  for (const x of c.walkers) {
    if (!x.on || x.waiting || !x.path[x.seg] || x.path[x.seg].gate) continue;
    const a = x.group.rotation.y;
    p.teleport(x.pos.x + Math.sin(a) * 0.9, x.pos.z + Math.cos(a) * 0.9);
    if (Math.abs(Math.hypot(p.pos.x - x.pos.x, p.pos.z - x.pos.z) - 0.9) < 0.1) { w = x; hx = Math.sin(a); hz = Math.cos(a); break; }
  }
  if (!w) return null;
  const shouts = []; c.onShout = (x, y, z, text, en) => shouts.push(en);
  const px = p.pos.x, pz = p.pos.z, start = [w.pos.x, w.pos.z];
  const out = { moved1: 0, passed: false, minDist: 1e9, shouts };
  for (let i = 0; i < 30 * 12; i++) {
    w.update(1 / 30, g.signals, p.pos);
    out.minDist = Math.min(out.minDist, Math.hypot(w.pos.x - px, w.pos.z - pz));
    if (i === 30) out.moved1 = Math.hypot(w.pos.x - start[0], w.pos.z - start[1]);
  }
  // how far past her (along the way it was going) it has got
  out.beyond = (w.pos.x - px) * hx + (w.pos.z - pz) * hz;
  out.passed = out.beyond > 0.8;
  return out;
});
ok('a person stops for the player in the way', stop !== null && stop.moved1 < 0.6, JSON.stringify(stop));
ok('and when she stays it says "Excuse me!" and then "Get out of the way!"', stop && stop.shouts[0] === 'Excuse me!' && stop.shouts[1] === 'Get out of the way!', JSON.stringify(stop?.shouts));
ok('then it goes round her and on (it does not wait for ever)', stop && stop.passed, `${stop?.beyond?.toFixed(1)} m past her`);
ok('without walking through her', stop && stop.minDist > 0.58, `${stop?.minDist?.toFixed(2)} m at the closest`);
// she stands right on the point a person is going to (a corner): it must not circle her for ever
const circle = await page.evaluate(() => {
  const g = window.__game, c = g.crowd, p = g.player;
  const w = c.walkers.find((x) => x.on && !x.waiting && x.path[x.seg] && !x.path[x.seg].gate && x.seg + 1 < x.path.length - 1);
  if (!w) return null;
  const t = w.path[w.seg];
  p.teleport(t.x, t.z);
  const shouts = []; c.onShout = (x, y, z, text, en) => shouts.push(en);
  const seg0 = w.seg;
  let nearAfter = 0;
  for (let i = 0; i < 30 * 40; i++) { w.update(1 / 30, g.signals, p.pos); if (i > 30 * 25 && Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z) < 2.2) nearAfter++; }
  return { advanced: w.seg > seg0 || !w.on, shouts: shouts.length, nearAfter, dist: Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z) };
});
ok('standing on its point: it gets by and goes on, it does not circle her', circle !== null && circle.advanced && circle.shouts <= 4 && circle.nearAfter < 30, JSON.stringify(circle));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
