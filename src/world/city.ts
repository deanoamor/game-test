import { AdditiveBlending, CanvasTexture, CircleGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GeoBuilder, shadeOf, toRgb, type V3 } from '../util/builder';
import { pick, rng } from '../util/rng';
import { BLOCK_USE, CITY, blockAt } from './config';
import { raiseSkyline } from './skyline';
import type { SignAtlas, Cell } from './signs';
import type { TreeField } from './forest';

type Face = '+z' | '-z' | '+x' | '-x';
const FACES: Face[] = ['+z', '-z', '+x', '-x'];
const RIGHT: Record<Face, number> = { '+z': 1, '-z': -1, '+x': -1, '-x': 1 };
const NORMAL: Record<Face, V3> = { '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0] };
const TANGENT: Record<Face, V3> = { '+z': [1, 0, 0], '-z': [1, 0, 0], '+x': [0, 0, 1], '-x': [0, 0, 1] };

/** A point on the wall of a box (centre cx,cz, half sizes hw,hd): u along the wall, y up, off out of the wall. */
function wp(f: Face, cx: number, cz: number, hw: number, hd: number, u: number, y: number, off: number): V3 {
  switch (f) {
    case '+z': return [cx + u, y, cz + hd + off];
    case '-z': return [cx + u, y, cz - hd - off];
    case '+x': return [cx + hw + off, y, cz + u];
    default: return [cx - hw - off, y, cz + u];
  }
}

interface Palette { body: string; trim: string; awn: [string, string]; glass: string[]; accent: string }
const PALETTES: Palette[] = [
  { body: '#eeeae0', trim: '#3fb8b0', awn: ['#e84a5f', '#ffffff'], glass: ['#6a9fbf', '#7fb0cc'], accent: '#f08a3a' },
  { body: '#f2e4c9', trim: '#e8883a', awn: ['#2f9d6a', '#ffffff'], glass: ['#6a9fbf', '#8fb7cf'], accent: '#e8883a' },
  { body: '#d8dde0', trim: '#e45cb0', awn: ['#4a6fd0', '#ffffff'], glass: ['#5d8fb0', '#7fb0cc'], accent: '#e45cb0' },
  { body: '#4fb4b0', trim: '#f4f1e4', awn: ['#f2c230', '#ffffff'], glass: ['#2f6f8c', '#4a8bab'], accent: '#f2c230' },
  { body: '#c4469f', trim: '#f2e7f0', awn: ['#2b2d3a', '#e45cb0'], glass: ['#3a5f8a', '#5a82ac'], accent: '#ffd23a' },
  { body: '#5b86d1', trim: '#e9eef7', awn: ['#e8883a', '#ffffff'], glass: ['#274d7a', '#3a638f'], accent: '#e8883a' },
  { body: '#8fc267', trim: '#f2f1e0', awn: ['#c9382f', '#ffffff'], glass: ['#5d8fb0', '#7fb0cc'], accent: '#c9382f' },
  { body: '#e6d7b8', trim: '#7a5a3c', awn: ['#b3322a', '#e8dcc0'], glass: ['#6a9fbf', '#7fb0cc'], accent: '#b3322a' },
  { body: '#f3df8a', trim: '#c9552f', awn: ['#3f6fb5', '#ffffff'], glass: ['#6a9fbf', '#8fb7cf'], accent: '#3f6fb5' },
  { body: '#e9d5d0', trim: '#8a5a50', awn: ['#4a8f6a', '#ffffff'], glass: ['#6a9fbf', '#8fb7cf'], accent: '#4a8f6a' },
];
const CORE_PALETTES: Palette[] = [
  { body: '#e9e6df', trim: '#8a9199', awn: ['#c9382f', '#ffffff'], glass: ['#5d7f99', '#7497ad'], accent: '#c9382f' },
  { body: '#d5d9dc', trim: '#3f4a55', awn: ['#2b2d3a', '#ffd23a'], glass: ['#4f7391', '#6a8fab'], accent: '#ffd23a' },
  { body: '#f0ebe0', trim: '#5b7fa8', awn: ['#2f9d6a', '#ffffff'], glass: ['#5d8fb0', '#7fb0cc'], accent: '#5b7fa8' },
  { body: '#c9d3d8', trim: '#e8883a', awn: ['#4a6fd0', '#ffffff'], glass: ['#4a7391', '#628aa8'], accent: '#e8883a' },
];
const GLASS_TOWERS: Palette[] = [
  { body: '#3f9bb8', trim: '#e9f0f4', awn: ['#2b2d3a', '#e45cb0'], glass: ['#2c7fa0', '#3d93b3'], accent: '#e9f0f4' },
  { body: '#5b86d1', trim: '#e9f0f4', awn: ['#2b2d3a', '#4fd0e0'], glass: ['#2f5a99', '#44700f'.replace('44700f', '4a78b8')], accent: '#e9f0f4' },
  { body: '#a9bcc8', trim: '#4a5560', awn: ['#c9382f', '#ffffff'], glass: ['#5d7f99', '#7497ad'], accent: '#c9382f' },
  { body: '#2f5f8a', trim: '#cfe6f2', awn: ['#f2c230', '#2b2d3a'], glass: ['#1f4666', '#2f5f84'], accent: '#cfe6f2' },
  { body: '#e8ecef', trim: '#3a4a5a', awn: ['#2f9d6a', '#ffffff'], glass: ['#6d90a8', '#86a8be'], accent: '#2f9d6a' },
];
const ROOF_TILE = ['#4d5964', '#5a4a44', '#3f4f66', '#6a5648'];

class Chunk {
  body = new GeoBuilder();
  win = new GeoBuilder();
  litA = new GeoBuilder();
  litB = new GeoBuilder();
  sign = new GeoBuilder();
}

export interface BlockInfo { i: number; j: number; cx: number; cz: number; x0: number; z0: number; x1: number; z1: number; use: string }

export interface CityBuild {
  group: Group;
  blocks: BlockInfo[];
  /** x of the north-south streets and z of the east-west streets */
  streetX: number[];
  streetZ: number[];
  update(night: number): void;
}

export function buildCity(trees: TreeField, atlas: SignAtlas): CityBuild {
  const r = rng(9001);
  const group = new Group();
  group.name = 'City';
  const Y = CITY.height; // the ground of the city
  const G = Y + 0.18; // the top of the sidewalk plates, where buildings stand
  const ext = CITY.extent;
  const x0c = CITY.cx - ext / 2, z0c = CITY.cz - ext / 2;
  const streetX = Array.from({ length: CITY.blocks + 1 }, (_, k) => x0c + k * CITY.pitch + CITY.street / 2);
  const streetZ = Array.from({ length: CITY.blocks + 1 }, (_, k) => z0c + k * CITY.pitch + CITY.street / 2);

  // ---------- roads ----------
  const roads = new GeoBuilder();
  const asphalt = toRgb('#454950');
  roads.quad([x0c, Y + 0.03, z0c + ext], [x0c + ext, Y + 0.03, z0c + ext], [x0c + ext, Y + 0.03, z0c], [x0c, Y + 0.03, z0c], asphalt);
  const strip = (xa: number, za: number, xb: number, zb: number, color: string) => {
    roads.quad([xa, Y + 0.06, zb], [xb, Y + 0.06, zb], [xb, Y + 0.06, za], [xa, Y + 0.06, za], toRgb(color));
  };
  const nearCross = (v: number, lines: number[]) => lines.some((l) => Math.abs(v - l) < CITY.street / 2 + 1.2);
  for (const sx of streetX) {
    for (let z = z0c + 2; z < z0c + ext - 3; z += 6) {
      if (nearCross(z + 1.5, streetZ)) continue;
      strip(sx - 0.14, z, sx + 0.14, z + 3, '#f2f0e4');
    }
  }
  for (const sz of streetZ) {
    for (let x = x0c + 2; x < x0c + ext - 3; x += 6) {
      if (nearCross(x + 1.5, streetX)) continue;
      strip(x, sz - 0.14, x + 3, sz + 0.14, '#f2f0e4');
    }
  }
  // zebra crossings on every arm of every junction
  for (const sx of streetX) {
    for (const sz of streetZ) {
      const h = CITY.street / 2;
      for (let k = 0; k < 9; k++) {
        const t = -h + 0.7 + k * 1.25;
        for (const sgn of [-1, 1]) {
          const cxA = sx + sgn * (h + 1.6);
          strip(cxA - 1.3, sz + t - 0.3, cxA + 1.3, sz + t + 0.3, '#f4f2ea');
          const czA = sz + sgn * (h + 1.6);
          strip(sx + t - 0.3, czA - 1.3, sx + t + 0.3, czA + 1.3, '#f4f2ea');
        }
      }
    }
  }
  const roadMesh = new Mesh(roads.toGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }));
  roadMesh.receiveShadow = true;
  roadMesh.name = 'Roads';
  group.add(roadMesh);

  // ---------- blocks ----------
  const used = new Map<string, string>();
  for (const [k, [i, j]] of Object.entries(BLOCK_USE)) used.set(`${i},${j}`, k);
  const blocks: BlockInfo[] = [];
  const plates = new GeoBuilder();
  const chunks: Chunk[] = [];
  const lampPos: [number, number][] = [];
  const mats = makeMaterials(atlas);

  for (let j = 0; j < CITY.blocks; j++) {
    for (let i = 0; i < CITY.blocks; i++) {
      const [cx, cz] = blockAt(i, j);
      const hb = CITY.block / 2;
      const use = used.get(`${i},${j}`) ?? 'town';
      const info: BlockInfo = { i, j, cx, cz, x0: cx - hb, z0: cz - hb, x1: cx + hb, z1: cz + hb, use };
      blocks.push(info);
      plates.box(cx, (Y + G) / 2, cz, CITY.block, G - Y, CITY.block, use === 'park' ? '#7fb85f' : '#bdbab0', { ao: 0.12 });
      // sidewalk trees and lamps along the edges
      const edge = (along: 'x' | 'z', fixed: number, from: number, to: number, side: number) => {
        for (let t = from + 8; t < to - 6; t += 12) {
          const kinds = ['sakura', 'ginkgo', 'round', 'sakura'] as const;
          const [x, z] = along === 'x' ? [t, fixed + side * 1.1] : [fixed + side * 1.1, t];
          trees.add(pick(r, kinds), x, z, 0.62 + r() * 0.2, G - 0.02);
        }
        for (let t = from + 14; t < to - 8; t += 26) lampPos.push(along === 'x' ? [t, fixed + side * 0.7] : [fixed + side * 0.7, t]);
      };
      if (use !== 'park') {
        edge('x', info.z0, info.x0, info.x1, 1);
        edge('x', info.z1, info.x0, info.x1, -1);
        edge('z', info.x0, info.z0, info.z1, 1);
        edge('z', info.x1, info.z0, info.z1, -1);
      }
      const ch = new Chunk();
      chunks.push(ch);
      const dd = Math.hypot(i - 2.5, j - 2.5);
      if (use === 'town') fillBlock(ch, info, dd, G, r, atlas);
      if (use === 'park') parkBlock(plates, trees, info, G, r);
    }
  }
  const plateMesh = new Mesh(plates.toGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  plateMesh.receiveShadow = true;
  plateMesh.name = 'Blocks';
  group.add(plateMesh);

  for (const ch of chunks) {
    const add = (b: GeoBuilder, mat: MeshStandardMaterial, shadow: boolean, name: string) => {
      if (b.triangles === 0) return;
      const m = new Mesh(b.toGeometry(), mat);
      m.castShadow = shadow;
      m.receiveShadow = shadow;
      m.name = name;
      group.add(m);
    };
    add(ch.body, mats.body, true, 'Buildings');
    add(ch.win, mats.win, false, 'Windows');
    add(ch.litA, mats.litA, false, 'Lit windows');
    add(ch.litB, mats.litB, false, 'Lit windows 2');
    add(ch.sign, mats.sign, false, 'Signs');
  }

  // ---------- street lamps ----------
  const poles = new InstancedMesh(new GeoBuilder().toGeometry(), mats.pole, 1);
  {
    const b = new GeoBuilder();
    b.box(0, 3.0, 0, 0.16, 6, 0.16, '#3d4148', { ao: 0.1 });
    b.box(0.5, 6.05, 0, 1.1, 0.1, 0.1, '#3d4148');
    poles.geometry = b.toGeometry();
  }
  const heads = new InstancedMesh(new GeoBuilder().toGeometry(), mats.lampHead, lampPos.length);
  {
    const b = new GeoBuilder();
    b.box(0.95, 5.95, 0, 0.7, 0.14, 0.36, '#fff4d6', { ao: 0 });
    heads.geometry = b.toGeometry();
  }
  const glow = new InstancedMesh(new CircleGeometry(8, 20).rotateX(-Math.PI / 2), mats.lampGlow, lampPos.length);
  const poleInst = new InstancedMesh(poles.geometry, mats.pole, lampPos.length);
  const m4 = new Matrix4();
  lampPos.forEach(([x, z], i) => {
    // turn the arm toward the road
    const toward = Math.atan2(CITY.cz - z, CITY.cx - x);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.round(toward / (Math.PI / 2)) * (Math.PI / 2) * -1 + Math.PI);
    m4.compose(new Vector3(x, G, z), q, new Vector3(1, 1, 1));
    poleInst.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    const gp = new Vector3(0.95, 0, 0).applyQuaternion(q).add(new Vector3(x, G + 0.05, z));
    glow.setMatrixAt(i, new Matrix4().makeTranslation(gp.x, gp.y, gp.z));
  });
  poleInst.castShadow = true;
  poleInst.name = 'Lamp poles';
  heads.name = 'Lamp heads';
  glow.name = 'Lamp glow';
  glow.renderOrder = 2;
  group.add(poleInst, heads, glow);

  return {
    group,
    blocks,
    streetX,
    streetZ,
    update(night: number) {
      mats.litA.emissiveIntensity = night * 2.6;
      mats.litB.emissiveIntensity = night * 2.2;
      mats.sign.emissiveIntensity = 0.55 + night * 1.6;
      mats.lampHead.emissiveIntensity = 0.15 + night * 3.2;
      (mats.lampGlow as MeshBasicMaterial).opacity = night * 0.5;
    },
  };
}

