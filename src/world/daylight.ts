import { Color, DirectionalLight, FogExp2, HemisphereLight, Scene, Vector3, type WebGLRenderer } from 'three';
import { lerp, smoothstep } from '../util/rng';
import type { SkyState } from './sky';

interface Key {
  h: number;
  top: string;
  horizon: string;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  fog: string;
  fogD: number;
  exposure: number;
  bloom: number;
}

// hour of the day -> the look of the sky and the light
const KEYS: Key[] = [
  { h: 0, top: '#050a1c', horizon: '#14264a', sun: '#8fa8ff', sunI: 0, hemiSky: '#34508f', hemiGround: '#141c33', hemiI: 0.85, fog: '#101c3a', fogD: 0.00085, exposure: 1.05, bloom: 0.5 },
  { h: 4.8, top: '#0a1534', horizon: '#233763', sun: '#ffb27a', sunI: 0, hemiSky: '#3c5896', hemiGround: '#18203a', hemiI: 0.85, fog: '#1d2c52', fogD: 0.0009, exposure: 1.05, bloom: 0.5 },
  { h: 6.2, top: '#4a6fb8', horizon: '#ffb07a', sun: '#ffb67a', sunI: 1.6, hemiSky: '#8fa6d6', hemiGround: '#4a3b3b', hemiI: 0.8, fog: '#f2b891', fogD: 0.0011, exposure: 1.05, bloom: 0.55 },
  { h: 8.5, top: '#3d84d6', horizon: '#c8e4f6', sun: '#fff0d2', sunI: 2.7, hemiSky: '#b6d6f2', hemiGround: '#6f7a5a', hemiI: 1.0, fog: '#cfe6f4', fogD: 0.00075, exposure: 1.0, bloom: 0.35 },
  { h: 12, top: '#2f7bd9', horizon: '#cbe7fb', sun: '#fff6e2', sunI: 3.0, hemiSky: '#bfdcf7', hemiGround: '#7a845f', hemiI: 0.95, fog: '#d3e9f8', fogD: 0.0007, exposure: 0.98, bloom: 0.3 },
  { h: 16, top: '#3a80d4', horizon: '#d6e7f2', sun: '#ffeccb', sunI: 2.8, hemiSky: '#b9d3ee', hemiGround: '#7c7a58', hemiI: 1.0, fog: '#dbe6ee', fogD: 0.00078, exposure: 1.0, bloom: 0.35 },
  { h: 17.9, top: '#4d6cb0', horizon: '#ffa66b', sun: '#ff9a5a', sunI: 2.2, hemiSky: '#a8a0c8', hemiGround: '#5a4638', hemiI: 0.85, fog: '#f0a77c', fogD: 0.00105, exposure: 1.05, bloom: 0.55 },
  { h: 19.2, top: '#1d2a5c', horizon: '#c9577a', sun: '#ff7a5a', sunI: 0.4, hemiSky: '#53548f', hemiGround: '#251e33', hemiI: 0.62, fog: '#5b3f66', fogD: 0.001, exposure: 1.08, bloom: 0.5 },
  { h: 21, top: '#070d24', horizon: '#192b52', sun: '#8fa8ff', sunI: 0, hemiSky: '#364e8c', hemiGround: '#121a30', hemiI: 0.85, fog: '#121f40', fogD: 0.00088, exposure: 1.05, bloom: 0.5 },
  { h: 24, top: '#050a1c', horizon: '#14264a', sun: '#8fa8ff', sunI: 0, hemiSky: '#34508f', hemiGround: '#141c33', hemiI: 0.85, fog: '#101c3a', fogD: 0.00085, exposure: 1.05, bloom: 0.5 },
];

export interface Daylight {
  hour: number;
  night: number;
  bloom: number;
  sky: SkyState;
  /** 1 in full daylight, 0 at night. */
  day: number;
}

const ca = new Color();
const cb = new Color();

/** The light of the world: sun, moon, sky colours, fog and exposure, all driven by one clock. */
export class DaylightRig {
  sun = new DirectionalLight('#ffffff', 3);
  moon = new DirectionalLight('#7f9bd6', 0);
  hemi = new HemisphereLight('#bfdcf7', '#7a845f', 1);
  fog = new FogExp2('#d3e9f8', 0.0007);
  state: Daylight;
  private target = new Vector3();
  /** The direction the shadows are cast from: it moves in small steps, and the shadow map is redrawn only on a step. */
  private shadowDir = new Vector3(0, 1, 0);
  private shadowKey = '';
  /** True when the shadow map needs drawing again (the light or the area it covers has moved). */
  shadowDirty = true;

