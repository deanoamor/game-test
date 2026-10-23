import { ACESFilmicToneMapping, PCFSoftShadowMap, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, Vector3, Color, type Mesh } from 'three';
import { Drone } from './camera/drone';
import { TalkUI } from './npc/talk';
import { Player } from './player/player';
import { Post, type Quality } from './fx/post';
import { Hud } from './ui/hud';
import { yieldUI } from './util/rng';
import { Sound } from './audio/sound';
import { BAGS } from './inventory/items';
import { Basket } from './inventory/shop';
import { Inventory } from './inventory/store';
import { BagUI } from './inventory/ui';
import { buildBagModel, buildBasketModel } from './player/bagModel';
import { KONBINI } from './worlds/ekimae/home';
import { buildIndoor } from './stages/indoor';
import { buildOutdoor } from './stages/outdoor';
import { areaOf, arrival, carriedHour, currentWorld, forgetCarried, keepArea } from './worlds';
import { DaylightRig } from './world/daylight';
import { Clouds, SkyDome } from './world/sky';

const params = new URLSearchParams(location.search);
const nextFrame = yieldUI;

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
  // the world: a zone of the town (with its scenery ring and invisible barrier), the full map, or the rooms of a house
  const world = currentWorld();
  const spawn = arrival(world);
  const carried = carriedHour();
  forgetCarried();
  const keep = keepArea(world);
  const drone = new Drone(renderer.domElement);
  // the camera goes where it may look: the whole area she may walk, when it follows her
  const area = areaOf(world);
  if (area) drone.bounds = { ...area };
  drone.minDist = world.minDist;
  drone.maxDist = world.maxDist;
  const hud = new Hud(drone, world);
  const PLACES = hud.places;
  const progress = (f: number, msg: string) => hud.setProgress(f, msg);

  const stage = world.interior
    ? await buildIndoor({ scene, world, progress, nextFrame })
    : await buildOutdoor({ scene, world, keep, progress, nextFrame });

  // the player, in a world played on foot: the camera follows her (unless a test asked for a fixed view)
  let player: Player | null = null;
  if (world.player) {
    progress(0.92, 'Waking the player…');
    await nextFrame();
    player = await Player.create(stage.obstacles, area, spawn ?? world.player, stage.floor);
    scene.add(player.group, player.shadowMesh);
    drone.following = !params.has('yaw');
    // a steady view: the camera keeps its distance and its tilt, and does not rise or back off round the roofs
    drone.clearance = false;
  }

  // the sound: the ambience of the place, her steps, the voices (it starts at the first key or click)
  const sound = new Sound(world.key === 'konbini' ? 'shop' : world.key === 'home' ? 'home' : 'town', !params.has('shot'));
  if (KONBINI.door.x1 > KONBINI.door.x0) sound.chimeAt = { x: (KONBINI.door.x0 + KONBINI.door.x1) / 2, z: (KONBINI.door.z0 + KONBINI.door.z1) / 2 };
  {
    const btn = document.getElementById('sound') as HTMLButtonElement, vol = document.getElementById('vol') as HTMLInputElement;
    const show = () => { btn.textContent = sound.muted || sound.volume === 0 ? '🔇' : '🔊'; vol.value = String(sound.volume); };
    btn.onclick = () => sound.setMuted(!sound.muted);
    vol.oninput = () => { sound.setVolume(Number(vol.value)); if (sound.muted) sound.setMuted(false); };
    sound.onChange = show;
    show();
  }

  // the drivers: they stop for her (and the NPCs) on the road, and honk and shout at her if she stands in the way
  const angry: { x: number; y: number; z: number; text: string; t: number; el: HTMLElement }[] = [];
  if (stage.extra.traffic) {
    const RAGE: [string, string][] = [['おい！', 'Hey!'], ['どけ！', 'Move!'], ['邪魔だ！', 'You are in the way!'], ['何してんだ！', 'What are you doing?!'], ['いい加減にしろ！', 'That is enough already!']];
    stage.extra.traffic.onHonk = (c) => {
      const lx = player?.pos.x ?? drone.target.x, lz = player?.pos.z ?? drone.target.z;
      const d = Math.hypot(c.x - lx, c.z - lz);
      const [text, en] = RAGE[Math.min(c.n - 1, RAGE.length - 1)];
      sound.honk(d, c.kind, c.n);
      if (d < 40) {
        if (c.n > 1) sound.shout(text, d);
        const el = document.createElement('div');
        el.className = 'carTag';
        el.innerHTML = `💢 ${text}<span class="en"></span>`;
        el.querySelector('.en')!.textContent = en;
        document.getElementById('hud')!.appendChild(el);
        angry.push({ x: c.x, y: c.y + 2.3, z: c.z, text, t: 1.8, el });
        while (angry.length > 3) angry.shift()!.el.remove();
      }
    };
  }

  // NPCs: the player cannot walk through them, their name tags are in the HUD, and F talks to the one in reach
  let talk: TalkUI | null = null;
  if (player && stage.npcs.length) {
    const layer = document.getElementById('hud')!;
    player.blockers = stage.npcs.map((n) => n.blocker);
    for (const n of stage.npcs) layer.appendChild(n.label);
    talk = new TalkUI(player, stage.npcs, layer, sound);
  }

  // the bag: what she carries (kept in the browser), shown on her, opened with B; the wardrobe at home; the shop's clerk
  const inv = new Inventory();
  let bagUi: BagUI | null = null;
  if (player) {
    const layer = document.getElementById('hud')!;
    const basket = new Basket();
    bagUi = new BagUI(inv, basket, player, layer, sound);
    bagUi.onHeld = (n) => player!.setHeld(n === null ? null : buildBasketModel(n));
    // (she cannot leave the shop with an unpaid basket)
    hud.guard = () => (world.key === 'konbini' ? bagUi!.leaveGuard() : null);
    hud.onBlocked = (why) => bagUi!.toast(why);
    const wear = () => player!.setBag(buildBagModel(inv.state.bag));
    wear();
    const refresh = inv.onChange;
    inv.onChange = () => { refresh?.(); wear(); };
    bagUi.setSpots(stage.extra.home?.spots ?? []);
    if (talk) { talk.onShop = () => bagUi!.open('register'); talk.blocked = () => !!bagUi!.mode; bagUi.onChat = () => talk!.press(true); bagUi.busy = () => talk!.talking; }
    const bb = document.getElementById('bagBtn');
    if (bb) bb.onclick = () => (bagUi!.mode === 'bag' ? bagUi!.close() : bagUi!.open('bag'));
  } else document.getElementById('bagBtn')?.remove();
  void BAGS;

  progress(0.95, 'Drawing the map…');
  await nextFrame();
  hud.paintBase();

  const sky = new SkyDome();
  scene.add(sky.mesh);
  const clouds = new Clouds();
  scene.add(clouds.mesh);
  const light = new DaylightRig(scene, renderer);
  light.fogScale = stage.fogScale;
  if (stage.shadowHalf) {
    // a small world: the sun's shadows cover only the area it needs, so they are sharper
    const c = light.sun.shadow.camera, h = stage.shadowHalf;
    c.left = -h; c.right = h; c.top = h; c.bottom = -h;
    c.updateProjectionMatrix();
  }

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
  // the render resolution: the screen's pixel density, but never more pixels than the quality allows (a HiDPI laptop
  // panel at 150-200 % would otherwise draw 2-3 times the pixels of a desktop monitor), times a dynamic scale that
  // drops when frames are slow and climbs back when they are quick
  let quality = (params.get('q') as Quality) ?? 'medium';
  const MAX_PIXELS: Record<Quality, number> = { low: 1.1e6, medium: 1.8e6, high: 2.2e6 };
  let dynScale = 1;
  const pixelRatio = () => {
    const w = host.clientWidth, h = host.clientHeight;
    const cap = Math.min(window.devicePixelRatio, 1.5, Math.sqrt(MAX_PIXELS[quality] / Math.max(1, w * h)));
    return params.has('shot') ? 1 : Math.max(0.5, cap * dynScale);
  };
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h);
    drone.resize(w, h);
    post.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  // ---- state ----
  let hour = Number(params.get('t') ?? carried ?? 11.5);
  let playing = !params.has('pause') && !params.has('shot');
  const dayLength = 360; // seconds for a whole day
  const applyQuality = (q: Quality) => {
    quality = q;
    post.setQuality(q);
    light.sun.shadow.mapSize.set(q === 'low' ? 2048 : 4096, q === 'low' ? 2048 : 4096);
    light.sun.shadow.map?.dispose();
    (light.sun.shadow as unknown as { map: unknown }).map = null;
    light.shadowDirty = true;
    (document.getElementById('quality') as HTMLSelectElement).value = q;
    resize();
  };
  // inside (the home, the shop) there is no sun, sky or town round it: the only light is the lamps of the room, the same at
  // any hour, and the world outside the walls is empty (the clock still runs for the HUD)
  const indoors = !!world.interior && !world.daylight;
  if (indoors) {
    sky.mesh.visible = false;
    clouds.mesh.visible = false;
    document.body.style.background = '#0b0d12';
  }
  const applyHour = (h: number) => {
    hour = ((h % 24) + 24) % 24;
    light.setHour(indoors ? 21.5 : hour);
    const s = light.state;
    if (indoors) {
      light.sun.intensity = 0;
      light.sun.castShadow = false;
      light.moon.intensity = 0;
      light.hemi.intensity = 0.1;
      light.fog.density = 0;
      scene.environmentIntensity = 0.08;
      stage.setNight(1, hour);
      post.setLook(1, s.bloom);
      return;
    }
    stage.setNight(s.night, hour);
    clouds.tint(s.sky.horizon, s.night);
    post.setLook(s.night, s.bloom);
    document.body.style.background = `#${s.sky.horizon.getHexString()}`;
  };
  hud.onFly = (key) => {
    const p = PLACES.find((q) => q.key === key);
    // on foot, a place (or a click on the map) takes her there
    if (p && player && drone.following) player.teleport(p.x, p.z);
    else if (p) drone.flyTo(p, params.has('shot'));
  };
  hud.onMapClick = (x, z) => player && drone.following ? player.teleport(x, z) : drone.flyTo({ key: 'map', name: '', jp: '', x, z, radius: 1, dist: Math.max(drone.dist, 120), pitch: (drone.pitch * 180) / Math.PI, yaw: (drone.yaw * 180) / Math.PI });
  hud.onHour = (h) => { playing = false; (document.getElementById('play') as HTMLElement).textContent = '▶ Play'; applyHour(h); };
  hud.onPlay = (p) => { playing = p; };
  hud.onQuality = (q) => { manual = true; applyQuality(q as Quality); };
  applyQuality(quality);
  applyHour(hour);
  const start = params.get('view');
  const startPlace = PLACES.find((p) => p.key === start);
  if (startPlace) drone.flyTo(startPlace, true);
  else drone.flyTo(world.start, true);
  if (params.has('yaw')) drone.setView(params.has('tx') ? Number(params.get('tx')) : drone.target.x, params.has('tz') ? Number(params.get('tz')) : drone.target.z, Number(params.get('yaw')), Number(params.get('pitch') ?? 45), Number(params.get('dist') ?? drone.dist));
  // on foot the camera starts on her, at her height
  if (player && drone.following) { drone.follow(player.pos.x, player.pos.z, player.pos.y); drone.update(0); }
  if (params.get('hud') === '0') hud.setHud(false);

  progress(1, 'Ready');
  hud.done();

  // ---- loop ----
  let last = performance.now();
  let stepIdx = 0;
  let frames = 0;
  let manual = params.has('q');
  let autoClock = 0, autoFrames = 0, autoSteps = 0;
  let dynClock = 0, dynFrames = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) applyHour(hour + (dt / dayLength) * 24);
    if (player) {
      // the cars as they stand now (they moved at the end of the last frame)
      if (stage.extra.traffic) player.carBlockers = stage.extra.traffic.circlesNear(player.pos.x, player.pos.z, 12, player.pos.y);
      // (screenshots hold her still: tests pose her by hand)
      player.update(params.has('shot') ? 0 : dt, drone.yaw);
      if (drone.following) drone.follow(player.pos.x, player.pos.z, player.pos.y);
    }
    for (const n of stage.npcs) {
      const before = n.bubble;
      n.update(params.has('shot') ? 0 : dt, player?.pos);
      if (n.bubble && !before) sound.greet(n.def.id);
    }
    drone.update(dt);
    // the strangers on the pavements walk, wait for the signal and stop for her
    stage.extra.crowd?.update(params.has('shot') ? 0 : dt, stage.extra.signals, player ? player.pos : null);
    if (player && stage.extra.crowd) player.blockers = [...stage.npcs.map((n) => n.blocker), ...stage.extra.crowd.blockers];
    if (stage.extra.traffic) {
      const tb = stage.extra.traffic.blockers;
      tb.length = 0;
      if (stage.extra.crowd) for (const b of stage.extra.crowd.blockers) tb.push(b);
      if (player) {
        tb.push({ x: player.pos.x, y: player.pos.y, z: player.pos.z, r: 0.3 });
      }
      for (const n of stage.npcs) tb.push({ x: n.pos.x, y: n.pos.y, z: n.pos.z, r: 0.3 });
      for (let i = angry.length - 1; i >= 0; i--) {
        const a = angry[i];
        a.t -= dt;
        if (a.t <= 0) { a.el.remove(); angry.splice(i, 1); continue; }
        const v = new Vector3(a.x, a.y, a.z).project(drone.camera);
        a.el.style.display = v.z < 1 ? 'block' : 'none';
        a.el.style.left = `${((v.x + 1) / 2) * host.clientWidth}px`;
        a.el.style.top = `${((1 - v.y) / 2) * host.clientHeight}px`;
      }
    }
    if (player) {
      bagUi?.update(player.pos.x, player.pos.z, dt);
      // her steps: one for each foot, as the stride comes round
      const g = player.gait, idx = Math.floor(g.phase / Math.PI);
      if (idx !== stepIdx && g.walkW > 0.35) {
        const inRoom = stage.extra.home?.surface;
        sound.step(inRoom ? inRoom(player.pos.x, player.pos.z) : player.surface, g.runW > 0.5);
      }
      stepIdx = idx;
      sound.update(dt, { night: light.state.night, x: player.pos.x, z: player.pos.z, traffic: stage.extra.traffic?.loudness(player.pos.x, player.pos.z) ?? 0, walk: stage.extra.signals?.walking() ?? false });
    } else sound.update(dt, { night: light.state.night, x: drone.target.x, z: drone.target.z, traffic: stage.extra.traffic?.loudness(drone.target.x, drone.target.z) ?? 0, walk: stage.extra.signals?.walking() ?? false });
    for (const n of stage.npcs) n.project(drone.camera, host.clientWidth, host.clientHeight);
    if (talk && player) talk.update(player.pos);
    light.follow(drone.target);
    stage.step(dt, light.state.night, drone.target, drone.yaw, params.has('shot'));
    clouds.step(dt);
    sky.update(drone.camera, light.state.sky);
    if (light.shadowDirty) { renderer.shadowMap.needsUpdate = true; light.shadowDirty = false; }
    // the tilt-shift band follows the view: sharp where the drone looks
    post.setTiltShift(0.5, quality === 'low' ? 0 : 2.6 * Math.min(1.6, 1 + Math.max(0, drone.dist - 150) / 400));
    hud.update(dt, hour, light.state.night, player && drone.following ? player.pos : undefined);
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
          else { dynScale = Math.max(0.6, dynScale * 0.8); resize(); }
        } else autoSteps = 3;
        autoClock = 0;
        autoFrames = 0;
      }
    }
    // dynamic resolution, whatever the quality: below ~40 fps draw fewer pixels, above ~57 fps go back up
    if (!params.has('shot') && frames > 30) {
      dynClock += dt;
      dynFrames++;
      if (dynClock > 1.5) {
        const fps = dynFrames / dynClock;
        const next = fps < 40 ? Math.max(0.55, dynScale * 0.85) : fps > 57 ? Math.min(1, dynScale * 1.08) : dynScale;
        if (Math.abs(next - dynScale) > 0.01) { dynScale = next; resize(); }
        dynClock = 0;
        dynFrames = 0;
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  (window as unknown as Record<string, unknown>).__game = {
    drone, scene, renderer, light, post, hud, player, stage, talk, sound, inv, bagUi, npcs: stage.npcs, ...stage.extra,
    hour: () => hour,
    /** Run the signals and the traffic ahead by `seconds` (for tests). */
    simulate: (seconds: number) => { const { signals, traffic } = stage.extra; if (signals && traffic) for (let t = 0; t < seconds; t += 1 / 30) { signals.step(1 / 30); traffic.step(1 / 30); } },
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
      return { triangles: Math.round(tris), meshes, trees: stage.trees };
    },
    loadSeconds: performance.now() / 1000,
  };
}

main().catch((e) => {
  console.error(e);
  const m = document.getElementById('loadMsg');
  if (m) m.textContent = `Error: ${e?.message ?? e}`;
});
