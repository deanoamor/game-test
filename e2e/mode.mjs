import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Game mode and dev mode: the game starts in World 1 whatever the address says, has no world menu, no clock controls and no
// places; the lock asks for a password, a wrong one does nothing, the right one opens dev mode (everything, and the options
// in the address work); the badge brings her back to the game. Start the dev server first. OUT=dir.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const ready = () => page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 });
const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }, sel);
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };

// ---- the game: whatever the address asks for, World 1, morning, no dev things
await page.goto('http://localhost:5300/?world=npclab&t=22&pause=1&yaw=40&q=low#world=full');
await ready();
let s = await page.evaluate(() => ({ world: window.__game.hud.world.key, hour: window.__game.hour(), body: document.body.className, paused: document.getElementById('play').textContent }));
ok('the game starts in World 1, at eight, whatever the address says', s.world === 'ekimae' && Math.abs(s.hour - 8) < 0.3 && /game/.test(s.body), JSON.stringify(s));
ok('there is no world menu, clock slider, pause button or places list', !(await vis('#world')) && !(await vis('#hour')) && !(await vis('#play')) && !(await vis('#places')));
ok('but the clock shows, and the bag, sound and graphics are there', (await vis('#clock')) && (await vis('#bagBtn')) && (await vis('#quality')) && (await vis('#sound')));
ok('the clock runs by itself', await (async () => { const h0 = await page.evaluate(() => window.__game.hour()); await page.waitForTimeout(2500); return (await page.evaluate(() => window.__game.hour())) > h0; })());
// the keys that would change things do nothing
const h1 = await page.evaluate(() => window.__game.hour());
await page.keyboard.press('KeyT'); await page.keyboard.press('Digit3');
await frames(3);
s = await page.evaluate(() => ({ hour: window.__game.hour(), x: window.__game.player.pos.x, z: window.__game.player.pos.z }));
ok('T and the number keys do nothing', s.hour >= h1 && s.hour < h1 + 0.1 && Math.abs(s.x - -5) < 1 && Math.abs(s.z - 38.6) < 1, JSON.stringify(s));
await page.evaluate(() => { const m = document.getElementById('mini').getBoundingClientRect(); window.__minimap = m; });
await page.mouse.click(10, 10);
ok('B opens the bag', await (async () => { await page.keyboard.press('KeyB'); await frames(2); return page.evaluate(() => document.getElementById('bag').classList.contains('on')); })());
await page.keyboard.press('Escape');
await page.screenshot({ path: `${OUT}/mode-game.png` });
// the doors still go (the game has them), but not the other worlds
await page.evaluate(() => { const g = window.__game; g.player.teleport(12.7, 56.3); g.hud.update(0.016, 15, 0, g.player.pos); });
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'konbini' && window.__game.frames() > 4, null, { timeout: 240000 });
ok('through the shop door she is in Hoshi Mart', true);
await page.goto('http://localhost:5300/#world=npclab');
await ready();
ok('typing another world in the address does not take her there', (await page.evaluate(() => window.__game.hud.world.key)) === 'ekimae');

// ---- the lock
ok('the lock is in the corner', await vis('#devBtn'));
await page.click('#devBtn');
ok('it asks for the password', await vis('#devBox input'));
await page.fill('#devBox input', 'wrong');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
ok('a wrong password: "Wrong password." and still the game', /Wrong/.test(await page.textContent('#devBox .msg')) && (await page.evaluate(() => document.body.classList.contains('game'))));
await page.fill('#devBox input', 'akuganteng');
await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
await ready();
s = await page.evaluate(() => ({ body: document.body.className, world: window.__game.hud.world.key }));
ok('the right password opens dev mode', /dev/.test(s.body) && !/game/.test(s.body), JSON.stringify(s));
ok('with the world menu, the clock, the places and the badge', (await vis('#world')) && (await vis('#hour')) && (await vis('#play')) && (await vis('#devBadge')));
await page.screenshot({ path: `${OUT}/mode-dev.png` });
await page.goto('http://localhost:5300/?world=npclab&t=22&pause=1');
await ready();
s = await page.evaluate(() => ({ world: window.__game.hud.world.key, hour: window.__game.hour() }));
ok('in dev mode the address options work (the test room, ten at night)', s.world === 'npclab' && Math.abs(s.hour - 22) < 0.3, JSON.stringify(s));
await page.evaluate(() => document.querySelector('#devBadge button').click());
await page.waitForTimeout(500);
await ready();
s = await page.evaluate(() => ({ world: window.__game.hud.world.key, body: document.body.className, search: location.search }));
ok('the badge brings her back to the game, at World 1', s.world === 'ekimae' && /game/.test(s.body) && s.search === '', JSON.stringify(s));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
