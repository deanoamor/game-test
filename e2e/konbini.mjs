import { chromium } from 'playwright-core';
import fs from 'node:fs';
// World 3, Hoshi Mart: the shop seen from the game camera (day and night), the clerk behind the counter (talk), and the way
// in and out through the door in World 1. OUT=dir. Start the dev server first.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const ready = async () => { await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 }); };
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const state = () => page.evaluate(() => { const g = window.__game, p = g.player.pos; return { world: g.hud.world.key, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], panel: document.getElementById('exit').classList.contains('on') ? document.getElementById('exitName').textContent : null, note: document.getElementById('exitNote').textContent, npcs: g.npcs.map((n) => [n.def.id, +n.pos.x.toFixed(2), +n.pos.z.toFixed(2)]) }; });

// ---- inside the shop
await page.goto('http://localhost:5300/?world=konbini&q=medium&pause=1&t=14');
await ready(); await frames(3);
let s = await state();
ok('in the shop with the clerk', s.world === 'konbini' && s.npcs.length === 1 && s.npcs[0][0] === 'clerk', JSON.stringify(s));
await page.screenshot({ path: `${OUT}/konbini-day.png` });
await page.evaluate(() => { const d = window.__game.drone; d.setView(1.5, -0.5, 200, 52, 17); });
await frames(3);
await page.screenshot({ path: `${OUT}/konbini-day2.png` });
// the player cannot reach the clerk's side: try walking to the counter's back from the shop floor
const reach = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  const tries = [[2.4, -3.1], [4.9, -3.0], [0.9, -3.4]];
  const out = [];
  for (const [tx, tz] of tries) {
    p.teleport(-1.0, -2.0);
    for (let i = 0; i < 900; i++) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z; if (Math.hypot(dx, dz) < 0.15) break;
      const cam = g.drone.yaw, ix = dx * Math.cos(cam) - dz * Math.sin(cam), iz = dx * Math.sin(cam) + dz * Math.cos(cam);
      const a = Math.atan2(iz, ix), q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      p.keys.clear(); const kx = Math.round(Math.cos(q)), kz = Math.round(Math.sin(q));
      if (kz < 0) p.keys.add('KeyW'); if (kz > 0) p.keys.add('KeyS'); if (kx < 0) p.keys.add('KeyA'); if (kx > 0) p.keys.add('KeyD');
      p.update(1 / 60, cam);
    }
    p.keys.clear();
    out.push([+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]);
  }
  return out;
});
ok('the clerk\'s side of the counter is closed', reach.every(([x, z]) => !(x > 0.9 && z < -2.65) && !(x > 0.15 && x < 0.9 && z < -2.2)), JSON.stringify(reach));
// talk to the clerk across the counter
await page.evaluate(() => { const g = window.__game, n = g.npcs[0]; g.player.teleport(n.pos.x, -1.2); for (let i = 0; i < 120; i++) n.update(1 / 60, g.player.pos); });
await frames(3);
await page.keyboard.press('KeyF');
await frames(3);
const talk = await page.evaluate(() => ({ talking: window.__game.talk.talking, text: document.querySelector('#talk p')?.textContent }));
ok('talking to Kenta', talk.talking && /Irasshaimase/.test(talk.text), JSON.stringify(talk));
await page.screenshot({ path: `${OUT}/konbini-talk.png` });
await page.keyboard.press('Escape');
// night
await page.goto('http://localhost:5300/?world=konbini&q=medium&pause=1&t=22');
await ready(); await frames(3);
await page.screenshot({ path: `${OUT}/konbini-night.png` });

// ---- the way in, from World 1
await page.goto('http://localhost:5300/?world=ekimae&q=low&pause=1&t=15.5');
await ready();
const door = await page.evaluate(() => { const e = window.__game.hud.world.exits.find((x) => x.to === 'konbini'); return { at: e.at, out: window.__game.hud.world.spawns.konbini }; });
ok('the shop door is known', door.at.x1 > door.at.x0 && door.at.z1 > 40, JSON.stringify(door));
const cx = (door.at.x0 + door.at.x1) / 2, cz = (door.at.z0 + door.at.z1) / 2;
await page.evaluate(([x, z]) => { const g = window.__game; g.player.teleport(x, z); g.hud.update(0.016, 15, 0, g.player.pos); }, [cx, cz]);
s = await state();
ok('at the door the panel comes up', s.panel && /Hoshi Mart/.test(s.panel) && /Enter/.test(s.note), JSON.stringify(s));
await page.evaluate(([x, z]) => { const g = window.__game; g.drone.setView(x, z, 160, 28, 14); }, [cx, cz]);
await frames(3);
await page.screenshot({ path: `${OUT}/konbini-door.png` });
// walk to the door from the street in front of the car park (can she reach it?)
const reachDoor = await page.evaluate(([x, z]) => {
  const g = window.__game, p = g.player;
  p.teleport(x, z - 6);
  for (let i = 0; i < 1500; i++) {
    const dx = x - p.pos.x, dz = z - p.pos.z; if (Math.hypot(dx, dz) < 0.2) break;
    const cam = g.drone.yaw, ix = dx * Math.cos(cam) - dz * Math.sin(cam), iz = dx * Math.sin(cam) + dz * Math.cos(cam);
    const a = Math.atan2(iz, ix), q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    p.keys.clear(); const kx = Math.round(Math.cos(q)), kz = Math.round(Math.sin(q));
    if (kz < 0) p.keys.add('KeyW'); if (kz > 0) p.keys.add('KeyS'); if (kx < 0) p.keys.add('KeyA'); if (kx > 0) p.keys.add('KeyD');
    p.update(1 / 60, cam); g.hud.update(1 / 60, 15, 0, p.pos);
    if (document.getElementById('exit').classList.contains('on')) break;
  }
  return document.getElementById('exit').classList.contains('on');
}, [cx, cz]);
ok('she can walk up to the door', reachDoor);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'konbini' && window.__game.frames() > 4, null, { timeout: 240000 });
await frames(3);
s = await state();
ok('inside Hoshi Mart, inside the door', s.world === 'konbini' && s.pos[2] < -1.5 && s.pos[2] > -3.5, JSON.stringify(s.pos));
// out again
await page.evaluate(() => { const g = window.__game; g.player.teleport(-3, -3.5); g.hud.update(0.016, 15, 0, g.player.pos); });
s = await state();
ok('at the inner door the panel offers "Go out"', s.panel && /Automatic door/.test(s.panel), JSON.stringify(s));
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'ekimae' && window.__game.frames() > 4, null, { timeout: 240000 });
await frames(3);
s = await state();
ok('back on the street in front of the shop', s.world === 'ekimae' && Math.abs(s.pos[0] - ((door.at.x0 + door.at.x1) / 2)) < 0.8 && s.pos[2] < cz + 0.5 + 6 && s.pos[2] > cz - 6, JSON.stringify(s.pos));
await page.screenshot({ path: `${OUT}/konbini-back.png` });
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
