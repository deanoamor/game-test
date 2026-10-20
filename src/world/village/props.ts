import { Color } from 'three';
import type { GeoBuilder, V3 } from '../../util/builder';
import type { SignAtlas } from '../signs';
import { lampFaces, type SignalGroup } from '../signals';
import { buildVehicle, type VehicleKind } from '../vehicles';
import { dk, newCtx, type Ctx } from './frame';

/** Everything that stands in the street: poles and wires, lamps, vending machines, rails, signs, cars and plants. */

const sag = (a: V3, b: V3, drop: number, n = 9): V3[] => {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
};

/** A concrete utility pole with two cross arms, insulators, a step plate and sometimes a transformer. Returns the wire attachment points. */
export function utilityPole(ctx: Ctx, x: number, y: number, z: number, o: { height?: number; transformer?: boolean; yaw?: number } = {}) {
  const B = ctx.body;
  const h = o.height ?? 9.6;
  B.box(x, y + h / 2, z, 0.34, h, 0.34, '#a8a49a', { ao: 0.15 });
  B.box(x, y + 0.6, z, 0.4, 1.2, 0.4, '#8f8b82', { ao: 0.1 });
  B.box(x, y + 2.4, z + 0.19, 0.2, 0.3, 0.02, '#e8c43a', { ao: 0 }); // number plate
  for (let k = 0; k < 6; k++) B.box(x, y + 0.25 + k * 0.32, z, 0.38, 0.16, 0.38, k % 2 ? '#1e1e1e' : '#f2c230', { ao: 0 }); // the striped guard sleeve
  B.box(x + 0.32, y + h - 3.4, z, 0.36, 0.6, 0.42, '#2a2c30', { ao: 0.05 }); // a black box
  B.box(x - 0.28, y + h - 4.4, z, 0.26, 0.42, 0.3, '#c9ccd0', { ao: 0.05 }); // a grey box
  // the cross arms run across the road (along x here), one for power and one lower for telephone lines
  B.box(x, y + h - 0.7, z, 0.12, 0.14, 2.3, '#4b4540', { ao: 0 });
  B.box(x, y + h - 1.6, z, 0.12, 0.14, 1.9, '#4b4540', { ao: 0 });
  B.box(x, y + h - 1.15, z, 0.1, 0.9, 0.1, '#6b6560', { ao: 0 });
  for (const dz of [-1.0, 0, 1.0]) B.box(x, y + h - 0.5, z + dz, 0.12, 0.22, 0.12, '#d8d4c8', { ao: 0 });
  for (const dz of [-0.8, 0.8]) B.box(x, y + h - 1.4, z + dz, 0.1, 0.18, 0.1, '#d8d4c8', { ao: 0 });
  if (o.transformer) {
    B.frustum(x + 0.5, y + h - 2.4, z, 0.4, 0.4, 1.0, 8, '#2a2c30');
    B.frustum(x - 0.5, y + h - 2.6, z, 0.34, 0.34, 0.9, 8, '#2a2c30');
    B.box(x + 0.5, y + h - 1.3, z, 0.8, 0.1, 0.8, '#6a7076', { ao: 0 });
    B.box(x + 0.25, y + h - 2.0, z, 0.5, 0.1, 0.1, '#6a7076', { ao: 0 });
  }
  for (let k = 0; k < 7; k++) B.box(x - 0.2, y + 2.8 + k * 0.5, z, 0.1, 0.04, 0.3, '#555', { ao: 0 }); // climbing steps
  void o.yaw;
  return {
    power: [-1.0, 0, 1.0].map((dz): V3 => [x, y + h - 0.35, z + dz]),
    phone: [-0.8, 0.8].map((dz): V3 => [x, y + h - 1.25, z + dz]),
    drop: [x + 0.2, y + h - 2.3, z] as V3,
  };
}

/** Wires between two poles' attachment points, sagging a little. */
export function wireSpan(ctx: Ctx, a: V3[], b: V3[], drop = 0.55, r = 0.028, color: string | Color = '#26292d') {
  for (let i = 0; i < Math.min(a.length, b.length); i++) ctx.body.cable(sag(a[i], b[i], drop + (i % 2) * 0.12), r, color);
}

