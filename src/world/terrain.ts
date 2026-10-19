import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { fbm } from '../util/noise';
import { clamp, smoothstep } from '../util/rng';
import { PADDY, TERRAIN_HALF, forestDensity, heightAt, mountainMask } from './config';

const C = {
  grassA: new Color('#8fc653'),
  grassB: new Color('#7cb847'),
  meadow: new Color('#a8d45f'),
  forest: new Color('#4c8a3a'),
  forestDark: new Color('#3d7433'),
  rock: new Color('#8a8379'),
  rockDark: new Color('#625d59'),
  alpine: new Color('#9a9185'),
  snow: new Color('#f6f8fb'),
  bed: new Color('#41707c'),
  wet: new Color('#a9b88a'),
  dirt: new Color('#b49a6e'),
  riceA: new Color('#8fcf4a'),
  riceB: new Color('#a6d94f'),
  riceWater: new Color('#9fd2c0'),
};

const tmp = new Color();

/** The colour of the ground at a point: grass, paddies, forest floor, rock, scree, snow and pond bed. */
export function groundColor(x: number, z: number, h: number, ny: number, out = new Color()): Color {
  const n = fbm(x * 0.03 + 3, z * 0.03 - 8, 2) * 0.5 + 0.5;
  out.copy(C.grassA).lerp(C.grassB, smoothstep(0.35, 0.65, n));
  out.lerp(C.meadow, smoothstep(0.62, 0.8, fbm(x * 0.05 - 20, z * 0.05 + 5, 2) * 0.5 + 0.5) * 0.55);
  const f = forestDensity(x, z, h);
  out.lerp(tmp.copy(C.forest).lerp(C.forestDark, smoothstep(0.4, 0.9, n)), smoothstep(0.1, 0.55, f) * 0.9);
  const steep = smoothstep(0.82, 0.6, ny);
  const high = smoothstep(55, 120, h);
  out.lerp(C.rock, clamp(steep * 0.9 + high * 0.6, 0, 1) * (mountainMask(x, z) > 0.05 || h > 40 ? 1 : 0.4) * (1 - f * 0.55));
  out.lerp(C.rockDark, smoothstep(0.55, 0.4, ny) * 0.5);
  out.lerp(C.alpine, smoothstep(105, 150, h) * 0.8);
  const snowLine = 150 + fbm(x * 0.04, z * 0.04, 2) * 22 - steep * 30;
  out.lerp(C.snow, smoothstep(snowLine - 8, snowLine + 10, h));
  // the paddies stand on muddy ground (the plots and banks are built as real geometry)
  const pd = Math.max(Math.abs(x - PADDY.x) - PADDY.hx, Math.abs(z - PADDY.z) - PADDY.hz);
  if (pd < 0) out.copy(C.dirt).lerp(C.riceA, 0.35);
  else if (pd < 2.5) out.lerp(C.dirt, 0.55);
  out.lerp(C.wet, smoothstep(1.1, 0.0, h) * smoothstep(-0.6, 0.1, h) * 0.6);
  out.lerp(C.bed, smoothstep(0.05, -1.6, h));
  return out;
}

/** The terrain: a flat-shaded triangle mesh whose facets are coloured from their own centres (the low-poly look). */
export function buildTerrain(): Mesh {
  const seg = 232;
  const half = TERRAIN_HALF;
  const step = (half * 2) / seg;
  const hs = new Float32Array((seg + 1) * (seg + 1));
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) hs[j * (seg + 1) + i] = heightAt(-half + i * step, -half + j * step);
  const H = (i: number, j: number) => hs[j * (seg + 1) + i];
  const pos: number[] = [];
  const col: number[] = [];
  const nor: number[] = [];
  const c = new Color();
  const tri = (i0: number, j0: number, i1: number, j1: number, i2: number, j2: number) => {
    const p: [number, number, number][] = [
      [-half + i0 * step, H(i0, j0), -half + j0 * step],
      [-half + i1 * step, H(i1, j1), -half + j1 * step],
      [-half + i2 * step, H(i2, j2), -half + j2 * step],
    ];
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cz = (p[0][2] + p[1][2] + p[2][2]) / 3, ch = (p[0][1] + p[1][1] + p[2][1]) / 3;
    groundColor(cx, cz, ch, ny, c);
    const jitter = 0.95 + ((((Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1) + 1) % 1) * 0.09;
    c.multiplyScalar(jitter);
    for (const q of p) {
      pos.push(q[0], q[1], q[2]);
      nor.push(nx, ny, nz);
      col.push(c.r, c.g, c.b);
    }
  };
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
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
  return m;
}
