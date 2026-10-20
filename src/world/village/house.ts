import { Color } from 'three';
import type { V3 } from '../../util/builder';
import type { SignAtlas } from '../signs';
import { FACES, NORMAL, TANGENT, dk, hangSign, newCtx, wallBox, wallPicture, wallQuad, wp, type Ctx, type Face } from './frame';

export interface ShopSpec {
  awning: [string, string];
  curved?: boolean;
  style?: 'stripes' | 'box' | 'none';
  sign?: string; // a wide sign on the awning front (atlas name)
  noren?: string;
  banners?: string[]; // tall banners hung from the wall (atlas names)
  menu?: boolean;
}

export interface HouseSpec {
  w: number;
  d: number;
  floors: number;
  fh?: number;
  wall: string;
  wall2?: string;
  trim: string;
  plinth?: string;
  roof: 'gable' | 'hip' | 'flat';
  roofColor: string;
  gableFront?: boolean; // ridge runs front to back (the gable end faces the street)
  pent?: string;
  shutters?: string;
  balcony?: boolean;
  ac?: number;
  antenna?: boolean;
  chimney?: boolean;
  stack?: boolean; // a tall dark chimney stack on the side wall
  slats?: boolean;
  door?: string;
  doorU?: number;
  frame?: string;
  glass?: string;
  lit?: number;
  shop?: ShopSpec;
  tiles?: string; // ground floor walls covered in small tiles of this colour
  stairs?: 'left' | 'right'; // outside steel stairs up the side to the first floor
  board?: string; // a wide sign board over the ground floor (atlas name)
  roundSign?: string; // a round sign on a bracket at the corner (atlas name)
  lattice?: string; // wooden slats over the front of the ground floor
  planters?: boolean; // window boxes with plants under the upper windows
  bars?: boolean; // grilles on the ground floor windows
  parapet?: string; // for flat roofs: the low wall around the roof
}

const FRONT: Face = '+z';

/** One window: frame, glass (lit or not), mullions, sill and optional louvered shutters. */
export function windowUnit(ctx: Ctx, f: Face, hw: number, hd: number, u: number, yb: number, w: number, h: number, o: { frame: string; glass: string; lit: boolean; shutter?: string; tall?: boolean }) {
  const B = ctx.body;
  const yc = yb + h / 2;
  wallBox(B, f, hw, hd, u, yb + 0.04, w + 0.16, 0.08, 0.1, 0.05, o.frame);
  wallBox(B, f, hw, hd, u, yb + h - 0.04, w + 0.16, 0.08, 0.1, 0.05, o.frame);
  wallBox(B, f, hw, hd, u - w / 2 - 0.04, yc, 0.08, h, 0.1, 0.05, o.frame);
  wallBox(B, f, hw, hd, u + w / 2 + 0.04, yc, 0.08, h, 0.1, 0.05, o.frame);
  const target = o.lit ? (ctx.r() < 0.78 ? ctx.litA : ctx.litB) : ctx.win;
  wallQuad(target, f, hw, hd, u, yb + 0.06, w, h - 0.12, o.lit ? '#ffe3a6' : o.glass, 0.03);
  wallBox(B, f, hw, hd, u, yc, 0.05, h - 0.1, 0.06, 0.06, o.frame);
  if (!o.tall) wallBox(B, f, hw, hd, u, yc + h * 0.12, w, 0.05, 0.06, 0.06, o.frame);
  wallBox(B, f, hw, hd, u, yb - 0.03, w + 0.34, 0.07, 0.24, 0.12, '#cbc6ba');
  if (o.shutter) {
    for (const s of [-1, 1]) {
      const pu = u + s * (w / 2 + w * 0.26 + 0.08);
      wallBox(B, f, hw, hd, pu, yc, w * 0.5, h, 0.05, 0.05, o.shutter);
      for (let k = 1; k <= 6; k++) wallBox(B, f, hw, hd, pu, yb + (k * h) / 7, w * 0.46, 0.025, 0.04, 0.085, dk(o.shutter, 0.62), 0);
    }
  }
}

