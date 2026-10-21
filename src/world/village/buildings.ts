import { Color } from 'three';
import type { SignAtlas } from '../signs';
import { dk, newCtx, wallBox, wallPicture, wallQuad, type Ctx, solidBox } from './frame';
import { airConditioner, windowUnit } from './house';

/** The bigger buildings that are not houses: a convenience store, a supermarket, apartments and an office block. */

const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];

/** A convenience store: white box, a blue and white striped band, a glass front, a sign, posters, roof units. Faces +Z. */
export function konbini(r: () => number, atlas: SignAtlas, w = 14, d = 11): Ctx {
  const ctx = newCtx(r);
  solidBox(ctx, 0, 0, w / 2, d / 2);
  const B = ctx.body;
  const hw = w / 2, hd = d / 2, h = 4.4;
  B.box(0, 0.12, 0, w + 0.3, 0.24, d + 0.3, '#b9b5ab', { ao: 0.1 });
  B.box(0, 0.24 + h / 2, 0, w, h, d, '#f2f1ec', { ao: 0.12 });
  // the striped band all around, under a white cornice
  for (const f of ['+z', '-z', '+x', '-x'] as const) {
    const L = f === '+z' || f === '-z' ? w : d;
    wallBox(B, f, hw, hd, 0, 0.24 + h - 0.55, L + 0.1, 0.42, 0.1, 0.05, '#2a8fd8', 0);
    wallBox(B, f, hw, hd, 0, 0.24 + h - 0.85, L + 0.1, 0.12, 0.1, 0.05, '#ffffff', 0);
    wallBox(B, f, hw, hd, 0, 0.24 + h - 1.0, L + 0.1, 0.16, 0.1, 0.05, '#8fd0f4', 0);
  }
  B.box(0, 0.24 + h + 0.25, 0, w + 0.3, 0.5, d + 0.3, '#f6f6f2', { ao: 0 });
  // the glass front with mullions and an automatic door
  const gy = 0.3, gh = 2.7;
  wallQuad(ctx.litB, '+z', hw, hd, 0, gy, w - 1.0, gh, '#dff2fa', 0.04);
  ctx.glow.push({ x: 0, y: 0, z: hd + 1.6, h: 2.4, r: 4.2, color: '#dceeff', k: 0.45 });
  for (let k = 0; k <= 6; k++) wallBox(B, '+z', hw, hd, -(w - 1.0) / 2 + (k * (w - 1.0)) / 6, gy + gh / 2, 0.08, gh, 0.08, 0.06, '#9aa0a6', 0);
  wallBox(B, '+z', hw, hd, 0, gy + gh + 0.05, w - 0.9, 0.1, 0.1, 0.06, '#9aa0a6', 0);
  // shelves seen through the glass
  for (let k = 0; k < 5; k++) for (let j = 0; j < 3; j++) wallBox(ctx.litA, '+z', hw, hd, -w / 2 + 1.8 + k * 2.6, gy + 0.4 + j * 0.55, 1.8, 0.3, 0.3, -0.5, pick(r, ['#e8402a', '#f2c230', '#4aa8e0', '#3a9a5a', '#f08aac']), 0);
  const c = atlas.get('konbini');
  wallPicture(ctx.sign, '+z', hw, hd, 0, 0.24 + h - 0.62, 4.2, 4.2 / c.aspect, c, 0.12);
  wallPicture(ctx.sign, '+z', hw, hd, -w / 2 + 1.0, gy + 1.3, 0.9, 0.9, atlas.get('sale'), 0.06);
  wallPicture(ctx.sign, '+z', hw, hd, w / 2 - 1.0, gy + 1.3, 0.9, 0.9, atlas.get('sale'), 0.06);
  // side windows, roof units, bins and a freezer by the door
  wallQuad(ctx.litB, '+x', hw, hd, 1.5, 0.9, 4.0, 1.6, '#dff2fa', 0.04);
  for (let k = 0; k < 3; k++) B.box(-hw + 2 + k * 1.3, 0.24 + h + 0.85, -hd + 1.5, 1.0, 0.7, 0.8, '#e6e9eb', { ao: 0.1 });
  for (let k = 0; k < 3; k++) {
    B.box(-hw + 0.6 + k * 0.6, 0.6, hd + 0.5, 0.5, 0.95, 0.5, ['#3a9a5a', '#2a8fd8', '#e8a030'][k], { ao: 0.1 });
    B.box(-hw + 0.6 + k * 0.6, 1.1, hd + 0.5, 0.52, 0.06, 0.52, '#e8e8e8', { ao: 0 });
  }
  B.box(hw - 1.0, 0.55, hd + 0.5, 1.2, 0.85, 0.7, '#f4f4f2', { ao: 0.1 });
  B.box(hw - 1.0, 1.0, hd + 0.5, 1.2, 0.06, 0.7, '#8fd0f4', { ao: 0 });
  return ctx;
}

