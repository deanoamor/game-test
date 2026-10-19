import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { V3 } from '../../util/builder';
import { GeoBuilder } from '../../util/builder';
import { pick, rng } from '../../util/rng';
import { PADDY, POND, WATER_Y } from '../config';
import type { TreeField } from '../forest';
import { raiseSkyline } from '../skyline';
import type { SignAtlas } from '../signs';
import { appendCtx, newCtx, wallBox, wallQuad, type Ctx } from './frame';
import { buildHouse, windowUnit, type HouseSpec } from './house';
import { bicycle, blockWall, busStop, convexMirror, guardrail, jizo, parkedVehicle, pot, redLamp, roadPaint, roadSign, scarecrow, shrub, utilityPole, vendingMachine, wireSpan } from './props';

const G = 2.0; // the ground of the village: houses stand on it, lots and yards are 12 cm higher
const ROAD_Z = 44;
const N_EDGE = ROAD_Z - 4; // the north edge of the main street
const S_EDGE = ROAD_Z + 4;
const YARD = 4.2; // from a front wall to the street

const WALLS = ['#e8e3d6', '#dcd8cb', '#efe9dc', '#d9d2c0', '#f1eee6', '#cfc9b8', '#e4ddcc', '#d5dad8'];
const ROOFS = ['#3e4856', '#4a3f3a', '#35465a', '#52463f', '#3b4a40'];
const TRIMS = ['#8a8f96', '#f2efe6', '#6b5a48', '#7a838c'];

interface Spot { x: number; z: number; yaw: number; side: 'N' | 'S'; spec: HouseSpec }

export interface VillageBuild {
  group: Group;
  update(night: number): void;
}

