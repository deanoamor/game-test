import { ACESFilmicToneMapping, PCFSoftShadowMap, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, Vector3, Color, type Mesh } from 'three';
import { Drone } from './camera/drone';
import { Post, type Quality } from './fx/post';
import { Hud } from './ui/hud';
import { PLACES } from './world/config';
import { buildVillage } from './world/village';
import { DaylightRig } from './world/daylight';
import { TreeField, growForest } from './world/forest';
import { loadLandmarks } from './world/landmarks';
import { buildRoads } from './world/roads';
import { Clouds, SkyDome } from './world/sky';
import { SignAtlas } from './world/signs';
import { buildTerrain } from './world/terrain';
import { Traffic } from './world/traffic';
import { buildWater } from './world/water';

const params = new URLSearchParams(location.search);
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function main() {
  const host = document.getElementById('app')!;
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, params.has('shot') ? 1 : 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  // the shadow map is drawn only when the sun or the area it covers moves (see the loop)
  renderer.shadowMap.autoUpdate = false;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const drone = new Drone(renderer.domElement);
  const hud = new Hud(drone);
  const progress = (f: number, msg: string) => hud.setProgress(f, msg);

  progress(0.04, 'Shaping the land…');
  await nextFrame();
  const terrain = buildTerrain();
  scene.add(terrain);
  const water = buildWater();
  scene.add(water.mesh);

  progress(0.22, 'Planting forests…');
  await nextFrame();
  const trees = new TreeField();
  const { rocks } = growForest(trees);
  scene.add(rocks);

  progress(0.4, 'Building the village…');
  await nextFrame();
  const atlas = new SignAtlas();
  const village = buildVillage(trees, atlas);
  scene.add(village.group);
  scene.add(buildRoads());
  const windU = { value: 0 };
  scene.add(trees.build(windU));
  const traffic = new Traffic();
  scene.add(traffic.group);

  progress(0.62, 'Placing landmarks…');
  const marks = await loadLandmarks((n, total, name) => progress(0.62 + (n / total) * 0.3, `Landmark: ${name}`));
  scene.add(marks.group);

  const sky = new SkyDome();
  scene.add(sky.mesh);
  const clouds = new Clouds();
  scene.add(clouds.mesh);
  const light = new DaylightRig(scene, renderer);

  // a soft sky reflection for the glass
  {
    const pm = new PMREMGenerator(renderer);
    const envScene = new Scene();
    const dome = new SkyDome();
    dome.mesh.scale.setScalar(50);
    dome.update(drone.camera, { top: new Color('#5a8fd0'), horizon: new Color('#dcecf8'), sunColor: new Color('#fff4d8'), sunDir: new Vector3(0.3, 0.8, 0.4).normalize(), night: 0 });
    envScene.add(dome.mesh);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    pm.dispose();
  }

  const post = new Post(renderer, scene, drone.camera, host.clientWidth, host.clientHeight);
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h);
    drone.resize(w, h);
    post.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  // ---- state ----
  let hour = Number(params.get('t') ?? 11.5);
  let playing = !params.has('pause') && !params.has('shot');
  let quality = (params.get('q') as Quality) ?? 'medium';
  const dayLength = 360; // seconds for a whole day
  const applyQuality = (q: Quality) => {
    quality = q;
    post.setQuality(q);
    light.sun.shadow.mapSize.set(q === 'low' ? 2048 : 4096, q === 'low' ? 2048 : 4096);
    light.sun.shadow.map?.dispose();
    (light.sun.shadow as unknown as { map: unknown }).map = null;
    light.shadowDirty = true;
    (document.getElementById('quality') as HTMLSelectElement).value = q;
  };
  const applyHour = (h: number) => {
    hour = ((h % 24) + 24) % 24;
    light.setHour(hour);
    const s = light.state;
    village.update(s.night);
    marks.glow.forEach((m) => { m.emissiveIntensity = s.night * 1.4; });
    clouds.tint(s.sky.horizon, s.night);
    post.setLook(s.night, s.bloom);
    document.body.style.background = `#${s.sky.horizon.getHexString()}`;
  };
  hud.onFly = (key) => {
    const p = PLACES.find((q) => q.key === key);
    if (p) drone.flyTo(p, params.has('shot'));
  };
  hud.onMapClick = (x, z) => drone.flyTo({ key: 'map', name: '', jp: '', x, z, radius: 1, dist: Math.max(drone.dist, 120), pitch: (drone.pitch * 180) / Math.PI, yaw: (drone.yaw * 180) / Math.PI });
  hud.onHour = (h) => { playing = false; (document.getElementById('play') as HTMLElement).textContent = '▶ Play'; applyHour(h); };
  hud.onPlay = (p) => { playing = p; };
  hud.onQuality = (q) => { manual = true; applyQuality(q as Quality); };
  applyQuality(quality);
  applyHour(hour);
  const start = params.get('view');
  const startPlace = PLACES.find((p) => p.key === start);
  if (startPlace) drone.flyTo(startPlace, true);
  else drone.flyTo(PLACES[0], true);
  if (params.has('yaw')) drone.setView(params.has('tx') ? Number(params.get('tx')) : drone.target.x, params.has('tz') ? Number(params.get('tz')) : drone.target.z, Number(params.get('yaw')), Number(params.get('pitch') ?? 45), Number(params.get('dist') ?? drone.dist));
  if (params.get('hud') === '0') hud.setHud(false);

  progress(1, 'Ready');
  hud.done();

  // ---- loop ----
  let last = performance.now();
  let frames = 0;
  let manual = params.has('q');
  let autoClock = 0, autoFrames = 0, autoSteps = 0;
  let ratio = renderer.getPixelRatio();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) applyHour(hour + (dt / dayLength) * 24);
    drone.update(dt);
    light.follow(drone.target);
    windU.value += dt;
    water.uniforms.uTime.value += dt;
    clouds.step(dt);
    traffic.step(dt);
    sky.update(drone.camera, light.state.sky);
    if (light.shadowDirty) { renderer.shadowMap.needsUpdate = true; light.shadowDirty = false; }
    // the tilt-shift band follows the view: sharp where the drone looks
    post.setTiltShift(0.5, quality === 'low' ? 0 : 2.6 * Math.min(1.6, 1 + Math.max(0, drone.dist - 150) / 400));
    hud.update(dt, hour, light.state.night);
    if (post.usesComposer) post.render(dt);
    else renderer.render(scene, drone.camera);
    frames++;
    // the first seconds decide the quality: a slow machine gets a lighter picture
    if (!manual && autoSteps < 3 && frames > 20) {
      autoClock += dt;
      autoFrames++;
      if (autoClock > 2.5) {
        if (autoFrames / autoClock < 26) {
          autoSteps++;
          if (quality === 'high') applyQuality('medium');
          else if (quality === 'medium') applyQuality('low');
          else { ratio = Math.max(0.6, ratio * 0.75); renderer.setPixelRatio(ratio); resize(); }
        } else autoSteps = 3;
        autoClock = 0;
        autoFrames = 0;
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  (window as unknown as Record<string, unknown>).__game = {
    drone, scene, renderer, light, post, hud,
    flyTo: (key: string, instant = true) => { const p = PLACES.find((q) => q.key === key); if (p) drone.flyTo(p, instant); },
    setHour: (h: number) => { playing = false; applyHour(h); },
    setQuality: applyQuality,
    setView: (x: number, z: number, yaw: number, pitch: number, dist: number) => drone.setView(x, z, yaw, pitch, dist),
    showHud: (on: boolean) => hud.setHud(on),
    frames: () => frames,
    stats: () => {
      let tris = 0, meshes = 0;
      scene.traverse((o) => {
        const m = o as Mesh & { count?: number };
        if (!m.isMesh) return;
        meshes++;
        const g = m.geometry;
        const t = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        tris += t * (m.count ?? 1);
      });
      return { triangles: Math.round(tris), meshes, trees: trees.count };
    },
    terrain: terrain as Mesh,
    loadSeconds: performance.now() / 1000,
  };
}

main().catch((e) => {
  console.error(e);
  const m = document.getElementById('loadMsg');
  if (m) m.textContent = `Error: ${e?.message ?? e}`;
});