/** A red street lamp with a banner arm, like the ones on shopping streets. */
export function redLamp(ctx: Ctx, x: number, y: number, z: number, side = 1) {
  const B = ctx.body;
  B.box(x, y + 2.0, z, 0.14, 4.0, 0.14, '#3a2a28', { ao: 0.1 });
  B.box(x, y + 0.2, z, 0.3, 0.4, 0.3, '#3a2a28', { ao: 0.1 });
  B.box(x + side * 0.45, y + 3.9, z, 0.9, 0.08, 0.08, '#3a2a28', { ao: 0 });
  ctx.litA.frustum(x + side * 0.85, y + 3.45, z, 0.26, 0.2, 0.55, 8, '#e0402a', { ao: 0 });
  B.frustum(x + side * 0.85, y + 4.0, z, 0.3, 0.05, 0.22, 8, '#2a1a18', { ao: 0 });
  B.frustum(x + side * 0.85, y + 3.38, z, 0.2, 0.2, 0.07, 8, '#2a1a18', { ao: 0 });
}

/** A vending machine with a glowing picture front. */
export function vendingMachine(ctx: Ctx, atlas: SignAtlas, x: number, y: number, z: number, yaw: number, kind: 'vendRed' | 'vendBlue') {
  const tmp = new (ctx.body.constructor as new () => GeoBuilder)();
  const sg = new (ctx.sign.constructor as new () => GeoBuilder)();
  tmp.box(0, 0.95, 0, 0.95, 1.9, 0.78, kind === 'vendRed' ? '#c8322e' : '#1f5ea8', { ao: 0.12 });
  tmp.box(0, 1.93, 0, 1.0, 0.1, 0.84, '#e8e8e8', { ao: 0 });
  const c = atlas.get(kind);
  sg.quad([-0.4, 0.45, 0.402], [0.4, 0.45, 0.402], [0.4, 1.75, 0.402], [-0.4, 1.75, 0.402], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
  ctx.body.appendTransformed(tmp, x, y, z, yaw);
  ctx.sign.appendTransformed(sg, x, y, z, yaw);
}

/** A silver guardrail made of posts and two pipes along the line from (x0,z) to (x1,z). */
export function guardrail(ctx: Ctx, x0: number, x1: number, y: number, z: number) {
  const B = ctx.body;
  const len = Math.abs(x1 - x0);
  const n = Math.max(1, Math.round(len / 2.0));
  const dir = Math.sign(x1 - x0) || 1;
  const cx = (x0 + x1) / 2;
  B.box(cx, y + 0.86, z, len, 0.07, 0.07, '#d8dcdf', { ao: 0 });
  B.box(cx, y + 0.6, z, len, 0.07, 0.07, '#d8dcdf', { ao: 0 });
  for (let i = 0; i <= n; i++) {
    const x = x0 + dir * (i * len) / n;
    B.box(x, y + 0.45, z, 0.07, 0.9, 0.07, '#bfc4c8', { ao: 0 });
    B.box(x, y + 0.86, z + 0.06, 0.1, 0.1, 0.06, '#e8e8e8', { ao: 0 });
  }
}

/** A roadside convex mirror on a pole: an orange ring around a round mirror. */
export function convexMirror(ctx: Ctx, x: number, y: number, z: number, yaw: number) {
  const B = ctx.body;
  B.box(x, y + 1.7, z, 0.1, 3.4, 0.1, '#e8e8e8', { ao: 0.05 });
  const a = (yaw * Math.PI) / 180;
  const nx = Math.sin(a), nz = Math.cos(a);
  const cx = x + nx * 0.15, cz = z + nz * 0.15;
  const axis: 'x' | 'z' = Math.abs(nx) > Math.abs(nz) ? 'x' : 'z';
  B.disc(cx, y + 3.1, cz, 0.62, 0.14, axis, '#f08a1c', 16);
  ctx.win.disc(cx + nx * 0.075, y + 3.1, cz + nz * 0.075, 0.5, 0.05, axis, '#aebfcc', 16);
}

/** A speed limit or stop sign on a pole. */
export function roadSign(ctx: Ctx, atlas: SignAtlas, kind: 'speed30' | 'stopSign' | 'busStop', x: number, y: number, z: number, yaw: number, h = 2.4) {
  const c = atlas.get(kind);
  const tmp = new (ctx.body.constructor as new () => GeoBuilder)();
  const sg = new (ctx.sign.constructor as new () => GeoBuilder)();
  tmp.box(0, h / 2, 0, 0.07, h, 0.07, '#9aa0a6', { ao: 0 });
  const s = kind === 'busStop' ? 0.9 : 0.72;
  const sy = h + (kind === 'busStop' ? 0.1 : -0.1);
  for (const side of [1, -1]) {
    const zz = 0.06 * side;
    const pts: V3[] = [[-s / 2, sy - s / 2, zz], [s / 2, sy - s / 2, zz], [s / 2, sy + s / 2, zz], [-s / 2, sy + s / 2, zz]];
    const uv: [number, number][] = side > 0 ? [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]] : [[c.u1, c.v0], [c.u0, c.v0], [c.u0, c.v1], [c.u1, c.v1]];
    sg.quadFacing(pts[0], pts[1], pts[2], pts[3], [0, 0, side], [1, 1, 1], uv);
  }
  ctx.body.appendTransformed(tmp, x, y, z, yaw);
  ctx.sign.appendTransformed(sg, x, y, z, yaw);
}

