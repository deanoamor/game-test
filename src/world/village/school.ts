import { toRgb, type GeoBuilder, type V3 } from '../../util/builder';
import { pick } from '../../util/rng';
import { SCHOOL, getRoad, naturalHeight, roadNear } from '../config';
import type { TreeField } from '../forest';
import type { Cell, SignAtlas } from '../signs';
import { raiseSkyline } from '../skyline';
import { appendCtx, newCtx, wallBox, type Ctx } from './frame';
import { fence, wallSeg } from './ground';
import { airConditioner, windowUnit } from './house';
import { bicycle, parkedVehicle, shrub } from './props';

/**
 * Hoshigaoka Junior High School (星ヶ丘中学校) on the plateau of the east hill. A four-storey school building along the
 * north side with classroom windows and balconies facing the yard, stair towers, an entrance hall with a canopy, a
 * clock tower and banners from the roof; a gymnasium and a 25 m pool on the east side; the schoolyard with a running
 * track, soccer goals, a baseball backstop, iron bars and a jungle gym; flagpoles, a bicycle shelter, teachers' car park,
 * a gate with its name plate, a green net fence and cherry trees all round.
 */

const WALL = '#eeebe2', TRIM = '#d6d2c6', FRAME = '#e8e6e0', GLASS = '#86aecb', RAIL = '#9aa2a8', NET = '#4f8a5a';