/** An air conditioner on a wall: a box, a dark fan and a hose. */
export function airConditioner(ctx: Ctx, f: Face, hw: number, hd: number, u: number, y: number) {
  wallBox(ctx.body, f, hw, hd, u, y, 0.9, 0.5, 0.3, 0.15, '#e6e9eb');
  wallBox(ctx.body, f, hw, hd, u - 0.12, y, 0.34, 0.34, 0.04, 0.32, '#4a4f55', 0);
  wallBox(ctx.body, f, hw, hd, u + 0.3, y - 0.05, 0.12, 0.22, 0.05, 0.32, '#c8ccd0', 0);
  wallBox(ctx.body, f, hw, hd, u + 0.38, y - 0.55, 0.05, 0.6, 0.05, 0.05, '#d8dcde', 0);
}

type Pt = [number, number, number];
const pick2 = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
const lerp3 = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Rows of tiles on a roof slope: thin darker strips from the eave line to the ridge line. */
function tileRows(ctx: Ctx, e0: Pt, e1: Pt, r0: Pt, r1: Pt, color: Color, rows = 9) {
  const nx = (e1[1] - e0[1]) * (r0[2] - e0[2]) - (e1[2] - e0[2]) * (r0[1] - e0[1]);
  const ny = (e1[2] - e0[2]) * (r0[0] - e0[0]) - (e1[0] - e0[0]) * (r0[2] - e0[2]);
  const nz = (e1[0] - e0[0]) * (r0[1] - e0[1]) - (e1[1] - e0[1]) * (r0[0] - e0[0]);
  const nl = Math.hypot(nx, ny, nz) || 1;
  const sgn = ny >= 0 ? 1 : -1;
  const off: V3 = [(nx / nl) * 0.025 * sgn, (ny / nl) * 0.025 * sgn, (nz / nl) * 0.025 * sgn];
  const c: [number, number, number] = [color.r, color.g, color.b];
  for (let k = 0; k < rows; k++) {
    const t = 0.05 + (k / rows) * 0.9, t2 = t + 0.035;
    const a = lerp3(e0, r0, t), b = lerp3(e1, r1, t), cc = lerp3(e1, r1, t2), d = lerp3(e0, r0, t2);
    const mv = (p: Pt): V3 => [p[0] + off[0], p[1] + off[1], p[2] + off[2]];
    ctx.body.quadFacing(mv(a), mv(b), mv(cc), mv(d), [off[0], off[1], off[2]], c);
  }
}

