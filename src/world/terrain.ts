import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { fbm } from '../util/noise';
import { clamp, smoothstep } from '../util/rng';
import { CITY, HALF, SEA_Z, cityDist, forestDensity, heightAt, mountainMask } from './config';

const C = {
  grassA: new Color('#8fc653'),
  grassB: new Color('#76b247'),
  meadow: new Color('#a4d05e'),
  forest: new Color('#4a8638'),
  forestDark: new Color('#3b7232'),
  rock: new Color('#7d776f'),
  rockDark: new Color('#5e5a58'),
  alpine: new Color('#8a8276'),
  snow: new Color('#f5f8fb'),
  sand: new Color('#e8d8a6'),
  wet: new Color('#c9b88a'),
  bed: new Color('#41707c'),
  city: new Color('#8d9195'),
};

const tmp = new Color();
const FIELD = ['#a9d65b', '#c7da5e', '#8dc34f', '#e6d56b', '#7dbb62', '#b7d96a'].map((c) => new Color(c));
const hash2 = (a: number, b: number) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** The colour of the ground at a point: grass, forest floor, rock, alpine scree, snow, sand and lake bed. */
export function groundColor(x: number, z: number, h: number, ny: number, out = new Color()): Color {
  const n = fbm(x * 0.012 + 3, z * 0.012 - 8, 2) * 0.5 + 0.5;
  out.copy(C.grassA).lerp(C.grassB, smoothstep(0.35, 0.65, n));
  const meadow = smoothstep(0.62, 0.8, fbm(x * 0.02 - 20, z * 0.02 + 5, 2) * 0.5 + 0.5);
  out.lerp(C.meadow, meadow * 0.5);
  const f = forestDensity(x, z, h);
  out.lerp(tmp.copy(C.forest).lerp(C.forestDark, smoothstep(0.4, 0.9, n)), smoothstep(0.1, 0.55, f) * 0.9);
  // the patchwork of farm fields on flat low ground
  if (h > 1.8 && h < 70 && ny > 0.9 && f < 0.2 && cityDist(x, z) > 22 && z < SEA_Z - 45) {
    const a = 0.35;
    const u = x * Math.cos(a) - z * Math.sin(a), v = x * Math.sin(a) + z * Math.cos(a);
    const iu = Math.floor(u / 36), iv = Math.floor(v / 52);
    if (hash2(iu, iv) > 0.42) {
      out.lerp(FIELD[Math.floor(hash2(iu + 9, iv - 3) * FIELD.length)], 0.85);
      out.multiplyScalar(0.94 + 0.08 * (Math.sin(u * 0.9) * 0.5 + 0.5));
    }
  }
  const steep = smoothstep(0.82, 0.62, ny);
  const high = smoothstep(95, 190, h);
  out.lerp(C.rock, clamp(steep * 0.9 + high * 0.5, 0, 1) * (mountainMask(x, z) > 0.05 || h > 90 ? 1 : 0.5) * (1 - f * 0.65));
  out.lerp(C.rockDark, smoothstep(0.55, 0.4, ny) * 0.6);
  out.lerp(C.alpine, smoothstep(190, 260, h) * 0.8);
  const snowLine = 292 + fbm(x * 0.03, z * 0.03, 2) * 30 - steep * 35;
  out.lerp(C.snow, smoothstep(snowLine - 10, snowLine + 12, h));
  if (z > SEA_Z - 40 && h < 3.2) out.lerp(C.sand, smoothstep(3.2, 1.2, h) * 0.95);
  out.lerp(C.wet, smoothstep(1.4, 0.2, h) * smoothstep(-0.4, 0.3, h) * 0.7);
  out.lerp(C.bed, smoothstep(0.1, -2.2, h));
  const dc = cityDist(x, z);
  if (dc < 6) out.lerp(C.city, smoothstep(6, -2, dc));
  return out;
}

/** The terrain: a flat-shaded triangle mesh, each facet coloured from its own centre, which gives the low-poly look. */
export function buildTerrain(): Mesh {
  const seg = 250;
  const step = (HALF * 2) / seg;
  const hs = new Float32Array((seg + 1) * (seg + 1));
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) hs[j * (seg + 1) + i] = heightAt(-HALF + i * step, -HALF + j * step);
  const H = (i: number, j: number) => hs[j * (seg + 1) + i];
  const pos: number[] = [];
  const col: number[] = [];
  const nor: number[] = [];
  const c = new Color();
  const tri = (i0: number, j0: number, i1: number, j1: number, i2: number, j2: number) => {
    const p: [number, number, number][] = [
      [-HALF + i0 * step, H(i0, j0), -HALF + j0 * step],
      [-HALF + i1 * step, H(i1, j1), -HALF + j1 * step],
      [-HALF + i2 * step, H(i2, j2), -HALF + j2 * step],
    ];
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cz = (p[0][2] + p[1][2] + p[2][2]) / 3, ch = (p[0][1] + p[1][1] + p[2][1]) / 3;
    groundColor(cx, cz, ch, ny, c);
    const jitter = 0.94 + ((Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.1;
    c.multiplyScalar(jitter);
    for (const q of p) {
      pos.push(q[0], q[1], q[2]);
      nor.push(nx, ny, nz);
      col.push(c.r, c.g, c.b);
    }
  };
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      // alternate the diagonal so the facets do not all lean the same way
      if ((i + j) % 2 === 0) {
        tri(i, j, i, j + 1, i + 1, j);
        tri(i + 1, j, i, j + 1, i + 1, j + 1);
      } else {
        tri(i, j, i, j + 1, i + 1, j + 1);
        tri(i, j, i + 1, j + 1, i + 1, j);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const m = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true;
  m.name = 'Terrain';
  void CITY;
  return m;
}
