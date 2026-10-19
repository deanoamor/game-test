import { toRgb, type GeoBuilder, type V3 } from '../../util/builder';
import { fbm } from '../../util/noise';
import { clamp, lerp, smoothstep } from '../../util/rng';
import { PADDY, PLATFORMS, RAMPS, RAMP_BANDS, STAIRS, TERRACES, TOWN, naturalHeight, paddyY, rampBand, rampY, roadNear, terraceY } from '../config';
import type { Ctx } from './frame';

/**
 * The ground of the hillside town: paved terraces and ramp streets, concrete retaining walls with drains, fences and
 * caps, the stairs that climb the walls, and the stepped rice paddies below. The terrain mesh has a hole under all of
 * it; every wall reaches down below the natural ground so the hole never shows.
 */

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/** A quad a-b-c-d wound to face `facing`, one colour per corner. */
function face4(B: GeoBuilder, a: V3, b: V3, c: V3, d: V3, facing: V3, ca: RGB, cb = ca, cc = ca, cd = ca) {
  const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
  const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
  const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  if (nx * facing[0] + ny * facing[1] + nz * facing[2] >= 0) B.quad(a, b, c, d, ca, cb, cc, cd);
  else B.quad(a, d, c, b, ca, cd, cc, cb);
}

/** A wall from p0 to p1 with its own top and bottom at each end (so it can follow a slope), `thick` across. */
export function wallSeg(B: GeoBuilder, x0: number, z0: number, x1: number, z1: number, bot0: number, top0: number, bot1: number, top1: number, thick: number, color: string, cap?: string) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 1e-3) return;
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const nx = -uz * (thick / 2), nz = ux * (thick / 2);
  const c = toRgb(color), cb = mul(c, 0.72), ct = cap ? toRgb(cap) : mul(c, 1.1);
  const A0b: V3 = [x0 + nx, bot0, z0 + nz], A1b: V3 = [x1 + nx, bot1, z1 + nz], A1t: V3 = [x1 + nx, top1, z1 + nz], A0t: V3 = [x0 + nx, top0, z0 + nz];
  const B0b: V3 = [x0 - nx, bot0, z0 - nz], B1b: V3 = [x1 - nx, bot1, z1 - nz], B1t: V3 = [x1 - nx, top1, z1 - nz], B0t: V3 = [x0 - nx, top0, z0 - nz];
  face4(B, A0b, A1b, A1t, A0t, [nx, 0, nz], cb, cb, c, c);
  face4(B, B0b, B1b, B1t, B0t, [-nx, 0, -nz], cb, cb, c, c);
  face4(B, A0t, A1t, B1t, B0t, [0, 1, 0], ct);
  face4(B, A0b, B0b, B0t, A0t, [-ux, 0, -uz], cb, cb, c, c);
  face4(B, A1b, B1b, B1t, A1t, [ux, 0, uz], cb, cb, c, c);
}

/** A mesh fence (posts, two rails and a mesh panel) along a line whose foot may slope. */
export function fence(ctx: Ctx, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, h = 1.0, color = '#6f7d74') {
  const B = ctx.body;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    B.box(lerp(x0, x1, t), lerp(y0, y1, t) + h / 2, lerp(z0, z1, t), 0.06, h, 0.06, color, { ao: 0.1 });
  }
  B.cable([[x0, y0 + h, z0], [x1, y1 + h, z1]], 0.03, color);
  B.cable([[x0, y0 + 0.12, z0], [x1, y1 + 0.12, z1]], 0.025, color);
  wallSeg(B, x0, z0, x1, z1, y0 + 0.12, y0 + h - 0.02, y1 + 0.12, y1 + h - 0.02, 0.012, '#8d9a92', '#8d9a92');
}

/** A handrail: a round rail on posts. */
function handrail(B: GeoBuilder, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, color = '#b8bcc0') {
  const len = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
  const n = Math.max(1, Math.round(len / 1.6));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    B.box(lerp(x0, x1, t), lerp(y0, y1, t) + 0.45, lerp(z0, z1, t), 0.05, 0.9, 0.05, color, { ao: 0.05 });
  }
  B.cable([[x0, y0 + 0.9, z0], [x1, y1 + 0.9, z1]], 0.03, color);
}