export function buildVillage(trees: TreeField, atlas: SignAtlas): VillageBuild {
  const r = rng(2024);
  const chunks = new Map<number, Ctx>();
  const at = (x: number): Ctx => {
    const k = Math.floor((x + 160) / 50);
    let c = chunks.get(k);
    if (!c) chunks.set(k, (c = newCtx(r)));
    return c;
  };

  // ---------- the houses on both sides of the main street ----------
  const spots: Spot[] = [];
  const home = (x: number, side: 'N' | 'S', over: Partial<HouseSpec> = {}) => {
    const w = over.w ?? 8 + Math.round(r() * 2);
    const d = over.d ?? 7 + Math.round(r() * 2);
    const floors = over.floors ?? (r() < 0.75 ? 2 : 1);
    const spec: HouseSpec = {
      w, d, floors, wall: pick(r, WALLS), trim: pick(r, TRIMS), roof: r() < 0.55 ? 'gable' : 'hip', roofColor: pick(r, ROOFS),
      pent: floors > 1 && r() < 0.7 ? '#464c54' : undefined, shutters: r() < 0.3 ? pick(r, ['#7a5a3c', '#5a6a4a', '#6a4a3a']) : undefined,
      balcony: floors > 1 && r() < 0.35, ac: 1 + Math.floor(r() * 3), antenna: r() < 0.6, chimney: r() < 0.12, slats: r() < 0.3, door: pick(r, ['#7a5a3c', '#5a4a3a', '#4a6a5a', '#8a3a30']),
      doorU: -w / 2 + 1.5 + r() * Math.max(0.5, w - 3.4), lit: 0.25 + r() * 0.35, gableFront: r() < 0.25, ...over,
    };
    const z = side === 'N' ? N_EDGE - YARD - d / 2 : S_EDGE + YARD + d / 2;
    spots.push({ x, z, yaw: side === 'N' ? 0 : 180, side, spec });
  };
  for (const x of [-132, -112, -72, -52, -33]) home(x, 'N');
  home(-92, 'N', { floors: 1, w: 8, d: 7, roof: 'hip', trim: '#4a6a3a', wall: '#efe9d6', ac: 1, shop: { awning: ['#3b9a3a', '#f6f2e0'], sign: 'yaoya', noren: '#3b9a3a' } });
  // the ramen shop: the hero of the corner
  home(-14, 'N', { w: 7.6, d: 9, floors: 2, wall: '#d6d3c8', wall2: '#cdc8ba', trim: '#4a5560', roof: 'gable', roofColor: '#38414c', pent: '#2f3a46', stack: true, ac: 1, lit: 0.75, shutters: undefined, balcony: false, antenna: false, slats: false, chimney: false, gableFront: false,
    shop: { awning: ['#17a39a', '#e8f6f4'], curved: true, sign: 'ramenAwning', noren: '#b3322a', banners: ['sukiyaki', 'ramenBanner'], menu: true } });
  // the yellow house beyond the lane
  home(14, 'N', { w: 9.4, d: 8.4, floors: 2, wall: '#e8d46a', wall2: '#e8d46a', trim: '#f4f1e8', roof: 'hip', roofColor: '#3a3f46', shutters: '#7a5a3c', balcony: true, antenna: true, ac: 2, slats: false, pent: '#3a3f46', gableFront: false, chimney: false });
  for (const x of [33, 52, 92, 113, 134]) home(x, 'N');
  home(71, 'N', { floors: 1, w: 8, d: 7, roof: 'gable', trim: '#1f5ea8', wall: '#e4e6e8', ac: 2, shop: { awning: ['#1f5ea8', '#f4f4f0'], sign: 'denki' } });
  for (const x of [-134, -114, -80, -44, -8, 30, 50]) home(x, 'S');
  home(-96, 'S', { floors: 1, w: 8, d: 7, roof: 'hip', wall: '#e6f0f4', trim: '#2a9bd6', shop: { awning: ['#2a9bd6', '#f4f4f0'], sign: 'laundry' } });
  home(-26, 'S', { floors: 1, w: 8, d: 7, roof: 'gable', wall: '#efe4d0', trim: '#c8322e', shop: { awning: ['#c8322e', '#f4f4f0'], sign: 'shoten', noren: '#c8322e' } });

  // houses along the two lanes that run south from the main street
  const laneHome = (laneX: number, laneHalf: number, z: number, east: boolean, over: Partial<HouseSpec> = {}) => {
    const d0 = over.d ?? 7 + Math.round(r() * 2);
    const front = east ? laneX - laneHalf - YARD : laneX + laneHalf + YARD;
    const x = east ? front - d0 / 2 : front + d0 / 2;
    const before = spots.length;
    home(0, 'N', { d: d0, ...over });
    const sp = spots[before];
    sp.x = x;
    sp.z = z;
    sp.yaw = east ? 90 : -90;
  };
  for (const z of [64, 80, 96]) { laneHome(-62, 2.5, z, true); laneHome(-62, 2.5, z + 4, false); }
  for (const z of [66, 84, 102]) laneHome(72, 2.3, z, true);

  for (const s of spots) {
    const { w, d } = s.spec;
    const ctx = buildHouse(s.spec, r, atlas);
    const B = ctx.body;
    // the lot: grass behind, a concrete yard in front, a slab under the house
    B.box(0, 0.05, -d / 2 - 1.5, w + 5, 0.1, 3, '#86bd55', { ao: 0, noTop: false });
    B.box(0, 0.06, d / 2 + YARD / 2, w + 4, 0.12, YARD, '#cdc9be', { ao: 0.1 });
    B.box(0, 0.06, 0, w + 4, 0.12, d, '#a9a59b', { ao: 0.1 });
    // yard: a block wall along the street with a gate gap, pots and shrubs
    const gu = s.spec.doorU ?? 0;
    const lx = -(w / 2 + 2), rx = w / 2 + 2;
    const wz = d / 2 + YARD - 0.2;
    if (!s.spec.shop) {
      blockWall(ctx, lx, wz, gu - 1.6, wz, 0.12, 1.1);
      blockWall(ctx, gu + 1.6, wz, rx, wz, 0.12, 1.1);
      B.box(gu - 1.6, 0.75, wz, 0.34, 1.3, 0.34, '#c9c6bd', { ao: 0.1 });
      B.box(gu + 1.6, 0.75, wz, 0.34, 1.3, 0.34, '#c9c6bd', { ao: 0.1 });
      B.box(gu + 0.7, 0.8, wz, 1.4, 1.0, 0.05, '#3a3f46', { ao: 0, yaw: 20 });
    }
    pot(ctx, -w / 2 + 0.6, 0.12, d / 2 + 0.9, Math.floor(r() * 5));
    pot(ctx, w / 2 - 0.6, 0.12, d / 2 + 1.2, Math.floor(r() * 5));
    shrub(ctx, pick(r, ['round', 'flower', 'cone', 'round'] as const), -w / 2 - 1.2, 0.12, d / 2 + 1.5, 0.8 + r() * 0.6, Math.floor(r() * 9));
    shrub(ctx, pick(r, ['round', 'hedge', 'flower'] as const), w / 2 + 1.4, 0.12, d / 2 + 2.2, 0.8 + r() * 0.5, Math.floor(r() * 9));
    if (r() < 0.5) bicycle(ctx, w / 2 - 1.8, 0.12, d / 2 + 2.6, 90, pick(r, ['#4f7fd9', '#d94f4f', '#7fb8b0', '#e0b341']));
    appendCtx(at(s.x), ctx, s.x, G, s.z, s.yaw);
    const rr = Math.max(w, d) / 2 + 1;
    raiseSkyline(s.x - rr, s.z - rr, s.x + rr, s.z + rr, G + 0.5 + s.spec.floors * 3.05 + 3.2);
  }

  // ---------- utility poles and wires ----------
  const lines: { side: 'N' | 'S'; list: { x: number; z: number; w: ReturnType<typeof utilityPole> }[] }[] = [
    { side: 'N', list: [] },
    { side: 'S', list: [] },
  ];
  for (let k = 0; k < 14; k++) {
    const xn = -143 + 22 * k, xs = -132 + 22 * k;
    lines[0].list.push({ x: xn, z: N_EDGE - 0.6, w: utilityPole(at(xn), G, N_EDGE - 0.6, 0, { transformer: k % 3 === 1 }) });
    lines[1].list.push({ x: xs, z: S_EDGE + 0.6, w: utilityPole(at(xs), G, S_EDGE + 0.6, 0, { transformer: k % 4 === 2 }) });
  }
  for (const ln of lines) {
    for (let i = 0; i < ln.list.length - 1; i++) {
      const a = ln.list[i], b = ln.list[i + 1];
      wireSpan(at(a.x), a.w.power, b.w.power, 0.55);
      wireSpan(at(a.x), a.w.phone, b.w.phone, 0.4, 0.022, '#34383d');
    }
  }
  // wires across the street between the two lines, and drops from poles down to the houses
  for (let i = 0; i < 12; i += 2) {
    const a = lines[0].list[i + 1], b = lines[1].list[i];
    wireSpan(at(a.x), [a.w.power[1], a.w.phone[0]], [b.w.power[1], b.w.phone[1]], 0.5);
  }
  for (const s of spots.filter((q) => Math.abs(q.yaw) === 0 || Math.abs(q.yaw) === 180)) {
    const ln = lines[s.side === 'N' ? 0 : 1].list;
    const near = ln.reduce((p, q) => (Math.abs(q.x - s.x) < Math.abs(p.x - s.x) ? q : p));
    const hgt = G + 0.45 + s.spec.floors * (s.spec.fh ?? 3.05) - 0.5;
    const zf = s.side === 'N' ? s.z + s.spec.d / 2 + 0.1 : s.z - s.spec.d / 2 - 0.1;
    const to: V3 = [s.x + 1.2, hgt, zf];
    at(s.x).body.cable(sagPts(near.w.drop, to, 0.45), 0.018, '#202327');
  }

  // ---------- street furniture ----------
  const A = (x: number) => at(x);
  const yardTop = G + 0.12;
  guardrail(A(-6), -9.4, -3.0, yardTop, N_EDGE - 0.25);
  guardrail(A(8), 6.0, 21.0, yardTop, N_EDGE - 0.25);
  guardrail(A(30), 26.0, 36.0, yardTop, S_EDGE + 0.25);
  convexMirror(A(-3), -3.4, yardTop, N_EDGE - 0.9, 90);
  roadSign(A(-5), atlas, 'speed30', -5.6, yardTop, N_EDGE - 0.7, 0, 2.5);
  roadSign(A(3), atlas, 'stopSign', 3.2, yardTop, N_EDGE - 0.9, 0, 2.5);
  roadPaint(A(0), atlas, 'roadStop', 0, G + 0.05, N_EDGE - 3.4, 2.6, 0);
  vendingMachine(A(-8), atlas, -8.2, yardTop, 36.9, 0, 'vendRed');
  vendingMachine(A(-8), atlas, -7.0, yardTop, 36.9, 0, 'vendBlue');
  vendingMachine(A(10), atlas, 4.6, yardTop, 38.6, 180, 'vendRed');
  busStop(A(12), atlas, 12, yardTop, S_EDGE + 1.6, 180);
  parkedVehicle(A(-22), 'kei', '#f4f4ee', -22.5, yardTop, 37.4, 6);
  parkedVehicle(A(24), 'van', '#7a2a2e', 24.5, yardTop, 37.8, 98);
  parkedVehicle(A(60), 'car', '#2f2f35', 58.6, yardTop, 37.4, 4);
  parkedVehicle(A(-60), 'kei', '#dfe6ee', -48.5, yardTop, S_EDGE + 2.0, 176);
  bicycle(A(-17), -17.4, yardTop, 37.6, 92, '#7fb8b0');
  bicycle(A(-6), -5.2, yardTop, 38.4, 80, '#d94f4f');
  for (const x of [-4.8, 4.8, -44, 44, -88, 88, 124]) redLamp(A(x), x, yardTop, N_EDGE - 0.5, x > 0 ? -1 : 1);
  for (const x of [-60, -20, 36, 78, -110]) redLamp(A(x), x, yardTop, S_EDGE + 0.5, 1);
  // jizo statues on the lane that climbs to the shrine
  jizo(A(2.8), 3.2, G + 0.1, 8.4, -20);
  jizo(A(2.8), -3.0, G + 0.1, -10.8, 25);

  // ---------- the apartment blocks behind the south side ----------
  apartment(A(-18), atlas, r, -18, 114, 22, 10, 4, '#e9e0cc');
  apartment(A(30), atlas, r, 30, 128, 17, 10, 6, '#d9dcd8');

  // ---------- paddies and pond ----------
  paddies(A(PADDY.x), r);
  scarecrow(A(PADDY.x), PADDY.x - 12, PADDY.height, PADDY.z + 6);
  scarecrow(A(PADDY.x), PADDY.x + 18, PADDY.height, PADDY.z - 14);
  {
    const shed = buildHouse({ w: 4.6, d: 3.6, floors: 1, wall: '#d8c9a6', trim: '#6b5a48', roof: 'gable', roofColor: '#6a5648', door: '#6a4a3a', doorU: 0, ac: 0, antenna: false, lit: 0 }, r, atlas);
    appendCtx(A(PADDY.x), shed, PADDY.x - 28, PADDY.height, PADDY.z - 32, 14);
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    const rx = POND.x + Math.cos(a) * (POND.radius - 1.2), rz = POND.z + Math.sin(a) * (POND.radius - 1.2);
    A(rx).body.blob(rx, WATER_Y + 0.15, rz, 1.0 + (k % 3) * 0.4, 0.6, 0.9, ['#8f8b82', '#a29d92', '#7d7a72'][k % 3], { seed: k });
  }
  for (let k = 0; k < 7; k++) A(POND.x).body.disc(POND.x + Math.cos(k * 2.3) * (4 + k * 1.1), WATER_Y + 0.06, POND.z + Math.sin(k * 2.3) * (3 + k), 0.7, 0.04, 'y', '#5aa845', 10);
  A(POND.x).body.box(POND.x + POND.radius - 4, WATER_Y + 0.5, POND.z, 8, 0.2, 2.0, '#9a7a52', { ao: 0.1 });
  for (let k = 0; k < 5; k++) A(POND.x).body.box(POND.x + POND.radius - 7 + k * 1.6, WATER_Y, POND.z + (k % 2 ? 0.95 : -0.95), 0.2, 1.0, 0.2, '#6b5238', { ao: 0 });

  // ---------- trees around the village ----------
  trees.add('jacaranda', 24.5, 28.0, 1.15, G);
  trees.add('sakura', -46, 24, 1.2, G);
  trees.add('sakura', 62, 26, 1.1, G);
  trees.add('ginkgo', -84, 56, 1.1, G);
  trees.add('round', -3.5, 24, 1.0, G);
  for (const [x, z] of [[-124, 22], [-100, 28], [-60, 26], [40, 22], [100, 24], [-120, 60], [-62, 72], [-34, 70], [20, 62], [58, 62], [-100, 66]]) trees.add(pick(r, ['round', 'sakura', 'ginkgo', 'maple'] as const), x + (r() - 0.5) * 4, z + (r() - 0.5) * 4, 0.85 + r() * 0.4, G);
  // groves and orchards on the open ground in the south and the west
  for (const [gx, gz, n] of [[-24, 96, 26], [-110, 70, 18], [96, 116, 22], [-8, 142, 24], [-132, 124, 20], [52, 100, 16]] as const) {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 13;
      const x = gx + Math.cos(a) * rad, z = gz + Math.sin(a) * rad;
      trees.add(pick(r, ['round', 'round', 'ginkgo', 'sakura', 'cedar', 'maple'] as const), x, z, 0.8 + r() * 0.5, G);
    }
  }
  for (let k = 0; k < 40; k++) {
    const x = -140 + r() * 280, z = pick(r, [12, 16, 62, 70, 90, 100]) + r() * 6;
    trees.add('shrub', x, z, 0.8 + r() * 0.7, G);
  }

  return assemble(chunks, atlas);
}

