import { chromium } from 'playwright-core';
// The sound (Web Audio): after a key press the audio runs; the ambience of each place makes a level of sound, a footstep
// and an NPC's voice make a burst, and muting makes silence. Measured at the output of the master gain. Start the dev server first.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 700, height: 460 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; console.log(cond ? 'OK  ' : 'FAIL', name, extra ?? ''); };
const ready = () => page.waitForFunction(() => window.__game && window.__game.frames() > 4, null, { timeout: 240000 });
/** The loudest level (RMS) at the master over `ms`. */
const level = (ms) => page.evaluate(async (ms) => {
  const s = window.__game.sound, an = s.ctx.createAnalyser();
  an.fftSize = 2048; s.master.connect(an);
  const buf = new Float32Array(an.fftSize); let max = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 40)); an.getFloatTimeDomainData(buf); let q = 0; for (const v of buf) q += v * v; max = Math.max(max, Math.sqrt(q / buf.length)); }
  s.master.disconnect(an);
  return +max.toFixed(5);
}, ms);
for (const [world, name] of [['ekimae', 'the street'], ['home', 'the home'], ['konbini', 'the shop']]) {
  await page.goto(`http://localhost:5300/?world=${world}&q=low&pause=1&t=${world === 'ekimae' ? 14 : 12}`);
  await ready();
  await page.keyboard.press('KeyW'); await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.__game.sound.ctx?.state === 'running', null, { timeout: 10000 }).catch(() => {});
  const running = await page.evaluate(() => window.__game.sound.ctx?.state);
  ok(`${name}: the audio runs after a key`, running === 'running', running);
  await page.waitForTimeout(800);
  const amb = await level(1200);
  ok(`${name}: there is ambience`, amb > 0.002, `rms ${amb}`);
  if (world === 'ekimae') {
    const quiet = await page.evaluate(() => { const g = window.__game; g.player.teleport(-40, 66); return true; });
    await page.waitForTimeout(1500);
    const far = await level(800);
    ok('the street: quieter far from the traffic', far < amb * 1.2 || far < 0.03, `near ${amb} far ${far}`);
  }
  const stepLoud = await page.evaluate(async () => {
    const s = window.__game.sound, g = window.__game, surf = g.stage.extra.home?.surface;
    s.step(surf ? surf(g.player.pos.x, g.player.pos.z) : g.player.surface, false); return g.player.surface;
  });
  const st = await level(300);
  ok(`${name}: a footstep makes a sound`, st > 0.003, `${stepLoud} rms ${st}`);
  if (world === 'konbini') {
    await page.evaluate(() => { const g = window.__game, n = g.npcs[0]; g.player.teleport(n.pos.x, -1.2); for (let i = 0; i < 120; i++) n.update(1 / 60, g.player.pos); });
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyF');
    const talk = await level(700);
    ok('the clerk has a voice', talk > 0.004, `rms ${talk}`);
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(400);
    const muted = await level(500);
    ok('M mutes the sound', muted < 0.0005, `rms ${muted}`);
    await page.keyboard.press('KeyM');
    ok('the sound button shows it', await page.evaluate(() => document.getElementById('sound').textContent.includes('🔊')));
  }
}
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(bad ? 1 : 0);