/** A picture on a board facing ±z (one side). */
function picture(ctx: Ctx, c: Cell, x: number, y: number, z: number, w: number, h: number, s: 1 | -1) {
  const xl = s > 0 ? x - w / 2 : x + w / 2, xr = s > 0 ? x + w / 2 : x - w / 2;
  ctx.sign.quadFacing([xl, y - h / 2, z], [xr, y - h / 2, z], [xr, y + h / 2, z], [xl, y + h / 2, z], [0, 0, s], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
}

/** The school building in its own frame: centred at the origin, the yard side toward +z. */
function mainBuilding(r: () => number, atlas: SignAtlas): Ctx {
  const ctx = newCtx(r), B = ctx.body;
  const w = 50, d = 12, hw = w / 2, hd = d / 2, floors = 4, fh = 3.6, base = 0.4, H = floors * fh;
  B.box(0, base / 2, 0, w + 0.6, base, d + 0.6, '#b9b5ab', { ao: 0.1 });
  B.box(0, base + H / 2, 0, w, H, d, WALL, { ao: 0.12 });
  // roof slab with a parapet, the green rooftop fence, a water tank and units
  B.box(0, base + H + 0.2, 0, w + 0.5, 0.4, d + 0.5, TRIM, { ao: 0 });
  for (const s of [-1, 1]) {
    B.box(0, base + H + 0.65, s * (hd + 0.15), w + 0.5, 0.5, 0.2, TRIM, { ao: 0 });
    B.box(s * (hw + 0.15), base + H + 0.65, 0, 0.2, 0.5, d + 0.5, TRIM, { ao: 0 });
  }
  const top = base + H + 0.9;
  for (let x = -hw + 0.5; x <= hw - 0.4; x += 2.5) for (const s of [-1, 1]) B.box(x, top + 0.75, s * (hd - 0.1), 0.06, 1.5, 0.06, NET, { ao: 0 });
  for (const s of [-1, 1]) {
    B.box(0, top + 1.5, s * (hd - 0.1), w - 1, 0.05, 0.05, NET, { ao: 0 });
    B.box(0, top + 0.75, s * (hd - 0.1), w - 1, 1.4, 0.01, '#5f9a6a', { ao: 0 });
  }
  B.box(-hw + 6, top + 1.4, -1.5, 3.2, 2.4, 2.4, '#cfd3d6', { ao: 0.1 });
  for (let k = 0; k < 4; k++) B.box(hw - 8 + k * 1.3, top + 0.4, -3, 1.0, 0.8, 0.7, '#e6e9eb', { ao: 0.1 });

  // floors: a band between them; classroom windows and a balcony on the yard side, corridor windows behind
  for (let fl = 0; fl < floors; fl++) {
    const y0 = base + fl * fh;
    if (fl > 0) {
      wallBox(B, '+z', hw, hd, 0, y0 - 0.1, w, 0.25, 0.08, 0.04, TRIM, 0);
      wallBox(B, '-z', hw, hd, 0, y0 - 0.1, w, 0.25, 0.08, 0.04, TRIM, 0);
      // the balcony: slab, solid lower panel and a rail
      wallBox(B, '+z', hw, hd, 0, y0 - 0.05, w - 1, 0.2, 1.3, 0.65, '#d9d5ca');
      wallBox(B, '+z', hw, hd, 0, y0 + 0.5, w - 1, 0.9, 0.1, 1.28, '#f2f0ea', 0.05);
      wallBox(B, '+z', hw, hd, 0, y0 + 1.0, w - 1, 0.06, 0.14, 1.28, RAIL, 0);
    }
    for (let x = -hw + 2.2; x < hw - 1.5; x += 3.2) {
      if (Math.abs(x) < 3) continue; // the entrance hall sits in the middle
      windowUnit(ctx, '+z', hw, hd, x, y0 + 0.95, 2.6, 1.9, { frame: FRAME, glass: GLASS, lit: r() < 0.3 });
      windowUnit(ctx, '-z', hw, hd, x, y0 + 1.5, 2.2, 1.2, { frame: FRAME, glass: GLASS, lit: r() < 0.2 });
    }
  }
  // the stair towers at both ends, a little taller, with tall narrow windows
  for (const s of [-1, 1]) {
    const x = s * (hw + 1.6);
    B.box(x, base + (H + 2.2) / 2, -1, 3.2, H + 2.2, 7, '#e6e2d8', { ao: 0.1 });
    B.box(x, base + H + 2.3, -1, 3.5, 0.3, 7.3, TRIM, { ao: 0 });
    for (let fl = 0; fl < floors; fl++) ctx.win.box(x, base + fl * fh + 2.0, 2.52, 1.0, 2.6, 0.04, GLASS, { ao: 0 });
  }
  // the entrance hall: a glazed front with a canopy, the clock tower above
  B.box(0, base + 2.0, hd + 1.0, 6, 4.0, 2.0, '#e6e2d8', { ao: 0.1 });
  ctx.win.box(0, base + 1.4, hd + 2.02, 4.6, 2.6, 0.04, '#9ec4dc', { ao: 0 });
  for (let k = 0; k < 4; k++) B.box(-1.7 + k * 1.15, base + 1.4, hd + 2.04, 0.08, 2.6, 0.04, RAIL, { ao: 0 });
  B.box(0, base + 4.2, hd + 2.4, 8, 0.25, 3.0, TRIM, { ao: 0 });
  for (const s of [-1, 1]) B.box(s * 3.6, base + 2.1, hd + 3.6, 0.25, 4.2, 0.25, '#cfcbc0', { ao: 0 });
  B.box(0, top + 1.6, 0, 4.4, 3.4, 4.4, '#e6e2d8', { ao: 0.1 });
  B.box(0, top + 3.4, 0, 4.8, 0.3, 4.8, TRIM, { ao: 0 });
  B.box(0, top + 1.8, 2.22, 2.4, 2.4, 0.06, '#2a2c32', { ao: 0 });
  picture(ctx, atlas.get('clock'), 0, top + 1.8, 2.26, 2.2, 2.2, 1);
  // banners hanging from the roof on either side of the clock
  picture(ctx, atlas.get('schoolBanner'), -6.5, base + H - 4.2, hd + 1.33, 1.6, 4.8, 1);
  picture(ctx, atlas.get('schoolBanner2'), 6.5, base + H - 4.2, hd + 1.33, 1.6, 4.8, 1);
  // AC units along the back and a shoe-box porch by the corridor door
  for (let x = -hw + 4; x < hw - 3; x += 7) airConditioner(ctx, '-z', hw, hd, x, 1.2);
  return ctx;
}

/** The gymnasium: a tall hall with a low arched roof, high windows, doors and an outside stair (own frame, door to +z). */
function gymnasium(r: () => number): Ctx {
  const ctx = newCtx(r), B = ctx.body;
  const w = 20, d = 18, hw = w / 2, hd = d / 2, h = 8.5;
  B.box(0, 0.25, 0, w + 0.6, 0.5, d + 0.6, '#b9b5ab', { ao: 0.1 });
  B.box(0, 0.5 + h / 2, 0, w, h, d, '#dfe3e2', { ao: 0.12 });
  B.box(0, 0.5 + 1.0, 0, w + 0.04, 2.0, d + 0.04, '#b9c4c8', { ao: 0.05 });
  // the arched roof: eight slats across the hall
  const n = 8, rise = 2.4;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI, a1 = ((k + 1) / n) * Math.PI;
    const x0 = -Math.cos(a0) * (hw + 0.4), x1 = -Math.cos(a1) * (hw + 0.4);
    const y0 = 0.5 + h + Math.sin(a0) * rise, y1 = 0.5 + h + Math.sin(a1) * rise;
    const c = k % 2 ? [0.42, 0.5, 0.58] as [number, number, number] : [0.4, 0.48, 0.56] as [number, number, number];
    B.quad([x0, y0, hd + 0.4], [x1, y1, hd + 0.4], [x1, y1, -hd - 0.4], [x0, y0, -hd - 0.4], c);
  }
  for (const s of [-1, 1]) {
    // the arched ends under the roof
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI, a1 = ((k + 1) / n) * Math.PI;
      const x0 = -Math.cos(a0) * hw, x1 = -Math.cos(a1) * hw;
      B.quadFacing([x0, 0.5 + h, s * hd], [x1, 0.5 + h, s * hd], [x1, 0.5 + h + Math.sin(a1) * rise * 0.95, s * hd], [x0, 0.5 + h + Math.sin(a0) * rise * 0.95, s * hd], [0, 0, s], [0.86, 0.88, 0.88]);
    }
    // high windows along both long sides, a gallery of small ones below
    for (let z = -hd + 1.5; z < hd - 1; z += 2.2) {
      windowUnit(ctx, s > 0 ? '+x' : '-x', hw, hd, z, 5.4, 1.6, 2.4, { frame: FRAME, glass: GLASS, lit: r() < 0.4 });
      windowUnit(ctx, s > 0 ? '+x' : '-x', hw, hd, z, 2.6, 1.2, 0.8, { frame: FRAME, glass: GLASS, lit: false });
    }
  }
  // the main doors and a canopy, and an outside steel stair up to the gallery
  for (const dx of [-3.5, 0, 3.5]) wallBox(B, '+z', hw, hd, dx, 1.75, 2.6, 2.5, 0.08, 0.05, '#7a8a96');
  wallBox(B, '+z', hw, hd, 0, 3.4, 12, 0.25, 2.2, 1.1, '#cfcbc0', 0);
  for (let k = 0; k < 14; k++) B.box(hw + 0.7, 0.5 + (k + 1) * 0.3, -hd + 2 + k * 0.32, 1.1, 0.06, 0.32, RAIL, { ao: 0 });
  B.cable([[hw + 1.25, 1.4, -hd + 2], [hw + 1.25, 5.4, -hd + 6.5]], 0.03, RAIL);
  B.box(hw + 0.7, 4.7, -hd + 7.4, 1.2, 0.1, 1.8, RAIL, { ao: 0 });
  return ctx;
}

