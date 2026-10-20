import { pick } from '../../util/rng';
import { GAS } from '../config';
import type { Cell, SignAtlas } from '../signs';
import { raiseSkyline } from '../skyline';
import type { Ctx } from './frame';
import { bins, parkedVehicle, vendingMachine } from './props';

/**
 * A Japanese self-service gas station by the frontage road: a levelled concrete lot with a curb and two entrances, a big
 * canopy with an orange brand fascia and a lit underside, three pump islands with dispensers for regular, high-octane
 * and diesel, a kiosk, a drive-through car wash, a price tower by the road, SELF flags and the usual odds and ends.
 * The road is on the north side (-z), so everything faces it.
 */

/** A picture on a board in the plane z = const, facing ±z. */
function boardZ(ctx: Ctx, c: Cell, x: number, y: number, z: number, w: number, h: number, s: 1 | -1) {
  const xl = s > 0 ? x - w / 2 : x + w / 2, xr = s > 0 ? x + w / 2 : x - w / 2;
  const zz = z + s * 0.005;
  ctx.sign.quadFacing([xl, y - h / 2, zz], [xr, y - h / 2, zz], [xr, y + h / 2, zz], [xl, y + h / 2, zz], [0, 0, s], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
}

export function buildGasStation(at: (x: number) => Ctx, atlas: SignAtlas, r: () => number) {
  const ctx = at((GAS.x0 + GAS.x1) / 2), B = ctx.body;
  const y = GAS.y, cx = (GAS.x0 + GAS.x1) / 2, cz = (GAS.z0 + GAS.z1) / 2, W = GAS.x1 - GAS.x0, D = GAS.z1 - GAS.z0;
  // the lot: a concrete slab with joints, a curb along the road with two openings, and a strip of planting at the back
  B.box(cx, y - 0.75, cz, W, 1.5, D, '#a9a59b', { ao: 0.1 });
  B.box(cx, y + 0.005, cz, W - 0.1, 0.01, D - 0.1, '#cdcac1', { ao: 0 });
  for (let x = GAS.x0 + 4; x < GAS.x1; x += 4) B.box(x, y + 0.012, cz, 0.04, 0.01, D - 0.2, '#b0ada4', { ao: 0 });
  for (let z = GAS.z0 + 4; z < GAS.z1; z += 4) B.box(cx, y + 0.012, z, W - 0.2, 0.01, 0.04, '#b0ada4', { ao: 0 });
  const gaps: [number, number][] = [[-61, -54], [-42, -35]];
  let x = GAS.x0;
  for (const [a, b] of [...gaps, [GAS.x1, GAS.x1]]) {
    if (a > x) B.box((x + a) / 2, y + 0.1, GAS.z0 + 0.15, a - x, 0.2, 0.3, '#e2ded4', { ao: 0.05 });
    x = b;
  }
  B.box(cx, y + 0.2, GAS.z1 - 0.4, W - 0.2, 0.4, 0.8, '#8f8a7e', { ao: 0.1 });
  for (let x = GAS.x0 + 1; x < GAS.x1 - 0.5; x += 1.4) B.blob(x, y + 0.6, GAS.z1 - 0.4, 0.55, 0.4, 0.45, pick(r, ['#4f9a3f', '#5aa845', '#67b350']), { seed: Math.floor(x * 3) });
  // painted arrows in and out
  for (const [ax, dir] of [[-57.5, 1], [-38.5, -1]] as const) {
    B.box(ax, y + 0.02, GAS.z0 + 2.6, 0.35, 0.02, 2.4, '#f4f2ea', { ao: 0 });
    for (const s of [-1, 1]) B.box(ax + s * 0.35, y + 0.02, GAS.z0 + 2.6 + dir * 1.3, 0.25, 0.02, 0.7, '#f4f2ea', { ao: 0, yaw: s * dir * 40 });
  }

  // the canopy: columns on the islands, a deep roof, the brand fascia all round and lit panels underneath
  const kx = -48.5, kz = 138.5, cw = 21, cd = 11.5, ch = 5.6;
  B.box(kx, y + ch + 0.45, kz, cw, 0.9, cd, '#f4f4ee', { ao: 0 });
  B.box(kx, y + ch + 0.95, kz, cw + 0.1, 0.12, cd + 0.1, '#d8d6ce', { ao: 0 });
  for (const s of [-1, 1] as const) {
    B.box(kx, y + ch + 0.42, kz + s * (cd / 2 + 0.02), cw, 0.82, 0.04, '#e8501e', { ao: 0 });
    boardZ(ctx, atlas.get('gasBrand'), kx, y + ch + 0.45, kz + s * (cd / 2 + 0.05), 3.4, 0.85, s);
    B.box(kx + s * (cw / 2 + 0.02), y + ch + 0.42, kz, 0.04, 0.82, cd, '#e8501e', { ao: 0 });
  }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) ctx.litB.box(kx - 7.5 + i * 5, y + ch - 0.02, kz - 2.6 + k * 5.2, 3.2, 0.04, 1.4, '#ffffff', { ao: 0 });
  // three pump islands along the driving direction, each with two dispensers
  for (const ix of [-55.5, -48.5, -41.5]) {
    B.box(ix, y + 0.1, kz, 1.3, 0.2, 7.0, '#d8d4c8', { ao: 0.1 });
    for (const e of [-1, 1]) {
      B.box(ix, y + 0.45, kz + e * 3.75, 0.5, 0.9, 0.5, '#f2c230', { ao: 0 });
      B.box(ix, y + 0.55, kz + e * 3.75, 0.52, 0.18, 0.52, '#2a2a2a', { ao: 0 });
    }
    B.box(ix, y + 0.2 + ch / 2, kz, 0.5, ch, 0.5, '#e8e6de', { ao: 0.05 });
    for (const e of [-1.7, 1.7]) {
      const dz = kz + e;
      B.box(ix, y + 1.05, dz, 0.75, 1.7, 1.1, '#f4f4ee', { ao: 0.1 });
      B.box(ix, y + 1.95, dz, 0.8, 0.12, 1.15, '#e8501e', { ao: 0 });
      ctx.litB.box(ix, y + 1.5, dz, 0.77, 0.32, 0.5, '#d8f0ff', { ao: 0 });
      // the nozzles in their holsters on both sides: regular red, high-octane yellow, diesel green
      for (const sx of [-1, 1]) {
        ['#d8322e', '#f2c230', '#2f9a4a'].forEach((c, n) => B.box(ix + sx * 0.4, y + 1.0, dz - 0.35 + n * 0.35, 0.06, 0.32, 0.18, c, { ao: 0 }));
        B.cable([[ix + sx * 0.42, y + 1.0, dz], [ix + sx * 0.6, y + 0.4, dz + 0.2], [ix + sx * 0.45, y + 0.25, dz + 0.5]], 0.03, '#2a2a2a');
      }
    }
    // a water bucket and a paper towel stand at one end
    B.frustum(ix, y + 0.2, kz + 4.4, 0.18, 0.2, 0.3, 8, '#3a7ad8', { ao: 0 });
  }
  // cars filling up
  parkedVehicle(ctx, pick(r, ['car', 'kei', 'van'] as const), pick(r, ['#f4f4ee', '#3a4a6a', '#7a2a2e']), -52, y + 0.02, kz + 0.4, 90);
  parkedVehicle(ctx, pick(r, ['car', 'keivan'] as const), pick(r, ['#d8d8d0', '#2f2f35', '#5a7a9a']), -45, y + 0.02, kz - 0.6, 90);

  // the kiosk at the back: a glass front, an orange band, a SELF sign, a vending machine and an air tower
  const sx = -57, sz = 147.6;
  B.box(sx, y + 1.7, sz, 11, 3.4, 5.4, '#f4f2ec', { ao: 0.12 });
  B.box(sx, y + 3.45, sz, 11.2, 0.12, 5.6, '#8f9296', { ao: 0 });
  for (const s of [-1, 1]) {
    B.box(sx, y + 3.5, sz + s * 2.85, 11.4, 0.45, 0.1, '#e8501e', { ao: 0 });
    B.box(sx + s * 5.65, y + 3.5, sz, 0.1, 0.45, 5.8, '#e8501e', { ao: 0 });
  }
  B.box(sx + 3, y + 3.9, sz + 0.8, 1.6, 0.7, 1.0, '#cfd3d6', { ao: 0.1 });
  ctx.win.box(sx + 0.8, y + 1.45, sz - 2.71, 8.0, 2.3, 0.04, '#9ec4dc', { ao: 0 });
  for (let k = 0; k < 5; k++) B.box(sx - 3.2 + k * 2.0, y + 1.45, sz - 2.73, 0.08, 2.3, 0.04, '#8a9096', { ao: 0 });
  B.box(sx - 4.4, y + 1.1, sz - 2.72, 1.0, 2.2, 0.04, '#5a6068', { ao: 0 });
  boardZ(ctx, atlas.get('gasBrand'), sx, y + 3.5, sz - 2.92, 3.0, 0.75, -1);
  vendingMachine(ctx, atlas, sx + 6.0, y, sz - 2.0, 180, 'vendRed');
  bins(ctx, sx + 6.0, y, sz - 0.8);
  B.box(sx - 6.4, y + 0.8, sz - 2.4, 0.5, 1.6, 0.4, '#d8322e', { ao: 0.05 });
  B.box(sx - 6.4, y + 1.7, sz - 2.4, 0.6, 0.2, 0.5, '#2a2a2a', { ao: 0 });
  for (let k = 0; k < 6; k++) B.disc(sx - 6.4 + (k % 3) * 0.5, y + 0.35 + Math.floor(k / 3) * 0.7, sz - 1.2, 0.33, 0.22, 'x', '#2a2a2a', 12);
  // the car wash: a gantry with two upright brushes and one across the top
  const wx = -41.5, wz = 148;
  B.box(wx, y + 0.02, wz, 5.0, 0.04, 6.5, '#9aa0a6', { ao: 0 });
  for (const s of [-1, 1]) for (const e of [-1, 1]) B.box(wx + s * 1.9, y + 1.6, wz + e * 0.6, 0.25, 3.2, 0.25, '#e8e8e2', { ao: 0.05 });
  B.box(wx, y + 3.3, wz, 4.2, 0.35, 1.6, '#e8e8e2', { ao: 0 });
  for (const s of [-1, 1]) B.frustum(wx + s * 1.3, y + 0.2, wz, 0.42, 0.42, 2.8, 10, '#2a7ad8', { ao: 0.1 });
  B.box(wx, y + 2.9, wz, 2.4, 0.6, 0.6, '#3a8ae0', { ao: 0 });
  boardZ(ctx, atlas.get('carWash'), wx, y + 4.1, wz - 0.85, 1.1, 1.1, -1);
  B.box(wx, y + 3.55, wz - 0.8, 0.08, 0.5, 0.08, '#8a9096', { ao: 0 });
  parkedVehicle(ctx, 'car', pick(r, ['#f4f4ee', '#d94f4f']), wx, y + 0.04, wz + 0.3, 90);

  // the price tower by the road and SELF flags along the curb
  const px = -34.5, pz = 132.2;
  B.box(px, y + 0.3, pz, 1.6, 0.6, 1.0, '#8f8a7e', { ao: 0.1 });
  B.box(px, y + 3.6, pz, 0.5, 6.4, 0.5, '#e8e6de', { ao: 0.05 });
  B.box(px, y + 5.4, pz, 2.7, 2.7, 0.3, '#1a1a1a', { ao: 0 });
  for (const s of [-1, 1] as const) boardZ(ctx, atlas.get('gasPrice'), px, y + 5.4, pz + s * 0.16, 2.5, 2.5, s);
  B.box(px, y + 7.1, pz, 2.7, 0.7, 0.4, '#e8501e', { ao: 0 });
  for (const s of [-1, 1] as const) boardZ(ctx, atlas.get('gasBrand'), px, y + 7.1, pz + s * 0.21, 2.6, 0.65, s);
  const flag = atlas.get('selfFlag');
  for (const fx of [-63, -52.5, -45, -33.6]) {
    B.box(fx, y + 1.5, GAS.z0 + 0.5, 0.04, 3.0, 0.04, '#d8d8d8', { ao: 0 });
    for (const s of [-1, 1] as const) {
      const fz = GAS.z0 + 0.5 + s * 0.01;
      const xl = s > 0 ? fx + 0.02 : fx + 0.62, xr = s > 0 ? fx + 0.62 : fx + 0.02;
      ctx.sign.quadFacing([xl, y + 1.75, fz], [xr, y + 1.75, fz], [xr, y + 2.95, fz], [xl, y + 2.95, fz], [0, 0, s], [1, 1, 1], [[flag.u0, flag.v0], [flag.u1, flag.v0], [flag.u1, flag.v1], [flag.u0, flag.v1]]);
    }
  }
  // the underground tank lids and a lamp at each entrance
  for (let k = 0; k < 3; k++) B.disc(-60 + k * 1.6, y + 0.02, 143.2, 0.4, 0.03, 'y', '#5a5e64', 12);
  for (const lx of [-62.5, -35.5]) {
    B.box(lx, y + 3, GAS.z0 + 0.6, 0.15, 6, 0.15, '#8a9096', { ao: 0 });
    ctx.litB.box(lx, y + 6.05, GAS.z0 + 1.0, 0.4, 0.12, 0.8, '#ffffff', { ao: 0 });
  }
  raiseSkyline(kx - cw / 2, kz - cd / 2, kx + cw / 2, kz + cd / 2, y + ch + 1.5);
  raiseSkyline(px - 1.5, pz - 1, px + 1.5, pz + 1, y + 8);
}