/** Words painted on the road, lying flat and facing up. */
export function roadPaint(ctx: Ctx, atlas: SignAtlas, name: string, x: number, y: number, z: number, w: number, yaw: number) {
  const c = atlas.get(name);
  const h = w / c.aspect;
  const tmp = new (ctx.sign.constructor as new () => GeoBuilder)();
  tmp.quad([-w / 2, 0, h / 2], [w / 2, 0, h / 2], [w / 2, 0, -h / 2], [-w / 2, 0, -h / 2], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
  ctx.sign.appendTransformed(tmp, x, y, z, yaw);
}

/** A parked vehicle. */
export function parkedVehicle(ctx: Ctx, kind: VehicleKind, color: string, x: number, y: number, z: number, yaw: number) {
  ctx.body.appendTransformed(buildVehicle(kind, color), x, y, z, yaw);
}

/** A concrete block wall: courses of blocks, pilasters and a cap. Along the line from (x0,z0) to (x1,z1). */
export function blockWall(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, h = 1.25) {
  const B = ctx.body;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const yaw = (Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(cx, y + h / 2, cz, len, h, 0.28, '#bcb9b0', { yaw, ao: 0.1 });
  B.box(cx, y + h + 0.05, cz, len, 0.1, 0.34, '#d2cfc6', { yaw, ao: 0 });
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const px = -uz, pz = ux;
  for (let k = 1; k < 4; k++) B.box(cx + px * 0.145, y + (k * h) / 4, cz + pz * 0.145, len, 0.025, 0.02, '#9d9a92', { yaw, ao: 0 });
  const n = Math.max(1, Math.round(len / 2.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    B.box(x0 + (x1 - x0) * t, y + h / 2, z0 + (z1 - z0) * t, 0.34, h, 0.34, '#c9c6bd', { yaw, ao: 0.1 });
  }
}

/** A round shrub, a hedge, a conifer or a flowering bush. */
export function shrub(ctx: Ctx, kind: 'round' | 'hedge' | 'cone' | 'flower', x: number, y: number, z: number, s = 1, seed = 1) {
  const B = ctx.body;
  switch (kind) {
    case 'round':
      B.box(x, y + 0.1 * s, z, 0.2, 0.2 * s, 0.2, '#6b4a32', { ao: 0 });
      B.blob(x, y + 0.65 * s, z, 0.7 * s, 0.6 * s, 0.7 * s, ['#5aa845', '#67b350', '#4f9a3f'][seed % 3], { seed });
      break;
    case 'hedge':
      B.box(x, y + 0.5 * s, z, 2.4 * s, 1.0 * s, 0.8, '#4f9a3f', { ao: 0.2 });
      B.blob(x, y + 1.0 * s, z, 1.3 * s, 0.35 * s, 0.5, '#5aa845', { seed });
      break;
    case 'cone':
      B.box(x, y + 0.2, z, 0.18, 0.4, 0.18, '#6b4a32', { ao: 0 });
      B.frustum(x, y + 0.4, z, 0.8 * s, 0.1, 2.2 * s, 7, '#3f8a45');
      break;
    case 'flower':
      B.blob(x, y + 0.45 * s, z, 0.6 * s, 0.45 * s, 0.6 * s, '#5aa845', { seed });
      for (let k = 0; k < 6; k++) B.blob(x + Math.cos(k * 1.05) * 0.4 * s, y + 0.65 * s + (k % 2) * 0.1, z + Math.sin(k * 1.05) * 0.4 * s, 0.14, 0.12, 0.14, ['#f08aac', '#ffe36a', '#ffffff', '#e86a8a'][k % 4], { jitter: 0.05, detail: 0, seed: seed + k });
      break;
  }
}

/** A potted plant on the pavement. */
export function pot(ctx: Ctx, x: number, y: number, z: number, seed = 1) {
  ctx.body.box(x, y + 0.2, z, 0.42, 0.4, 0.42, ['#b9704a', '#8a6a4a', '#9aa0a6'][seed % 3], { ao: 0.2 });
  ctx.body.blob(x, y + 0.65, z, 0.34, 0.3, 0.34, ['#5aa845', '#67b350', '#4f9a3f'][seed % 3], { seed });
}

/** A parked bicycle. */
export function bicycle(ctx: Ctx, x: number, y: number, z: number, yaw: number, color = '#4f7fd9') {
  const tmp = new (ctx.body.constructor as new () => GeoBuilder)();
  tmp.disc(0.0, 0.34, 0.5, 0.34, 0.05, 'x', '#222', 12);
  tmp.disc(0.0, 0.34, -0.5, 0.34, 0.05, 'x', '#222', 12);
  tmp.box(0, 0.62, 0, 0.05, 0.05, 1.0, color, { ao: 0 });
  tmp.box(0, 0.8, -0.22, 0.05, 0.4, 0.05, color, { ao: 0 });
  tmp.box(0, 1.02, -0.26, 0.12, 0.06, 0.26, '#222', { ao: 0 });
  tmp.box(0, 0.8, 0.48, 0.05, 0.9, 0.05, color, { ao: 0, noBottom: true });
  tmp.box(0, 1.12, 0.5, 0.55, 0.05, 0.05, '#222', { ao: 0 });
  tmp.box(0, 0.9, 0.62, 0.3, 0.2, 0.26, '#9aa0a6', { ao: 0 });
  ctx.body.appendTransformed(tmp, x, y, z, yaw);
}

/** A stone jizo statue in a red bib, with a small roof. */
export function jizo(ctx: Ctx, x: number, y: number, z: number, yaw = 0) {
  const tmp = new (ctx.body.constructor as new () => GeoBuilder)();
  tmp.box(0, 0.12, 0, 0.6, 0.24, 0.5, '#9a978f', { ao: 0.2 });
  tmp.frustum(0, 0.24, 0, 0.26, 0.17, 0.6, 7, '#a9a69d');
  tmp.blob(0, 1.0, 0, 0.17, 0.17, 0.17, '#b4b1a8', { jitter: 0.04 });
  tmp.box(0, 0.74, 0.1, 0.34, 0.2, 0.05, '#d8402a', { ao: 0 });
  ctx.body.appendTransformed(tmp, x, y, z, yaw);
}

/** A scarecrow among the paddies. */
export function scarecrow(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.box(x, y + 0.9, z, 0.08, 1.8, 0.08, '#7a5a3c', { ao: 0 });
  B.box(x, y + 1.35, z, 1.4, 0.08, 0.08, '#7a5a3c', { ao: 0 });
  B.box(x, y + 1.05, z, 0.5, 0.7, 0.3, '#3a5a8a', { ao: 0.1 });
  B.blob(x, y + 1.65, z, 0.2, 0.2, 0.2, '#e9d2a8', { jitter: 0.05 });
  B.frustum(x, y + 1.78, z, 0.45, 0.08, 0.28, 8, '#d8b86a', { ao: 0 });
}

/** A bus stop with a roof, a bench and a sign. */
export function busStop(ctx: Ctx, atlas: SignAtlas, x: number, y: number, z: number, yaw: number) {
  const tmp = new (ctx.body.constructor as new () => GeoBuilder)();
  for (const sx of [-1.2, 1.2]) tmp.box(sx, 1.2, -0.5, 0.1, 2.4, 0.1, '#5a6068', { ao: 0 });
  tmp.box(0, 2.45, -0.1, 3.0, 0.12, 1.4, '#3f9bd0', { ao: 0 });
  tmp.box(0, 1.3, -0.52, 2.4, 1.6, 0.05, '#bfe0ee', { ao: 0 });
  tmp.box(0, 0.5, -0.2, 2.0, 0.08, 0.5, '#8a6a46', { ao: 0.1 });
  for (const sx of [-0.9, 0.9]) tmp.box(sx, 0.25, -0.2, 0.08, 0.5, 0.4, '#5a6068', { ao: 0 });
  ctx.body.appendTransformed(tmp, x, y, z, yaw);
  roadSign(ctx, atlas, 'busStop', x + Math.cos((yaw * Math.PI) / 180) * 2.1, y, z - Math.sin((yaw * Math.PI) / 180) * 2.1, yaw, 2.6);
}

export { dk };

/** The green-and-white (or red) guard pipes along a pavement: bent posts and a striped top rail, from (x0,z0) to (x1,z1). */
export function guardPipe(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, color = '#4caf50') {
  const B = ctx.body;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.5) return;
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const yaw = (Math.atan2(-uz, ux) * 180) / Math.PI;
  const n = Math.max(2, Math.round(len / 0.4));
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const cx = x0 + (x1 - x0) * (t0 + t1) / 2, cz = z0 + (z1 - z0) * (t0 + t1) / 2;
    B.box(cx, y + 0.9, cz, len / n + 0.005, 0.07, 0.07, k % 2 ? '#f2f2ee' : color, { yaw, ao: 0 });
  }
  for (const t of [0, 1]) {
    const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    for (let k = 0; k < 4; k++) B.box(px, y + 0.11 + k * 0.22, pz, 0.08, 0.22, 0.08, k % 2 ? '#f2f2ee' : color, { ao: 0 });
  }
  B.box((x0 + x1) / 2, y + 0.5, (z0 + z1) / 2, len, 0.05, 0.05, '#f2f2ee', { yaw, ao: 0 });
}

/** A red fire hydrant. */
export function hydrant(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.frustum(x, y, z, 0.2, 0.17, 0.75, 10, '#d8322e');
  B.frustum(x, y + 0.75, z, 0.2, 0.05, 0.22, 10, '#c42a26');
  B.box(x, y + 0.5, z, 0.52, 0.12, 0.12, '#c42a26', { ao: 0 });
  B.box(x, y + 0.05, z, 0.4, 0.1, 0.4, '#a42420', { ao: 0 });
}

/** An orange traffic cone. */
export function cone(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.box(x, y + 0.03, z, 0.42, 0.06, 0.42, '#d86a1c', { ao: 0 });
  B.frustum(x, y + 0.06, z, 0.17, 0.03, 0.66, 10, '#f08a1c');
  B.frustum(x, y + 0.36, z, 0.115, 0.095, 0.1, 10, '#f4f4ee', { ao: 0 });
}

/** A traffic light: a pole, an arm over the road with a three-lamp head, and a walk signal. `yaw` points the lamps. */
/** A signal pole with its arm over the road and a walk signal on the pole. Its lamps are drawn dark; their lit faces go
 *  to the signal cycle (src/world/signals.ts) for `group`, the street whose traffic it shows. */
export function trafficLight(ctx: Ctx, x: number, y: number, z: number, yaw: number, arm: number, group: SignalGroup) {
  const tmp = newCtx(ctx.r);
  const B = tmp.body;
  B.box(0, 2.9, 0, 0.18, 5.8, 0.18, '#a9adb1', { ao: 0.1 });
  B.box(arm / 2, 5.5, 0, arm, 0.12, 0.12, '#a9adb1', { ao: 0 });
  B.box(arm - 0.2, 5.3, 0.15, 1.4, 0.42, 0.3, '#5a6066', { ao: 0.05 });
  const lit = (kind: Parameters<typeof lampFaces>[1], draw: (b: GeoBuilder) => void) => {
    const b = new (B.constructor as new () => GeoBuilder)();
    draw(b);
    lampFaces(group, kind).appendTransformed(b, x, y, z, yaw);
  };
  const lamps: ['green' | 'yellow' | 'red', string][] = [['green', '#2fd07a'], ['yellow', '#f2c230'], ['red', '#ff4a3a']];
  lamps.forEach(([kind, c], i) => {
    const lx = arm - 0.65 + i * 0.45;
    B.disc(lx, 5.3, 0.31, 0.16, 0.04, 'z', dk(c, 0.35), 12);
    lit(kind, (b) => b.disc(lx, 5.3, 0.325, 0.155, 0.02, 'z', dk(c, 1.6), 12));
    B.box(lx, 5.48, 0.38, 0.36, 0.04, 0.16, '#4a5056', { ao: 0 });
  });
  // the walk signal on the pole: red man above, green man below
  B.box(0.0, 2.6, 0.22, 0.36, 0.8, 0.22, '#5a6066', { ao: 0.05 });
  B.box(0.0, 2.8, 0.34, 0.24, 0.26, 0.02, '#5a2a28', { ao: 0 });
  B.box(0.0, 2.42, 0.34, 0.24, 0.26, 0.02, '#1f4a34', { ao: 0 });
  lit('walkRed', (b) => b.box(0.0, 2.8, 0.352, 0.22, 0.24, 0.01, dk('#ff4a3a', 1.5), { ao: 0 }));
  lit('walkGreen', (b) => b.box(0.0, 2.42, 0.352, 0.22, 0.24, 0.01, dk('#2fd07a', 1.5), { ao: 0 }));
  B.box(0, 1.2, 0.12, 0.2, 0.3, 0.12, '#e8e8e8', { ao: 0 }); // the push button box
  ctx.body.appendTransformed(tmp.body, x, y, z, yaw);
}

/** A red street lamp post with two hanging lanterns, as on old shopping streets. */
export function doubleLamp(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.box(x, y + 2.2, z, 0.14, 4.4, 0.14, '#c8322e', { ao: 0.1 });
  B.box(x, y + 0.15, z, 0.3, 0.3, 0.3, '#a42420', { ao: 0.1 });
  B.box(x, y + 4.0, z, 1.3, 0.08, 0.08, '#c8322e', { ao: 0 });
  for (const s of [-1, 1]) {
    ctx.litA.box(x + s * 0.55, y + 3.62, z, 0.3, 0.42, 0.3, '#fff4dc', { ao: 0 });
    B.frustum(x + s * 0.55, y + 3.83, z, 0.25, 0.08, 0.18, 4, '#c8322e', { rotate: 0.5 });
    B.box(x + s * 0.55, y + 3.38, z, 0.22, 0.06, 0.22, '#c8322e', { ao: 0 });
  }
  B.box(x, y + 2.6, z + 0.09, 0.3, 0.9, 0.03, '#2a5ea8', { ao: 0 }); // a little street name plate
}

/** A black classic street lamp. */
export function classicLamp(ctx: Ctx, x: number, y: number, z: number) {
  const B = ctx.body;
  B.box(x, y + 2.0, z, 0.12, 4.0, 0.12, '#2a2c30', { ao: 0.1 });
  B.box(x, y + 0.15, z, 0.26, 0.3, 0.26, '#2a2c30', { ao: 0.1 });
  ctx.litA.box(x, y + 4.25, z, 0.32, 0.42, 0.32, '#fff4dc', { ao: 0 });
  B.frustum(x, y + 4.46, z, 0.3, 0.06, 0.2, 4, '#2a2c30', { rotate: 0.5 });
  B.box(x, y + 4.03, z, 0.36, 0.05, 0.36, '#2a2c30', { ao: 0 });
}

/** A sign on a pole, any picture from the atlas (pedestrian crossing, no entry, arrows, parking...). */
export function signPole(ctx: Ctx, atlas: SignAtlas, name: string, x: number, y: number, z: number, yaw: number, h = 2.5, size = 0.65) {
  const c = atlas.get(name);
  const tmp = newCtx(ctx.r);
  tmp.body.box(0, h / 2, 0, 0.07, h, 0.07, '#9aa0a6', { ao: 0 });
  const sy = h - 0.1;
  for (const side of [1, -1]) {
    const zz = 0.06 * side;
    const uv: [number, number][] = side > 0 ? [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]] : [[c.u1, c.v0], [c.u0, c.v0], [c.u0, c.v1], [c.u1, c.v1]];
    tmp.sign.quadFacing([-size / 2, sy - size / 2, zz], [size / 2, sy - size / 2, zz], [size / 2, sy + size / 2, zz], [-size / 2, sy + size / 2, zz], [0, 0, side], [1, 1, 1], uv);
  }
  ctx.body.appendTransformed(tmp.body, x, y, z, yaw);
  ctx.sign.appendTransformed(tmp.sign, x, y, z, yaw);
}

