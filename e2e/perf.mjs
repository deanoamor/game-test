// How long the world takes to build, and how much the GPU draws per frame (draw calls, triangles) from a few views.
// Software GL in CI cannot tell real frame rates, but these numbers move with the real cost.
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:5300/';
const VIEWS = (process.env.VIEWS || 'town,street,ic,hillside').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${URL}?pause=1&world=${process.env.WORLD || 'full'}&q=${process.env.Q || 'medium'}&view=${VIEWS[0]}`);
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
const out = await page.evaluate(async (views) => {
  const g = window.__game;
  const res = { loadSeconds: +g.loadSeconds.toFixed(2), scene: g.stats() };
  for (const v of views) {
    g.flyTo(v, true);
    await new Promise((r) => setTimeout(r, 800));
    g.renderer.info.autoReset = false;
    g.renderer.info.reset();
    await new Promise((r) => requestAnimationFrame(r));
    res[v] = { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles };
    g.renderer.info.autoReset = true;
  }
  return res;
}, VIEWS);
console.log(JSON.stringify(out, null, 1));
await browser.close();