function makeMaterials(atlas: SignAtlas) {
  const body = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  const win = new MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.35, envMapIntensity: 1.4 });
  const litA = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: new Color('#ffcf7a'), emissiveIntensity: 0 });
  const litB = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: new Color('#bfe3ff'), emissiveIntensity: 0 });
  const sign = new MeshStandardMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: new Color('#ffffff'), emissiveIntensity: 0.55, roughness: 0.6, vertexColors: true });
  const pole = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const lampHead = new MeshStandardMaterial({ vertexColors: true, emissive: new Color('#ffe3a0'), emissiveIntensity: 0.15 });
  // a soft round gradient for the pool of light on the ground
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,214,140,0.9)');
  grd.addColorStop(0.5, 'rgba(255,190,110,0.28)');
  grd.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const lampGlow = new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: true });
  return { body, win, litA, litB, sign, pole, lampHead, lampGlow };
}

// ---------------------------------------------------------------------------------------------
// parks and building blocks
// ---------------------------------------------------------------------------------------------

function parkBlock(plates: GeoBuilder, trees: TreeField, b: BlockInfo, G: number, r: () => number) {
  // a brick plaza with a ring of cherry trees; the cat sushi stall stands in the middle
  plates.frustum(b.cx, G, b.cz, 16, 16, 0.12, 28, '#cdbba0', { cap: true });
  plates.frustum(b.cx, G + 0.12, b.cz, 13, 13, 0.04, 28, '#d9c7aa', { cap: true });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    trees.add(k % 3 === 0 ? 'maple' : 'sakura', b.cx + Math.cos(a) * 20, b.cz + Math.sin(a) * 20, 0.95 + r() * 0.3, G);
  }
  for (let k = 0; k < 10; k++) trees.add(pick(r, ['round', 'ginkgo', 'sakura'] as const), b.x0 + 4 + r() * (CITY.block - 8), b.z0 + 4 + r() * (CITY.block - 8) , 0.9 + r() * 0.4, G);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.4;
    plates.box(b.cx + Math.cos(a) * 17.4, G + 0.3, b.cz + Math.sin(a) * 17.4, 1.9, 0.5, 0.6, '#8a6a46', { yaw: (-a * 180) / Math.PI + 90 });
  }
}