/** The 25 m pool with its deck, lanes, starting blocks, ladders, a fence and a changing hut (own frame). */
function pool(ctx: Ctx, cx: number, cz: number, y: number) {
  const B = ctx.body;
  const W = 18, D = 14, pw = 25 * 0.62, pd = 9.5;
  B.box(cx, y + 0.35, cz, W, 0.7, D, '#d8d6cf', { ao: 0.1 });
  B.box(cx, y + 0.69, cz, pw, 0.02, pd, '#3fa3d8', { ao: 0 });
  for (let k = 1; k < 6; k++) B.box(cx, y + 0.71, cz - pd / 2 + k * (pd / 6), pw - 0.4, 0.02, 0.06, k % 2 ? '#f4f4ee' : '#d8322e', { ao: 0 });
  for (let k = 0; k < 6; k++) B.box(cx - pw / 2 - 0.3, y + 0.95, cz - pd / 2 + (k + 0.5) * (pd / 6), 0.5, 0.5, 0.45, '#f4f4ee', { ao: 0.05 });
  for (const e of [-1, 1]) {
    B.box(cx + e * pw / 2, y + 0.75, cz, 0.12, 0.1, pd, '#2a6ea8', { ao: 0 });
    B.box(cx + pw / 2 - 1.2, y + 1.0, cz + e * (pd / 2 - 0.1), 0.6, 0.6, 0.06, RAIL, { ao: 0 });
  }
  // a fence with panels so the pool cannot be seen into, a hut and a shower
  const corners: [number, number][] = [[cx - W / 2, cz - D / 2], [cx + W / 2, cz - D / 2], [cx + W / 2, cz + D / 2], [cx - W / 2, cz + D / 2]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
    fence(ctx, ax, az, y + 0.7, bx, bz, y + 0.7, 1.8, '#7d8a80');
  }
  B.box(cx - W / 2 + 2.2, y + 1.9, cz + D / 2 - 1.6, 3.6, 2.4, 2.4, '#e8e4d8', { ao: 0.1 });
  B.box(cx - W / 2 + 2.2, y + 3.15, cz + D / 2 - 1.6, 3.9, 0.15, 2.7, '#5a6068', { ao: 0 });
  B.box(cx + W / 2 - 1.2, y + 1.9, cz + D / 2 - 0.8, 0.08, 2.4, 0.08, RAIL, { ao: 0 });
  B.box(cx + W / 2 - 1.2, y + 3.05, cz + D / 2 - 0.6, 0.6, 0.06, 0.5, RAIL, { ao: 0 });
}

