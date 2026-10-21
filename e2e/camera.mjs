import { chromium } from 'playwright-core';
// Sweeps the camera along the streets of a world and reports the biggest jump in its height from one frame to the next.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
await page.goto(`http://localhost:5300/?shot=1&pause=1&hud=0&q=low&world=${process.env.WORLD || 'ekimae'}`);
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
const r = await page.evaluate(() => {
  const d = window.__game.drone;
  const out = {};
  for (const [name, x0, z0, x1, z1, yaw] of [['main', -40, 44, 26, 44, -70], ['main2', 26, 42, -40, 42, 110], ['cross', 0, 26, 0, 62, 20], ['diag', -40, 26, 26, 62, 200]]) {
    d.setView(x0, z0, yaw, 40, 18);
    let prev = d.camera.position.y, prevD = 0, maxStep = 0, maxJerk = 0;
    const n = 600;
    for (let i = 0; i <= n; i++) {
      d.goal.x = x0 + ((x1 - x0) * i) / n;
      d.goal.z = z0 + ((z1 - z0) * i) / n;
      d.update(1 / 60);
      const y = d.camera.position.y, dy = y - prev;
      maxStep = Math.max(maxStep, Math.abs(dy));
      if (i > 1) maxJerk = Math.max(maxJerk, Math.abs(dy - prevD));
      prev = y; prevD = dy;
    }
    out[name] = { maxStep: +maxStep.toFixed(3), maxJerk: +maxJerk.toFixed(3) };
  }
  // turning round on the spot, at a few points
  for (const [name, x, z] of [['turn-crossing', 0, 44], ['turn-north', -20, 30], ['turn-south', 12, 58]]) {
    d.setView(x, z, 0, 40, 18);
    let prev = d.camera.position.y, prevD = 0, maxStep = 0, maxJerk = 0;
    for (let i = 0; i <= 600; i++) {
      d.yawGoal = (i / 600) * Math.PI * 2;
      d.update(1 / 60);
      const y = d.camera.position.y, dy = y - prev;
      maxStep = Math.max(maxStep, Math.abs(dy));
      if (i > 1) maxJerk = Math.max(maxJerk, Math.abs(dy - prevD));
      prev = y; prevD = dy;
    }
    out[name] = { maxStep: +maxStep.toFixed(3), maxJerk: +maxJerk.toFixed(3) };
  }
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