/** The roof: slopes, tile rows, ridge, fascia boards and gutters. Returns the roof peak height. */
function roof(ctx: Ctx, spec: HouseSpec, H: number): number {
  if (spec.roof === 'flat') {
    const B = ctx.body;
    const pc = spec.parapet ?? spec.trim;
    B.box(0, H + 0.1, 0, spec.w + 0.2, 0.2, spec.d + 0.2, '#9a9a96', { ao: 0 });
    for (const [x, z, sx, sz] of [[0, spec.d / 2, spec.w + 0.3, 0.2], [0, -spec.d / 2, spec.w + 0.3, 0.2], [spec.w / 2, 0, 0.2, spec.d + 0.3], [-spec.w / 2, 0, 0.2, spec.d + 0.3]] as const) B.box(x, H + 0.45, z, sx, 0.7, sz, pc, { ao: 0.05 });
    // roof gear: a water tank or air conditioners and a little stair hut
    if (ctx.r() < 0.5) {
      for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) B.box(spec.w * 0.2 + lx, H + 0.6, lz, 0.08, 1.0, 0.08, '#5a5f66', { ao: 0 });
      B.frustum(spec.w * 0.2, H + 1.1, 0, 0.75, 0.75, 1.3, 10, pick2(ctx.r, ['#9fb3c4', '#c9cfd4', '#b98a6a']));
    } else for (let k = 0; k < 2; k++) B.box(-spec.w * 0.2 + k * 1.0, H + 0.5, -spec.d * 0.2, 0.8, 0.6, 0.5, '#e6e9eb', { ao: 0.1 });
    return H + 0.8;
  }
  const ov = 0.7;
  const RW = spec.w + ov * 2, RD = spec.d + ov * 2;
  const alongZ = !!spec.gableFront;
  const span = alongZ ? RW : RD; // the width across the ridge
  const hr = (span / 2) * 0.58;
  const rc = new Color(spec.roofColor);
  const tile = rc.clone().multiplyScalar(0.72);
  const B = ctx.body;
  let rx0 = -RW / 2, rx1 = RW / 2, rz0 = -RD / 2, rz1 = RD / 2;
  if (spec.roof === 'gable') {
    B.gable(0, H, 0, RW, RD, hr, rc, { alongZ });
    if (alongZ) { rx0 = rx1 = 0; } else { rz0 = rz1 = 0; }
  } else {
    B.hip(0, H, 0, RW, RD, hr, rc, { alongZ });
    if (!alongZ) { const r = Math.max(0, (RW - RD) / 2); rx0 = -r; rx1 = r; rz0 = rz1 = 0; }
    else { const r = Math.max(0, (RD - RW) / 2); rz0 = -r; rz1 = r; rx0 = rx1 = 0; }
  }
  const y = H + hr;
  if (!alongZ) {
    tileRows(ctx, [-RW / 2, H, RD / 2], [RW / 2, H, RD / 2], [rx0, y, rz0], [rx1, y, rz1], tile);
    tileRows(ctx, [RW / 2, H, -RD / 2], [-RW / 2, H, -RD / 2], [rx1, y, rz0], [rx0, y, rz1], tile);
    B.box(0, y + 0.06, 0, Math.max(0.3, rx1 - rx0 + (spec.roof === 'gable' ? 0.15 : 0.35)), 0.16, 0.3, dk(spec.roofColor, 0.55), { ao: 0 });
  } else {
    tileRows(ctx, [RW / 2, H, RD / 2], [RW / 2, H, -RD / 2], [rx0, y, rz1], [rx0, y, rz0], tile);
    tileRows(ctx, [-RW / 2, H, -RD / 2], [-RW / 2, H, RD / 2], [rx0, y, rz0], [rx0, y, rz1], tile);
    B.box(0, y + 0.06, 0, 0.3, 0.16, Math.max(0.3, rz1 - rz0 + (spec.roof === 'gable' ? 0.15 : 0.35)), dk(spec.roofColor, 0.55), { ao: 0 });
  }
  // fascia boards and a gutter around the eaves
  B.box(0, H + 0.04, RD / 2, RW, 0.16, 0.1, '#e9e4d8', { ao: 0 });
  B.box(0, H + 0.04, -RD / 2, RW, 0.16, 0.1, '#e9e4d8', { ao: 0 });
  B.box(RW / 2, H + 0.04, 0, 0.1, 0.16, RD, '#e9e4d8', { ao: 0 });
  B.box(-RW / 2, H + 0.04, 0, 0.1, 0.16, RD, '#e9e4d8', { ao: 0 });
  B.box(0, H - 0.06, RD / 2 - 0.02, RW, 0.09, 0.12, '#8a9096', { ao: 0 });
  return y;
}

/** A TV antenna: a mast with crossbars. */
function antenna(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.box(x, y + 1.6, z, 0.07, 3.2, 0.07, '#9aa0a6', { ao: 0 });
  for (let k = 0; k < 4; k++) B.box(x, y + 1.7 + k * 0.5, z, 0.05, 0.05, 1.5 - k * 0.22, '#9aa0a6', { ao: 0 });
  B.box(x, y + 1.7 + 1.5, z, 0.05, 0.05, 0.9, '#9aa0a6', { ao: 0 });
}

/**
 * A village house or shop, built facing +Z with its centre on the origin and its feet on y = 0.
 * Walls with floor bands, windows with sills and shutters, pent eaves, a tiled roof, air conditioners, a door
 * (or a shop front with an awning, noren and banners), a tall chimney stack, a TV antenna.
 */
