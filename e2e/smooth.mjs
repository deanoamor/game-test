import { chromium } from 'playwright-core';
// Starts, speeds up, slows down and stops the player in the simulation and reports the biggest jump any bone makes
// from one frame to the next (radians, and metres for the pelvis): a pop in the animation shows up as a large number.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
console.log(JSON.stringify(await page.evaluate(() => {
  const p = window.__game.player;
  p.teleport(-30, 44);
  const names = [...p.gait.bones.keys()];
  const snap = () => { const o = {}; for (const n of names) { const b = p.gait.bones.get(n); o[n] = [b.rotation.x, b.rotation.y, b.rotation.z]; } o.hipsY = [p.gait.bones.get('Hips').position.y]; return o; };
  let prev = snap();
  const worst = {};
  const script = [[0.5, []], [2.5, ['KeyD']], [2.5, ['KeyD', 'ShiftLeft']], [2, ['KeyD']], [1.5, []]];
  let heading = 'KeyD';
  for (const [secs, keys] of script) {
    p.keys.clear(); for (const k of keys) p.keys.add(k);
    for (let i = 0; i < secs * 60; i++) {
      p.update(1 / 60, -Math.PI / 2); // camera turned so D goes along +x
      const cur = snap();
      for (const n in cur) { let d = 0; cur[n].forEach((v, j) => { d = Math.max(d, Math.abs(v - prev[n][j])); }); worst[n] = Math.max(worst[n] ?? 0, d); }
      prev = cur;
    }
  }
  return Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(3)]));
})));
await browser.close();
