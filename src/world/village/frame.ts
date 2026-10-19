import { Color } from 'three';
import { GeoBuilder, type V3 } from '../../util/builder';
import type { Cell } from '../signs';

export type Face = '+z' | '-z' | '+x' | '-x';
export const FACES: Face[] = ['+z', '-z', '+x', '-x'];
export const RIGHT: Record<Face, number> = { '+z': 1, '-z': -1, '+x': -1, '-x': 1 };
export const NORMAL: Record<Face, V3> = { '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0] };
export const TANGENT: Record<Face, V3> = { '+z': [1, 0, 0], '-z': [1, 0, 0], '+x': [0, 0, 1], '-x': [0, 0, 1] };

/** What a building draws into: opaque parts, windows (day), two kinds of lit windows (night), and signs. */
export interface Ctx {
  body: GeoBuilder;
  win: GeoBuilder;
  litA: GeoBuilder;
  litB: GeoBuilder;
  sign: GeoBuilder;
  r: () => number;
}

export const newCtx = (r: () => number): Ctx => ({ body: new GeoBuilder(), win: new GeoBuilder(), litA: new GeoBuilder(), litB: new GeoBuilder(), sign: new GeoBuilder(), r });

export function appendCtx(dst: Ctx, src: Ctx, x: number, y: number, z: number, yaw: number) {
  dst.body.appendTransformed(src.body, x, y, z, yaw);
  dst.win.appendTransformed(src.win, x, y, z, yaw);
  dst.litA.appendTransformed(src.litA, x, y, z, yaw);
  dst.litB.appendTransformed(src.litB, x, y, z, yaw);
  dst.sign.appendTransformed(src.sign, x, y, z, yaw);
}

export const dk = (hex: string, k: number): Color => new Color(hex).multiplyScalar(k);

/** A point on the wall of a box (centre cx,cz, half sizes hw,hd): u along the wall, y up, off out of the wall. */
export function wp(f: Face, cx: number, cz: number, hw: number, hd: number, u: number, y: number, off: number): V3 {
  switch (f) {
    case '+z': return [cx + u, y, cz + hd + off];
    case '-z': return [cx + u, y, cz - hd - off];
    case '+x': return [cx + hw + off, y, cz + u];
    default: return [cx - hw - off, y, cz + u];
  }
}

/** A box stuck on a wall: `u` along it, `yc` its centre height, `w` x `h` seen from the front, `depth` thick, `off` from the wall to its centre. */
export function wallBox(b: GeoBuilder, f: Face, hw: number, hd: number, u: number, yc: number, w: number, h: number, depth: number, off: number, color: string | Color, ao = 0.1) {
  const p = wp(f, 0, 0, hw, hd, u, yc, off);
  const sx = f === '+z' || f === '-z' ? w : depth;
  const sz = f === '+z' || f === '-z' ? depth : w;
  b.box(p[0], p[1], p[2], sx, h, sz, color, { ao });
}

/** A flat coloured quad on a wall, seen from outside. */
export function wallQuad(b: GeoBuilder, f: Face, hw: number, hd: number, u: number, y: number, w: number, h: number, color: string | Color, off = 0.04) {
  const rs = RIGHT[f];
  const ul = u - (rs * w) / 2, ur = u + (rs * w) / 2;
  const c = new Color(color as never);
  const col: [number, number, number] = [c.r, c.g, c.b];
  b.quad(wp(f, 0, 0, hw, hd, ul, y, off), wp(f, 0, 0, hw, hd, ur, y, off), wp(f, 0, 0, hw, hd, ur, y + h, off), wp(f, 0, 0, hw, hd, ul, y + h, off), [col[0] * 0.92, col[1] * 0.92, col[2] * 0.92], [col[0] * 0.92, col[1] * 0.92, col[2] * 0.92], col, col);
}

/** A picture from the sign atlas on a wall (the front faces outward). */
export function wallPicture(b: GeoBuilder, f: Face, hw: number, hd: number, u: number, y: number, w: number, h: number, c: Cell, off = 0.05) {
  const rs = RIGHT[f];
  const ul = u - (rs * w) / 2, ur = u + (rs * w) / 2;
  b.quad(wp(f, 0, 0, hw, hd, ul, y, off), wp(f, 0, 0, hw, hd, ur, y, off), wp(f, 0, 0, hw, hd, ur, y + h, off), wp(f, 0, 0, hw, hd, ul, y + h, off), [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
}

/** A tall banner sticking out of a wall on a bracket, with the picture on both faces. */
export function hangSign(ctx: Ctx, f: Face, hw: number, hd: number, u: number, y0: number, h: number, c: Cell, depth = 0.9, width = 0.3) {
  const t = TANGENT[f], n = NORMAL[f];
  const base = wp(f, 0, 0, hw, hd, u, y0, 0);
  ctx.body.box(base[0] + n[0] * (depth / 2), y0 + h / 2, base[2] + n[2] * (depth / 2), Math.abs(n[0]) * depth + Math.abs(t[0]) * width, h, Math.abs(n[2]) * depth + Math.abs(t[2]) * width, '#2a2c32', { ao: 0 });
  for (const side of [1, -1]) {
    const o = width / 2 + 0.012;
    const p = (off: number, y: number): V3 => [base[0] + n[0] * off + t[0] * o * side, y, base[2] + n[2] * off + t[2] * o * side];
    // seen from this side, does the outward direction run to the right?
    const fw: V3 = [-t[0] * side, 0, -t[2] * side];
    const right: V3 = [-fw[2], 0, fw[0]];
    const flip = right[0] * n[0] + right[2] * n[2] < 0;
    const uL = flip ? c.u1 : c.u0, uR = flip ? c.u0 : c.u1;
    ctx.sign.quadFacing(p(0.03, y0 + 0.06), p(depth - 0.03, y0 + 0.06), p(depth - 0.03, y0 + h - 0.06), p(0.03, y0 + h - 0.06), [t[0] * side, 0, t[2] * side], [1, 1, 1], [[uL, c.v0], [uR, c.v0], [uR, c.v1], [uL, c.v1]]);
  }
}
