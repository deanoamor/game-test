import { Color } from 'three';
import type { SignAtlas } from '../signs';
import { dk, newCtx, wallBox, wallPicture, wallQuad, type Ctx } from './frame';
import { airConditioner, windowUnit } from './house';

/** The bigger buildings that are not houses: a convenience store, a supermarket, apartments and an office block. */

const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];

/** A convenience store: white box, a blue and white striped band, a glass front, a sign, posters, roof units. Faces +Z. */
export function konbini(r: () => number, atlas: SignAtlas, w = 14, d = 11): Ctx {
  const ctx = newCtx(r);
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

/** A small apartment block with an outside corridor on every floor, doors, mailboxes and a stair at the end. Faces +Z. */
export function apartmentBlock(r: () => number, w: number, d: number, floors: number, wall: string): Ctx {
  const ctx = newCtx(r);
  const B = ctx.body;
  const hw = w / 2, hd = d / 2, fh = 2.9, base = 0.3;
  B.box(0, base / 2, 0, w + 0.3, base, d + 0.3, '#b9b5ab', { ao: 0.1 });
  B.box(0, base + (floors * fh) / 2, 0, w, floors * fh, d, wall, { ao: 0.14 });
  B.box(0, base + floors * fh + 0.25, 0, w + 0.4, 0.5, d + 0.4, dk(wall, 0.85), { ao: 0 });
  const units = Math.max(2, Math.floor((w - 2.4) / 3.2));
  for (let fl = 0; fl < floors; fl++) {
    const y0 = base + fl * fh;
    // corridor slab and its solid rail, on the upper floors
    if (fl > 0) {
      wallBox(B, '+z', hw, hd, -1.0, y0 + 0.08, w - 2.0, 0.16, 1.3, 0.65, '#c9c4b6');
      wallBox(B, '+z', hw, hd, -1.0, y0 + 0.6, w - 2.0, 0.9, 0.1, 1.28, dk(wall, 0.95));
      wallBox(B, '+z', hw, hd, -1.0, y0 + 1.07, w - 2.0, 0.06, 0.16, 1.28, '#8a9096', 0);
    }
    for (let k = 0; k < units; k++) {
      const u = -hw + 1.4 + (k + 0.5) * ((w - 2.8) / units) - 1.0;
      wallBox(B, '+z', hw, hd, u - 0.6, y0 + 1.15, 0.85, 2.0, 0.08, 0.05, pick(r, ['#7a8088', '#8a6a4a', '#6a7a8a', '#9a9a92']));
      wallBox(B, '+z', hw, hd, u - 0.25, y0 + 1.35, 0.06, 0.12, 0.04, 0.1, '#d8c890', 0);
      windowUnit(ctx, '+z', hw, hd, u + 0.7, y0 + 1.15, 0.9, 0.8, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.35, tall: true });
      wallBox(B, '+z', hw, hd, u + 0.7, y0 + 1.1, 0.9, 0.05, 0.15, 0.1, '#c8ccd0', 0);
      // a balcony with laundry on the back
      windowUnit(ctx, '-z', hw, hd, -u, y0 + 0.4, 1.6, 2.0, { frame: '#e8e4d8', glass: '#7fa6c2', lit: r() < 0.35, tall: true });
      wallBox(B, '-z', hw, hd, -u, y0 + 0.1, 2.6, 0.15, 1.0, 0.5, '#d2cec2');
      wallBox(B, '-z', hw, hd, -u, y0 + 0.6, 2.6, 0.9, 0.06, 0.98, '#e8e4dc');
      if (r() < 0.5) for (let q = 0; q < 3; q++) wallBox(B, '-z', hw, hd, -u - 0.6 + q * 0.6, y0 + 1.6, 0.45, 0.6, 0.02, 0.8, pick(r, ['#f4f4f0', '#a9d1f0', '#f4b6c2', '#f5e08a']), 0);
    }
  }
  // the stair at the end
  const sx = hw - 1.0;
  for (let fl = 0; fl < floors - 1; fl++) {
    const y0 = base + fl * fh;
    for (let k = 0; k < 10; k++) B.box(sx, y0 + (k + 1) * (fh / 10), hd + 0.3 + k * 0.12, 1.2, 0.06, 0.28, '#8a9096', { ao: 0 });
  }
  B.box(sx + 0.62, base + (floors * fh) / 2, hd + 0.9, 0.08, floors * fh, 1.4, dk(wall, 0.9), { ao: 0.05 });
  // mailboxes and a bike shelter on the ground floor
  for (let k = 0; k < 6; k++) wallBox(B, '+z', hw, hd, -hw + 0.8 + (k % 3) * 0.36, base + 1.0 + Math.floor(k / 3) * 0.32, 0.32, 0.28, 0.25, 0.12, '#b8bcc0');
  airConditioner(ctx, '+x', hw, hd, -1, 2.0);
  airConditioner(ctx, '+x', hw, hd, -1, 4.9);
  return ctx;
}

/** A taller building at the back of the town: bands of windows, a ledge, roof gear and sometimes a billboard. Faces +Z. */
export function officeBlock(r: () => number, atlas: SignAtlas, w: number, d: number, floors: number, wall: string): Ctx {
  const ctx = newCtx(r);
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