/** A low wall of small blue-white tiles with a cap, from (x0,z0) to (x1,z1). */
export function tileFence(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, y: number, h = 1.2, color = '#cfe0e4') {
  const B = ctx.body;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.4) return;
  const yaw = (Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(cx, y + h / 2, cz, len, h, 0.24, color, { yaw, ao: 0.08 });
  B.box(cx, y + h + 0.05, cz, len + 0.04, 0.1, 0.3, '#e8ecee', { yaw, ao: 0 });
  const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  const px = -uz, pz = ux;
  const grout = new Color(color).multiplyScalar(0.8);
  for (const side of [1, -1]) {
    for (let k = 1; k < Math.floor(h / 0.24); k++) B.box(cx + px * 0.122 * side, y + k * 0.24, cz + pz * 0.122 * side, len, 0.02, 0.01, grout, { yaw, ao: 0 });
    for (let k = 1; k < Math.floor(len / 0.24); k++) B.box(x0 + ux * k * 0.24 + px * 0.122 * side, y + h / 2, z0 + uz * k * 0.24 + pz * 0.122 * side, 0.02, h, 0.01, grout, { yaw, ao: 0 });
  }
}

/** Bottle and can bins beside a vending machine. */
export function bins(ctx: Ctx, x: number, y: number, z: number) {
  for (let k = 0; k < 2; k++) {
    ctx.body.box(x + k * 0.42, y + 0.4, z, 0.36, 0.8, 0.36, k ? '#3a6ab8' : '#e8e8e8', { ao: 0.1 });
    ctx.body.box(x + k * 0.42, y + 0.82, z, 0.38, 0.06, 0.38, k ? '#2a4a8a' : '#c8c8c8', { ao: 0 });
  }
}

/** A stack of cardboard boxes. */
export function boxes(ctx: Ctx, x: number, y: number, z: number, n = 3) {
  for (let k = 0; k < n; k++) ctx.body.box(x + (k % 2) * 0.12, y + 0.22 + k * 0.42, z - (k % 2) * 0.1, 0.6 - k * 0.06, 0.42, 0.5 - k * 0.05, k % 2 ? '#c9a574' : '#b8925e', { ao: 0.1, yaw: k * 9 });
}

/** A sandwich board on the pavement with a menu. */
export function aBoard(ctx: Ctx, atlas: SignAtlas, name: string, x: number, y: number, z: number, yaw: number) {
  const c = atlas.get(name);
  const tmp = newCtx(ctx.r);
  tmp.body.box(0, 0.5, 0, 0.62, 1.0, 0.12, '#5a3a24', { ao: 0.1 });
  tmp.sign.quad([-0.27, 0.12, 0.065], [0.27, 0.12, 0.065], [0.27, 0.9, 0.065], [-0.27, 0.9, 0.065], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
  ctx.body.appendTransformed(tmp.body, x, y, z, yaw);
  ctx.sign.appendTransformed(tmp.sign, x, y, z, yaw);
}
