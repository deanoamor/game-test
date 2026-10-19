import type { GeoBuilder } from '../../util/builder';
import { pick } from '../../util/rng';
import { PLATFORMS, RAMP_BANDS, TERRACES, TOWN, heightAt, roadNear } from '../config';
import type { TreeField } from '../forest';
import type { Cell, SignAtlas } from '../signs';
import { raiseSkyline } from '../skyline';
import { appendCtx, newCtx, type Ctx } from './frame';
import { bicycle, bins, boxes, parkedVehicle, pot, shrub, vendingMachine } from './props';

/**
 * Nothing in town is left bare. A 1 m grid records what the buildings, streets, yards and car parks cover; every free
 * patch left over becomes something you would find in a Japanese town: a coin car park, a food stall, a pocket park,
 * bicycle parking, a vending machine corner, a little roadside shrine or a vegetable garden.
 */
export class Occupancy {
  readonly nx = Math.round(TOWN.x1 - TOWN.x0);
  readonly nz = Math.round(TOWN.z1 - TOWN.z0);
  readonly grid = new Uint8Array(this.nx * this.nz);

  /** Mark the rectangle (any corner order) as used. */
  mark(xa: number, za: number, xb: number, zb: number) {
    const i0 = Math.max(0, Math.floor(Math.min(xa, xb) - TOWN.x0)), i1 = Math.min(this.nx - 1, Math.ceil(Math.max(xa, xb) - TOWN.x0) - 1);
    const j0 = Math.max(0, Math.floor(Math.min(za, zb) - TOWN.z0)), j1 = Math.min(this.nz - 1, Math.ceil(Math.max(za, zb) - TOWN.z0) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grid[j * this.nx + i] = 1;
  }

  free(i: number, j: number) { return i >= 0 && j >= 0 && i < this.nx && j < this.nz && this.grid[j * this.nx + i] === 0; }
}

type Kind = 'parking' | 'yatai' | 'park' | 'bikes' | 'vending' | 'hokora' | 'garden' | 'nook';
export interface Patch { x0: number; z0: number; x1: number; z1: number; kind: Kind }

/** Find the free patches (at least 3 x 3 m, at most 18 x 14 m) and build something on each. */
export function fillEmpty(occ: Occupancy, at: (x: number) => Ctx, atlas: SignAtlas, r: () => number, trees: TreeField): Patch[] {
  // the streets, the ramp streets, the walls between the levels and the edge of the town are never free
  for (let j = 0; j < occ.nz; j++) {
    for (let i = 0; i < occ.nx; i++) {
      const x = TOWN.x0 + i + 0.5, z = TOWN.z0 + j + 0.5;
      const rd = roadNear(x, z);
      if (rd.d < rd.width / 2 + 0.7 || RAMP_BANDS.some((b) => Math.abs(x - b.x) < b.half + 0.6)) occ.grid[j * occ.nx + i] = 1;
    }
  }
  for (const zb of [...TERRACES.slice(0, -1).map((t) => t.z1), ...PLATFORMS.map((p) => p.z1)]) occ.mark(TOWN.x0, zb - 0.7, TOWN.x1, zb + 0.4);
  occ.mark(TOWN.x0, TOWN.z0, TOWN.x1, TOWN.z0 + 0.8);
  occ.mark(TOWN.x0, TOWN.z1 - 0.8, TOWN.x1, TOWN.z1);
  occ.mark(TOWN.x0, TOWN.z0, TOWN.x0 + 0.8, TOWN.z1);
  occ.mark(TOWN.x1 - 0.8, TOWN.z0, TOWN.x1, TOWN.z1);

  const patches: Patch[] = [];
  let last: Kind | null = null;
  for (let j = 0; j < occ.nz; j++) {
    for (let i = 0; i < occ.nx; i++) {
      if (!occ.free(i, j)) continue;
      let w = 0;
      while (w < 18 && occ.free(i + w, j)) w++;
      let h = 1;
      while (h < 14) {
        let ok = true;
        for (let k = 0; k < w; k++) if (!occ.free(i + k, j + h)) { ok = false; break; }
        if (!ok) break;
        h++;
      }
      // a short wide strip is better used upright: try growing down with a narrower width
      const x0 = TOWN.x0 + i, z0 = TOWN.z0 + j, x1 = x0 + w, z1 = z0 + h;
      occ.mark(x0, z0, x1, z1);
      if (Math.min(w, h) < 2 || w * h < 6) continue;
      // a long patch is cut into pieces of 6-9 m so it holds several different things
      const nxp = w > 11 ? Math.ceil(w / 9) : 1, nzp = h > 11 ? Math.ceil(h / 9) : 1;
      for (let a = 0; a < nxp; a++) {
        for (let b = 0; b < nzp; b++) {
          const px0 = x0 + (a * w) / nxp, px1 = x0 + ((a + 1) * w) / nxp, pz0 = z0 + (b * h) / nzp, pz1 = z0 + ((b + 1) * h) / nzp;
          const kind = build(px0 + 0.15, pz0 + 0.15, px1 - 0.15, pz1 - 0.15, at, atlas, r, trees, last);
          if (kind) { patches.push({ x0: px0, z0: pz0, x1: px1, z1: pz1, kind }); last = kind; }
        }
      }
    }
  }
  return patches;
}

/** Which side of the patch looks onto a street: +z, -z, +x or -x (as a yaw: 0, 180, 90, -90). */
function facing(x0: number, z0: number, x1: number, z1: number): number {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const sides: [number, number, number][] = [[cx, z1 + 1.5, 0], [cx, z0 - 1.5, 180], [x1 + 1.5, cz, 90], [x0 - 1.5, cz, -90]];
  let best = sides[0][2], bd = Infinity;
  for (const [x, z, yaw] of sides) {
    const rd = roadNear(x, z);
    const d = rd.d - rd.width / 2;
    if (d < bd) { bd = d; best = yaw; }
  }
  return best;
}

function build(x0: number, z0: number, x1: number, z1: number, at: (x: number) => Ctx, atlas: SignAtlas, r: () => number, trees: TreeField, last: Kind | null): Kind | null {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const y = heightAt(cx, cz);
  // never across a step in the ground
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) if (Math.abs(heightAt(x, z) - y) > 0.05) return null;
  const yaw = facing(x0, z0, x1, z1);
  const alongX = yaw === 0 || yaw === 180;
  const W = alongX ? x1 - x0 : z1 - z0, D = alongX ? z1 - z0 : x1 - x0;
  const area = W * D;
  const choose = (): Kind => {
    const t = r();
    if (D >= 5.2 && W >= 7.4) return t < 0.55 ? 'parking' : t < 0.8 ? 'park' : 'yatai';
    if (area >= 18 && W >= 4) return t < 0.3 ? 'yatai' : t < 0.55 && W >= 5 && D >= 4 ? 'park' : t < 0.75 ? 'bikes' : 'garden';
    if (area >= 18) return t < 0.35 ? 'bikes' : t < 0.65 ? 'garden' : t < 0.85 ? 'hokora' : 'vending';
    return t < 0.45 ? 'vending' : t < 0.65 ? 'hokora' : t < 0.82 ? 'garden' : 'bikes';
  };
  let kind = Math.min(W, D) < 2.9 ? 'nook' as Kind : choose();
  if (kind === last && kind !== 'nook') kind = choose();
  if (kind === 'yatai' && D < 3.4) kind = 'vending';
  const ctx = newCtx(r);
  // trees are planted in world space: turn the local point the same way appendCtx turns the geometry
  const rad = (yaw * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const plant = (lx: number, lz: number, k: Parameters<TreeField['add']>[0], s: number) => trees.add(k, cx + lx * cs + lz * sn, cz - lx * sn + lz * cs, s, y);
  let top = 3;
  switch (kind) {
    case 'parking': top = coinParking(ctx, atlas, r, W, D); break;
    case 'yatai': top = yatai(ctx, atlas, r, W, D); break;
    case 'park': top = pocketPark(ctx, atlas, r, W, D, plant); break;
    case 'bikes': top = bikeParking(ctx, atlas, r, W, D); break;
    case 'vending': top = vendingCorner(ctx, atlas, r, W, D, plant); break;
    case 'hokora': top = hokora(ctx, r, W, D, plant); break;
    case 'garden': top = garden(ctx, r, W, D); break;
    case 'nook': top = nook(ctx, atlas, r, W, D, plant); break;
  }
  appendCtx(at(cx), ctx, cx, y, cz, yaw);
  raiseSkyline(x0, z0, x1, z1, y + top);
  return kind;
}

// ---------------------------------------------------------------------------------------------
// helpers (local frame: the patch is W wide along x, D deep along z, its street side at z = +D/2)
// ---------------------------------------------------------------------------------------------

/** A picture on both faces of a thin board centred at (x, y, z), facing ±z. */
function board(ctx: Ctx, c: Cell, x: number, y: number, z: number, w: number, h: number, frame = '#e8e8e2', both = true) {
  ctx.body.box(x, y, z, w + 0.1, h + 0.1, 0.06, frame, { ao: 0 });
  for (const side of both ? [1, -1] : [1]) {
    const zz = z + 0.035 * side;
    const uv: [number, number][] = side > 0 ? [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]] : [[c.u1, c.v0], [c.u0, c.v0], [c.u0, c.v1], [c.u1, c.v1]];
    ctx.sign.quadFacing([x - w / 2, y - h / 2, zz], [x + w / 2, y - h / 2, zz], [x + w / 2, y + h / 2, zz], [x - w / 2, y + h / 2, zz], [0, 0, side], [1, 1, 1], uv);
  }
}