  constructor(private scene: Scene, private renderer: WebGLRenderer) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const c = this.sun.shadow.camera;
    c.left = -110; c.right = 110; c.top = 110; c.bottom = -110; c.near = 10; c.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.35;
    scene.add(this.sun, this.sun.target, this.moon, this.moon.target, this.hemi);
    scene.fog = this.fog;
    this.state = {
      hour: 12, night: 0, bloom: 0.3, day: 1,
      sky: { top: new Color(), horizon: new Color(), sunColor: new Color(), sunDir: new Vector3(0, 1, 0), night: 0 },
    };
    this.setHour(12);
  }

  /**
   * Where the shadow camera looks: it follows the drone in 8 m steps (a whole number of shadow texels, so the shadows do
   * not crawl); the shadow area is wide enough that the view never runs off it between steps.
   */
  follow(target: Vector3) {
    const texel = (this.sun.shadow.camera.right - this.sun.shadow.camera.left) / this.sun.shadow.mapSize.x;
    const grid = texel * Math.round(8 / texel);
    const x = Math.round(target.x / grid) * grid, z = Math.round(target.z / grid) * grid, y = Math.round(target.y / 4) * 4;
    if (x !== this.target.x || z !== this.target.z || y !== this.target.y) {
      this.target.set(x, y, z);
      this.shadowDirty = true;
    }
    this.place();
  }

  private place() {
    const d = this.shadowDir;
    this.sun.position.copy(this.target).addScaledVector(d, 420);
    this.sun.target.position.copy(this.target);
    this.moon.position.copy(this.target).addScaledVector(d, -420);
    this.moon.target.position.copy(this.target);
    this.sun.target.updateMatrixWorld();
    this.moon.target.updateMatrixWorld();
  }

  setHour(hour: number) {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (h - a.h) / (b.h - a.h);
    const mix = (x: string, y: string, out: Color) => out.set(x).lerp(cb.set(y), t);
    const s = this.state.sky;
    mix(a.top, b.top, s.top);
    mix(a.horizon, b.horizon, s.horizon);
    mix(a.sun, b.sun, s.sunColor);
    const theta = ((h - 6) / 12) * Math.PI;
    s.sunDir.set(Math.cos(theta), Math.sin(theta) * 0.95, Math.sin(theta) * 0.38).normalize();
    const elev = s.sunDir.y;
    const night = 1 - smoothstep(-0.12, 0.1, elev);
    s.night = night;
    this.state.night = night;
    this.state.day = smoothstep(0.0, 0.35, elev);
    this.state.hour = h;
    const sunI = lerp(a.sunI, b.sunI, t);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = sunI * smoothstep(-0.02, 0.12, elev);
    this.sun.castShadow = elev > 0.02;
    // the shadows step with the sun every 0.02 h (72 s of game time)
    const key = `${Math.round(h / 0.02)}:${this.sun.castShadow}`;
    if (key !== this.shadowKey) {
      this.shadowKey = key;
      const ts = ((Math.round(h / 0.02) * 0.02 - 6) / 12) * Math.PI;
      this.shadowDir.set(Math.cos(ts), Math.sin(ts) * 0.95, Math.sin(ts) * 0.38).normalize();
      this.shadowDirty = true;
    }
    this.moon.intensity = 0.8 * night;
    ca.set(a.hemiSky).lerp(cb.set(b.hemiSky), t);
    this.hemi.color.copy(ca);
    ca.set(a.hemiGround).lerp(cb.set(b.hemiGround), t);
    this.hemi.groundColor.copy(ca);
    this.hemi.intensity = lerp(a.hemiI, b.hemiI, t);
    mix(a.fog, b.fog, this.fog.color);
    this.fog.density = lerp(a.fogD, b.fogD, t) * 0.9;
    this.renderer.toneMappingExposure = lerp(a.exposure, b.exposure, t);
    this.state.bloom = lerp(a.bloom, b.bloom, t);
    this.scene.environmentIntensity = 0.12 + 0.5 * this.state.day;
    this.place();
  }
}
