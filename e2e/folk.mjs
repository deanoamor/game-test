import { chromium } from 'playwright-core';
// The ten people of the streets in the NPC test room: all there, each its own look (its own model or colours), the
// walkers walk their routes, and one can be talked to. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
await page.goto('http://localhost:5300/?world=npclab&q=low&pause=1&t=12');
await page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 });
const ids = await page.evaluate(() => window.__game.npcs.map((n) => n.def.id));
ok('the nurse and twenty people', ids.length === 21 && ['haruto', 'daichi', 'hina', 'aoi', 'taiga', 'goro', 'kaito', 'jake', 'kiyo', 'riku', 'tanaka', 'sato', 'gen', 'yamada', 'kobayashi', 'tomi', 'mio', 'rin', 'ken', 'sora'].every((i) => ids.includes(i)), ids.join(','));
const models = await page.evaluate(() => [...new Set(window.__game.npcs.map((n) => n.def.model))]);
ok('they are made from different models', models.length >= 18, models.join(','));
// keep the player far away and let the clock run: the walkers go along their routes, the standing ones stay
const moved = await page.evaluate(() => {
  const g = window.__game; g.player.teleport(-10.5, 8.5);
  const start = Object.fromEntries(g.npcs.map((n) => [n.def.id, [n.pos.x, n.pos.z]]));
  for (let i = 0; i < 60 * 12; i++) for (const n of g.npcs) n.update(1 / 60, g.player.pos);
  return Object.fromEntries(g.npcs.map((n) => [n.def.id, +Math.hypot(n.pos.x - start[n.def.id][0], n.pos.z - start[n.def.id][1]).toFixed(1)]));
});
ok('the walkers walk', ['tanaka', 'gen', 'yamada', 'tomi', 'mio', 'rin', 'ken', 'sora', 'haruto', 'daichi', 'hina', 'goro', 'kaito', 'jake', 'kiyo', 'riku'].every((i) => moved[i] > 0.8), JSON.stringify(moved));
ok('Kobayashi stays at the notice board', moved.kobayashi < 0.3);
ok('Sora is small and the name tag hangs lower', await page.evaluate(() => { const g = window.__game, s = g.npcs.find((n) => n.def.id === 'sora'), t = g.npcs.find((n) => n.def.id === 'tanaka'); return s.height < t.height - 0.3; }));
// talk to Grandma Tomi
await page.evaluate(() => { const g = window.__game, n = g.npcs.find((x) => x.def.id === 'tomi'); g.player.teleport(n.pos.x, n.pos.z + 1.6); for (let i = 0; i < 120; i++) n.update(1 / 60, g.player.pos); });
await page.waitForTimeout(700);
await page.keyboard.press('KeyF');
await page.waitForTimeout(500);
const t = await page.evaluate(() => ({ talking: window.__game.talk.talking, who: document.querySelector('#talk .who')?.textContent, text: document.querySelector('#talk p')?.textContent }));
ok('she can be talked to', t.talking && /Tomi/.test(t.who) && /dear/.test(t.text), JSON.stringify(t));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