/** A nobori: a tall vertical flag on a pole. */
function nobori(ctx: Ctx, c: Cell, x: number, z: number, h = 2.6) {
  ctx.body.box(x, h / 2, z, 0.04, h, 0.04, '#d8d8d8', { ao: 0 });
  ctx.body.box(x + 0.25, h - 0.05, z, 0.5, 0.03, 0.03, '#d8d8d8', { ao: 0 });
  const w = 0.5, fh = w / c.aspect;
  for (const side of [1, -1]) {
    const zz = z + 0.01 * side;
    const uv: [number, number][] = side > 0 ? [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]] : [[c.u1, c.v0], [c.u0, c.v0], [c.u0, c.v1], [c.u1, c.v1]];
    ctx.sign.quadFacing([x + 0.02, h - 0.07 - fh, zz], [x + 0.02 + w, h - 0.07 - fh, zz], [x + 0.02 + w, h - 0.07, zz], [x + 0.02, h - 0.07, zz], [0, 0, side], [1, 1, 1], uv);
  }
}

function bench(B: GeoBuilder, x: number, z: number, yawDeg = 0, color = '#8a5a3a') {
  B.box(x, 0.42, z, 1.6, 0.06, 0.42, color, { yaw: yawDeg, ao: 0 });
  B.box(x, 0.7, z - 0.2 * Math.cos((yawDeg * Math.PI) / 180), 1.6, 0.32, 0.05, color, { yaw: yawDeg, ao: 0 });
  for (const s of [-0.65, 0.65]) {
    const a = (yawDeg * Math.PI) / 180;
    B.box(x + s * Math.cos(a), 0.2, z - s * Math.sin(a), 0.08, 0.4, 0.4, '#5a5e64', { yaw: yawDeg, ao: 0 });
  }
}

