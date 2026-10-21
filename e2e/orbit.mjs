import { chromium } from 'playwright-core';
// Turns the camera once round the player (as dragging does) at a few places and reports how its height and its tilt
// change: a view that "pulls down" shows as a tilt that differs from the one asked for.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
console.log(JSON.stringify(await page.evaluate(() => {
  const g = window.__game, d = g.drone, p = g.player, out = {};
  for (const [name, x, z] of [['corner', -5, 38.6], ['street', -20, 44], ['alley', -30, 30], ['pavementN', 8, 38], ['pavementS', -12, 50]]) {
    p.teleport(x, z);
    d.following = true; d.clearance = true;
    d.follow(p.pos.x, p.pos.z, p.pos.y);
    d.setView(p.pos.x, p.pos.z, 0, 40, 18);
    d.target.y = p.pos.y;
    let worstDist = 0, worstPitch = 0, minY = 1e9, maxY = -1e9, worstStep = 0, prev = d.camera.position.y;
    for (let deg = 0; deg <= 360; deg += 2) {
      d.yawGoal = (deg * Math.PI) / 180; d.yaw = d.yawGoal;
      for (let i = 0; i < 6; i++) d.update(1 / 60);
      const c = d.camera.position, t = d.target;
      const actual = Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)) * 180 / Math.PI;
      worstDist = Math.max(worstDist, Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z));
      worstPitch = Math.max(worstPitch, Math.abs(actual - 40));
      minY = Math.min(minY, c.y - t.y); maxY = Math.max(maxY, c.y - t.y);
      worstStep = Math.max(worstStep, Math.abs(c.y - prev)); prev = c.y;
    }
    out[name] = { pitchOff: +worstPitch.toFixed(1), camAbove: [+minY.toFixed(1), +maxY.toFixed(1)], worstStep: +worstStep.toFixed(2), farthest: +worstDist.toFixed(1) };
  }
  return out;
})));
await browser.close();