function subdivide(x0: number, z0: number, x1: number, z1: number, maxS: number, minS: number, r: () => number, out: [number, number, number, number][]) {
  const w = x1 - x0, d = z1 - z0;
  if (w <= maxS && d <= maxS) { out.push([x0, z0, x1, z1]); return; }
  const alongX = w >= d;
  const len = alongX ? w : d;
  if (len < minS * 2) { out.push([x0, z0, x1, z1]); return; }
  const s = 0.38 + r() * 0.24;
  const cut = (alongX ? x0 : z0) + len * s;
  if (alongX) { subdivide(x0, z0, cut, z1, maxS, minS, r, out); subdivide(cut, z0, x1, z1, maxS, minS, r, out); }
  else { subdivide(x0, z0, x1, cut, maxS, minS, r, out); subdivide(x0, cut, x1, z1, maxS, minS, r, out); }
}

function fillBlock(ch: Chunk, b: BlockInfo, dd: number, G: number, r: () => number, atlas: SignAtlas) {
  const zone = dd < 1.3 ? 'core' : dd < 2.3 ? 'mid' : 'outer';
  const residential = dd >= 2.7 || (zone === 'outer' && r() < 0.35);
  const lots: [number, number, number, number][] = [];
  const m = 1.0;
  subdivide(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, residential ? 13 : zone === 'core' ? 27 : 23, residential ? 9 : 14, r, lots);
  for (const [lx0, lz0, lx1, lz1] of lots) {
    const gap = 0.35 + r() * 0.5;
    const x0 = lx0 + gap, x1 = lx1 - gap, z0 = lz0 + gap, z1 = lz1 - gap;
    if (x1 - x0 < 6 || z1 - z0 < 6) continue;
    if (residential) { house(ch, x0, z0, x1, z1, G, r); continue; }
    const styleRoll = r();
    const style: 'glass' | 'color' | 'shop' = zone === 'core' ? (styleRoll < 0.45 ? 'glass' : styleRoll < 0.8 ? 'color' : 'shop') : zone === 'mid' ? (styleRoll < 0.2 ? 'glass' : styleRoll < 0.65 ? 'color' : 'shop') : styleRoll < 0.6 ? 'color' : 'shop';
    const hRoll = r();
    const supertall = zone === 'core' && Math.abs(b.i - 2.5) < 1 && Math.abs(b.j - 2.5) < 1 && hRoll > 0.7;
    let height: number;
    if (zone === 'core') height = supertall ? 110 + r() * 45 : 42 + hRoll * 62;
    else if (zone === 'mid') height = 18 + hRoll * 36;
    else height = 10 + hRoll * 14;
    if (style === 'shop') height = Math.min(height, 26);
    building(ch, x0, z0, x1, z1, G, height, style, zone, r, atlas);
  }
}