export function buildHouse(spec: HouseSpec, r: () => number, atlas: SignAtlas): Ctx {
  const ctx = newCtx(r);
  const B = ctx.body;
  const { w, d } = spec;
  const hw = w / 2, hd = d / 2;
  const fh = spec.fh ?? 3.05;
  const base = 0.45;
  const frame = spec.frame ?? '#f2efe6';
  const glass = spec.glass ?? '#7fa6c2';
  const litP = spec.lit ?? 0.4;
  B.box(0, base / 2, 0, w + 0.3, base, d + 0.3, spec.plinth ?? '#b9b5ab', { ao: 0.2 });
  for (let fl = 0; fl < spec.floors; fl++) {
    const y0 = base + fl * fh;
    B.box(0, y0 + fh / 2, 0, w, fh, d, fl === 0 ? spec.wall : spec.wall2 ?? spec.wall, { ao: 0.14 });
    B.box(0, y0 + fh - 0.07, 0, w + 0.14, 0.14, d + 0.14, spec.trim, { ao: 0 });
    if (spec.slats && fl > 0) {
      for (const f of ['+z', '-z'] as Face[]) for (let k = 1; k < 10; k++) wallBox(B, f, hw, hd, 0, y0 + k * 0.28, w - 0.1, 0.03, 0.03, 0.015, dk(spec.wall2 ?? spec.wall, 0.78), 0);
    }
  }
  const H = base + spec.floors * fh;
  if (spec.tiles) tileWalls(ctx, w, d, base, fh, spec.tiles);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(sx * hw, base + (spec.floors * fh) / 2, sz * hd, 0.22, spec.floors * fh, 0.22, dk(spec.wall, 0.9), { ao: 0.08 });

  // windows
  const doorU = spec.doorU ?? -hw + 1.5;
  for (const f of FACES) {
    const L = f === '+z' || f === '-z' ? w : d;
    const cols = Math.max(1, Math.floor((L - 0.8) / 2.6));
    for (let fl = 0; fl < spec.floors; fl++) {
      const yb = base + fl * fh + 0.85;
      for (let c = 0; c < cols; c++) {
        const u = -L / 2 + (c + 0.5) * (L / cols);
        if (f === FRONT && fl === 0 && (spec.shop || Math.abs(u - doorU) < 1.4)) continue;
        if (f === FRONT && fl >= 1 && spec.balcony && c === Math.floor(cols / 2)) continue;
        const ww = Math.min(1.55, L / cols - 0.9);
        windowUnit(ctx, f, hw, hd, u, yb, ww, 1.3, { frame, glass, lit: r() < litP, shutter: spec.shutters && r() < 0.8 ? spec.shutters : undefined });
        if (spec.bars && fl === 0) for (let k = 0; k < 5; k++) wallBox(B, f, hw, hd, u - ww / 2 + 0.12 + (k * (ww - 0.24)) / 4, yb + 0.65, 0.04, 1.25, 0.04, 0.16, '#d8dcdf', 0);
        if (spec.planters && fl > 0 && f === FRONT && r() < 0.7) {
          wallBox(B, f, hw, hd, u, yb - 0.12, ww + 0.1, 0.26, 0.32, 0.26, '#8a6a46');
          const p0 = wp(f, 0, 0, hw, hd, u, yb + 0.12, 0.26);
          B.blob(p0[0], p0[1], p0[2], ww * 0.45, 0.22, 0.2, '#5aa845', { seed: c + fl * 7 });
          if (r() < 0.6) for (let k = 0; k < 3; k++) { const q = wp(f, 0, 0, hw, hd, u - ww / 3 + k * (ww / 3), yb + 0.28, 0.32); B.blob(q[0], q[1], q[2], 0.08, 0.08, 0.08, pick2(r, ['#f08aac', '#ffe36a', '#e8402a', '#ffffff']), { detail: 0, jitter: 0.02 }); }
        }
      }
    }
  }
  // the balcony on the front of the upper floors
  if (spec.balcony) {
    for (let fl = 1; fl < spec.floors; fl++) {
      const y0 = base + fl * fh;
      const bw = Math.min(3.4, w * 0.5);
      const u = 0;
      wallBox(B, FRONT, hw, hd, u, y0 + 0.08, bw + 0.3, 0.16, 1.05, 0.52, '#d3cebf');
      wallBox(B, FRONT, hw, hd, u, y0 + 1.05, bw + 0.3, 0.06, 0.06, 1.02, '#4d535b', 0);
      wallBox(B, FRONT, hw, hd, u, y0 + 0.42, bw + 0.3, 0.05, 0.05, 1.02, '#4d535b', 0);
      const n = Math.max(4, Math.round(bw / 0.2));
      for (let k = 0; k <= n; k++) wallBox(B, FRONT, hw, hd, u - bw / 2 - 0.15 + (k * (bw + 0.3)) / n, y0 + 0.62, 0.035, 0.9, 0.035, 1.02, '#4d535b', 0);
      for (const s of [-1, 1]) wallBox(B, FRONT, hw, hd, u + s * (bw / 2 + 0.15), y0 + 1.05, 0.05, 0.06, 1.02, 0.52, '#4d535b', 0);
      windowUnit(ctx, FRONT, hw, hd, u, y0 + 0.2, bw - 0.4, 2.0, { frame, glass, lit: r() < litP, tall: true });
    }
  }
  // pent eaves between floors (a dark little roof over each floor)
  if (spec.pent) {
    for (let fl = 0; fl < spec.floors - 1; fl++) {
      const yt = base + (fl + 1) * fh - 0.05;
      for (const f of FACES) {
        // not over the outside stairs: they climb that side wall
        if (spec.stairs && f === (spec.stairs === 'right' ? '+x' : '-x')) continue;
        const L = f === '+z' || f === '-z' ? w : d;
        const a = wp(f, 0, 0, hw, hd, -L / 2 - 0.25, yt, 0), b = wp(f, 0, 0, hw, hd, L / 2 + 0.25, yt, 0);
        const c = wp(f, 0, 0, hw, hd, L / 2 + 0.25, yt - 0.42, 0.95), e = wp(f, 0, 0, hw, hd, -L / 2 - 0.25, yt - 0.42, 0.95);
        const n = NORMAL[f];
        B.quadFacing(a, b, c, e, [n[0], 1, n[2]], [new Color(spec.pent).r, new Color(spec.pent).g, new Color(spec.pent).b]);
        wallBox(B, f, hw, hd, 0, yt - 0.47, L + 0.5, 0.1, 0.05, 0.95, dk(spec.pent, 0.6), 0);
      }
    }
  }
  roof(ctx, spec, H);
  if (spec.chimney) B.box(hw * 0.4, H + 1.0, -hd * 0.3, 0.7, 2.2, 0.7, '#8a8f95', { ao: 0.1 });
  if (spec.antenna) antenna(ctx, -hw * 0.45, H + 1.3, 0);
  if (spec.stack) {
    // a tall dark stack at the side of the building, as on old shops
    B.box(-hw - 0.3, H * 0.58, -hd * 0.1, 0.9, H * 1.18, 0.9, '#2f3a46', { ao: 0.12 });
    B.box(-hw - 0.3, H * 1.18 + 0.1, -hd * 0.1, 1.15, 0.22, 1.15, '#242d37', { ao: 0 });
    B.box(-hw - 0.3, H * 1.18 + 0.5, -hd * 0.1, 0.75, 0.6, 0.75, '#2f3a46', { ao: 0 });
  }
  // air conditioners, a meter box, a downpipe
  const nac = spec.ac ?? 1;
  for (let k = 0; k < nac; k++) {
    const f: Face = k % 2 ? '+x' : '-z';
    const L = f === '+x' ? d : w;
    airConditioner(ctx, f, hw, hd, -L / 2 + 1.2 + k * 0.9, base + (spec.floors > 1 ? fh + 0.5 : 1.4));
  }
  wallBox(B, '+x', hw, hd, -hd + 0.5, 1.4, 0.35, 0.5, 0.2, 0.1, '#d6d9dc');
  wallBox(B, '+x', hw, hd, hd - 0.12, H / 2, 0.1, H, 0.1, 0.07, '#9aa0a6', 0);

  if (spec.stairs) outsideStairs(ctx, spec, base, fh);
  if (spec.board) {
    const c = atlas.get(spec.board);
    const bw = Math.min(w - 0.6, 5.4), bh = bw / c.aspect;
    wallBox(B, FRONT, hw, hd, 0, base + fh - 0.35, bw + 0.2, bh + 0.2, 0.12, 0.08, '#2a2c30');
    wallPicture(ctx.sign, FRONT, hw, hd, 0, base + fh - 0.35 - bh / 2, bw, bh, c, 0.15);
  }
  if (spec.roundSign) {
    const c = atlas.get(spec.roundSign);
    const u = hw - 0.4;
    const p0 = wp(FRONT, 0, 0, hw, hd, u, base + fh + 0.6, 0.55);
    B.box(p0[0], p0[1] + 0.62, p0[2] - 0.2, 0.06, 0.06, 0.7, '#3a3a3a', { ao: 0 });
    B.disc(p0[0], p0[1], p0[2], 0.6, 0.1, 'x', '#c8322e', 18);
    for (const side of [1, -1]) {
      const x = p0[0] + side * 0.056;
      const uL = side > 0 ? c.u1 : c.u0, uR = side > 0 ? c.u0 : c.u1;
      ctx.sign.quadFacing([x, p0[1] - 0.55, p0[2] - 0.55], [x, p0[1] - 0.55, p0[2] + 0.55], [x, p0[1] + 0.55, p0[2] + 0.55], [x, p0[1] + 0.55, p0[2] - 0.55], [side, 0, 0], [1, 1, 1], [[uL, c.v0], [uR, c.v0], [uR, c.v1], [uL, c.v1]]);
    }
  }
  if (spec.lattice) for (let k = 0; k < Math.floor((w - 1.2) / 0.16); k++) wallBox(B, FRONT, hw, hd, -w / 2 + 0.6 + k * 0.16, base + 1.6, 0.05, 1.9, 0.05, 0.2, spec.lattice, 0);

  // the way in: a shop front, or a front door with a step and a porch light
  if (spec.shop) shopFront(ctx, spec, atlas);
  else {
    wallBox(B, FRONT, hw, hd, doorU, 1.2, 1.2, 2.3, 0.1, 0.06, frame);
    wallBox(B, FRONT, hw, hd, doorU, 1.18, 0.95, 2.1, 0.07, 0.1, spec.door ?? '#7a5a3c');
    wallQuad(ctx.win, FRONT, hw, hd, doorU, 1.55, 0.6, 0.7, glass, 0.14);
    wallBox(B, FRONT, hw, hd, doorU + 0.38, 1.05, 0.05, 0.22, 0.05, 0.15, '#c9a24a', 0);
    wallBox(B, FRONT, hw, hd, doorU, 0.28, 1.8, 0.2, 0.8, 0.45, '#b4afa3');
    wallBox(B, FRONT, hw, hd, doorU + 1.0, 2.2, 0.2, 0.2, 0.12, 0.08, '#fff2c0', 0);
    wallBox(B, FRONT, hw, hd, doorU + 0.78, 1.6, 0.16, 0.08, 0.03, 0.05, '#2a2a2a', 0);
    wallBox(B, FRONT, hw, hd, doorU, 2.5, 1.6, 0.08, 0.7, 0.4, dk(spec.roofColor, 0.7));
  }
  return ctx;
}