/** A retaining wall face detail: drain holes with a stain below, and panel joints. */
function wallDetail(B: GeoBuilder, x: number, z: number, nx: number, nz: number, yLow: number, yHigh: number, k: number) {
  const h = yHigh - yLow;
  if (h < 0.6) return;
  const ox = x + nx * 0.005, oz = z + nz * 0.005;
  const along = Math.abs(nz) > 0.5;
  // a panel joint
  B.box(ox, (yLow + yHigh) / 2, oz, along ? 0.04 : 0.02, h, along ? 0.02 : 0.04, '#8f8b82', { ao: 0 });
  if (k % 2 === 0 && h > 1.0) {
    const dy = yLow + Math.min(0.55, h * 0.3);
    const px = ox + (along ? 1.25 : 0) , pz = oz + (along ? 0 : 1.25);
    B.box(px, dy, pz, along ? 0.16 : 0.03, 0.16, along ? 0.03 : 0.16, '#3d3c39', { ao: 0 });
    B.box(px, dy - 0.3, pz, along ? 0.12 : 0.025, 0.45, along ? 0.025 : 0.12, '#8a877d', { ao: 0 });
  }
}

const WALL = '#b5b1a7', CAP = '#cfcbc1';

export function buildTownGround(at: (x: number) => Ctx) {
  // the cells of the ground: a 2.5 m grid, cut along the edges of the ramp streets, the stair alleys and the terraces
  const xs = new Set<number>();
  for (let x = TOWN.x0; x <= TOWN.x1 + 1e-6; x += 2.5) xs.add(+x.toFixed(3));
  for (const b of RAMP_BANDS) { xs.add(b.x - b.half); xs.add(b.x + b.half); }
  for (const s of STAIRS) { xs.add(s.x - s.w / 2); xs.add(s.x + s.w / 2); }
  const zs = new Set<number>();
  for (let z = TOWN.z0; z <= TOWN.z1 + 1e-6; z += 2.5) zs.add(+z.toFixed(3));
  for (const t of TERRACES) zs.add(t.z1);
  for (const p of PLATFORMS) zs.add(p.z1);
  for (const r of RAMPS) { zs.add(r.z0); zs.add(r.z1); for (let z = Math.ceil(r.z0); z < r.z1; z++) zs.add(z); }
  const X = [...xs].filter((x) => x >= TOWN.x0 && x <= TOWN.x1).sort((a, b) => a - b);
  const Z = [...zs].filter((z) => z >= TOWN.z0 && z <= TOWN.z1).sort((a, b) => a - b);
  const pave = [toRgb('#aaa69d'), toRgb('#97948d'), toRgb('#b8ae9a')];
  const asphalt = toRgb('#585b61');
  for (let j = 0; j < Z.length - 1; j++) {
    const z0 = Z[j], z1 = Z[j + 1], zm = (z0 + z1) / 2;
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i], x1 = X[i + 1], xm = (x0 + x1) / 2;
      const band = rampBand(xm);
      const ya = band ? rampY(z0 + 1e-4) : terraceY(zm), yb = band ? rampY(z1 - 1e-4) : terraceY(zm);
      let c: RGB;
      if (band) c = mul(asphalt, 0.94 + fbm(xm * 0.3, zm * 0.3, 1) * 0.08);
      else {
        const n = fbm(xm * 0.11 + 7, zm * 0.11 - 3, 2) * 0.5 + 0.5;
        c = pave[n < 0.42 ? 0 : n < 0.62 ? 1 : 2];
        c = mul(c, 0.95 + (((Math.sin(xm * 12.9898 + zm * 78.233) * 43758.5453) % 1) + 1) % 1 * 0.08);
      }
      at(xm).body.quad([x0, yb, z1], [x1, yb, z1], [x1, ya, z0], [x0, ya, z0], c);
    }
  }

  // the retaining walls between the terraces, with a cap, drains and a fence along the top; the low walls of the
  // raised strips along the back lanes
  const steps = [...TERRACES.slice(0, -1).map((t) => t.z1), ...PLATFORMS.map((p) => p.z1)];
  for (const zb of steps) {
    const yU = terraceY(zb - 0.01), yL = terraceY(zb + 0.01);
    const tall = yU - yL > 1.5;
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i], x1 = X[i + 1], xm = (x0 + x1) / 2;
      if (rampBand(xm) || STAIRS.some((s) => Math.abs(xm - s.x) < s.w / 2 && (s.z === zb || (PLATFORMS.some((p) => p.z1 === zb) && terraceY(s.z + 0.01) === yU)))) continue;
      const B = at(xm).body;
      wallSeg(B, x0, zb - 0.15, x1, zb - 0.15, yL - 0.4, yU + (tall ? 0.14 : 0.08), yL - 0.4, yU + (tall ? 0.14 : 0.08), tall ? 0.42 : 0.3, tall ? WALL : '#c2bdb2', CAP);
      if (tall) {
        wallDetail(B, x0, zb + 0.06, 0, 1, yL, yU, i);
        fence(at(xm), x0, zb - 0.3, yU + 0.14, x1, zb - 0.3, yU + 0.14);
      }
    }
    // the stair alleys come down to the lane with a few more steps
    for (const st of STAIRS) {
      if (!PLATFORMS.some((p) => p.z1 === zb) || terraceY(st.z + 0.01) !== yU) continue;
      const n = Math.round((yU - yL) / 0.19), rise = (yU - yL) / n;
      for (let k = 1; k < n; k++) at(st.x).body.box(st.x, yL + ((n - k) * rise) / 2 - 0.02, zb + (k - 0.5) * 0.28, st.w, (n - k) * rise + 0.04, 0.28, k % 2 ? '#c4bfb4' : '#bab5aa', { ao: 0.05 });
    }
  }

  // the ramp streets: walls along their sides where they part from the ground beside them, railings where they stand high
  for (const band of RAMP_BANDS) {
    const lift = band.x === 0 ? 0.17 : 0;
    const pts = [...new Set([...Z, ...Array.from({ length: Math.ceil(TOWN.z1 - TOWN.z0) }, (_, k) => TOWN.z0 + k)])].filter((z) => z <= TOWN.z1).sort((a, b) => a - b);
    for (const s of [-1, 1]) {
      const xe = band.x + s * band.half;
      for (let k = 0; k < pts.length - 1; k++) {
        const za = pts[k], zb = pts[k + 1];
        if (zb - za < 0.02) continue;
        const tY = terraceY((za + zb) / 2);
        const ga = rampY(za + 1e-4), gb = rampY(zb - 1e-4), ra = ga + lift, rb = gb + lift;
        if (Math.abs(ga - tY) < 0.04 && Math.abs(gb - tY) < 0.04) continue;
        const B = at(xe).body;
        wallSeg(B, xe + s * 0.11, za, xe + s * 0.11, zb, Math.min(ga, tY) - 0.4, Math.max(ra, tY) + 0.06, Math.min(gb, tY) - 0.4, Math.max(rb, tY) + 0.06, 0.22, WALL, CAP);
        if (ra > tY + 0.5 && rb > tY + 0.5) handrail(B, xe - s * 0.12, za, ra + 0.06, xe - s * 0.12, zb, rb + 0.06, '#e8e8e2');
      }
    }
  }

  // the stairs up the walls, with side walls and handrails
  for (const st of STAIRS) {
    const yU = terraceY(st.z - 0.01), yL = terraceY(st.z + 0.01);
    const n = Math.round((yU - yL) / 0.18), rise = (yU - yL) / n, tread = 0.3;
    const B = at(st.x).body;
    for (let k = 0; k < n - 1; k++) {
      const top = yU - (k + 1) * rise;
      B.box(st.x, (top + yL - 0.3) / 2, st.z + (k + 0.5) * tread, st.w, top - yL + 0.3, tread, k % 2 ? '#c4bfb4' : '#bbb6ab', { ao: 0.04 });
      B.box(st.x, top + 0.005, st.z + k * tread + 0.04, st.w - 0.1, 0.012, 0.06, '#e2c24a', { ao: 0 });
    }
    const run = n * tread;
    for (const s of [-1, 1]) {
      const xw = st.x + s * (st.w / 2 + 0.1);
      wallSeg(B, xw, st.z - 0.2, xw, st.z + run, yL - 0.3, yU + 0.3, yL - 0.3, yL + 0.3, 0.2, WALL, CAP);
      handrail(B, st.x + s * (st.w / 2 - 0.12), st.z + 0.1, yU, st.x + s * (st.w / 2 - 0.12), st.z + run - 0.2, yL + rise);
    }
    handrail(B, st.x, st.z + 0.2, yU - rise, st.x, st.z + run - 0.3, yL + rise, '#c9cdd2');
  }

  // the edges of the town against the natural slope
  perimeter(at, [[TOWN.x0, TOWN.z0], [TOWN.x1, TOWN.z0]], [0, 1], (x, z) => townIn(x, z), true);
  perimeter(at, [[TOWN.x0, TOWN.z1], [TOWN.x1, TOWN.z1]], [0, -1], (x, z) => townIn(x, z), true);
  perimeter(at, [[TOWN.x0, TOWN.z0], [TOWN.x0, TOWN.z1]], [1, 0], (x, z) => townIn(x, z), true);
  perimeter(at, [[TOWN.x1, TOWN.z0], [TOWN.x1, TOWN.z1]], [-1, 0], (x, z) => townIn(x, z), true);
}