/** The schoolyard: earth, a running track, soccer goals, a baseball backstop, iron bars, a jungle gym, a sandpit. */
function schoolyard(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number) {
  const B = ctx.body;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  B.box(cx, y + 0.02, cz, W, 0.04, D, '#c7a777', { ao: 0 });
  // the track: two straights joined by half circles, two lanes, painted white
  const rr = D / 2 - 2.5, sl = W / 2 - rr - 3;
  for (const lane of [0, 1.4]) {
    const R = rr - lane;
    for (const s of [-1, 1]) B.box(cx, y + 0.05, cz + s * R, sl * 2, 0.02, 0.12, '#f4f2ea', { ao: 0 });
    for (const e of [-1, 1]) {
      const steps = 22;
      for (let k = 0; k < steps; k++) {
        const a0 = -Math.PI / 2 + (k / steps) * Math.PI, a1 = -Math.PI / 2 + ((k + 1) / steps) * Math.PI;
        const px0 = cx + e * (sl + Math.cos(a0) * R), pz0 = cz + Math.sin(a0) * R, px1 = cx + e * (sl + Math.cos(a1) * R), pz1 = cz + Math.sin(a1) * R;
        const len = Math.hypot(px1 - px0, pz1 - pz0), yaw = (Math.atan2(-(pz1 - pz0), px1 - px0) * 180) / Math.PI;
        B.box((px0 + px1) / 2, y + 0.05, (pz0 + pz1) / 2, len + 0.02, 0.02, 0.12, '#f4f2ea', { ao: 0, yaw });
      }
    }
  }
  for (let k = 0; k < 4; k++) B.box(cx - sl + 0.5 + k * 0.6, y + 0.05, cz - rr + 0.7, 0.08, 0.02, 1.4, '#f4f2ea', { ao: 0 }); // the start line
  // soccer goals at both ends of the field inside the track
  for (const e of [-1, 1]) {
    const gx = cx + e * (sl + rr * 0.55);
    for (const s of [-1, 1]) B.box(gx, y + 1.2, cz + s * 3.6, 0.12, 2.4, 0.12, '#f4f4ee', { ao: 0 });
    B.box(gx, y + 2.4, cz, 0.12, 0.12, 7.3, '#f4f4ee', { ao: 0 });
    // the net: a grid of thin cords on the back and the top, so the goal reads as open
    for (let k = 0; k <= 12; k++) B.box(gx + e * 1.0, y + 1.2, cz - 3.55 + k * (7.1 / 12), 0.02, 2.3, 0.02, '#e8ece8', { ao: 0 });
    for (let k = 0; k <= 5; k++) B.box(gx + e * 1.0, y + 0.05 + k * 0.46, cz, 0.02, 0.02, 7.1, '#e8ece8', { ao: 0 });
    for (let k = 0; k <= 12; k++) B.box(gx + e * 0.5, y + 2.38, cz - 3.55 + k * (7.1 / 12), 1.0, 0.02, 0.02, '#e8ece8', { ao: 0 });
    for (const s of [-1, 1]) B.box(gx + e * 0.5, y + 1.2, cz + s * 3.6, 1.0, 0.04, 0.04, '#f4f4ee', { ao: 0 });
  }
  B.box(cx, y + 0.05, cz, 0.12, 0.02, rr * 2 - 3.5, '#f4f2ea', { ao: 0 });
  // a baseball backstop in the north-west corner: posts and a tall net
  const bx = x0 + 3.5, bz = z1 - 3.5;
  for (const [ax, az, bx2, bz2] of [[bx - 4, bz, bx + 4, bz], [bx - 4, bz, bx - 6, bz - 4], [bx + 4, bz, bx + 6, bz - 4]] as const) {
    const len = Math.hypot(bx2 - ax, bz2 - az), yaw = (Math.atan2(-(bz2 - az), bx2 - ax) * 180) / Math.PI;
    B.box((ax + bx2) / 2, y + 3.0, (az + bz2) / 2, len, 5.6, 0.02, '#6f8a78', { ao: 0, yaw });
    B.box(ax, y + 3.0, az, 0.18, 6.0, 0.18, RAIL, { ao: 0 });
    B.box(bx2, y + 3.0, bz2, 0.18, 6.0, 0.18, RAIL, { ao: 0 });
  }
  B.box(bx, y + 0.04, bz - 4, 0.5, 0.03, 0.5, '#f4f4ee', { ao: 0, yaw: 45 });
}

