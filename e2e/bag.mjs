import { chromium } from 'playwright-core';
import fs from 'node:fs';
// The bag: B opens it, the bag shows on her, F at the wardrobe at home changes the bag (what she carries moves over, the
// rest stays in the wardrobe), the clerk's shop sells things for yen, and it all stays when she changes world. OUT=dir.
const OUT = process.env.OUT || 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const ready = () => page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__game.frames()); await page.waitForFunction((t) => window.__game.frames() >= t, f0 + n, { timeout: 120000 }); };
const inv = () => page.evaluate(() => { const s = window.__game.inv.state; return { bag: s.bag, slots: s.slots.length, items: s.slots.filter(Boolean).map((x) => `${x.id}:${x.n}`), stash: s.stash.map((x) => `${x.id}:${x.n}`), yen: s.yen }; });

await page.goto('http://localhost:5300/?world=home&q=low&pause=1&t=12');
await page.evaluate(() => localStorage.removeItem('hoshi.bag'));
await page.reload(); await ready(); await frames(3);
let s = await inv();
ok('she starts with the school bag and a few things', s.bag === 'school' && s.slots === 10 && s.items.length === 4 && s.yen === 3000, JSON.stringify(s));
ok('the bag is on her back', await page.evaluate(() => window.__game.player.group.children.some((c) => c.name === 'Bag school')));
await page.keyboard.press('KeyB');
await frames(2);
ok('B opens the bag, and she stands still', await page.evaluate(() => document.getElementById('bag').classList.contains('on') && window.__game.player.frozen));
ok('with ten slots', (await page.$$('#bag .slot')).length === 10);
await page.click('#bag .slot:not(.empty)');
ok('a click shows the thing, with a Use button for food', await page.evaluate(() => /House keys|Onigiri|Notebook|coffee/i.test(document.querySelector('#bag .info').textContent)));
await page.screenshot({ path: `${OUT}/bag-open.png` });
await page.keyboard.press('Escape');
await frames(2);
ok('Esc closes it and frees her', await page.evaluate(() => !document.getElementById('bag').classList.contains('on') && !window.__game.player.frozen));

// the wardrobe
await page.evaluate(() => window.__game.player.teleport(2.8, 3.0));
await frames(3);
ok('at the wardrobe there is a prompt', await page.evaluate(() => document.getElementById('act').classList.contains('on') && /Wardrobe/.test(document.getElementById('act').textContent)));
await page.keyboard.press('KeyF');
await frames(2);
ok('F opens the wardrobe', await page.evaluate(() => document.getElementById('bag').classList.contains('on') && document.querySelectorAll('#bag .bagcard').length === 4));
await page.screenshot({ path: `${OUT}/bag-wardrobe.png` });
await page.click('#bag [data-bag="tote"]');
s = await inv();
ok('the tote bag has six slots, and her things moved over', s.bag === 'tote' && s.slots === 6 && s.items.length === 4, JSON.stringify(s));
await page.click('#bag [data-store="0"]');
await page.click('#bag [data-store="1"]');
await page.click('#bag [data-store="2"]');
s = await inv();
ok('putting things away fills the wardrobe', s.stash.length === 3 && s.items.length === 1, JSON.stringify(s));
await page.click('#bag [data-bag="backpack"]');
s = await inv();
ok('the backpack has sixteen slots', s.bag === 'backpack' && s.slots === 16, JSON.stringify(s));
ok('and she wears it', await page.evaluate(() => window.__game.player.group.children.some((c) => c.name === 'Bag backpack') && !window.__game.player.group.children.some((c) => c.name === 'Bag school')));
await page.click('#bag [data-take="0"]');
s = await inv();
ok('taking from the wardrobe puts it in the bag', s.stash.length === 2 && s.items.length === 2, JSON.stringify(s));
// fill the bag, then switch to a smaller one: what does not fit goes to the wardrobe
await page.evaluate(() => { const i = window.__game.inv; for (const id of ['onigiri', 'bento', 'coffee', 'tea', 'bread', 'icecream', 'umbrella']) i.add(id, 3); });
await page.click('#bag [data-bag="tote"]');
s = await inv();
ok('a smaller bag leaves the overflow in the wardrobe', s.slots === 6 && s.items.length === 6 && s.stash.length >= 4, JSON.stringify(s));
await page.keyboard.press('Escape');
await page.screenshot({ path: `${OUT}/bag-worn.png` });

// it stays across worlds (each world is a page of its own)
await page.goto('http://localhost:5300/?world=konbini&q=low&pause=1&t=12');
await ready(); await frames(3);
s = await inv();
ok('the bag is the same in the shop', s.bag === 'tote' && s.items.length === 6, JSON.stringify(s));
// the clerk's shop
await page.evaluate(() => { const g = window.__game, n = g.npcs[0]; g.player.teleport(n.pos.x, -1.2); for (let i = 0; i < 120; i++) n.update(1 / 60, g.player.pos); });
await frames(3);
await page.keyboard.press('KeyF');
await frames(2);
ok('at the counter F opens the shop at once', await page.evaluate(() => window.__game.bagUi.mode === 'shop' && document.querySelectorAll('#bag .rows .row').length === 8));
ok('the shop has a button to chat with the clerk', !!(await page.$('#bag [data-chat]')));
await page.click('#bag [data-chat]');
await frames(2);
ok('which closes the shop and starts the talk', await page.evaluate(() => !window.__game.bagUi.mode && window.__game.talk.talking && /Irasshaimase/.test(document.querySelector('#talk p').textContent)));
for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyF'); await frames(1); }
ok('the talk ends, and she is free', await page.evaluate(() => !window.__game.talk.talking && !window.__game.player.frozen));
// anywhere in the shop (by the drinks, far from the clerk): F buys
await page.evaluate(() => { window.__game.player.teleport(1.2, 2.2); });
await frames(3);
ok('at the shelves there is a prompt', await page.evaluate(() => document.getElementById('act').classList.contains('on') && /Buy/.test(document.getElementById('act').textContent)));
await page.keyboard.press('KeyF');
await frames(2);
ok('and F opens the shop there too', await page.evaluate(() => window.__game.bagUi.mode === 'shop'));
await page.screenshot({ path: `${OUT}/bag-shop.png` });
await page.evaluate(() => { const i = window.__game.inv; i.state.slots = i.state.slots.map(() => null); i.state.yen = 3000; i.add('keys', 1); });
const before = await inv();
await page.click('#bag [data-buy="coffee"]');
s = await inv();
ok('buying costs yen and puts the thing in the bag', s.yen === before.yen - 130 && s.items.includes('coffee:1'), JSON.stringify(s));
await page.evaluate(() => { window.__game.inv.state.yen = 50; });
await page.click('#bag [data-buy="bento"]');
s = await inv();
ok('with no money you cannot buy', s.yen === 50 && !s.items.includes('bento:1'));
await page.keyboard.press('Escape');
await frames(2);
ok('she can move again after the shop', await page.evaluate(() => !window.__game.player.frozen));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
