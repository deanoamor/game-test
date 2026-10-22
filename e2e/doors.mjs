import { chromium } from 'playwright-core';
import fs from 'node:fs';
// The way in and out of her home, as a player does it: walk up the stairs to the landing, the door panel comes up,
// press Enter, the next world loads; walk to the front door, press Space, and she is back on the landing.
// (Her walking is stepped by hand: a headless browser draws too few frames to walk her in real time.) OUT=dir.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 460 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const ready = async () => { await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 }); };
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };
const state = () => page.evaluate(() => { const g = window.__game, p = g.player.pos; return { world: g.hud.world.key, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], hour: +g.hour().toFixed(2), panel: document.getElementById('exit').classList.contains('on') ? document.getElementById('exitName').textContent : null, label: document.getElementById('exitLabel').textContent, note: document.getElementById('exitNote').textContent }; });
const steps = [];
const ok = (name, cond, extra) => { steps.push(!!cond); console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
/** Walk her toward (tx, tz) with the eight keys as the camera sees them, until the door panel is up (or the time is out). */
const walk = (tx, tz, seconds) => page.evaluate(([tx, tz, seconds]) => {
  const g = window.__game, p = g.player, cam = g.drone.yaw;
  for (let i = 0; i < seconds * 60; i++) {
    const dx = tx - p.pos.x, dz = tz - p.pos.z;
    if (Math.hypot(dx, dz) < 0.1) break;
    const ix = dx * Math.cos(cam) - dz * Math.sin(cam), iz = dx * Math.sin(cam) + dz * Math.cos(cam);
    const a = Math.atan2(iz, ix), q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    const kx = Math.round(Math.cos(q)), kz = Math.round(Math.sin(q));
    p.keys.clear();
    if (kz < 0) p.keys.add('KeyW'); if (kz > 0) p.keys.add('KeyS'); if (kx < 0) p.keys.add('KeyA'); if (kx > 0) p.keys.add('KeyD');
    p.update(1 / 60, cam);
    g.hud.update(1 / 60, g.hour(), 0, p.pos);
    if (document.getElementById('exit').classList.contains('on')) break;
  }
  p.keys.clear();
}, [tx, tz, seconds]);

await page.goto('http://localhost:5300/?world=ekimae&q=low&pause=1&t=15.5');
await ready();
const door = await page.evaluate(() => { const e = window.__game.hud.world.exits.find((x) => x.door); return { at: e.at, minY: e.door.minY, out: window.__game.hud.world.spawns.home }; });
ok('the door is known', door.at.x1 > door.at.x0, JSON.stringify(door.at));
const cx = (door.at.x0 + door.at.x1) / 2, cz = (door.at.z0 + door.at.z1) / 2;
// from the foot of the stairs, straight up
await page.evaluate(([x, z]) => { window.__game.player.teleport(x, z); }, [cx, door.at.z1 + 4.6]);
let s = await state();
ok('at the foot of the stairs: no panel', !s.panel, JSON.stringify(s.pos));
await walk(cx, cz, 14);
s = await state();
ok('climbing brings up the door panel', s.panel === 'Home · 自宅' && s.label === 'Door' && /Press Enter to go in/.test(s.note), JSON.stringify(s));
ok('and she is up on the landing', s.pos[1] > door.minY, `y=${s.pos[1]}`);
await frames(2);
await page.screenshot({ path: `${OUT}/door-panel.png` });
// under the landing, on the street: not offered
await page.evaluate(([x, z]) => { const g = window.__game; g.player.teleport(x, z + 6); g.player.pos.set(x, 12.17, z); g.hud.update(0.016, 15, 0, g.player.pos); }, [cx, cz]);
s = await state();
ok('not from the street under the landing', !s.panel, JSON.stringify(s.pos));
// Enter takes the door
await page.evaluate(([x, z]) => { const g = window.__game; g.player.teleport(x, z); g.hud.update(0.016, 15, 0, g.player.pos); }, [cx, cz]);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'home' && window.__game.frames() > 4, null, { timeout: 240000 });
await frames(3);
s = await state();
ok('inside her home', s.world === 'home', JSON.stringify(s));
ok('in the entrance', s.pos[0] < -2.2 && s.pos[2] < -2.7, JSON.stringify(s.pos));
ok('the clock carried over', Math.abs(s.hour - 15.5) < 0.1, `hour=${s.hour}`);
ok('no door panel on arrival', !s.panel);
await page.screenshot({ path: `${OUT}/home-arrive.png` });
// to the front door
await walk(-3.1, -4.2, 8);
s = await state();
ok('the panel is up at the front door', s.panel && /Front door/.test(s.panel) && /go out/i.test(s.note), JSON.stringify(s));
await frames(2);
await page.screenshot({ path: `${OUT}/home-door.png` });
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'ekimae' && window.__game.frames() > 4, null, { timeout: 240000 });
await frames(3);
s = await state();
ok('back in the town', s.world === 'ekimae', JSON.stringify(s));
ok('at the top of the stairs, facing down them', Math.abs(s.pos[0] - door.out.x) < 0.2 && Math.abs(s.pos[2] - door.out.z) < 0.4 && s.pos[1] > 14, JSON.stringify(s.pos));
ok('no panel yet', !s.panel, JSON.stringify(s));
ok('the clock came back too', Math.abs(s.hour - 15.5) < 0.1, `hour=${s.hour}`);
await page.screenshot({ path: `${OUT}/back-out.png` });
console.log(errs.slice(0, 5));
console.log(steps.every(Boolean) ? 'ALL OK' : 'SOME FAILED');
await browser.close();