export function buildSchool(at: (x: number) => Ctx, atlas: SignAtlas, r: () => number, trees: TreeField) {
  const S = SCHOOL, y = S.y, cx = (S.x0 + S.x1) / 2;
  const ctx = at(cx), B = ctx.body;
  // the school building along the north side, facing the yard
  const main = mainBuilding(r, atlas);
  appendCtx(ctx, main, cx - 1, y, S.z0 + 8, 0);
  raiseSkyline(cx - 30, S.z0 + 1, cx + 28, S.z0 + 15, y + 19);
  // the gym and the pool on the east side
  const gym = gymnasium(r);
  appendCtx(ctx, gym, S.x1 - 12, y, S.z0 + 29.5, -90);
  raiseSkyline(S.x1 - 22, S.z0 + 18, S.x1 - 1, S.z0 + 41, y + 12);
  pool(ctx, S.x1 - 11, S.z1 - 9, y);
  // the yard in front of the building, from the gate side to the gym
  schoolyard(ctx, S.x0 + 12, S.z0 + 20, S.x1 - 24, S.z1 - 3, y);
  // the strip in front of the building: paving, flagpoles, iron bars, a jungle gym, benches
  B.box(cx - 1, y + 0.03, S.z0 + 16.5, 54, 0.06, 4.5, '#bdb8ad', { ao: 0 });
  for (let k = 0; k < 3; k++) {
    const fx = cx + 8 + k * 1.6;
    B.box(fx, y + 4.5, S.z0 + 17.6, 0.1, 9, 0.1, '#d8dcdf', { ao: 0 });
    B.frustum(fx, y + 9.0, S.z0 + 17.6, 0.12, 0.12, 0.2, 8, '#f2c230', { ao: 0 });
    B.box(fx + 0.7, y + 8.2, S.z0 + 17.6, 1.3, 0.9, 0.02, ['#ffffff', '#f4f4ee', '#2f6ab8'][k], { ao: 0 });
  }
  B.disc(cx + 8 + 0.7, y + 8.2, S.z0 + 17.62, 0.25, 0.02, 'z', '#d8322e', 14);
  for (let k = 0; k < 5; k++) {
    const bx = S.x0 + 16 + k * 1.6, hgt = 1.0 + k * 0.25;
    B.box(bx, y + hgt / 2, S.z0 + 16.8, 0.08, hgt, 0.08, '#c8322e', { ao: 0 });
    B.box(bx + 0.8, y + hgt, S.z0 + 16.8, 1.6, 0.05, 0.05, '#d8dcdf', { ao: 0 });
  }
  B.box(S.x0 + 24.8, y + 1.3, S.z0 + 16.8, 0.08, 2.4, 0.08, '#c8322e', { ao: 0 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const gx = cx + 16 + i * 0.8, gz = S.z0 + 15.6 + j * 0.8;
    B.box(gx, y + 1.2, gz, 0.06, 2.4, 0.06, ['#2f6ab8', '#f2c230', '#2f9a4a', '#d8322e'][(i + j) % 4], { ao: 0 });
  }
  for (let k = 0; k <= 3; k++) B.box(cx + 17.2, y + 0.6 * k + 0.6, S.z0 + 16.8, 3.0, 0.06, 3.0, '#d8dcdf', { ao: 0 });
  // the gate on the west side: pillars, the name plate, a sliding gate, and the bike shelter and car park behind
  const gz = 90;
  for (const s of [-1, 1]) {
    B.box(S.x0 + 0.4, y + 1.2, gz + s * 4.2, 0.8, 2.4, 0.8, '#bdb6a6', { ao: 0.1 });
    B.box(S.x0 + 0.4, y + 2.45, gz + s * 4.2, 0.95, 0.12, 0.95, '#a8a092', { ao: 0 });
  }
  const plaque = atlas.get('schoolPlaque');
  ctx.body.box(S.x0 - 0.02, y + 1.3, gz - 4.2, 0.04, 2.0, 0.6, '#5a4a3a', { ao: 0 });
  ctx.sign.quadFacing([S.x0 - 0.05, y + 0.4, gz - 4.45], [S.x0 - 0.05, y + 0.4, gz - 3.95], [S.x0 - 0.05, y + 2.2, gz - 3.95], [S.x0 - 0.05, y + 2.2, gz - 4.45], [-1, 0, 0], [1, 1, 1], [[plaque.u0, plaque.v0], [plaque.u1, plaque.v0], [plaque.u1, plaque.v1], [plaque.u0, plaque.v1]]);
  B.box(S.x0 + 0.25, y + 0.9, gz + 6.4, 0.12, 1.6, 3.4, RAIL, { ao: 0 }); // the sliding gate, pushed open along the fence
  B.box(S.x0 + 0.4, y + 0.02, gz, 0.2, 0.02, 7.6, '#8a9096', { ao: 0 });
  const name = atlas.get('schoolName');
  B.box(cx - 1, y + 16.4, S.z0 + 14.2, 7.3, 2.0, 0.12, '#1f5e3a', { ao: 0 });
  for (const s of [-1, 1]) B.box(cx - 1 + s * 3.2, y + 15.6, S.z0 + 14.1, 0.1, 1.2, 0.1, RAIL, { ao: 0 });
  picture(ctx, name, cx - 1, y + 16.4, S.z0 + 14.27, 7, 1.75, 1);
  // the bicycle shelter and the teachers' cars by the gate
  B.box(S.x0 + 6, y + 2.2, S.z0 + 17.5, 7.0, 0.08, 2.6, '#a8d0c0', { ao: 0 });
  for (const [px, pz] of [[S.x0 + 2.7, S.z0 + 16.5], [S.x0 + 9.3, S.z0 + 16.5], [S.x0 + 2.7, S.z0 + 18.5], [S.x0 + 9.3, S.z0 + 18.5]]) B.box(px, y + 1.1, pz, 0.08, 2.2, 0.08, RAIL, { ao: 0 });
  for (let k = 0; k < 9; k++) bicycle(ctx, S.x0 + 2.9 + k * 0.75, y, S.z0 + 17.5, 0, pick(r, ['#4f7fd9', '#d94f4f', '#9a9a9a', '#2a2a2a', '#f4f4ee']));
  // the teachers' car park right inside the gate: an aisle straight on from the road with a row of bays north of it,
  // then an aisle turning south along the fence with a long row of bays on its east side
  const px0 = S.x0 + 0.8, px1 = S.x0 + 11.6, pz0 = gz - 7.5, pz1 = S.z1 - 1.5;
  const ax1 = px0 + 5.2; // the east edge of the south aisle
  const car = () => pick(r, ['car', 'kei', 'keivan', 'car', 'van'] as const);
  const paint = () => pick(r, ['#f4f4ee', '#3a4a6a', '#d8d8d0', '#7a2a2e', '#2f2f35', '#5a7a9a', '#c8c0a8']);
  B.box((px0 + px1) / 2, y + 0.03, gz - 2.5, px1 - px0, 0.06, 10, '#55585e', { ao: 0 });
  B.box((px0 + px1) / 2, y + 0.03, (gz + 2.5 + pz1) / 2, px1 - px0, 0.06, pz1 - gz - 2.5, '#55585e', { ao: 0 });
  // the north row
  B.box((px0 + px1) / 2 + 0.5, y + 0.065, gz - 2.5, px1 - px0 - 1, 0.02, 0.1, '#f4f2ea', { ao: 0 });
  for (let k = 0; k <= 4; k++) B.box(px0 + 1.4 + k * 2.5, y + 0.065, gz - 5, 0.1, 0.02, 4.9, '#f4f2ea', { ao: 0 });
  for (let k = 0; k < 4; k++) {
    const bx = px0 + 2.65 + k * 2.5;
    B.box(bx, y + 0.12, pz0 + 0.4, 1.4, 0.12, 0.18, '#c9c6bd', { ao: 0.1 });
    if (k !== 2) parkedVehicle(ctx, car(), paint(), bx, y + 0.06, gz - 5, 90);
  }
  // the south aisle and its row of bays, nosed in toward the yard
  B.box(ax1, y + 0.065, (gz + 2.5 + pz1) / 2, 0.1, 0.02, pz1 - gz - 2.5, '#f4f2ea', { ao: 0 });
  const nb = Math.floor((pz1 - gz - 2.5) / 2.5);
  for (let k = 0; k <= nb; k++) B.box((ax1 + px1) / 2, y + 0.065, gz + 2.5 + k * 2.5, px1 - ax1, 0.02, 0.1, '#f4f2ea', { ao: 0 });
  for (let k = 0; k < nb; k++) {
    const bz = gz + 3.75 + k * 2.5;
    B.box(px1 - 0.45, y + 0.12, bz, 0.18, 0.12, 1.4, '#c9c6bd', { ao: 0.1 });
    if (r() < 0.75) parkedVehicle(ctx, car(), paint(), (ax1 + px1) / 2 + 0.2, y + 0.06, bz, 0);
  }
  // painted arrows: in from the gate, round the corner, and a stop line at the walk to the entrance
  B.box(px1 - 0.4, y + 0.07, gz - 2.5, 0.3, 0.02, 2.2, '#f4f2ea', { ao: 0 });
  for (const [x, z, yaw] of [[px0 + 3.5, gz - 0.6, 0], [px0 + 2.6, gz + 6, 90], [px0 + 2.6, pz1 - 6, 90]] as const) {
    B.box(x, y + 0.07, z, yaw ? 0.3 : 2.0, 0.02, yaw ? 2.0 : 0.3, '#f4f2ea', { ao: 0 });
  }
  // a lamp at the corner and a sign for visitors
  B.box(px0 + 0.4, y + 2.4, gz + 3.2, 0.12, 4.8, 0.12, '#5a5e64', { ao: 0 });
  ctx.litB.box(px0 + 0.85, y + 4.75, gz + 3.2, 0.9, 0.1, 0.25, '#ffffff', { ao: 0 });
  // the walk from the car park along the yard to the entrance
  B.box(px1 + 1.2, y + 0.035, (gz + S.z0 + 14) / 2, 2.2, 0.05, gz - S.z0 - 14 + 2.5, '#bdb8ad', { ao: 0 });
  // a concrete retaining wall wherever the hill outside drops below the plateau (none across the gate)
  const edges: [number, number, number, number][] = [[S.x0, S.z0, S.x0, S.z1], [S.x1, S.z0, S.x1, S.z1], [S.x0, S.z0, S.x1, S.z0], [S.x0, S.z1, S.x1, S.z1]];
  for (const [ax, az, bx, bz] of edges) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2), ox = ax === bx ? Math.sign(ax - (S.x0 + S.x1) / 2) : 0, oz = az === bz ? Math.sign(az - (S.z0 + S.z1) / 2) : 0;
    for (let k = 0; k < n; k++) {
      const x0 = ax + ((bx - ax) * k) / n, z0 = az + ((bz - az) * k) / n, x1 = ax + ((bx - ax) * (k + 1)) / n, z1 = az + ((bz - az) * (k + 1)) / n;
      if (ax === S.x0 && bx === S.x0 && Math.abs((z0 + z1) / 2 - gz) < 3.6) continue;
      // the plateau reaches 3 m past the fence; the wall stands at its edge, down to the natural ground just outside
      const g0 = naturalHeight(x0 + ox * 4.5, z0 + oz * 4.5), g1 = naturalHeight(x1 + ox * 4.5, z1 + oz * 4.5);
      if (y - Math.min(g0, g1) < 0.2) continue;
      const rn = roadNear((x0 + x1) / 2 + ox * 3.1, (z0 + z1) / 2 + oz * 3.1, (nm) => nm === 'school road');
      if (rn.d < 6.8) continue; // the road and its pavements come in here
      const e = 3.1, ex0 = x0 + ox * e - (ox ? 0 : 0), ez0 = z0 + oz * e, ex1 = x1 + ox * e, ez1 = z1 + oz * e;
      const sx = ax === bx ? 0 : (k === 0 ? -3.3 : 0) + 0, sx1 = ax === bx ? 0 : (k === n - 1 ? 3.3 : 0);
      const sz = az === bz ? 0 : (k === 0 ? -3.3 : 0), sz1 = az === bz ? 0 : (k === n - 1 ? 3.3 : 0);
      wallSeg(B, ex0 + sx, ez0 + sz, ex1 + sx1, ez1 + sz1, Math.min(g0, g1) - 0.6, y + 0.1, Math.min(g0, g1) - 0.6, y + 0.1, 0.4, '#b5b1a7', '#cfcbc1');
    }
  }
  // the fence all round (open at the gate) with cherry trees inside it, and a hedge along the building
  const ring: [number, number][] = [[S.x0, gz + 4.6], [S.x0, S.z1], [S.x1, S.z1], [S.x1, S.z0], [S.x0, S.z0], [S.x0, gz - 4.6]];
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[k + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 6));
    for (let i = 0; i < n; i++) fence(ctx, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, y, ax + ((bx - ax) * (i + 1)) / n, az + ((bz - az) * (i + 1)) / n, y, 1.8, NET);
  }
  for (const z of [S.z0 + 4, S.z0 + 10]) trees.add('sakura', S.x0 + 2.2, z, 0.62, y);
  for (let x = S.x0 + 14; x < S.x1 - 24; x += 7.5) trees.add('sakura', x, S.z1 - 1.6, 0.6, y);
  for (let x = S.x0 + 3; x < S.x0 + 22; x += 2.6) shrub(ctx, 'hedge', x, y, S.z0 + 14.6, 0.5, Math.floor(r() * 9));
  trees.add('ginkgo', S.x1 - 2, S.z0 + 2.5, 0.8, y);
  trees.add('ginkgo', S.x0 + 2.5, S.z0 + 2.5, 0.8, y);
}