/** A supermarket: two storeys, a big red sign, a canopy over the doors, posters and a row of carts. Faces +Z. */
export function supermarket(r: () => number, atlas: SignAtlas, w = 22, d = 16): Ctx {
  const ctx = newCtx(r);
  solidBox(ctx, 0, 0, w / 2, d / 2);
  const B = ctx.body;
  const hw = w / 2, hd = d / 2, h = 7.6;
  B.box(0, 0.12, 0, w + 0.3, 0.24, d + 0.3, '#b9b5ab', { ao: 0.1 });
  B.box(0, 0.24 + h / 2, 0, w, h, d, '#ece6d6', { ao: 0.12 });
  wallBox(B, '+z', hw, hd, 0, 0.24 + h - 0.6, w + 0.1, 1.2, 0.12, 0.06, '#d8322e', 0);
  const c = atlas.get('super');
  wallPicture(ctx.sign, '+z', hw, hd, 0, 0.24 + h - 1.15, 6.4, 6.4 / c.aspect, c, 0.14);
  wallQuad(ctx.litB, '+z', hw, hd, 0, 0.35, w - 2, 2.9, '#e6f2f6', 0.04);
  for (let k = 0; k <= 8; k++) wallBox(B, '+z', hw, hd, -(w - 2) / 2 + (k * (w - 2)) / 8, 1.8, 0.1, 2.9, 0.1, 0.06, '#8a9096', 0);
  for (let k = 0; k < 4; k++) wallPicture(ctx.sign, '+z', hw, hd, -w / 2 + 2 + k * 1.3, 1.4, 1.0, 1.0, atlas.get('sale'), 0.07);
  for (let k = 0; k < 7; k++) wallBox(ctx.litA, '+z', hw, hd, -w / 2 + 6.5 + k * 1.9, 0.9, 1.5, 0.9, 0.4, -0.6, pick(r, ['#e8402a', '#f2c230', '#3a9a5a', '#f08aac', '#e8a030']), 0);
  // the upper floor: a row of office windows
  for (let k = 0; k < 7; k++) windowUnit(ctx, '+z', hw, hd, -w / 2 + 1.8 + k * 3.1, 4.3, 2.0, 1.4, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.4 });
  // the canopy over the doors
  wallBox(B, '+z', hw, hd, w / 4, 3.4, 6.0, 0.25, 2.4, 1.2, '#f4f4f0');
  for (const s of [-1, 1]) wallBox(B, '+z', hw, hd, w / 4 + s * 2.8, 1.75, 0.15, 3.1, 0.15, 2.3, '#9aa0a6', 0);
  // carts
  for (let k = 0; k < 6; k++) {
    const x = -w / 2 + 2 + k * 0.45, z = hd + 1.2;
    B.box(x, 0.65, z, 0.4, 0.5, 0.8, '#b8c0c8', { ao: 0 });
    B.box(x, 0.2, z, 0.4, 0.06, 0.8, '#6a7076', { ao: 0 });
    B.box(x, 1.0, z - 0.42, 0.42, 0.04, 0.04, '#d8322e', { ao: 0 });
  }
  for (let k = 0; k < 4; k++) B.box(-w / 2 + 3 + k * 4, 0.24 + h + 0.5, -hd + 2, 1.4, 1.0, 1.0, '#e6e9eb', { ao: 0.1 });
  for (const f of ['+x', '-x'] as const) for (let k = 0; k < 3; k++) windowUnit(ctx, f, hw, hd, -d / 2 + 3 + k * 5, 4.3, 1.6, 1.3, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.3 });
  airConditioner(ctx, '-z', hw, hd, 2, 2.0);
  airConditioner(ctx, '-z', hw, hd, -3, 2.0);
  return ctx;
}

/**
 * A walk-up apartment block (faces +Z): open corridors with solid parapets along the front, a concrete dog-leg stair in
 * a bay at the +X end, balconies with partitions, laundry poles and AC units along the back. Everything stays inside
 * the w x d lot except the front corridor, which overhangs the front strip by 1.3 m.
 */