/** A shop front: glass, a door, noren curtains, an awning with a sign, tall banners and a menu board. */
function shopFront(ctx: Ctx, spec: HouseSpec, atlas: SignAtlas) {
  const B = ctx.body;
  const shop = spec.shop!;
  const { w, d } = spec;
  const hw = w / 2, hd = d / 2;
  const f: Face = FRONT;
  const y0 = 0.45;
  const gw = w - 1.2;
  wallBox(B, f, hw, hd, 0, y0 + 0.35, gw + 0.2, 0.7, 0.12, 0.07, dk(spec.trim, 0.8));
  wallBox(B, f, hw, hd, 0, y0 + 2.45, gw + 0.2, 0.14, 0.12, 0.07, dk(spec.trim, 0.8));
  wallQuad(ctx.litA, f, hw, hd, -0.6, y0 + 0.72, gw - 1.6, 1.62, '#ffe0a0', 0.04);
  // the shop's light spills out over the pavement
  ctx.glow.push({ x: -0.6, y: 0, z: hd + 1.2, h: 1.8, r: Math.min(4.5, gw * 0.6 + 1), color: pickGlow(shop.awning[0]), k: 0.9 });
  for (let k = -2; k <= 2; k++) wallBox(B, f, hw, hd, -0.6 + k * (gw - 1.6) * 0.25, y0 + 1.55, 0.06, 1.7, 0.06, 0.07, dk(spec.trim, 0.8), 0);
  // the glass door at the right
  const du = gw / 2 - 0.62;
  wallBox(B, f, hw, hd, du, y0 + 1.2, 1.2, 2.4, 0.1, 0.07, '#eceae2');
  wallQuad(ctx.litB, f, hw, hd, du, y0 + 0.35, 0.95, 1.9, '#cfe8ef', 0.06);
  wallBox(B, f, hw, hd, du - 0.4, y0 + 1.1, 0.05, 0.4, 0.05, 0.12, '#888', 0);
  // noren curtains over the door
  if (shop.noren) {
    for (let k = -1; k <= 1; k++) {
      wallBox(B, f, hw, hd, du + k * 0.34, y0 + 1.55, 0.3, 0.85, 0.03, 0.2, shop.noren, 0);
      wallBox(B, f, hw, hd, du + k * 0.34, y0 + 1.65, 0.12, 0.2, 0.01, 0.225, '#f4eede', 0);
    }
    wallBox(B, f, hw, hd, du, y0 + 2.02, 1.2, 0.05, 0.05, 0.2, '#3a2a1a', 0);
  }
  // the awning: stripes over a bent profile, then a valance with the sign
  const aw = w - 0.5;
  if (shop.style === 'box' || shop.style === 'none') {
    if (shop.style === 'box') {
      const a = wp(f, 0, 0, hw, hd, -aw / 2, 3.45, 0.05), b = wp(f, 0, 0, hw, hd, aw / 2, 3.45, 0.05);
      const c = wp(f, 0, 0, hw, hd, aw / 2, 3.0, 1.3), e = wp(f, 0, 0, hw, hd, -aw / 2, 3.0, 1.3);
      const col = new Color(shop.awning[0]);
      B.quadFacing(a, b, c, e, [0, 1, 0.6], [col.r, col.g, col.b]);
      wallBox(B, f, hw, hd, 0, 2.78, aw, 0.45, 0.08, 1.3, dk(shop.awning[0], 0.9), 0);
      wallBox(B, f, hw, hd, 0, 2.58, aw, 0.05, 0.1, 1.31, shop.awning[1], 0);
    }
    if (shop.sign) {
      const c = atlas.get(shop.sign);
      const sw = Math.min(aw - 0.8, 3.6);
      wallBox(B, f, hw, hd, 0, 4.0, sw + 0.2, sw / c.aspect + 0.2, 0.12, 0.08, '#2a2c30');
      wallPicture(ctx.sign, f, hw, hd, 0, 4.0 - sw / c.aspect / 2, sw, sw / c.aspect, c, 0.15);
    }
  } else {
  const n = Math.max(6, Math.round(aw / 0.65));
  const profile: [number, number][] = shop.curved
    ? [[0, 3.55], [0.55, 3.5], [1.0, 3.32], [1.3, 3.05], [1.4, 2.8]]
    : [[0, 3.5], [1.4, 2.95]];
  for (let k = 0; k < n; k++) {
    const ua = -aw / 2 + (k * aw) / n, ub = -aw / 2 + ((k + 1) * aw) / n;
    const col = new Color(k % 2 ? shop.awning[1] : shop.awning[0]);
    for (let s = 0; s < profile.length - 1; s++) {
      const [o0, y0a] = profile[s], [o1, y1a] = profile[s + 1];
      B.quadFacing(wp(f, 0, 0, hw, hd, ua, y0a, o0 + 0.05), wp(f, 0, 0, hw, hd, ub, y0a, o0 + 0.05), wp(f, 0, 0, hw, hd, ub, y1a, o1 + 0.05), wp(f, 0, 0, hw, hd, ua, y1a, o1 + 0.05), [0, 1, 0.5], [col.r, col.g, col.b]);
    }
    const last = profile[profile.length - 1];
    const vc = new Color(k % 2 ? shop.awning[1] : shop.awning[0]);
    wallQuad(B, f, hw, hd, (ua + ub) / 2, last[1] - 0.5, ub - ua, 0.5, vc, last[0] + 0.07);
  }
  if (shop.sign) {
    const c = atlas.get(shop.sign);
    const sw = Math.min(aw - 0.8, 3.8);
    wallPicture(ctx.sign, f, hw, hd, 0, profile[profile.length - 1][1] - 0.46, sw, sw / c.aspect, c, profile[profile.length - 1][0] + 0.09);
  }
  }
  // tall banners on the wall, and a menu board on the ground
  (shop.banners ?? []).forEach((name, i) => {
    const c = atlas.get(name);
    hangSign(ctx, f, hw, hd, i % 2 ? hw - 0.5 : -hw + 0.5, 3.2, 3.4, c, 0.8, 0.12);
  });
  if (shop.menu) {
    const c = atlas.get('menu');
    wallBox(B, f, hw, hd, -hw + 1.0, 0.55, 0.7, 1.0, 0.08, 1.2, '#3a2a1a');
    wallPicture(ctx.sign, f, hw, hd, -hw + 1.0, 0.15, 0.62, 0.62, c, 1.248);
  }
  const lant = wp(f, 0, 0, hw, hd, du - 1.0, 2.55, 0.5);
  ctx.litA.box(lant[0], lant[1], lant[2], 0.34, 0.5, 0.34, '#ff6a3a', { ao: 0 });
  B.box(lant[0], lant[1] + 0.32, lant[2], 0.4, 0.06, 0.4, '#222', { ao: 0 });
  void TANGENT;
}

