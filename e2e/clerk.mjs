import { chromium } from 'playwright-core';
import fs from 'node:fs';
// Close-ups of an NPC doing what she does: standing, walking, waving, talking (start the dev server first).
// NPC=lab (the test room)  OUT=dir. The simulation is stepped by hand: a headless browser draws too few frames.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 520, height: 520 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5300/?shot=1&world=npclab&hud=0&q=medium&pause=1&t=12');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
const look = (yaw, pitch = 12, dist = 4.5) => page.evaluate(([yaw, pitch, dist]) => {
  const g = window.__game, n = g.npcs[1];
  const d = g.drone;
  d.following = true; d.clearance = false;
  d.setView(n.pos.x, n.pos.z, yaw, pitch, dist);
  // (the game's loop keeps pointing the camera at the player: hold it on her instead)
  if (!d.__follow) { d.__follow = d.follow.bind(d); d.follow = () => {}; }
  d.__follow(n.pos.x, n.pos.z, n.pos.y + 0.8); d.update(0);
}, [yaw, pitch, dist]);
const run = (seconds, playerAt) => page.evaluate(([seconds, playerAt]) => {
  const g = window.__game, n = g.npcs[1];
  if (playerAt) g.player.teleport(playerAt[0], playerAt[1]);
  for (let i = 0; i < seconds * 60; i++) n.update(1 / 60, g.player.pos);
}, [seconds, playerAt]);
const shot = async (name, yaw) => { await look(yaw); await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/clerk-${name}.png` }); };
await run(0.5, [-9, 7]); // the player far away: she goes about her round
for (const yaw of [200, 90, 0, 270]) await shot(`idle-${yaw}`, yaw);
await run(1.5);
await shot('walk', 90);
await run(0.7);
await shot('walk2', 90);
// the player comes near: she waves
await page.evaluate(() => { const g = window.__game, n = g.npcs[1]; g.player.teleport(n.pos.x + 1.0, n.pos.z + 3.4); });
await run(1.4);
await shot('wave', 55);
await run(0.3);
await shot('wave2', 40);
// and she is talked to
await page.evaluate(() => { const g = window.__game, n = g.npcs[1]; g.player.teleport(n.pos.x + 0.2, n.pos.z + 1.6); n.startTalk(); });
await run(1.2);
await shot('talk', 50);
await run(0.5);
await shot('talk2', 60);
console.log(errs.slice(0, 5));
await browser.close();