/** Low posts with a chain between them, from (x0,z0) to (x1,z1). */
function chainFence(B: GeoBuilder, x0: number, z0: number, x1: number, z1: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.8));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    B.box(x, 0.35, z, 0.1, 0.7, 0.1, k % 2 ? '#f2c230' : '#2a2a2a', { ao: 0.05 });
    if (k < n) {
      const xn = x0 + (x1 - x0) * ((k + 1) / n), zn = z0 + (z1 - z0) * ((k + 1) / n);
      B.cable([[x, 0.6, z], [(x + xn) / 2, 0.45, (z + zn) / 2], [xn, 0.6, zn]], 0.015, '#3a3a3a');
    }
  }
}

const CAR_COLORS = ['#f4f4ee', '#3a4a6a', '#7a2a2e', '#d8d8d0', '#2f2f35', '#c8c0a8', '#5a7a9a', '#e8d8b0'];

// ---------------------------------------------------------------------------------------------
// the fillers
// ---------------------------------------------------------------------------------------------

/** A coin car park: numbered bays with lock plates, wheel stops, a pay machine, a tall yellow sign and a lamp. */
function coinParking(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#4d5055', { ao: 0 });
  const n = Math.floor((W - 1.2) / 2.5);
  const bx0 = -W / 2 + 1.0, bz0 = -D / 2 + 0.3, bz1 = Math.min(D / 2 - 0.4, bz0 + 5.2);
  for (let k = 0; k <= n; k++) B.box(bx0 + k * 2.5, 0.07, (bz0 + bz1) / 2, 0.1, 0.02, bz1 - bz0, '#f4f2ea', { ao: 0 });
  for (let k = 0; k < n; k++) {
    const x = bx0 + 1.25 + k * 2.5;
    B.box(x, 0.12, bz0 + 0.55, 1.5, 0.12, 0.16, '#d8d4ca', { ao: 0.1 });
    B.box(x, 0.1, (bz0 + bz1) / 2 + 0.3, 0.9, 0.08, 0.55, '#7a7e84', { ao: 0.1 });
    B.box(x, 0.145, (bz0 + bz1) / 2 + 0.3, 0.86, 0.01, 0.1, '#f2c230', { ao: 0 });
    B.box(x - 0.9, 0.08, bz1 - 0.3, 0.5, 0.02, 0.3, '#f4f2ea', { ao: 0 }); // the bay number
    if (r() < 0.65) parkedVehicle(ctx, pick(r, ['car', 'kei', 'keivan', 'van', 'car'] as const), pick(r, CAR_COLORS), x, 0.06, (bz0 + bz1) / 2 - 0.2, 90);
  }
  // the pay machine and its price board
  const px = W / 2 - 0.7, pz = D / 2 - 0.8;
  B.box(px, 0.75, pz, 0.6, 1.5, 0.45, '#f2c230', { ao: 0.1 });
  B.box(px, 1.55, pz, 0.7, 0.08, 0.55, '#2a2a2a', { ao: 0 });
  board(ctx, atlas.get('payScreen'), px, 1.05, pz + 0.26, 0.45, 0.45, '#2a2a2a', false);
  board(ctx, atlas.get('parkPrice'), px - 1.0, 1.3, pz + 0.1, 0.6, 0.6, '#c8c8c8');
  B.box(px - 1.0, 0.5, pz + 0.1, 0.06, 1.0, 0.06, '#9aa0a6', { ao: 0 });
  // the tall sign by the street
  const sx = -W / 2 + 0.6, sz = D / 2 - 0.5;
  B.box(sx, 2.6, sz, 0.14, 5.2, 0.14, '#9aa0a6', { ao: 0.05 });
  board(ctx, atlas.get('coinPark'), sx + 1.25, 4.3, sz, 2.4, 0.6, '#f2c230');
  board(ctx, atlas.get('parkingP'), sx + 0.45, 5.1, sz, 0.8, 0.8, '#1f5ea8');
  // a lamp on the far corner and a chain along the back and sides
  B.box(W / 2 - 0.4, 2.2, -D / 2 + 0.4, 0.1, 4.4, 0.1, '#5a5e64', { ao: 0 });
  B.box(W / 2 - 0.8, 4.35, -D / 2 + 0.4, 0.9, 0.08, 0.12, '#5a5e64', { ao: 0 });
  ctx.litB.box(W / 2 - 1.15, 4.27, -D / 2 + 0.4, 0.5, 0.06, 0.2, '#ffffff', { ao: 0 });
  chainFence(B, -W / 2 + 0.2, -D / 2 + 0.15, W / 2 - 0.2, -D / 2 + 0.15);
  chainFence(B, -W / 2 + 0.15, -D / 2 + 0.2, -W / 2 + 0.15, D / 2 - 1.2);
  chainFence(B, W / 2 - 0.15, -D / 2 + 0.2, W / 2 - 0.15, D / 2 - 1.6);
  return 5.5;
}