const townIn = (x: number, z: number) => (rampBand(x) ? rampY(z) : terraceY(z));

/** A wall along an edge (split every 2.5 m and at the terrace steps) between the inner ground and the natural one. */
function perimeter(at: (x: number) => Ctx, [[x0, z0], [x1, z1]]: [number, number][], inward: [number, number], inner: (x: number, z: number) => number, withFence: boolean, color = WALL, cap = CAP) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ts = new Set<number>();
  for (let d = 0; d <= len + 1e-6; d += 2.5) ts.add(d / len);
  if (x0 === x1) for (const t of TERRACES) if (t.z1 > Math.min(z0, z1) && t.z1 < Math.max(z0, z1)) ts.add((t.z1 - z0) / (z1 - z0));
  if (x0 === x1) for (const t of [...PADDY_ROWS_Z]) if (t > Math.min(z0, z1) && t < Math.max(z0, z1) && inner === paddyIn) ts.add((t - z0) / (z1 - z0));
  const T = [...ts].sort((a, b) => a - b);
  // the natural ground along the edge is linear between the terrain's grid points
  const nat = (t: number) => {
    const d = t * len, g0 = Math.floor(d / 2.5 + 1e-6) * 2.5, g1 = Math.min(len, g0 + 2.5);
    const h0 = naturalHeight(lerp(x0, x1, g0 / len), lerp(z0, z1, g0 / len)), h1 = naturalHeight(lerp(x0, x1, g1 / len), lerp(z0, z1, g1 / len));
    return g1 > g0 ? lerp(h0, h1, clamp((d - g0) / (g1 - g0), 0, 1)) : h0;
  };
  for (let k = 0; k < T.length - 1; k++) {
    const ta = T[k], tb = T[k + 1], tm = (ta + tb) / 2;
    const xa = lerp(x0, x1, ta), za = lerp(z0, z1, ta), xb = lerp(x0, x1, tb), zb = lerp(z0, z1, tb);
    const xm = (xa + xb) / 2, zm = (za + zb) / 2;
    const rd = roadNear(xm - inward[0] * 0.5, zm - inward[1] * 0.5);
    if (rd.d < rd.width / 2 + 0.6) continue;
    const ia = inner(xa + inward[0] * 0.3 + (xb - xa) * 0.01, za + inward[1] * 0.3 + (zb - za) * 0.01), ib = inner(xb + inward[0] * 0.3 - (xb - xa) * 0.01, zb + inward[1] * 0.3 - (zb - za) * 0.01);
    const im = inner(xm + inward[0] * 0.3, zm + inward[1] * 0.3);
    const na = nat(ta), nb = nat(tb);
    void tm;
    const B = at(xm).body;
    const ya = ia, yb = ib;
    wallSeg(B, xa, za, xb, zb, Math.min(ya, na) - 0.6, Math.max(ya, na) + 0.12, Math.min(yb, nb) - 0.6, Math.max(yb, nb) + 0.12, 0.4, color, cap);
    if (withFence && im > Math.max(na, nb) + 0.9) fence(at(xm), xa + inward[0] * 0.35, za + inward[1] * 0.35, ya + 0.12, xb + inward[0] * 0.35, zb + inward[1] * 0.35, yb + 0.12);
    if (im < Math.min(na, nb) - 0.6) wallDetail(B, xa + inward[0] * 0.2, za + inward[1] * 0.2, inward[0], inward[1], im, Math.min(na, nb), k);
  }
}