/** The rice paddies: plots with rows of seedlings or flooded water, raised banks, a ditch and a footpath. */
function paddies(ctx: Ctx, r: () => number) {
  const B = ctx.body;
  const px = 15, pz = 10.2; // plot size
  const nx = Math.floor((PADDY.hx * 2) / px), nz = Math.floor((PADDY.hz * 2) / pz);
  const x0 = PADDY.x - (nx * px) / 2, z0 = PADDY.z - (nz * pz) / 2;
  const y = PADDY.height;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * px, cz = z0 + (j + 0.5) * pz;
      const flooded = r() < 0.22;
      const stage = r();
      B.box(cx, y + 0.05, cz, px - 1.0, 0.18, pz - 0.9, flooded ? '#6fa9a4' : stage < 0.35 ? '#a4d25a' : stage < 0.7 ? '#8cc64e' : '#b9d65a', { ao: 0.05 });
      if (!flooded) for (let k = 0; k < 7; k++) B.box(cx, y + 0.17, cz - (pz - 1.9) / 2 + (k * (pz - 1.9)) / 6, px - 1.6, 0.08, 0.2, stage < 0.35 ? '#78b046' : '#6aa63e', { ao: 0 });
      else for (let k = 0; k < 4; k++) B.box(cx + (k - 1.5) * 3, y + 0.17, cz, 0.12, 0.22, 0.12, '#6aa63e', { ao: 0 });
    }
  }
  // banks between the plots, and the footpath around
  for (let j = 0; j <= nz; j++) B.box(PADDY.x, y + 0.1, z0 + j * pz, nx * px, 0.3, 0.9, '#a68e5e', { ao: 0.1 });
  for (let i = 0; i <= nx; i++) B.box(x0 + i * px, y + 0.1, PADDY.z, 0.9, 0.3, nz * pz, '#a68e5e', { ao: 0.1 });
  B.box(PADDY.x, y + 0.02, z0 - 1.8, nx * px + 4, 0.1, 1.2, '#7aa8b0', { ao: 0 }); // the irrigation ditch
  // straw bales and a stack of drying poles at the corner
  for (let k = 0; k < 4; k++) B.frustum(x0 + 5 + k * 1.6, y + 0.1, z0 + nz * pz + 2.4, 0.6, 0.45, 1.2, 8, '#d8b86a', { ao: 0.1 });
  for (let k = 0; k < 6; k++) B.box(x0 + 22 + k * 0.7, y + 1.0, z0 + nz * pz + 2.6, 0.08, 2.0, 0.08, '#8a6a46', { ao: 0 });
  B.box(x0 + 24, y + 1.9, z0 + nz * pz + 2.6, 4.2, 0.08, 0.08, '#8a6a46', { ao: 0 });
  B.box(x0 + 24, y + 1.4, z0 + nz * pz + 2.6, 4.2, 0.08, 0.08, '#8a6a46', { ao: 0 });
}