/** One or two food stalls: a wooden cart under a canopy, noren, red lanterns, stools, flags and crates. */
function yatai(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number): number {
  const B = ctx.body;
  const n = W >= 8 ? 2 : 1;
  const flags = ['takoyaki', 'yakisoba', 'oden', 'taiyaki', 'kakigori', 'ramenBanner', 'yakitori', 'beer', 'dango'];
  B.box(0, 0.025, 0, W - 0.2, 0.05, D - 0.2, '#a89f90', { ao: 0 });
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? 0 : (k === 0 ? -W / 4 : W / 4);
    const z = -D / 2 + 1.4;
    const wood = pick(r, ['#8a5a32', '#7a4a2a', '#9a6a3a']);
    const roof = pick(r, [['#c8322e', '#f4f4f0'], ['#2c3f6e', '#f4f4f0'], ['#e8862a', '#fff4dc'], ['#3a7a3a', '#f4f4f0']] as const);
    // the cart: a counter box on two wheels, with a grill and pots
    B.box(x, 0.75, z, 2.4, 0.9, 1.0, wood, { ao: 0.12 });
    B.box(x, 1.24, z, 2.6, 0.08, 1.2, '#c8a070', { ao: 0 });
    for (const s of [-1, 1]) B.disc(x, 0.32, z + 0.52 * s, 0.32, 0.08, 'z', '#3a2a1a', 10);
    B.box(x - 0.5, 1.33, z - 0.1, 0.9, 0.1, 0.6, '#2a2a2a', { ao: 0 });
    B.frustum(x + 0.6, 1.28, z - 0.1, 0.25, 0.25, 0.35, 8, '#b8bcc0', { ao: 0 });
    // the canopy: four posts and a little gable roof in stripes
    for (const sx of [-1.3, 1.3]) for (const sz of [-0.6, 0.6]) B.box(x + sx, 1.25, z + sz, 0.07, 2.5, 0.07, wood, { ao: 0 });
    for (let s = 0; s < 6; s++) B.gable(x - 1.5 + s * 0.5 + 0.25, 2.5, z, 0.5, 1.7, 0.35, s % 2 ? roof[1] : roof[0], { alongZ: true });
    // noren across the front, and two red lanterns
    for (let s = 0; s < 4; s++) B.box(x - 0.9 + s * 0.6, 2.18, z + 0.63, 0.56, 0.42, 0.02, s % 2 ? '#a82a24' : '#b8322a', { ao: 0 });
    for (const s of [-1, 1]) {
      ctx.litA.frustum(x + s * 1.15, 1.85, z + 0.68, 0.17, 0.17, 0.42, 8, '#e0402a', { ao: 0 });
      B.box(x + s * 1.15, 2.1, z + 0.68, 0.02, 0.1, 0.02, '#2a1a18', { ao: 0 });
    }
    board(ctx, atlas.get('yataiSign'), x, 2.85, z + 0.62, 1.4, 0.35, '#5a3a24', false);
    // stools in front, a cooler, a gas bottle and beer crates
    for (let s = 0; s < 3; s++) B.frustum(x - 0.8 + s * 0.8, 0, z + 1.1, 0.17, 0.15, 0.55, 8, pick(r, ['#c8322e', '#2a2a2a', '#e8e8e2']), { ao: 0.1 });
    B.box(x - 1.6, 0.25, z - 0.2, 0.5, 0.5, 0.4, '#3a8ad8', { ao: 0.1 });
    B.frustum(x + 1.6, 0, z - 0.3, 0.16, 0.16, 0.6, 8, '#d8d8d8', { ao: 0.1 });
    nobori(ctx, atlas.get(pick(r, flags)), x + 1.55, z + 0.9);
    if (r() < 0.6) nobori(ctx, atlas.get(pick(r, flags)), x - 1.95, z + 0.9);
  }
  // a folding table with plastic crates as seats when there is room
  if (D > 4.6) {
    const tz = D / 2 - 1.3;
    B.box(0, 0.7, tz, 1.6, 0.05, 0.7, '#e8e4dc', { ao: 0 });
    for (const sx of [-0.7, 0.7]) B.box(sx, 0.35, tz, 0.05, 0.7, 0.6, '#9aa0a6', { ao: 0 });
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.4, 0.4]) B.box(sx, 0.17, tz + sz, 0.45, 0.34, 0.32, pick(r, ['#f2c230', '#c8322e', '#3a7ad8']), { ao: 0.1 });
  }
  return 3.4;
}