// ---------------------------------------------------------------------------------------------
// one house (outer districts): white walls, a tiled gable roof, a fence and a garden tree
// ---------------------------------------------------------------------------------------------
function house(ch: Chunk, x0: number, z0: number, x1: number, z1: number, G: number, r: () => number) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const w = Math.min(x1 - x0 - 3, 8 + r() * 3), d = Math.min(z1 - z0 - 3, 7 + r() * 3);
  const h = 5.2 + r() * 1.6;
  const wall = pick(r, ['#f3efe4', '#ece4d2', '#e8ddc8', '#f6f1ea', '#dfe6e4']);
  const tile = pick(r, ROOF_TILE);
  ch.body.box(cx, G + 0.15, cz, x1 - x0, 0.3, z1 - z0, '#8fbf6a', { ao: 0 }); // the garden
  ch.body.box(cx, G + 0.3 + h / 2, cz, w, h, d, wall);
  raiseSkyline(x0, z0, x1, z1, G + h + 4);
  ch.body.box(cx, G + 0.3 + h * 0.5, cz, w + 0.1, 0.3, d + 0.1, '#d6cdb8'); // floor line
  const alongZ = d > w;
  ch.body.gable(cx, G + 0.3 + h, cz, w + 1.4, d + 1.4, 2.4 + r() * 0.8, tile, { alongZ });
  // windows and a door on the two long faces
  for (const f of FACES) {
    const L = f === '+z' || f === '-z' ? w : d;
    const n = Math.max(1, Math.floor(L / 3.2));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (k + 0.5) * (L / n);
      for (const fy of [1.3, 4.0]) {
        const lit = r() < 0.45;
        windowQuad(lit ? (r() < 0.8 ? ch.litA : ch.litB) : ch.win, f, cx, cz, w / 2, d / 2, u, G + 0.3 + fy, 1.4, 1.4, lit ? '#ffe8b8' : '#7aa6c2');
      }
    }
  }
  // a low fence
  const fh = 1.0;
  ch.body.box(cx, G + 0.3 + fh / 2, z0 + 0.15, x1 - x0, fh, 0.15, '#d8c7a0', { ao: 0.1 });
  ch.body.box(cx, G + 0.3 + fh / 2, z1 - 0.15, x1 - x0, fh, 0.15, '#d8c7a0', { ao: 0.1 });
  ch.body.box(x0 + 0.15, G + 0.3 + fh / 2, cz, 0.15, fh, z1 - z0, '#d8c7a0', { ao: 0.1 });
  ch.body.box(x1 - 0.15, G + 0.3 + fh / 2, cz, 0.15, fh, z1 - z0, '#d8c7a0', { ao: 0.1 });
}

