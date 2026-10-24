import { chromium } from 'playwright-core';
import fs from 'node:fs';
// One whole stride of the player, 12 poses, from the side or the front (start the dev server first).
// MODE=walk|run  VIEW=0 (side) | 90 (front)  OUT=dir
const OUT = process.env.OUT || 'e2e/out';
const MODE = process.env.MODE || 'walk', VIEW = +(process.env.VIEW || 0);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
await page.addInitScript(() => sessionStorage.setItem('hoshi.dev', 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96')); // (the tests run in dev mode)
await page.goto('http://localhost:5300/?shot=1&world=ekimae&hud=0&q=low&pause=1&t=13');
await page.waitForFunction(() => window.__game && window.__game.frames() > 2, null, { timeout: 240000 });
for (let k = 0; k < 12; k++) {
  await page.evaluate(([k, mode, view]) => {
    const g = window.__game, p = g.player;
    p.teleport(16, 44);
    p.gait.walkW = 1; p.gait.runW = mode === "run" ? 1 : 0;
    p.facing = Math.PI / 2; p.gait.phase = (k / 12) * Math.PI * 2;
    p.gait.pose();
    p.group.rotation.y = p.facing; p.group.position.copy(p.pos);
    g.drone.following = false; g.drone.clearance = false;
    g.drone.setView(p.pos.x, p.pos.z, view, 8, 4.2);
    g.drone.target.y = p.pos.y + 0.7; g.drone.camera.lookAt(g.drone.target);
  }, [k, MODE, VIEW]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/cycle-${MODE}-${VIEW}-${k}.png`, clip: { x: 90, y: 40, width: 240, height: 340 } });
}
await browser.close();