/** A pocket park: gravel, a green fence, benches, trees, swings, a slide, a sandpit, a fountain and its name. */
function pocketPark(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number, plant: (lx: number, lz: number, k: Parameters<TreeField['add']>[0], s: number) => void): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#c9b88f', { ao: 0 });
  // the fence, with a gap at the street
  const fence = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= n; k++) B.box(xa + (xb - xa) * (k / n), 0.4, za + (zb - za) * (k / n), 0.06, 0.8, 0.06, '#3f8f5a', { ao: 0 });
    B.cable([[xa, 0.78, za], [xb, 0.78, zb]], 0.03, '#3f8f5a');
    B.cable([[xa, 0.4, za], [xb, 0.4, zb]], 0.025, '#3f8f5a');
  };
  const hw = W / 2 - 0.15, hd = D / 2 - 0.15;
  fence(-hw, -hd, hw, -hd);
  fence(-hw, -hd, -hw, hd);
  fence(hw, -hd, hw, hd);
  fence(-hw, hd, -1.0, hd);
  fence(1.0, hd, hw, hd);
  board(ctx, atlas.get('parkName'), -hw + 1.4, 1.2, hd + 0.1, 1.8, 0.45, '#2f7a46');
  for (const s of [-1, 1]) B.box(-hw + 1.4 + s * 0.85, 0.6, hd + 0.1, 0.06, 1.2, 0.06, '#5a5e64', { ao: 0 });
  // trees in the back corners, benches under them
  plant(-hw + 1.2, -hd + 1.2, pick(r, ['sakura', 'round', 'ginkgo', 'jacaranda'] as const), 0.7);
  if (W > 7) plant(hw - 1.2, -hd + 1.2, pick(r, ['sakura', 'round', 'maple'] as const), 0.65);
  bench(B, -hw + 2.6, -hd + 0.7, 0);
  if (W > 6) bench(B, 0, -hd + 0.7, 0, '#6a8a9a');
  // swings
  if (W >= 6 && D >= 5) {
    const sx = hw - 2.0, sz = 0.2;
    for (const s of [-1, 1]) {
      B.box(sx + s * 1.2, 1.1, sz - 0.6, 0.07, 2.2, 0.07, '#d8322e', { ao: 0, yaw: 0 });
      B.box(sx + s * 1.2, 1.1, sz + 0.6, 0.07, 2.2, 0.07, '#d8322e', { ao: 0 });
    }
    B.box(sx, 2.2, sz, 2.6, 0.09, 0.09, '#d8322e', { ao: 0 });
    for (const s of [-0.5, 0.5]) {
      B.box(sx + s - 0.2, 1.35, sz, 0.02, 1.7, 0.02, '#9aa0a6', { ao: 0 });
      B.box(sx + s + 0.2, 1.35, sz, 0.02, 1.7, 0.02, '#9aa0a6', { ao: 0 });
      B.box(sx + s, 0.48, sz, 0.48, 0.05, 0.22, '#f2c230', { ao: 0 });
    }
  }
  // a slide and a sandpit
  if (W >= 8) {
    const lx = -1.0, lz = 0.6;
    B.box(lx, 0.7, lz, 0.8, 1.4, 0.8, '#3a7ad8', { ao: 0.1 });
    B.box(lx, 1.45, lz, 0.9, 0.08, 0.9, '#f2c230', { ao: 0 });
    for (let k = 0; k < 6; k++) B.box(lx, 0.12 + k * 0.23, lz - 0.55 - k * 0.0, 0.6, 0.04, 0.12, '#9aa0a6', { ao: 0 });
    B.box(lx + 1.3, 0.75, lz, 2.0, 0.06, 0.6, '#e8e8e2', { ao: 0, yaw: 0 });
    B.quad([lx + 0.4, 1.42, lz - 0.3], [lx + 0.4, 1.42, lz + 0.3], [lx + 2.4, 0.15, lz + 0.3], [lx + 2.4, 0.15, lz - 0.3], [0.85, 0.85, 0.84]);
  }
  if (D >= 6 && W >= 6) {
    const sx = -hw + 1.8, sz = hd - 1.8;
    for (const [dx, dz, w, d] of [[0, -0.9, 2.0, 0.15], [0, 0.9, 2.0, 0.15], [-0.95, 0, 0.15, 1.8], [0.95, 0, 0.15, 1.8]]) B.box(sx + dx, 0.12, sz + dz, w, 0.24, d, '#b8b4aa', { ao: 0.1 });
    B.box(sx, 0.08, sz, 1.8, 0.06, 1.65, '#e8d8a8', { ao: 0 });
  }
  // a drinking fountain and a clock pole
  B.frustum(hw - 0.6, 0, hd - 0.7, 0.18, 0.15, 0.85, 8, '#b8b4aa', { ao: 0.1 });
  B.box(hw - 0.6, 0.9, hd - 0.7, 0.4, 0.1, 0.4, '#9aa0a6', { ao: 0 });
  if (W > 7) {
    B.box(hw - 1.4, 1.5, hd - 0.4, 0.08, 3.0, 0.08, '#5a5e64', { ao: 0 });
    B.disc(hw - 1.4, 3.0, hd - 0.4, 0.28, 0.12, 'z', '#f4f4ee', 14);
  }
  return 3;
}