// ---------------------------------------------------------------------------------------------
// windows, signs and the shop fronts
// ---------------------------------------------------------------------------------------------
function windowQuad(b: GeoBuilder, f: Face, cx: number, cz: number, hw: number, hd: number, u: number, y: number, w: number, h: number, color: string, off = 0.05) {
  const rs = RIGHT[f];
  const ul = u - (rs * w) / 2, ur = u + (rs * w) / 2;
  const c = toRgb(color);
  b.quad(wp(f, cx, cz, hw, hd, ul, y, off), wp(f, cx, cz, hw, hd, ur, y, off), wp(f, cx, cz, hw, hd, ur, y + h, off), wp(f, cx, cz, hw, hd, ul, y + h, off), c, shadeOf(c, 1.0), shadeOf(c, 1.12), shadeOf(c, 1.12));
}

/** A tall sign board sticking out of a wall, with the picture on both faces. */
function verticalSign(ch: Chunk, atlas: SignAtlas, f: Face, cx: number, cz: number, hw: number, hd: number, u: number, y0: number, h: number, cell: number) {
  const c: Cell = atlas.tall[cell % atlas.tall.length];
  const t = TANGENT[f], n = NORMAL[f];
  const depth = 1.25, thick = 0.26;
  const base = wp(f, cx, cz, hw, hd, u, y0, 0);
  ch.body.box(base[0] + n[0] * (depth / 2), y0 + h / 2, base[2] + n[2] * (depth / 2), Math.abs(n[0]) * depth + Math.abs(t[0]) * thick, h, Math.abs(n[2]) * depth + Math.abs(t[2]) * thick, '#2a2c32', { ao: 0 });
  for (const side of [1, -1]) {
    const o = thick / 2 + 0.012;
    const p = (off: number, y: number): V3 => [base[0] + n[0] * off + t[0] * o * side, y, base[2] + n[2] * off + t[2] * o * side];
    // viewing from the +side (side=1) looking back along -t: is "outward" to the right or the left?
    const rightX = (-t[0] * side) * 0 + 0; void rightX;
    const fw: V3 = [-t[0] * side, 0, -t[2] * side];
    const right: V3 = [fw[1] * 0 - fw[2] * 1, fw[2] * 0 - fw[0] * 0, fw[0] * 1 - fw[1] * 0]; // forward x up
    const flip = right[0] * n[0] + right[2] * n[2] < 0;
    const uL = flip ? c.u1 : c.u0, uR = flip ? c.u0 : c.u1;
    ch.sign.quadFacing(p(0.02, y0 + 0.1), p(depth - 0.02, y0 + 0.1), p(depth - 0.02, y0 + h - 0.1), p(0.02, y0 + h - 0.1), [t[0] * side, 0, t[2] * side], [1, 1, 1], [[uL, c.v0], [uR, c.v0], [uR, c.v1], [uL, c.v1]]);
  }
}