/**
 * Pavements on both sides of the road from the edge of town up to the school gate: a slab with a curb where the road is
 * gentle, concrete steps with a handrail where it climbs steeply, and street lamps along the north and east side.
 */
export function buildSchoolWalks(at: (x: number) => Ctx) {
  const W = 1.9, GAP = 0.12, LIFT = 0.165, STEEP = 0.1, RISER = 0.16;
  const top = toRgb('#cdc8bc'), side = toRgb('#a9a59b'), curb = toRgb('#e2ded4'), step = toRgb('#c2bdb1');
  const path: { x: number; z: number; y: number }[] = [];
  const main = getRoad('main'), sch = getRoad('school road');
  for (let i = 0; i < main.len; i++) if (main.x[i] >= 113.9) path.push({ x: main.x[i], z: main.z[i], y: main.y[i] });
  // all the way to the fence beside the gate
  for (let i = 1; i < sch.len; i++) if (sch.x[i] < SCHOOL.x0 - 0.3) path.push({ x: sch.x[i], z: sch.z[i], y: sch.y[i] });
  const end = sch.len - 1;
  if (path[path.length - 1].x < SCHOOL.x0 - 0.5) path.push({ x: SCHOOL.x0 - 0.4, z: sch.z[end], y: sch.y[end] });
  const half = 4;
  const nrm = (i: number) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
    return { nx: -tz / l, nz: tx / l };
  };
  for (const s of [-1, 1]) {
    const pt = (i: number, off: number, y: number): V3 => { const n = nrm(i); return [path[i].x + n.nx * s * off, y, path[i].z + n.nz * s * off]; };
    let prevEnd = NaN;
    for (let i = 0; i < path.length - 1; i++) {
      const B = at(path[i].x).body;
      const ya = path[i].y + LIFT, yb = path[i + 1].y + LIFT;
      const lin = (t: number, off: number, y: number): V3 => {
        const a = pt(i, off, 0), b = pt(i + 1, off, 0);
        return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
      };
      const seg = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
      const grade = Math.abs(yb - ya) / Math.max(0.1, seg);
      const inner = half + GAP, outer = half + GAP + W;
      const n = grade > STEEP ? Math.max(1, Math.ceil(Math.abs(yb - ya) / RISER)) : 1;
      // close the step where this stretch meets the last one (a flight against a slope, or two flights)
      const startH = n === 1 ? ya : ya + (yb - ya) * 0.5 / n, endH = n === 1 ? yb : ya + ((yb - ya) * (n - 0.5)) / n;
      if (!isNaN(prevEnd) && Math.abs(startH - prevEnd) > 0.005) quadFace(B, lin(0, inner, prevEnd), lin(0, outer, prevEnd), lin(0, outer, startH), lin(0, inner, startH), step);
      prevEnd = endH;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        // a slope follows the road; a flight of steps keeps each tread flat at the level of its upper end
        const h0 = n === 1 ? ya : ya + ((yb - ya) * (k + 0.5)) / n, h1 = n === 1 ? yb : h0;
        const i0 = lin(t0, inner, h0), i1 = lin(t1, inner, h1), o0 = lin(t0, outer, h0), o1 = lin(t1, outer, h1);
        const col = n === 1 ? top : k % 2 ? step : top;
        quadFace(B, i0, i1, o1, o0, col);
        // the curb face toward the road, the outer face down into the ground
        const ri0 = lin(t0, inner, path[i].y + (path[i + 1].y - path[i].y) * t0 - 0.05), ri1 = lin(t1, inner, path[i].y + (path[i + 1].y - path[i].y) * t1 - 0.05);
        quadFace(B, ri0, ri1, i1, i0, curb);
        const ro0 = lin(t0, outer, h0 - 1.2), ro1 = lin(t1, outer, h1 - 1.2);
        quadFace(B, o0, o1, ro1, ro0, side);
        // the riser up to the next tread
        if (n > 1 && k < n - 1) {
          const hn = ya + ((yb - ya) * (k + 1.5)) / n;
          quadFace(B, lin(t1, inner, h1), lin(t1, outer, h1), lin(t1, outer, hn), lin(t1, inner, hn), step);
        }
      }
      // a handrail on the outer edge of the steep stretches
      if (grade > STEEP) B.cable([pt(i, outer - 0.15, ya + 0.9), pt(i + 1, outer - 0.15, yb + 0.9)], 0.03, '#b8bcc0');
      if (grade > STEEP && i % 2 === 0) B.box(...pt(i, outer - 0.15, ya + 0.45), 0.05, 0.9, 0.05, '#b8bcc0', { ao: 0 });
      // street lamps every 24 m on the north and east side
      if (s < 0 && i % 12 === 6) classicLampAt(at(path[i].x), pt(i, outer - 0.35, ya));
    }
  }
}

/** A quad wound to face away from the road's centre line (both windings drawn, the walls are seen from both sides). */
function quadFace(B: GeoBuilder, a: V3, b: V3, c: V3, d: V3, col: [number, number, number]) {
  B.quad(a, b, c, d, col);
  B.quad(a, d, c, b, col);
}

function classicLampAt(ctx: Ctx, p: V3) {
  ctx.body.box(p[0], p[1] + 2.0, p[2], 0.12, 4.0, 0.12, '#2a2c30', { ao: 0.1 });
  ctx.body.box(p[0], p[1] + 0.15, p[2], 0.26, 0.3, 0.26, '#2a2c30', { ao: 0.1 });
  ctx.litA.box(p[0], p[1] + 4.25, p[2], 0.32, 0.42, 0.32, '#fff4dc', { ao: 0 });
  ctx.body.frustum(p[0], p[1] + 4.46, p[2], 0.3, 0.06, 0.2, 4, '#2a2c30', { rotate: 0.5 });
}