/** A covered bicycle park: a shelter with racks and rows of bicycles. */
function bikeParking(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#9a9a96', { ao: 0 });
  const zb = -D / 2 + 1.1;
  for (let x = -W / 2 + 0.4; x <= W / 2 - 0.3; x += Math.max(1.5, (W - 0.7) / Math.round((W - 0.7) / 2.5))) B.box(x, 1.1, zb - 0.9, 0.08, 2.2, 0.08, '#8a9aa0', { ao: 0 });
  B.box(0, 2.25, zb - 0.1, W - 0.4, 0.06, 2.4, '#a8d0c0', { ao: 0 });
  B.box(0, 0.3, zb, W - 0.8, 0.05, 0.05, '#9aa0a6', { ao: 0 });
  for (let x = -W / 2 + 0.7; x < W / 2 - 0.5; x += 0.65) {
    if (r() < 0.8) bicycle(ctx, x, 0.03, zb + 0.1, 0, pick(r, ['#4f7fd9', '#d94f4f', '#7fb8b0', '#e0b341', '#9a9a9a', '#2a2a2a', '#f4f4ee', '#e88ab0']));
  }
  board(ctx, atlas.get('bikePark'), -W / 2 + 1.2, 1.6, D / 2 - 0.3, 1.6, 0.4, '#1f5ea8');
  B.box(-W / 2 + 1.2, 0.7, D / 2 - 0.3, 0.06, 1.4, 0.06, '#9aa0a6', { ao: 0 });
  if (D > 4) for (let x = -W / 2 + 1.0; x < W / 2 - 0.5; x += 1.4) if (r() < 0.5) bicycle(ctx, x, 0.03, D / 2 - 1.4, 0, pick(r, ['#4f7fd9', '#d94f4f', '#9a9a9a', '#2a2a2a']));
  return 2.4;
}

