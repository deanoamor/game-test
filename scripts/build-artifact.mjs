// Builds a single HTML file (script, styles and the landmark models inline) for places that serve one file only.
// Usage: node scripts/build-artifact.mjs   ->   dist-artifact/index.html
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

execFileSync('npx', ['vite', 'build', '--outDir', 'dist-artifact-tmp'], { stdio: 'inherit' });
const dir = 'dist-artifact-tmp';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const scriptTag = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!scriptTag) throw new Error('bundle script not found');
const js = fs.readFileSync(path.join(dir, scriptTag[1]), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const glb = {};
for (const f of fs.readdirSync(path.join(dir, 'places'))) glb[f.replace(/\.glb$/, '')] = fs.readFileSync(path.join(dir, 'places', f)).toString('base64');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const out = `<title>Hoshi no Kuni</title>
<style>
${style}
:root { color-scheme: dark; }
html, body { height: 100%; margin: 0; padding: 0; background: #0b1020; }
</style>
${body}
<script>window.__GLB=${JSON.stringify(glb)};</script>
<script type="module">
${js}
</script>
`;
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync('dist-artifact/index.html', out);
fs.rmSync(dir, { recursive: true, force: true });
console.log('dist-artifact/index.html', (out.length / 1e6).toFixed(2), 'MB');
