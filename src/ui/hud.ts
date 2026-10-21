import { Color } from 'three';
import { clamp, smoothstep } from '../util/rng';
import { EXPRESSWAY, IC, IC_RAMP, PADDY, SHRINE, VILLAGE, getRoads, heightAt, placeAt, type Place } from '../world/config';
import { WORLDS, goToWorld, inRect, mapView, placesIn, type Exit, type WorldDef } from '../worlds';
import { groundColor } from '../world/terrain';
import type { Drone } from '../camera/drone';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private mini = $<HTMLCanvasElement>('mini');
  private base: HTMLCanvasElement;
  private lastPlace = '';
  private fpsAcc = 0;
  private fpsN = 0;
  onFly?: (key: string) => void;
  onHour?: (h: number) => void;
  onPlay?: (playing: boolean) => void;
  onQuality?: (q: string) => void;
  onMapClick?: (x: number, z: number) => void;
  /** The places listed for this world. */
  readonly places: Place[];
  private view: { cx: number; cz: number; half: number };
  private exit: Exit | null = null;

  constructor(private drone: Drone, private world: WorldDef) {
    // the map is painted once the world exists (see paintBase); until then a blank one
    this.base = document.createElement('canvas');
    this.view = mapView(world);
    this.places = placesIn(world);
    const PLACES = this.places;
    $('worldName').textContent = world.bounds ? `${world.name} · ${world.jp}` : 'Hoshi no Kuni · 星の国';
    if (world.minDist === world.maxDist) $('helpZoom').style.display = 'none';
    // on foot: the keys walk, Shift runs, a drag turns the view
    if (world.player) $('help').innerHTML = '<b>W A S D</b> walk &nbsp; <b>Shift</b> run &nbsp; <b>Drag</b> turn &amp; tilt<br /><b>Q E</b> turn &nbsp; <b>R F</b> tilt &nbsp; <b>T</b> time &nbsp; <b>H</b> hide HUD';
    // the worlds menu: going to another world loads it afresh
    const sel = $<HTMLSelectElement>('world');
    for (const w of WORLDS) {
      const o = document.createElement('option');
      o.value = w.key;
      o.textContent = w.name;
      o.selected = w.key === world.key;
      sel.appendChild(o);
    }
    sel.onchange = () => goToWorld(sel.value);
    $('exitGo').onclick = () => { if (this.exit?.to) goToWorld(this.exit.to); };
    const list = $('places');
    PLACES.forEach((p, i) => {
      const b = document.createElement('button');
      b.dataset.key = p.key;
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${p.name}</span><small>${p.jp}</small>`;
      b.onclick = () => this.onFly?.(p.key);
      list.appendChild(b);
    });
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= PLACES.length) this.onFly?.(PLACES[n - 1].key);
      if (e.code === 'KeyH') $('hud').classList.toggle('off');
      if (e.code === 'KeyT') $('play').click();
    });
    const hour = $<HTMLInputElement>('hour');
    hour.oninput = () => this.onHour?.(Number(hour.value));
    const play = $('play');
    let playing = true;
    play.onclick = () => {
      playing = !playing;
      play.textContent = playing ? '⏸ Pause' : '▶ Play';
      this.onPlay?.(playing);
    };
    $<HTMLSelectElement>('quality').onchange = (e) => this.onQuality?.((e.target as HTMLSelectElement).value);
    this.mini.addEventListener('pointerdown', (e) => {
      const r = this.mini.getBoundingClientRect();
      const v = this.view;
      const x = v.cx - v.half + ((e.clientX - r.left) / r.width) * v.half * 2;
      const z = v.cz - v.half + ((e.clientY - r.top) / r.height) * v.half * 2;
      this.onMapClick?.(x, z);
    });
  }

  /** The static map: terrain colours, water, the city grid, the mountain road. */
  private paintMap(): HTMLCanvasElement {
    const n = 210;
    const { cx: VX, cz: VZ, half: HALF } = this.view;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(n, n);
    const c = new Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = VX - HALF + (i / n) * HALF * 2, z = VZ - HALF + (j / n) * HALF * 2;
        const h = heightAt(x, z);
        const slope = Math.hypot(heightAt(x + 4, z) - heightAt(x - 4, z), heightAt(x, z + 4) - heightAt(x, z - 4)) / 8;
        groundColor(x, z, h, 1 / Math.sqrt(1 + slope * slope), c);
        if (h < 0) c.set('#2a78a8').lerp(new Color('#7fd0d6'), smoothstep(-8, 0, h));
        // simple hill-shading from the north-west
        const shade = clamp(1 + (heightAt(x - 4, z - 4) - heightAt(x + 4, z + 4)) * 0.012, 0.7, 1.25);
        const k = (j * n + i) * 4;
        img.data[k] = Math.min(255, c.r * 255 * shade);
        img.data[k + 1] = Math.min(255, c.g * 255 * shade);
        img.data[k + 2] = Math.min(255, c.b * 255 * shade);
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // the roads, the village ground and the shrine
    const s = n / (HALF * 2);
    const px = (x: number) => (x - VX + HALF) * s, pz = (z: number) => (z - VZ + HALF) * s;
    g.fillStyle = 'rgba(200,196,182,0.55)';
    g.fillRect(px(-HALF), pz(VILLAGE.cz - VILLAGE.hz), px(HALF) - px(-HALF), (VILLAGE.hz + 30) * s);
    for (const r of getRoads()) {
      g.strokeStyle = r.name === 'main' ? 'rgba(60,64,72,0.95)' : 'rgba(80,84,92,0.9)';
      g.lineWidth = Math.max(1.5, r.width * s * 1.2);
      g.beginPath();
      r.x.forEach((x, i) => (i ? g.lineTo(px(x), pz(r.z[i])) : g.moveTo(px(x), pz(r.z[i]))));
      g.stroke();
    }
    // the expressway with its toll plaza and ramps
    g.strokeStyle = 'rgba(40,120,80,0.95)';
    g.lineWidth = Math.max(3, EXPRESSWAY.half * 2 * s);
    g.beginPath(); g.moveTo(px(-HALF), pz(EXPRESSWAY.z)); g.lineTo(px(HALF), pz(EXPRESSWAY.z)); g.stroke();
    g.lineWidth = Math.max(1.5, IC_RAMP.half * 2 * s);
    g.beginPath(); g.moveTo(px(-IC_RAMP.end - 30), pz(EXPRESSWAY.z - EXPRESSWAY.half)); g.lineTo(px(-IC_RAMP.end), pz(IC_RAMP.z)); g.lineTo(px(IC_RAMP.end), pz(IC_RAMP.z)); g.lineTo(px(IC_RAMP.end + 30), pz(EXPRESSWAY.z - EXPRESSWAY.half)); g.stroke();
    g.fillStyle = 'rgba(80,84,92,0.9)';
    g.fillRect(px(IC.x0), pz(IC.z0), (IC.x1 - IC.x0) * s, (IC.z1 - IC.z0) * s);
    g.fillStyle = 'rgba(190,230,120,0.5)';
    g.fillRect(px(PADDY.x - PADDY.hx), pz(PADDY.z - PADDY.hz), PADDY.hx * 2 * s, PADDY.hz * 2 * s);
    g.fillStyle = '#ff8fb4';
    g.beginPath();
    g.arc(px(SHRINE.x), pz(SHRINE.z), 3, 0, Math.PI * 2);
    g.fill();
    // a zone: the land past the barrier dimmed, the barrier drawn, the exits marked
    const b = this.world.bounds;
    if (b) {
      g.fillStyle = 'rgba(10,16,34,0.42)';
      g.fillRect(0, 0, n, pz(b.z0));
      g.fillRect(0, pz(b.z1), n, n - pz(b.z1));
      g.fillRect(0, pz(b.z0), px(b.x0), pz(b.z1) - pz(b.z0));
      g.fillRect(px(b.x1), pz(b.z0), n - px(b.x1), pz(b.z1) - pz(b.z0));
      g.strokeStyle = 'rgba(255,143,180,0.9)';
      g.lineWidth = 1.5;
      g.setLineDash([4, 3]);
      g.strokeRect(px(b.x0), pz(b.z0), px(b.x1) - px(b.x0), pz(b.z1) - pz(b.z0));
      g.setLineDash([]);
      g.fillStyle = '#ffd27a';
      for (const e of this.world.exits) g.fillRect(px(e.at.x0), pz(e.at.z0), Math.max(3, (e.at.x1 - e.at.x0) * s), Math.max(3, (e.at.z1 - e.at.z0) * s));
    }
    return cv;
  }

  update(dt: number, hour: number, night: number) {
    const t = this.drone.target;
    const p = placeAt(t.x, t.z);
    if (p.name !== this.lastPlace) {
      this.lastPlace = p.name;
      $('placeName').textContent = p.name;
      $('placeJp').textContent = p.jp;
      document.querySelectorAll<HTMLButtonElement>('#places button').forEach((b) => b.classList.toggle('on', b.dataset.key === p.key));
    }
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('phase').textContent = hour < 4.8 ? 'Night' : hour < 7.2 ? 'Dawn' : hour < 11 ? 'Morning' : hour < 14 ? 'Midday' : hour < 17.2 ? 'Afternoon' : hour < 19.5 ? 'Dusk' : 'Night';
    const hs = $<HTMLInputElement>('hour');
    if (document.activeElement !== hs) hs.value = String(hour);
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      $('fps').textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps`;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    // the minimap with the drone's view cone
    const g = this.mini.getContext('2d')!;
    const W = this.mini.width;
    g.clearRect(0, 0, W, W);
    g.drawImage(this.base, 0, 0, W, W);
    if (night > 0) {
      g.fillStyle = `rgba(8,14,40,${night * 0.45})`;
      g.fillRect(0, 0, W, W);
    }
    const { cx: VX, cz: VZ, half: HALF } = this.view;
    const sx = ((t.x - VX + HALF) / (HALF * 2)) * W, sz = ((t.z - VZ + HALF) / (HALF * 2)) * W;
    const yaw = this.drone.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const reach = clamp(this.drone.dist * 1.1, 40, 700) / (HALF * 2) * W;
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sx - fx * reach * 0.5, sz - fz * reach * 0.5);
    const spread = 0.62;
    for (const sgn of [-1, 1]) {
      const a = Math.atan2(fz, fx) + sgn * spread;
      g.lineTo(sx - fx * reach * 0.5 + Math.cos(a) * reach * 1.3, sz - fz * reach * 0.5 + Math.sin(a) * reach * 1.3);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#ff5c8a';
    g.beginPath();
    g.arc(sx, sz, 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.stroke();
    // at an exit (the drone pushed against the barrier there): offer the way on
    const pushedRecently = performance.now() - this.drone.pushed.t < 1500;
    const ex = this.world.exits.find((e) => inRect(e.at, t.x, t.z, 1.5)) ?? (pushedRecently ? this.world.exits.find((e) => inRect(e.at, this.drone.pushed.x, this.drone.pushed.z, 6)) : undefined) ?? null;
    if (ex !== this.exit) {
      this.exit = ex;
      const box = $('exit');
      box.classList.toggle('on', !!ex);
      if (ex) {
        $('exitName').textContent = `${ex.name} · ${ex.jp}`;
        $('exitNote').textContent = ex.to ? 'The next area — it loads when you go on.' : 'The next area is not built yet.';
        $<HTMLButtonElement>('exitGo').disabled = !ex.to;
      }
    }
  }

  /** Paint the minimap's ground, roads and places (after the world is built). */
  paintBase() {
    this.base = this.paintMap();
  }

  setProgress(f: number, msg: string) {
    ($('bar') as HTMLElement).style.width = `${Math.round(f * 100)}%`;
    $('loadMsg').textContent = msg;
  }

  done() {
    $('loading').classList.add('done');
  }

  setHud(on: boolean) {
    $('hud').classList.toggle('off', !on);
  }
}