/** A vending machine corner: two or three machines, bins, a bench and sometimes a green public telephone. */
function vendingCorner(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number, plant: (lx: number, lz: number, k: Parameters<TreeField['add']>[0], s: number) => void): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#b0aba0', { ao: 0 });
  const n = Math.min(3, Math.floor((W - 1.2) / 1.05));
  const z = D / 2 - 0.9;
  for (let k = 0; k < n; k++) vendingMachine(ctx, atlas, -((n - 1) * 1.02) / 2 + k * 1.02 - 0.4, 0.04, z, 0, pick(r, ['vendRed', 'vendBlue', 'vendRed']));
  B.box(-((n - 1) * 1.02) / 2 - 0.4, 2.2, z - 0.05, n * 1.02 + 0.3, 0.08, 1.1, '#5a5e64', { ao: 0 });
  bins(ctx, ((n - 1) * 1.02) / 2 + 0.3, 0.04, z + 0.1);
  if (D > 3.4) bench(B, -0.3, -D / 2 + 0.9, 180, '#4a6a8a');
  if (r() < 0.5 && W > 4) {
    // a green public telephone box
    const px = W / 2 - 0.7, pz = -D / 2 + 0.8;
    B.box(px, 1.1, pz, 0.85, 2.2, 0.85, '#7ac08a', { ao: 0.05 });
    B.box(px, 2.25, pz, 0.95, 0.12, 0.95, '#2f7a46', { ao: 0 });
    ctx.win.box(px, 1.15, pz + 0.43, 0.65, 1.7, 0.02, '#cfe8f0', { ao: 0 });
    board(ctx, atlas.get('phone'), px, 2.05, pz + 0.47, 0.3, 0.3, '#2f9a4a', false);
  } else plant(W / 2 - 0.9, -D / 2 + 0.9, 'round', 0.5);
  pot(ctx, -W / 2 + 0.5, 0.04, -D / 2 + 0.5, 2);
  return 2.6;
}

/** A little roadside shrine: a red torii, a wooden hokora on a stone base, lanterns and offerings. */
function hokora(ctx: Ctx, r: () => number, W: number, D: number, plant: (lx: number, lz: number, k: Parameters<TreeField['add']>[0], s: number) => void): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#bdb6a6', { ao: 0 });
  const z = -D / 2 + 1.0;
  B.box(0, 0.3, z, 1.2, 0.6, 1.0, '#a8a49a', { ao: 0.15 });
  B.box(0, 0.95, z, 0.75, 0.7, 0.6, '#8a5a32', { ao: 0.1 });
  B.gable(0, 1.3, z, 1.0, 0.95, 0.4, '#3a3f46');
  B.box(0, 0.95, z + 0.31, 0.5, 0.5, 0.02, '#c8a050', { ao: 0 });
  // the torii
  const tz = z + 1.4;
  for (const s of [-0.65, 0.65]) B.frustum(s, 0, tz, 0.08, 0.07, 1.9, 8, '#d8322e', { ao: 0 });
  B.box(0, 1.9, tz, 1.8, 0.12, 0.16, '#2a2a2a', { ao: 0 });
  B.box(0, 1.78, tz, 1.6, 0.1, 0.12, '#d8322e', { ao: 0 });
  B.box(0, 1.5, tz, 1.4, 0.08, 0.1, '#d8322e', { ao: 0 });
  // stone lanterns, a rope with paper, offerings and greenery
  for (const s of [-1, 1]) {
    const lx = s * 0.95;
    B.box(lx, 0.1, z + 0.4, 0.34, 0.2, 0.34, '#a8a49a', { ao: 0.1 });
    B.box(lx, 0.45, z + 0.4, 0.12, 0.5, 0.12, '#a8a49a', { ao: 0 });
    ctx.litA.box(lx, 0.8, z + 0.4, 0.24, 0.2, 0.24, '#f4e8c8', { ao: 0 });
    B.frustum(lx, 0.9, z + 0.4, 0.22, 0.03, 0.18, 4, '#a8a49a', { rotate: 0.785 });
  }
  B.cable([[-0.4, 1.32, z + 0.33], [0, 1.25, z + 0.33], [0.4, 1.32, z + 0.33]], 0.03, '#d8c890');
  B.box(0, 0.62, z + 0.6, 0.3, 0.04, 0.12, '#f4f4ee', { ao: 0 });
  shrub(ctx, 'round', W / 2 - 0.6, 0, z, 0.7, Math.floor(r() * 9));
  if (W > 4) plant(-W / 2 + 0.9, z, 'cedar', 0.45);
  return 2.4;
}