/** A big billboard on a roof: two legs and a board with a wide picture on both sides. */
function billboard(ch: Chunk, atlas: SignAtlas, cx: number, cz: number, y: number, cell: number, alongX: boolean, width: number) {
  const c = atlas.wide[cell % atlas.wide.length];
  const w = width, h = width / c.aspect;
  const lift = 1.6;
  const dir: V3 = alongX ? [1, 0, 0] : [0, 0, 1];
  const nor: V3 = alongX ? [0, 0, 1] : [1, 0, 0];
  for (const s of [-1, 1]) ch.body.box(cx + dir[0] * s * w * 0.32, y + lift / 2, cz + dir[2] * s * w * 0.32, 0.25, lift, 0.25, '#4a4d55');
  ch.body.box(cx, y + lift + h / 2, cz, alongX ? w + 0.3 : 0.3, h + 0.3, alongX ? 0.3 : w + 0.3, '#2b2d34', { ao: 0 });
  for (const side of [1, -1]) {
    const o = 0.17 * side;
    const p = (along: number, yy: number): V3 => [cx + dir[0] * along + nor[0] * o, yy, cz + dir[2] * along + nor[2] * o];
    const flip = side < 0;
    const uL = flip ? c.u1 : c.u0, uR = flip ? c.u0 : c.u1;
    ch.sign.quadFacing(p(-w / 2, y + lift), p(w / 2, y + lift), p(w / 2, y + lift + h), p(-w / 2, y + lift + h), [nor[0] * side, 0, nor[2] * side], [1, 1, 1], [[uL, c.v0], [uR, c.v0], [uR, c.v1], [uL, c.v1]]);
  }
}

