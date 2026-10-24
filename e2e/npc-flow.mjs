import { chromium } from 'playwright-core';
import fs from 'node:fs';
// What an NPC does in the test room, as the game runs it: she walks her route and waits at each point, waves when the
// player comes near, can be talked to with F (the lines come one after the other, the player stands still), and the
// player cannot walk through her. (The simulation is stepped by hand: a headless browser draws too few frames.)
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const steps = [];
const ok = (name, cond, extra) => { steps.push(!!cond); console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
await page.goto('http://localhost:5300/?world=npclab&q=low&pause=1&t=12');
await page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };

// 1. her round: she visits every point of her route, and waits at each
const round = await page.evaluate(() => {
  const g = window.__game, n = g.npcs[0], route = n.def.route;
  g.player.teleport(-10, 8); // far away: nothing to wave at
  const visited = new Set(), states = new Set(); let maxSpeed = 0, last = n.pos.clone();
  for (let i = 0; i < 60 * 70; i++) {
    n.update(1 / 60, g.player.pos);
    states.add(n.state);
    maxSpeed = Math.max(maxSpeed, n.pos.distanceTo(last) * 60); last.copy(n.pos);
    route.forEach((p, k) => { if (Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 0.3) visited.add(k); });
  }
  return { visited: [...visited], states: [...states], maxSpeed: +maxSpeed.toFixed(2), want: route.length };
});
ok('she walks to every point of her route', round.visited.length === round.want, JSON.stringify(round));
ok('she both walks and waits', round.states.includes('walk') && round.states.includes('wait'));
ok('at a gentle pace', round.maxSpeed > 0.5 && round.maxSpeed < 1.6, `max ${round.maxSpeed} m/s`);

// 2. the player comes near: she waves (and says hello over her head), once, then lets it be for a while
const wave = await page.evaluate(() => {
  const g = window.__game, n = g.npcs[0], out = {};
  g.player.teleport(-10, 8);
  for (let i = 0; i < 60; i++) n.update(1 / 60, g.player.pos);
  out.before = n.gesture;
  g.player.teleport(n.pos.x + 1, n.pos.z + 4.2);
  for (let i = 0; i < 40; i++) n.update(1 / 60, g.player.pos);
  out.during = n.gesture; out.bubble = n.bubble;
  for (let i = 0; i < 60 * 4; i++) n.update(1 / 60, g.player.pos);
  out.after = n.gesture; out.bubbleAfter = n.bubble;
  for (let i = 0; i < 60 * 5; i++) n.update(1 / 60, g.player.pos);
  out.again = n.gesture;
  return out;
});
ok('no wave while the player is far', wave.before === null, JSON.stringify(wave));
ok('she waves when the player comes near, saying hello', wave.during === 'wave' && wave.bubble === 'Oh, hello!');
ok('and stops after a moment', wave.after === null && wave.bubbleAfter === null);
ok('not again straight away', wave.again === null);

// 3. talking: F near her
await page.evaluate(() => { const g = window.__game, n = g.npcs[0]; g.player.teleport(n.pos.x + 0.1, n.pos.z + 1.7); });
await frames(3);
let t = await page.evaluate(() => ({ on: document.getElementById('talk').classList.contains('on'), who: document.querySelector('#talk .who').textContent, hint: document.querySelector('#talk .hint').textContent }));
ok('near her, the prompt says F: talk', t.on && /Nurse Hanae/.test(t.who) && t.hint === 'F: talk', JSON.stringify(t));
await page.keyboard.press('KeyF');
await frames(2);
t = await page.evaluate(() => ({ text: document.querySelector('#talk p').textContent, hint: document.querySelector('#talk .hint').textContent, frozen: window.__game.player.frozen, state: window.__game.npcs[0].state }));
ok('F starts it: her first line, and the player stands still', /Oh, hello there/.test(t.text) && t.frozen && t.state === 'talk', JSON.stringify(t));
await page.screenshot({ path: `${OUT}/npc-talk-ui.png` });
// the player cannot walk away while it lasts
const before = await page.evaluate(() => window.__game.player.pos.toArray());
await page.evaluate(() => { const p = window.__game.player; p.keys.add('KeyW'); for (let i = 0; i < 60; i++) p.update(1 / 60, 0); p.keys.clear(); });
const after = await page.evaluate(() => window.__game.player.pos.toArray());
ok('the player does not move while talking', Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.05);
for (let k = 1; k < 4; k++) {
  await page.keyboard.press('KeyF');
  await frames(1);
}
t = await page.evaluate(() => ({ text: document.querySelector('#talk p').textContent, hint: document.querySelector('#talk .hint').textContent }));
ok('F goes on to the next lines, the last says goodbye', /Take care now/.test(t.text) && t.hint === 'F: goodbye', JSON.stringify(t));
await page.keyboard.press('KeyF');
await frames(2);
t = await page.evaluate(() => ({ frozen: window.__game.player.frozen, state: window.__game.npcs[0].state, talking: window.__game.talk.talking }));
ok('after the last line, both are free again', !t.frozen && t.state !== 'talk' && !t.talking, JSON.stringify(t));

// 4. she is solid: the player cannot walk through her
const solid = await page.evaluate(() => {
  const g = window.__game, n = g.npcs[0], p = g.player;
  p.teleport(n.pos.x + 0.05, n.pos.z + 0.05);
  return Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
});
ok('the player cannot stand inside her', solid >= 0.5, `${solid.toFixed(2)} m apart`);
console.log(errs.slice(0, 5));
console.log(steps.every(Boolean) ? 'ALL OK' : 'SOME FAILED');
await browser.close();