/** Small square tiles over the ground floor walls: a fill and a grid of grout lines. */
function tileWalls(ctx: Ctx, w: number, d: number, base: number, fh: number, color: string) {
  const hw = w / 2, hd = d / 2;
  const grout = new Color(color).multiplyScalar(0.82);
  for (const f of FACES) {
    const L = f === '+z' || f === '-z' ? w : d;
    wallQuad(ctx.body, f, hw, hd, 0, base, L - 0.02, fh - 0.2, color, 0.012);
    for (let y = base + 0.3; y < base + fh - 0.25; y += 0.3) wallQuad(ctx.body, f, hw, hd, 0, y, L - 0.02, 0.025, grout, 0.016);
    for (let u = -L / 2 + 0.3; u < L / 2 - 0.1; u += 0.3) wallQuad(ctx.body, f, hw, hd, u, base, 0.025, fh - 0.2, grout, 0.016);
  }
}

/** Steel stairs up the outside of a side wall to a landing and a door on the first floor. */
function outsideStairs(ctx: Ctx, spec: HouseSpec, base: number, fh: number) {
  const B = ctx.body;
  const s = spec.stairs === 'right' ? 1 : -1;
  const x = s * (spec.w / 2 + 0.62);
  const top = base + fh;
  const n = 15;
  const rise = top / n, run = Math.min(0.26, (spec.d - 1.6) / n);
  const z0 = spec.d / 2 - 0.4;
  for (let k = 0; k < n; k++) B.box(x, rise * (k + 1) - 0.03, z0 - k * run, 1.0, 0.06, run + 0.02, '#8a9096', { ao: 0 });
  const zTop = z0 - n * run;
  // the two steel stringers the treads sit on, and a post at the foot
  for (const sd of [-0.52, 0.52]) {
    B.cable([[x + sd, 0.05, z0 + run * 0.6], [x + sd, top - 0.12, zTop]], 0.07, '#6a7076');
    B.box(x + sd, 0.12, z0 + run * 0.6, 0.12, 0.24, 0.16, '#6a7076', { ao: 0 });
  }
  B.box(x, top - 0.06, zTop - 0.6, 1.1, 0.12, 1.3, '#8a9096', { ao: 0.05 });
  for (const sz of [zTop - 1.2, z0]) B.box(x + s * 0.5, (sz === z0 ? 0.1 : top) / 2, sz, 0.08, sz === z0 ? 0.2 : top, 0.08, '#6a7076', { ao: 0 });
  B.box(x + s * 0.5, top / 2, zTop - 1.2, 0.08, top, 0.08, '#6a7076', { ao: 0 });
  B.cable([[x + s * 0.5, 1.0, z0], [x + s * 0.5, top + 0.95, zTop]], 0.03, '#5a6066');
  B.cable([[x - s * 0.5, 1.0, z0], [x - s * 0.5, top + 0.95, zTop]], 0.025, '#5a6066');
  B.box(x + s * 0.5, top + 0.95, zTop - 0.6, 0.05, 0.05, 1.3, '#5a6066', { ao: 0 });
  for (let k = 0; k < 4; k++) B.box(x + s * 0.5, top + 0.5, zTop - 0.1 - k * 0.35, 0.03, 0.9, 0.03, '#5a6066', { ao: 0 });
  // the upstairs door on the side wall
  const f: Face = s > 0 ? '+x' : '-x';
  wallBox(B, f, spec.w / 2, spec.d / 2, zTop - 0.6, top + 1.05, 0.9, 2.0, 0.08, 0.05, '#7a8088');
}

/** A shop's light: warm, tinted a little by its awning. */
function pickGlow(awning: string): string {
  const c = new Color('#ffcf8a').lerp(new Color(awning), 0.45);
  return `#${c.getHexString()}`;
}
