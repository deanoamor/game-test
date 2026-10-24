import { chromium } from 'playwright-core';
// The saved game (game mode): a restart goes on where she was (the world, the spot and the time of day), with her bag and her
// place in the guide; "new game" (two clicks) begins again. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const ready = () => page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };
const state = () => page.evaluate(() => { const g = window.__game, p = g.player.pos; return { world: g.hud.world.key, x: +p.x.toFixed(1), z: +p.z.toFixed(1), hour: +g.hour().toFixed(2), intro: !!document.getElementById('intro'), step: document.querySelector('#quest .n')?.textContent ?? null, yen: g.inv.state.yen, bag: g.inv.state.bag }; });

await page.goto('http://localhost:5300/');
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload(); await ready(); await frames(3);
await page.keyboard.press('Enter'); await frames(3);
let s = await state();
ok('a new game begins in World 1 at the start', s.world === 'ekimae' && Math.abs(s.x + 5) < 1.5 && Math.abs(s.z - 38.6) < 1.5 && s.hour >= 8 && s.hour < 8.5, JSON.stringify(s));
// she walks off, and time passes
await page.evaluate(() => window.__game.player.teleport(-12, 41.5));
await page.waitForTimeout(3500);
const before = await state();
await page.reload(); await ready(); await frames(3);
s = await state();
ok('a restart goes on where she was (the spot and the time)', s.world === 'ekimae' && Math.abs(s.x - before.x) < 1.5 && Math.abs(s.z - before.z) < 1.5 && s.hour >= before.hour - 0.02, JSON.stringify({ before, s }));
ok('without the introduction again, and the guide where it was (1/7)', !s.intro && s.step === '1/7', JSON.stringify(s));
// into the shop, and a restart inside it
await page.evaluate(() => { const g = window.__game; const d = g.hud.world.exits.find((e) => e.to === 'konbini').at; g.player.teleport((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2); g.hud.update(0.016, 15, 0, g.player.pos); });
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game && window.__game.hud.world.key === 'konbini' && window.__game.frames() > 4, null, { timeout: 240000 });
await frames(3);
await page.evaluate(() => window.__game.player.teleport(1.0, -0.4));
await page.waitForTimeout(3500);
await page.reload(); await ready(); await frames(3);
s = await state();
ok('a restart in the shop: she is in the shop, where she stood', s.world === 'konbini' && Math.abs(s.x - 1.0) < 1.5 && Math.abs(s.z + 0.4) < 1.5, JSON.stringify(s));
// her bag is kept too
await page.evaluate(() => { window.__game.inv.state.yen = 1234; window.__game.inv.add('bento', 2); window.__game.inv.onChange?.(); });
await frames(2);
await page.reload(); await ready(); await frames(3);
s = await state();
ok('and her money', s.yen === 1234, JSON.stringify(s));
// a new game
await page.click('#newGame');
ok('"new game" asks first (the button says Sure?)', (await page.textContent('#newGame')) === 'Sure?');
await page.click('#newGame');
await page.waitForFunction(() => window.__game && window.__game.frames() > 5, null, { timeout: 240000 });
await frames(4);
s = await state();
ok('the second click: back to the beginning (World 1, the start, the introduction, 3000 yen)', s.world === 'ekimae' && Math.abs(s.x + 5) < 1.5 && s.intro && s.yen === 3000 && s.hour < 8.5, JSON.stringify(s));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