const sagPts = (a: V3, b: V3, drop: number, n = 6): V3[] => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t] as V3;
});

/** A cream apartment block seen from the street: rows of windows and balconies. Faces -Z. */
function apartment(ctx: Ctx, atlas: SignAtlas, r: () => number, x: number, z: number, w: number, d: number, floors: number, wall: string) {
  void atlas;
  const loc = newCtx(r);
  const B = loc.body;
  const fh = 3.0;
  const hw = w / 2, hd = d / 2;
  B.box(0, 0.05, 0, w + 3, 0.1, d + 3, '#b9b5ab', { ao: 0 });
  B.box(0, 0.4 + (floors * fh) / 2, 0, w, floors * fh, d, wall, { ao: 0.14 });
  B.box(0, 0.4 + floors * fh + 0.15, 0, w + 0.5, 0.3, d + 0.5, '#8a8f96', { ao: 0 });
  for (let fl = 0; fl < floors; fl++) {
    const y0 = 0.4 + fl * fh;
    B.box(0, y0 + 0.05, 0, w + 0.2, 0.14, d + 0.2, '#cfcabd', { ao: 0 });
    const cols = Math.floor(w / 3.2);
    for (let c = 0; c < cols; c++) {
      const u = -w / 2 + (c + 0.5) * (w / cols);
      windowUnit(loc, '+z', hw, hd, u + 0.6, y0 + 0.5, 1.3, 1.9, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.35, tall: true });
      windowUnit(loc, '+z', hw, hd, u - 0.9, y0 + 1.0, 0.9, 1.1, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.3 });
      wallBox(B, '+z', hw, hd, u + 0.6, y0 + 0.1, 2.2, 0.16, 0.9, 0.45, '#d2cec2');
      wallBox(B, '+z', hw, hd, u + 0.6, y0 + 0.62, 2.2, 0.55, 0.05, 0.9, '#f0ece0', 0.05);
      wallBox(B, '+z', hw, hd, u + 0.6, y0 + 1.0, 2.2, 0.05, 0.07, 0.9, '#4d535b', 0);
    }
    wallQuad(loc.win, '+x', hw, hd, 0, y0 + 0.6, 1.2, 1.2, '#6f93aa', 0.04);
  }
  appendCtx(ctx, loc, x, G, z, 180);
  raiseSkyline(x - w / 2, z - d / 2, x + w / 2, z + d / 2, G + 0.9 + floors * fh);
}

