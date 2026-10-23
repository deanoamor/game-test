import { chromium } from 'playwright-core';
// The traffic follows the clock: busy in the morning, lighter at noon, busy again from the afternoon to the evening, quiet
// from 10 at night until dawn. Counts the cars on the road at several hours, and checks cars come and go (far from the
// camera) when the clock moves. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 460 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const count = {};
for (const h of [3, 8, 12.5, 16, 18.5, 23]) {
  await page.goto(`http://localhost:5300/?world=ekimae&q=low&pause=1&t=${h}`);
  await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
  count[h] = await page.evaluate(() => { const t = window.__game.traffic; return { on: t.active, all: t.cars.length }; });
}
console.log(JSON.stringify(count));
const n = (h) => count[h].on;
ok('the morning is busy', n(8) > n(12.5) * 1.5, `${n(8)} vs noon ${n(12.5)}`);
ok('noon is lighter than the morning and the evening', n(12.5) < n(8) && n(12.5) < n(18.5), `${n(12.5)}`);
ok('the evening is busy again', n(18.5) > n(12.5) * 1.5 && n(16) > n(12.5), `${n(16)}, ${n(18.5)}`);
ok('late at night it is quiet', n(23) < n(8) * 0.4 && n(3) < n(8) * 0.3, `23h ${n(23)}, 3h ${n(3)}`);
// the clock moves from the morning rush to the night: the cars go off the road one by one, far from the camera
await page.goto('http://localhost:5300/?world=ekimae&q=low&pause=1&t=8');
await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
const gone = await page.evaluate(() => {
  const g = window.__game, t = g.traffic, before = t.active;
  g.hud.onHour(23.5);
  return before;
});
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.evaluate(() => window.__game.simulate(40)); }
const after = await page.evaluate(() => { const t = window.__game.traffic; const f = t.focus; let near = 0; const m = new window.__game.scene.children[0].matrix.constructor(), p = new (window.__game.player.pos.constructor)(); for (const c of t.cars) { if (!c.on) continue; t.meshes.get(c.kind).getMatrixAt(c.index, m); p.setFromMatrixPosition(m); if (Math.hypot(p.x - f.x, p.z - f.z) < 58) near++; } return { on: t.active, near }; });
ok('cars leave the road when the night comes', after.on < gone * 0.6, `${gone} -> ${after.on}`);
ok('and only far from the camera (what is near stays)', after.on >= after.near, JSON.stringify(after));
await page.evaluate(() => window.__game.hud.onHour(8));
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.evaluate(() => window.__game.simulate(40)); }
const back = await page.evaluate(() => window.__game.traffic.active);
ok('and they come back with the morning', back > after.on * 1.5, `${after.on} -> ${back}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
