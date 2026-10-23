import { chromium } from 'playwright-core';
// The people on the pavements of World 1: how many follows the clock, they wait at the kerb for the signal and never walk
// onto a zebra while the cars have the green, they stop for the player, and the cars stop for them. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
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
// they stop for the player
const stop = await page.evaluate(() => {
  const g = window.__game, c = g.crowd, w = c.walkers.find((x) => x.on && !x.waiting);
  if (!w) return null;
  const p = g.player;
  // put her right in front of it, on its way
  const ang = w.group.rotation.y;
  p.teleport(w.pos.x + Math.sin(ang) * 0.9, w.pos.z + Math.cos(ang) * 0.9);
  const before = [w.pos.x, w.pos.z];
  for (let i = 0; i < 90; i++) w.update(1 / 30, g.signals, p.pos);
  return Math.hypot(w.pos.x - before[0], w.pos.z - before[1]);
});
ok('a person stops for the player in the way', stop !== null && stop < 0.6, `${stop} m in three seconds`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