// ---------------------------------------------------------------------------------------------
// the stepped rice paddies
// ---------------------------------------------------------------------------------------------
const PADDY_DZ = (PADDY.hz * 2) / PADDY.rows;
const PADDY_ROWS_Z = Array.from({ length: PADDY.rows - 1 }, (_, k) => PADDY.z - PADDY.hz + (k + 1) * PADDY_DZ);
const paddyIn = (_x: number, z: number) => paddyY(clamp(Math.floor((z - (PADDY.z - PADDY.hz)) / PADDY_DZ), 0, PADDY.rows - 1));

export function buildPaddies(ctx: Ctx, at: (x: number) => Ctx, r: () => number) {
  const B = ctx.body;
  const nx = 4, px = (PADDY.hx * 2) / nx;
  const x0 = PADDY.x - PADDY.hx, z0 = PADDY.z - PADDY.hz;
  const bank = '#9c8558', bankTop = '#86a64e';
  for (let j = 0; j < PADDY.rows; j++) {
    const y = paddyY(j);
    const cz = z0 + (j + 0.5) * PADDY_DZ;
    for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * px;
      const flooded = r() < 0.3;
      const stage = r();
      B.box(cx, y - 0.8, cz, px, 1.7, PADDY_DZ, flooded ? '#6fa9a4' : stage < 0.35 ? '#a4d25a' : stage < 0.7 ? '#8cc64e' : '#b9d65a', { ao: 0.02 });
      if (!flooded) for (let k = 0; k < 6; k++) B.box(cx, y + 0.12, cz - (PADDY_DZ - 1.6) / 2 + (k * (PADDY_DZ - 1.6)) / 5, px - 1.4, 0.08, 0.2, stage < 0.35 ? '#78b046' : '#6aa63e', { ao: 0 });
      // the low banks between the plots of one step
      if (i > 0) B.box(x0 + i * px, y + 0.08, cz, 0.6, 0.3, PADDY_DZ, bankTop, { ao: 0.1 });
    }
    // the bank between this step and the next one down
    if (j < PADDY.rows - 1) {
      const zb = z0 + (j + 1) * PADDY_DZ, yl = paddyY(j + 1);
      wallSeg(B, x0, zb, x0 + PADDY.hx * 2, zb, yl - 0.3, y + 0.28, yl - 0.3, y + 0.28, 0.9, bank, bankTop);
    }
  }
  perimeter(at, [[x0, z0], [x0 + PADDY.hx * 2, z0]], [0, 1], paddyIn, false, bank, bankTop);
  perimeter(at, [[x0, z0 + PADDY.hz * 2], [x0 + PADDY.hx * 2, z0 + PADDY.hz * 2]], [0, -1], paddyIn, false, bank, bankTop);
  perimeter(at, [[x0, z0], [x0, z0 + PADDY.hz * 2]], [1, 0], paddyIn, false, bank, bankTop);
  perimeter(at, [[x0 + PADDY.hx * 2, z0], [x0 + PADDY.hx * 2, z0 + PADDY.hz * 2]], [-1, 0], paddyIn, false, bank, bankTop);
  // a water channel along the top and straw stooks on the lowest step
  B.box(PADDY.x, paddyY(0) + 0.05, z0 + 0.6, PADDY.hx * 2 - 1, 0.1, 0.7, '#7aa8b0', { ao: 0 });
  for (let k = 0; k < 5; k++) B.frustum(x0 + 5 + k * 1.6, paddyY(PADDY.rows - 1) + 0.1, z0 + PADDY.hz * 2 - 1.4, 0.6, 0.45, 1.2, 8, '#d8b86a', { ao: 0.1 });
  void smoothstep;
}