export function apartmentBlock(r: () => number, w: number, d: number, floors: number, wall: string): Ctx {
  const ctx = newCtx(r);
  solidBox(ctx, 0, 0, w / 2, d / 2);
  const B = ctx.body;
  const hw = w / 2, hd = d / 2, fh = 2.9, base = 0.3, H = floors * fh;
  const SB = 2.6, bx1 = hw - SB; // the flats end at bx1, the stair bay runs from there to hw
  const zf = hd, zb = -hd + 1.1, hb = -zb; // front and back faces (the back balconies fill the last 1.1 m)
  const coreZ = zf - 3.3; // the back of the stair core
  const trim = dk(wall, 0.86);
  const rail = '#8a9096', panel = '#e6e2d8';
  // the plinth, the flats, the closed back of the stair bay, the roof with its parapet
  B.box(0, base / 2, 0.1, w + 0.3, base, d + 1.5, '#b9b5ab', { ao: 0.1 });
  B.box((-hw + bx1) / 2, base + H / 2, (zf + zb) / 2, bx1 + hw, H, zf - zb, wall, { ao: 0.14 });
  B.box((bx1 + hw) / 2, base + H / 2, (coreZ + zb) / 2, SB, H, coreZ - zb, wall, { ao: 0.14 });
  const roofZ0 = -hd - 0.1, roofZ1 = zf + 1.45;
  B.box(0, base + H + 0.14, (roofZ0 + roofZ1) / 2, w + 0.3, 0.28, roofZ1 - roofZ0, trim, { ao: 0 });
  for (const [x, z, sx, sz] of [[0, roofZ0 + 0.06, w + 0.3, 0.12], [0, roofZ1 - 0.06, w + 0.3, 0.12], [-hw - 0.09, (roofZ0 + roofZ1) / 2, 0.12, roofZ1 - roofZ0], [hw + 0.09, (roofZ0 + roofZ1) / 2, 0.12, roofZ1 - roofZ0]] as const) B.box(x, base + H + 0.48, z, sx, 0.4, sz, trim, { ao: 0 });
  B.box(-hw * 0.3, base + H + 0.9, -0.5, 1.6, 1.2, 1.2, '#cfd3d6', { ao: 0.1 }); // a water tank housing

  const span = bx1 + hw - 0.8;
  const units = Math.max(2, Math.floor(span / 3.2)), uw = span / units;
  const uc = (k: number) => -hw + 0.4 + (k + 0.5) * uw;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = base + fl * fh;
    // the open corridor: floor slab, a solid parapet with a rail on top, an end panel
    if (fl > 0) {
      B.box((-hw + hw) / 2, y0 - 0.09, zf + 0.65, w, 0.18, 1.3, '#c9c4b6', { ao: 0.05 });
      B.box(0, y0 + 0.5, zf + 1.25, w, 1.0, 0.1, panel, { ao: 0.08 });
      B.box(0, y0 + 1.03, zf + 1.25, w + 0.04, 0.06, 0.16, rail, { ao: 0 });
      B.box(-hw + 0.05, y0 + 0.5, zf + 0.65, 0.1, 1.0, 1.2, panel, { ao: 0.08 });
      B.box(0, y0 - 0.2, zf + 1.28, w + 0.02, 0.06, 0.06, trim, { ao: 0 }); // a drip edge
    }
    for (let k = 0; k < units; k++) {
      const u = uc(k);
      // the front door, its number plate, a meter box, a kitchen window with bars
      wallBox(B, '+z', hw, hd, u - 0.6, y0 + 1.02, 0.85, 2.0, 0.08, 0.05, pick(r, ['#7a8088', '#8a6a4a', '#6a7a8a', '#9a9a92']));
      wallBox(B, '+z', hw, hd, u - 0.25, y0 + 1.3, 0.06, 0.12, 0.04, 0.1, '#d8c890', 0);
      wallBox(B, '+z', hw, hd, u - 0.6, y0 + 2.2, 0.5, 0.14, 0.04, 0.03, '#f4f4ee', 0);
      wallBox(B, '+z', hw, hd, u - 1.2, y0 + 1.5, 0.3, 0.45, 0.12, 0.07, '#c8ccd0');
      windowUnit(ctx, '+z', hw, hd, u + 0.7, y0 + 1.15, 0.9, 0.8, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.35, tall: true });
      for (let q = 0; q < 4; q++) wallBox(B, '+z', hw, hd, u + 0.34 + q * 0.24, y0 + 1.55, 0.03, 0.82, 0.03, 0.14, rail, 0);
      // the back: a sliding glass door onto the balcony
      windowUnit(ctx, '-z', hw, hb, u, y0 + 0.15, 1.7, 2.05, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.35, tall: true });
    }
    // the balcony along the back of the flats (the ground floor gets a small walled yard instead)
    const bz = zb - 0.55, x0 = -hw + 0.05, x1 = bx1 - 0.05;
    if (fl === 0) {
      B.box((x0 + x1) / 2, 0.55, -hd + 0.05, x1 - x0, 1.1, 0.1, '#c9c6bc', { ao: 0.08 });
      for (let k = 0; k < units; k++) if (r() < 0.6) B.blob(uc(k) + 0.6, 0.6, bz, 0.4, 0.4, 0.35, '#5aa845', { seed: k });
      continue;
    }
    B.box((x0 + x1) / 2, y0 - 0.08, bz, x1 - x0, 0.16, 1.1, '#cfcbc0', { ao: 0.05 });
    B.box((x0 + x1) / 2, y0 + 0.55, -hd + 0.05, x1 - x0, 1.1, 0.1, panel, { ao: 0.08 });
    B.box((x0 + x1) / 2, y0 + 1.12, -hd + 0.05, x1 - x0 + 0.04, 0.06, 0.16, rail, { ao: 0 });
    for (const x of [x0, x1]) B.box(x, y0 + 0.55, bz, 0.08, 1.1, 1.1, panel, { ao: 0.08 });
    for (let k = 0; k < units; k++) {
      const u = uc(k);
      // a partition between neighbours, an AC unit, and laundry on a pole under the ceiling
      if (k > 0) B.box(u - uw / 2, y0 + 1.1, bz, 0.05, 2.2, 1.0, '#d8dce0', { ao: 0.05 });
      B.box(u + uw / 2 - 0.55, y0 + 0.3, bz + 0.2, 0.75, 0.6, 0.32, '#e6e9eb', { ao: 0.1 });
      B.disc(u + uw / 2 - 0.68, y0 + 0.3, bz - 0.0, 0.2, 0.02, 'z', '#5a5e64', 12);
      if (r() < 0.7) {
        const pa = u - uw / 2 + 0.25, pb = u + uw / 2 - 0.25, py = y0 + fh - 0.45;
        for (const x of [pa, pb]) B.box(x, py + 0.2, bz - 0.15, 0.04, 0.4, 0.04, rail, { ao: 0 });
        B.cable([[pa, py, bz - 0.15], [pb, py, bz - 0.15]], 0.02, '#c0c4c8');
        let x = pa + 0.25;
        while (x < pb - 0.3) {
          const cw = 0.3 + r() * 0.3, ch = 0.4 + r() * 0.4;
          B.box(x + cw / 2, py - ch / 2 - 0.03, bz - 0.15, cw, ch, 0.03, pick(r, ['#f4f4f0', '#a9d1f0', '#f4b6c2', '#f5e08a', '#9ad0a0', '#3a4a6a']), { ao: 0 });
          x += cw + 0.08;
        }
      }
    }
  }

  // the stair bay: a front landing on each floor, two flights a floor with a half landing at the back
  const sx0 = bx1, sx1 = hw, mid = sx0 + SB / 2;
  const n = 8, rise = fh / (2 * n), run = 2.2 / n;
  B.box(sx1 - 0.08, base + (H + 1.0) / 2, (coreZ + zf + 1.3) / 2, 0.16, H + 1.0, zf + 1.3 - coreZ, wall, { ao: 0.1 });
  for (let fl = 0; fl < floors; fl++) {
    for (let k = 0; k < 3; k++) wallBox(B, '+x', hw, hd, zf - 0.6 - k * 0.9, base + fl * fh + 1.9, 0.18, 0.5, 0.04, 0.0, '#3a3d42', 0);
  }
  B.box(mid, base + (H - fh) / 2 + 0.5, zf - 1.1, 0.1, H - fh + 1.0, 2.2, panel, { ao: 0.05 });
  for (let fl = 0; fl < floors - 1; fl++) {
    const y0 = base + fl * fh, ym = y0 + fh / 2;
    for (let k = 0; k < n; k++) {
      const za = zf - (k + 1) * run, ta = y0 + (k + 1) * rise;
      B.box((sx0 + mid) / 2, (ta + y0 - 0.15) / 2, za + run / 2, mid - sx0 - 0.05, ta - y0 + 0.15, run, k % 2 ? '#bdb8ad' : '#c6c1b6', { ao: 0.04 });
      const zbk = zf - 2.2 + k * run, tb = ym + (k + 1) * rise;
      B.box((mid + sx1) / 2, (tb + ym - 0.15) / 2, zbk + run / 2, sx1 - mid - 0.2, tb - ym + 0.15, run, k % 2 ? '#bdb8ad' : '#c6c1b6', { ao: 0.04 });
    }
    B.box((sx0 + sx1) / 2, ym - 0.09, (coreZ + zf - 2.2) / 2, SB, 0.18, zf - 2.2 - coreZ, '#c9c4b6', { ao: 0.05 });
    B.cable([[mid - 0.12, y0 + 0.95, zf], [mid - 0.12, ym + 0.95, zf - 2.2]], 0.025, rail);
    B.cable([[mid + 0.12, ym + 0.95, zf - 2.2], [mid + 0.12, y0 + fh + 0.95, zf]], 0.025, rail);
  }
  // mailboxes on the ground floor and the building's name plate
  for (let k = 0; k < 6; k++) wallBox(B, '+z', hw, hd, -hw + 0.8 + (k % 3) * 0.36, base + 1.0 + Math.floor(k / 3) * 0.32, 0.32, 0.28, 0.25, 0.12, '#b8bcc0');
  wallBox(B, '+z', hw, hd, -hw + 1.1, base + 2.0, 1.0, 0.3, 0.04, 0.03, '#3a3f46', 0);
  return ctx;
}

