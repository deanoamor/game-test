import { Color } from 'three';
import { clamp, smoothstep } from '../util/rng';
import { HALF, PLACES, cityDist, heightAt, placeAt, CITY, SHRINE } from '../world/config';
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

  constructor(private drone: Drone) {
    this.base = this.paintMap();
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
      const x = ((e.clientX - r.left) / r.width) * HALF * 2 - HALF;
      const z = ((e.clientY - r.top) / r.height) * HALF * 2 - HALF;
      this.onMapClick?.(x, z);
    });
  }

  /** The static map: terrain colours, water, the city grid, the mountain road. */
  private paintMap(): HTMLCanvasElement {
    const n = 210;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(n, n);
    const c = new Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / n) * HALF * 2 - HALF, z = (j / n) * HALF * 2 - HALF;
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
    // the city
    const s = n / (HALF * 2);
    const cx = (CITY.cx + HALF) * s, cz = (CITY.cz + HALF) * s, e = CITY.extent * s;
    g.fillStyle = 'rgba(190,190,200,0.85)';
    g.fillRect(cx - e / 2, cz - e / 2, e, e);
    g.fillStyle = 'rgba(70,74,82,0.9)';
    for (let k = 0; k <= CITY.blocks; k++) {
      g.fillRect(cx - e / 2 + k * CITY.pitch * s, cz - e / 2, CITY.street * s, e);
      g.fillRect(cx - e / 2, cz - e / 2 + k * CITY.pitch * s, e, CITY.street * s);
    }
    g.fillStyle = '#ff8fb4';
    g.beginPath();
    g.arc((SHRINE.x + HALF) * s, (SHRINE.z + HALF) * s, 3, 0, Math.PI * 2);
    g.fill();
    void cityDist;
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
    const sx = ((t.x + HALF) / (HALF * 2)) * W, sz = ((t.z + HALF) / (HALF * 2)) * W;
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