/** A vegetable garden: beds of crops, a cucumber frame, a tool shed and a blue water drum. */
function garden(ctx: Ctx, r: () => number, W: number, D: number): number {
  const B = ctx.body;
  B.box(0, 0.03, 0, W, 0.06, D, '#9c8a6a', { ao: 0 });
  const beds = Math.max(1, Math.floor((D - 1.0) / 1.3));
  for (let k = 0; k < beds; k++) {
    const z = -D / 2 + 0.9 + k * 1.3;
    B.box(0, 0.12, z, W - 1.6, 0.18, 0.8, '#7a5a3a', { ao: 0.1 });
    const crop = pick(r, ['#5aa845', '#7ab83a', '#3f8a45', '#a8c84a']);
    for (let x = -W / 2 + 1.1; x < W / 2 - 0.9; x += 0.5) B.blob(x, 0.32, z, 0.2, 0.16, 0.22, crop, { seed: Math.floor(x * 7 + k), detail: 0 });
  }
  if (W > 4) {
    // a frame of bamboo for cucumbers
    const fx = W / 2 - 0.6;
    for (let k = 0; k < 3; k++) B.box(fx, 0.8, -D / 2 + 0.8 + k * ((D - 1.6) / 2), 0.04, 1.6, 0.04, '#c8b878', { ao: 0 });
    B.box(fx, 1.55, 0, 0.04, 0.04, D - 1.6, '#c8b878', { ao: 0 });
    B.blob(fx, 1.0, 0, 0.2, 0.55, (D - 1.8) / 2, '#4f9a3f', { seed: 4 });
  }
  B.box(-W / 2 + 0.75, 0.75, D / 2 - 0.7, 1.1, 1.5, 0.9, '#9aa2a8', { ao: 0.15 });
  B.box(-W / 2 + 0.75, 1.55, D / 2 - 0.7, 1.25, 0.1, 1.05, '#5a6068', { ao: 0 });
  B.frustum(-W / 2 + 0.5, 0, -D / 2 + 0.5, 0.28, 0.28, 0.85, 10, '#2a6ac8', { ao: 0.1 });
  if (r() < 0.5) boxes(ctx, W / 2 - 0.6, 0.06, D / 2 - 0.6, 2);
  return 2;
}

/** A narrow leftover strip: potted plants, a vending machine, outdoor AC units, a bicycle, a bench or boxes. */
function nook(ctx: Ctx, atlas: SignAtlas, r: () => number, W: number, D: number, plant: (lx: number, lz: number, k: Parameters<TreeField['add']>[0], s: number) => void): number {
  const B = ctx.body;
  B.box(0, 0.02, 0, W, 0.04, D, '#b3ada2', { ao: 0 });
  let x = -W / 2 + 0.5;
  const z = D / 2 - 0.6;
  while (x < W / 2 - 0.5) {
    const t = r();
    if (t < 0.25 && x + 1 < W / 2) { vendingMachine(ctx, atlas, x + 0.5, 0.03, z - 0.1, 0, pick(r, ['vendRed', 'vendBlue'])); x += 1.15; }
    else if (t < 0.5) { for (let k = 0; k < 3 && x < W / 2 - 0.4; k++, x += 0.5) pot(ctx, x, 0.03, z + (k % 2) * 0.1, Math.floor(r() * 5)); }
    else if (t < 0.65) { B.box(x + 0.4, 0.32, z - 0.05, 0.8, 0.6, 0.32, '#e8e8e2', { ao: 0.1 }); B.disc(x + 0.4, 0.32, z + 0.12, 0.22, 0.02, 'z', '#5a5e64', 12); x += 1.0; }
    else if (t < 0.8) { bicycle(ctx, x + 0.3, 0.03, z - 0.2, 0, pick(r, ['#4f7fd9', '#d94f4f', '#9a9a9a', '#2a2a2a', '#e0b341'])); x += 0.8; }
    else if (t < 0.9 && x + 1.7 < W / 2) { bench(B, x + 0.85, z, 0, '#6a8a9a'); x += 1.8; }
    else { boxes(ctx, x + 0.3, 0.03, z, 2); x += 0.8; }
  }
  if (D > 3.5 && W > 2.2) plant(0, -D / 2 + 1.2, pick(r, ['round', 'sakura', 'maple'] as const), 0.45);
  else if (D > 2.4) shrub(ctx, pick(r, ['round', 'flower', 'cone'] as const), 0, 0, -D / 2 + 0.7, 0.6, Math.floor(r() * 9));
  return 2.2;
}