/** A taller building at the back of the town: bands of windows, a ledge, roof gear and sometimes a billboard. Faces +Z. */
export function officeBlock(r: () => number, atlas: SignAtlas, w: number, d: number, floors: number, wall: string): Ctx {
  const ctx = newCtx(r);
  solidBox(ctx, 0, 0, w / 2, d / 2);
  const B = ctx.body;
  const hw = w / 2, hd = d / 2, fh = 3.3;
  B.box(0, 0.15, 0, w + 0.3, 0.3, d + 0.3, '#b9b5ab', { ao: 0.1 });
  B.box(0, 0.3 + (floors * fh) / 2, 0, w, floors * fh, d, wall, { ao: 0.14 });
  const glass = pick(r, ['#6a9fbf', '#5d8fb0', '#7fb0cc']);
  for (let fl = 0; fl < floors; fl++) {
    const y0 = 0.3 + fl * fh;
    for (const f of ['+z', '-z', '+x', '-x'] as const) {
      const L = f === '+z' || f === '-z' ? w : d;
      const lit = r() < 0.35;
      wallQuad(lit ? ctx.litB : ctx.win, f, hw, hd, 0, y0 + 0.8, L - 1.2, 1.5, lit ? '#e6f2f8' : glass, 0.04);
      for (let k = 1; k < Math.floor(L / 2.4); k++) wallBox(B, f, hw, hd, -L / 2 + k * 2.4, y0 + 1.55, 0.12, 1.5, 0.08, 0.06, dk(wall, 0.8), 0);
      wallBox(B, f, hw, hd, 0, y0 + 0.05, L + 0.1, 0.12, 0.1, 0.05, dk(wall, 0.85), 0);
    }
  }
  const top = 0.3 + floors * fh;
  B.box(0, top + 0.3, 0, w + 0.3, 0.6, d + 0.3, dk(wall, 0.85), { ao: 0 });
  B.box(w * 0.2, top + 1.4, -d * 0.2, 3, 2.2, 2.6, '#cfd3d6', { ao: 0.1 });
  if (r() < 0.6) {
    const c = atlas.get(pick(r, ['books', 'clinic', 'karaoke', 'barber', 'izakayaBoard']));
    const bw = Math.min(w - 1, 8), bh = c.aspect > 2 ? bw / c.aspect : 2.5;
    for (const s of [-1, 1]) B.box(s * bw * 0.35, top + 1.3, 0, 0.2, 2.0, 0.2, '#4a4d55', { ao: 0 });
    B.box(0, top + 2.3 + bh / 2, 0, bw + 0.3, bh + 0.3, 0.3, '#2a2c32', { ao: 0 });
    for (const side of [1, -1]) {
      const z = side * 0.17;
      const uL = side > 0 ? c.u0 : c.u1, uR = side > 0 ? c.u1 : c.u0;
      ctx.sign.quadFacing([-bw / 2, top + 2.3, z], [bw / 2, top + 2.3, z], [bw / 2, top + 2.3 + bh, z], [-bw / 2, top + 2.3 + bh, z], [0, 0, side], [1, 1, 1], [[uL, c.v0], [uR, c.v0], [uR, c.v1], [uL, c.v1]]);
    }
  }
  void Color;
  return ctx;
}