/** One mesh per kind of surface for every 50 m chunk of the village. */
function assemble(chunks: Map<number, Ctx>, atlas: SignAtlas): VillageBuild {
  const group = new Group();
  group.name = 'Village';
  const body = new MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 });
  const win = new MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.35, envMapIntensity: 1.3 });
  const litA = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#ffcf7a'), emissiveIntensity: 0 });
  const litB = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#bfe3ff'), emissiveIntensity: 0 });
  const sign = new MeshStandardMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: new Color('#ffffff'), emissiveIntensity: 0.35, roughness: 0.55, alphaTest: 0.4, side: 2 });
  for (const [k, ctx] of chunks) {
    const add = (b: GeoBuilder, mat: MeshStandardMaterial, shadow: boolean, name: string) => {
      if (b.triangles === 0) return;
      const m = new Mesh(b.toGeometry(), mat);
      m.castShadow = shadow;
      m.receiveShadow = shadow || name === 'Signs';
      m.name = `${name} ${k}`;
      group.add(m);
    };
    add(ctx.body, body, true, 'Buildings');
    add(ctx.win, win, false, 'Windows');
    add(ctx.litA, litA, false, 'Lit windows');
    add(ctx.litB, litB, false, 'Lit windows 2');
    add(ctx.sign, sign, false, 'Signs');
  }
  return {
    group,
    update(night: number) {
      litA.emissiveIntensity = night * 1.25;
      litB.emissiveIntensity = night * 1.05;
      sign.emissiveIntensity = 0.3 + night * 1.0;
    },
  };
}