// ---------------------------------------------------------------------------------------------
// a building: a shop-front ground floor, floors of windows and a roof full of equipment
// ---------------------------------------------------------------------------------------------
function building(ch: Chunk, x0: number, z0: number, x1: number, z1: number, G: number, height: number, style: 'glass' | 'color' | 'shop', zone: string, r: () => number, atlas: SignAtlas) {
  const pal = style === 'glass' ? pick(r, GLASS_TOWERS) : zone === 'core' && r() < 0.55 ? pick(r, CORE_PALETTES) : pick(r, PALETTES);
  const groundH = 4.6;
  const fh = style === 'glass' ? 3.9 : 3.4;
  const floors = Math.max(2, Math.round((height - groundH) / fh));
  let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let w = x1 - x0, d = z1 - z0;
  let y = G;
  const litP = zone === 'core' ? 0.42 : 0.34;

  // tier 1: the podium with shops (sticks out a little)
  ch.body.box(cx, y + groundH / 2, cz, w + 0.4, groundH, d + 0.4, pal.trim, { ao: 0.22 });
  for (const f of FACES) {
    const L = f === '+z' || f === '-z' ? w : d;
    const n = Math.max(1, Math.floor(L / 3.6));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (k + 0.5) * (L / n);
      const lit = r() < 0.7;
      const door = k === Math.floor(n / 2) && r() < 0.5;
      windowQuad(lit ? (r() < 0.7 ? ch.litA : ch.litB) : ch.win, f, cx, cz, (w + 0.4) / 2, (d + 0.4) / 2, u, y + 0.5, Math.min(3.0, L / n - 0.8), door ? 3.0 : 2.5, lit ? '#ffe8b0' : '#6f93aa', 0.06);
    }
    // striped awning along the wall
    const stripes = Math.max(3, Math.floor(L / 1.3));
    const sw = (L - 0.6) / stripes;
    for (let k = 0; k < stripes; k++) {
      const ua = -L / 2 + 0.3 + k * sw, ub = ua + sw;
      const col = toRgb(k % 2 ? pal.awn[1] : pal.awn[0]);
      const a = wp(f, cx, cz, (w + 0.4) / 2, (d + 0.4) / 2, ua, y + 3.9, 0.05), b2 = wp(f, cx, cz, (w + 0.4) / 2, (d + 0.4) / 2, ub, y + 3.9, 0.05);
      const c2 = wp(f, cx, cz, (w + 0.4) / 2, (d + 0.4) / 2, ub, y + 3.25, 1.5), d2 = wp(f, cx, cz, (w + 0.4) / 2, (d + 0.4) / 2, ua, y + 3.25, 1.5);
      ch.body.quadFacing(a, b2, c2, d2, [NORMAL[f][0], 1, NORMAL[f][2]], col);
    }
  }
  y += groundH;

  // tiers above: sometimes the tower steps back
  let remaining = floors;
  let tierNo = 0;
  while (remaining > 0) {
    const stepBack = style !== 'shop' && remaining > 8 && tierNo < 2 && r() < 0.6;
    const n = stepBack ? Math.floor(remaining * (0.55 + r() * 0.2)) : remaining;
    const H = n * fh;
    const body = style === 'glass' ? shadeOf(toRgb(pal.body), 0.95 + tierNo * 0.04) : toRgb(pal.body);
    ch.body.box(cx, y + H / 2, cz, w, H, d, new Color(body[0], body[1], body[2]), { ao: 0.16 });
    // corner pilasters and a ledge on top
    if (style !== 'glass') for (const sx of [-1, 1]) for (const sz of [-1, 1]) ch.body.box(cx + sx * (w / 2 - 0.1), y + H / 2, cz + sz * (d / 2 - 0.1), 0.6, H, 0.6, pal.trim, { ao: 0.08 });
    ch.body.box(cx, y + H + 0.18, cz, w + 0.5, 0.36, d + 0.5, pal.trim, { ao: 0 });
    for (const f of FACES) {
      const L = f === '+z' || f === '-z' ? w : d;
      if (style === 'glass') {
        for (let k = 0; k < n; k++) {
          const lit = r() < litP;
          const col = lit ? '#ffe2a0' : pick(r, pal.glass);
          windowQuad(lit ? (r() < 0.75 ? ch.litA : ch.litB) : ch.win, f, cx, cz, w / 2, d / 2, 0, y + k * fh + fh * 0.2, L - 1.4, fh * 0.62, col);
          if (k % 2 === 0 && L > 8) {
            // a few lit/unlit panes in the band make it read as separate windows
            const panes = Math.floor((L - 1.4) / 3.0);
            for (let pnn = 1; pnn < panes; pnn++) {
              const uu = -(L - 1.4) / 2 + (pnn * (L - 1.4)) / panes;
              windowQuad(ch.body, f, cx, cz, w / 2, d / 2, uu, y + k * fh + fh * 0.2, 0.18, fh * 0.62, pal.trim, 0.075);
            }
          }
        }
      } else {
        const cols = Math.max(1, Math.floor((L - 1.0) / 3.5));
        for (let k = 0; k < n; k++) {
          for (let c = 0; c < cols; c++) {
            const u = -L / 2 + (c + 0.5) * (L / cols);
            const lit = r() < litP;
            const curtain = r() < 0.12;
            windowQuad(lit ? (r() < 0.8 ? ch.litA : ch.litB) : ch.win, f, cx, cz, w / 2, d / 2, u, y + k * fh + fh * 0.22, Math.min(2.2, L / cols - 1.4), fh * 0.5, lit ? '#ffe2a0' : curtain ? '#e8d6b0' : pick(r, pal.glass));
            // balconies with orange rails on shop-house floors
            if (style === 'shop' && k % 2 === 1 && f !== '-z' && r() < 0.8) {
              const bw = Math.min(2.8, L / cols - 0.6);
              const base = wp(f, cx, cz, w / 2, d / 2, u, y + k * fh + 0.15, 0.55);
              const n3 = NORMAL[f], t3 = TANGENT[f];
              const sizeX = Math.abs(n3[0]) * 1.1 + Math.abs(t3[0]) * bw, sizeZ = Math.abs(n3[2]) * 1.1 + Math.abs(t3[2]) * bw;
              ch.body.box(base[0], base[1], base[2], sizeX, 0.14, sizeZ, '#cfcabd', { ao: 0.1 });
              const rail = wp(f, cx, cz, w / 2, d / 2, u, y + k * fh + 0.75, 1.07);
              ch.body.box(rail[0], rail[1], rail[2], Math.abs(t3[0]) * bw + Math.abs(n3[0]) * 0.07, 0.07, Math.abs(t3[2]) * bw + Math.abs(n3[2]) * 0.07, pal.accent, { ao: 0 });
              ch.body.box(rail[0], rail[1] - 0.32, rail[2], Math.abs(t3[0]) * bw + Math.abs(n3[0]) * 0.05, 0.5, Math.abs(t3[2]) * bw + Math.abs(n3[2]) * 0.05, '#dfe2e4', { ao: 0 });
            }
          }
          // an air conditioner here and there
          if (r() < 0.12) {
            const u = (r() - 0.5) * (L - 3);
            const p = wp(f, cx, cz, w / 2, d / 2, u, y + k * fh + 0.9, 0.3);
            const t3 = TANGENT[f], n3 = NORMAL[f];
            ch.body.box(p[0], p[1], p[2], Math.abs(t3[0]) * 1.0 + Math.abs(n3[0]) * 0.55, 0.62, Math.abs(t3[2]) * 1.0 + Math.abs(n3[2]) * 0.55, '#e7eaec', { ao: 0.1 });
          }
        }
        // pent eaves between floors on shop houses
        if (style === 'shop') {
          for (let k = 2; k < n; k += 2) {
            const ya = y + k * fh;
            const a = wp(f, cx, cz, w / 2, d / 2, -L / 2 - 0.2, ya, 0), b2 = wp(f, cx, cz, w / 2, d / 2, L / 2 + 0.2, ya, 0);
            const c2 = wp(f, cx, cz, w / 2, d / 2, L / 2 + 0.2, ya - 0.45, 1.2), d2 = wp(f, cx, cz, w / 2, d / 2, -L / 2 - 0.2, ya - 0.45, 1.2);
            ch.body.quadFacing(a, b2, c2, d2, [NORMAL[f][0], 1, NORMAL[f][2]], toRgb('#5a6068'));
          }
        }
      }
    }
    y += H;
    remaining -= n;
    if (remaining > 0) {
      // step back
      const insetX = Math.min(w * 0.18, 4), insetZ = Math.min(d * 0.18, 4);
      cx += (r() - 0.5) * insetX; cz += (r() - 0.5) * insetZ;
      w -= insetX * 2; d -= insetZ * 2;
      tierNo++;
    }
  }

  // roof: parapet, equipment, and now and then a billboard or a helipad
  const topY = y + 0.36;
  raiseSkyline(x0, z0, x1, z1, topY + 8);
  const pw = w + 0.4, pd = d + 0.4;
  for (const [bx, bz, sx, sz] of [[0, pd / 2, pw, 0.3], [0, -pd / 2, pw, 0.3], [pw / 2, 0, 0.3, pd], [-pw / 2, 0, 0.3, pd]] as const) ch.body.box(cx + bx, topY + 0.45, cz + bz, sx, 0.9, sz, pal.trim, { ao: 0.1 });
  ch.body.box(cx, topY + 0.1, cz, w, 0.2, d, '#8a8f95', { ao: 0 });
  const roofItems = 2 + Math.floor(r() * 4);
  for (let k = 0; k < roofItems; k++) {
    const rx = cx + (r() - 0.5) * (w - 3), rz = cz + (r() - 0.5) * (d - 3);
    const t = r();
    if (t < 0.35) {
      // air conditioner bank
      for (let q = 0; q < 3; q++) ch.body.box(rx + q * 1.1, topY + 0.7, rz, 1.0, 0.9, 0.9, '#e7eaec', { ao: 0.1 });
    } else if (t < 0.6) {
      // water tank
      for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) ch.body.box(rx + lx, topY + 0.7, rz + lz, 0.18, 1.4, 0.18, '#5a5f66');
      ch.body.frustum(rx, topY + 1.4, rz, 1.35, 1.35, 2.3, 10, pick(r, ['#9fb3c4', '#b9c4cc', '#c97a5a']));
      ch.body.frustum(rx, topY + 3.7, rz, 1.4, 0.25, 0.7, 10, '#6b7580');
    } else if (t < 0.8) {
      ch.body.box(rx, topY + 1.4, rz, 3.2, 2.6, 2.8, '#cfd3d6', { ao: 0.12 });
      ch.body.box(rx + 0.4, topY + 1.0, rz + 1.41, 1.0, 1.8, 0.06, '#3a4048');
    } else {
      ch.body.box(rx, topY + 3.5, rz, 0.14, 7, 0.14, '#4a4d55');
      ch.body.box(rx, topY + 5.2, rz, 1.6, 0.1, 0.1, '#4a4d55');
      ch.body.box(rx, topY + 6.2, rz, 1.0, 0.1, 0.1, '#4a4d55');
    }
  }
  if (floors > 16 && style === 'glass') {
    ch.body.frustum(cx, topY, cz, Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.2, 18, '#4b4f57');
    ch.body.box(cx, topY + 0.22, cz, 0.35, 0.05, 3.0, '#f2f2f2', { ao: 0 });
    ch.body.box(cx, topY + 0.22, cz + 0.0, 2.2, 0.05, 0.35, '#f2f2f2', { ao: 0 });
  }
  if (zone !== 'outer' && floors >= 4 && r() < 0.6) billboard(ch, atlas, cx, cz + (r() - 0.5) * (d - 6), topY + 0.2, Math.floor(r() * 8), r() < 0.5, Math.min(11, Math.max(6, (w > d ? w : d) * 0.8)));

  // vertical neon signs on the lower floors
  const nSigns = style === 'glass' ? 1 : 2 + Math.floor(r() * 3);
  const x0b = cx - 0, z0b = cz - 0;
  void x0b; void z0b;
  const sx0 = (x0 + x1) / 2, sz0 = (z0 + z1) / 2, sw0 = x1 - x0, sd0 = z1 - z0;
  for (let k = 0; k < nSigns; k++) {
    const f = FACES[Math.floor(r() * 4)];
    const L = f === '+z' || f === '-z' ? sw0 : sd0;
    const u = (r() - 0.5) * (L - 2.5);
    const h = 3.2 + r() * 3.0;
    const yy = G + 4.8 + r() * Math.max(0.5, Math.min(height - 12, 14));
    verticalSign(ch, atlas, f, sx0, sz0, sw0 / 2 + 0.2, sd0 / 2 + 0.2, u, yy, h, Math.floor(r() * 8));
  }
}
