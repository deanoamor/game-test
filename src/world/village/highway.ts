import { smoothstep } from '../../util/rng';
import { EXPRESSWAY, IC, IC_RAMP, UNDERPASS, getRoad, icRampY, inPaddy, naturalHeight, roadNear } from '../config';
import type { Cell, SignAtlas } from '../signs';
import { raiseSkyline } from '../skyline';
import type { Ctx } from './frame';
import { fence, wallSeg } from './ground';

/**
 * The expressway (高速道路): a four-lane deck on piers with concrete barriers, sound walls, a median, lane markings,
 * lights and green sign gantries, running on an embankment where it cuts through the hills. Below it the Hoshinomachi
 * IC: a toll plaza with ETC and general booths under a canopy, and two ramps on the eastbound side, an off-ramp coming
 * down from the west and an on-ramp climbing away to the east. Traffic keeps left: eastbound on the north half.
 */

const CONCRETE = '#a7a9ac', BARRIER = '#cfccc4', ASPH = '#3e4146', WHITE = '#eeece4';
const E = EXPRESSWAY;

/** A sign board in the plane x = const, facing ±x (s = -1 is seen by traffic heading +x). */
function boardX(ctx: Ctx, c: Cell, x: number, y: number, z: number, w: number, h: number, s: 1 | -1, frame = '#e8e8e2') {
  ctx.body.box(x - s * 0.06, y, z, 0.1, h + 0.12, w + 0.12, frame, { ao: 0 });
  const zl = s < 0 ? z - w / 2 : z + w / 2, zr = s < 0 ? z + w / 2 : z - w / 2;
  const xx = x + s * 0.005;
  ctx.sign.quadFacing([xx, y - h / 2, zl], [xx, y - h / 2, zr], [xx, y + h / 2, zr], [xx, y + h / 2, zl], [s, 0, 0], [1, 1, 1], [[c.u0, c.v0], [c.u1, c.v0], [c.u1, c.v1], [c.u0, c.v1]]);
}

export function buildExpressway(at: (x: number) => Ctx, atlas: SignAtlas) {
  const zc = E.z, y = E.y, H = E.half;
  const step = 5;
  const merge = (x: number) => Math.abs(x) > IC_RAMP.end - 2 && Math.abs(x) < IC_RAMP.end + 36;
  for (let x0 = E.x0; x0 < E.x1; x0 += step) {
    const x1 = x0 + step, xm = (x0 + x1) / 2;
    const B = at(xm).body;
    const g = Math.min(naturalHeight(xm, zc - H), naturalHeight(xm, zc), naturalHeight(xm, zc + H));
    // the deck: on a girder where it stands high, on a solid embankment where the ground comes up close
    B.box(xm, y - 0.3, zc, step + 0.02, 0.6, H * 2, CONCRETE, { ao: 0 });
    B.box(xm, y + 0.01, zc, step + 0.02, 0.02, H * 2 - 0.8, ASPH, { ao: 0 });
    if (g > y - 3.2) B.box(xm, (g - 0.8 + y - 0.6) / 2, zc, step + 0.02, y - 0.6 - (g - 0.8), H * 2 - 0.4, '#8f8b80', { ao: 0.2 });
    else B.box(xm, y - 1.3, zc, step + 0.02, 1.4, H * 2 - 6, '#868a8f', { ao: 0.1 });
    // barriers along both edges (the north one opens where the ramps merge), sound walls near the town, the median
    for (const s of [-1, 1]) {
      if (s < 0 && merge(xm)) continue;
      B.box(xm, y + 0.5, zc + s * (H - 0.2), step + 0.02, 1.0, 0.4, BARRIER, { ao: 0.05 });
      if (Math.abs(xm) < 175) {
        B.box(xm, y + 2.0, zc + s * (H - 0.15), step - 0.1, 2.0, 0.08, '#9fbdbd', { ao: 0 });
        B.box(x0, y + 2.0, zc + s * (H - 0.15), 0.16, 2.1, 0.22, '#6f767c', { ao: 0 });
      }
    }
    B.box(xm, y + 0.4, zc, step + 0.02, 0.8, 0.6, BARRIER, { ao: 0.05 });
    // lane markings: edge lines, lines by the median, dashes between the lanes
    for (const s of [-1, 1]) {
      if (!(s < 0 && merge(xm))) B.box(xm, y + 0.03, zc + s * (H - 0.75), step + 0.02, 0.02, 0.15, WHITE, { ao: 0 });
      B.box(xm, y + 0.03, zc + s * 0.6, step + 0.02, 0.02, 0.15, WHITE, { ao: 0 });
      if (Math.floor((x0 - E.x0) / step) % 4 < 2) B.box(xm, y + 0.03, zc + s * 4.1, step, 0.02, 0.15, WHITE, { ao: 0 });
    }
    raiseSkyline(x0, zc - H, x1, zc + H, y + 3);
  }
  // the piers
  for (let x = E.x0 + 10; x < E.x1; x += 25) {
    const g = naturalHeight(x, zc);
    if (g > y - 3.2) continue;
    const B = at(x).body;
    B.box(x, g + 0.2, zc, 4.4, 0.4, 5.5, '#9a9c9e', { ao: 0.1 });
    B.box(x, (g + y - 2.4) / 2, zc, 2.2, y - 2.4 - g, 3.0, '#b3b5b8', { ao: 0.18 });
    B.box(x, y - 2.4, zc, 2.4, 0.9, H * 2 - 2, '#a9abae', { ao: 0.1 });
  }
  // lights on the median and sign gantries
  for (let x = E.x0 + 20; x < E.x1; x += 40) {
    const B = at(x).body;
    B.box(x, y + 4.4, zc, 0.18, 7.2, 0.18, '#8a9096', { ao: 0 });
    B.box(x, y + 7.9, zc, 0.12, 0.12, 5.4, '#8a9096', { ao: 0 });
    for (const s of [-1, 1]) at(x).litB.box(x, y + 7.75, zc + s * 2.6, 0.5, 0.12, 0.9, '#ffffff', { ao: 0 });
  }
  const gantry = (x: number, s: 1 | -1, signs: [string, number][]) => {
    const ctx = at(x), B = ctx.body;
    const za = zc + s * 0.6, zb = zc + s * (H - 0.1);
    for (const z of [za, zb]) B.box(x, y + 3.6, z, 0.4, 7.2, 0.4, '#8a9096', { ao: 0.05 });
    B.box(x, y + 7.1, (za + zb) / 2, 0.5, 0.5, Math.abs(zb - za) + 0.4, '#8a9096', { ao: 0 });
    // traffic heading +x on the north half sees the face toward -x; heading -x on the south half sees +x
    const face = (s < 0 ? -1 : 1) as 1 | -1;
    for (const [name, z] of signs) {
      const c = atlas.get(name);
      const h = c.aspect > 2 ? 1.8 : 1.4, w = h * c.aspect;
      boardX(ctx, c, x + face * 0.3, y + 5.6, zc + s * z, w, h, face);
    }
  };
  gantry(-210, -1, [['hwDir', 4.0]]);
  gantry(-110, -1, [['hwExit', 4.2], ['e1', 1.2]]);
  gantry(40, -1, [['hwDir', 4.0]]);
  gantry(200, -1, [['hwSpeed', 4.2]]);
  gantry(120, 1, [['hwDir', 4.0], ['e1', 7.0]]);
  gantry(-60, 1, [['hwDir', 4.0]]);

  // the ramps: off from the west, on to the east, both along the north side of the deck
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let a = IC.x1; a <= IC_RAMP.end + 36; a += 3) {
      const z = IC_RAMP.z + (zc - H + IC_RAMP.half + 0.6 - IC_RAMP.z) * smoothstep(IC_RAMP.end, IC_RAMP.end + 36, a);
      pts.push([s * a, z]);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const [xa, za] = pts[k], [xb, zb] = pts[k + 1];
      const ya = icRampY(xa), yb = icRampY(xb);
      const B = at(xa).body;
      const ga = naturalHeight(xa, za), gb = naturalHeight(xb, zb);
      const low = ya - ga < 3.2 || yb - gb < 3.2;
      wallSeg(B, xa, za, xb, zb, low ? Math.min(ga, gb) - 0.8 : ya - 0.6, ya, low ? Math.min(ga, gb) - 0.8 : yb - 0.6, yb, IC_RAMP.half * 2, low ? '#9a968b' : CONCRETE, ASPH);
      const dx = xb - xa, dz = zb - za, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
      for (const side of [-1, 1]) {
        const off = side * (IC_RAMP.half - 0.2);
        // the inner barrier opens where the ramp joins the deck
        if (!(side * Math.sign(nz) > 0 && Math.abs(xa) > IC_RAMP.end + 4)) wallSeg(B, xa + nx * off, za + nz * off, xb + nx * off, zb + nz * off, ya, ya + 1.0, yb, yb + 1.0, 0.35, BARRIER, BARRIER);
        const lo = side * (IC_RAMP.half - 0.7);
        wallSeg(B, xa + nx * lo, za + nz * lo, xb + nx * lo, zb + nz * lo, ya + 0.01, ya + 0.03, yb + 0.01, yb + 0.03, 0.15, WHITE, WHITE);
      }
      if (!low && k % 7 === 3 && !inPaddy(xa, za)) {
        B.box(xa, (ga + ya - 0.6) / 2, za, 1.6, ya - 0.6 - ga, 1.6, '#b3b5b8', { ao: 0.18 });
        B.box(xa, ya - 0.9, za, 1.8, 0.6, IC_RAMP.half * 2 - 0.6, '#a9abae', { ao: 0.1 });
      }
      raiseSkyline(Math.min(xa, xb), Math.min(za, zb) - IC_RAMP.half, Math.max(xa, xb), Math.max(za, zb) + IC_RAMP.half, Math.max(ya, yb) + 2);
    }
  }

  // the toll plaza: a levelled apron, the booths and canopies at the foot of both ramps, a small office
  {
    const ctx = at(0), B = ctx.body;
    const cz = (IC.z0 + IC.z1) / 2, py = IC.y;
    B.box(0, py - 0.9, cz, IC.x1 - IC.x0, 1.8, IC.z1 - IC.z0, '#9a968b', { ao: 0.1 });
    B.box(0, py + 0.005, cz, IC.x1 - IC.x0 - 0.2, 0.01, IC.z1 - IC.z0 - 0.2, ASPH, { ao: 0 });
    // the lanes through the toll gate and their markings
    const lanes = 3, lw = (IC_RAMP.half * 2) / lanes, z0 = IC_RAMP.z - IC_RAMP.half;
    for (const s of [-1, 1]) {
      const xg = s * (IC.x1 - 5);
      for (let k = 0; k <= lanes; k++) {
        const z = z0 + k * lw;
        // an island with a booth (and a barrier arm on the ETC lanes)
        B.box(xg, py + 0.12, z, 5.0, 0.24, 0.7, '#d8d4c8', { ao: 0.1 });
        for (const e of [-2.5, 2.5]) B.box(xg + e, py + 0.3, z, 0.3, 0.6, 0.6, k % 2 ? '#f2c230' : '#2a2a2a', { ao: 0 });
        if (k > 0 && k < lanes) {
          B.box(xg, py + 1.3, z, 1.6, 2.2, 0.62, '#f4f4ee', { ao: 0.08 });
          ctx.win.box(xg, py + 1.6, z, 1.62, 0.8, 0.5, '#9ec4dc', { ao: 0 });
          B.box(xg, py + 2.5, z, 1.8, 0.12, 0.8, '#5a6068', { ao: 0 });
        }
        if (k < lanes) {
          const zl = z + lw / 2;
          B.box(xg - 2.2, py + 1.0, z + 0.35, 0.12, 0.12, lw - 0.5, k === 1 ? '#f4f4ee' : '#f2c230', { ao: 0 });
          boardX(ctx, atlas.get(k === 1 ? 'ippan' : 'etc'), xg - 2.6, py + 4.7, zl, 1.0, 1.0, -1, '#e8e8e2');
        }
      }
      // the canopy, with the name of the toll gate along its front
      B.box(xg, py + 5.5, IC_RAMP.z, 6.0, 0.5, IC_RAMP.half * 2 + 1.6, '#e8e6de', { ao: 0 });
      B.box(xg - 3.0, py + 5.5, IC_RAMP.z, 0.1, 0.7, IC_RAMP.half * 2 + 1.7, '#1c7a4a', { ao: 0 });
      for (const z of [z0 - 0.5, z0 + IC_RAMP.half * 2 + 0.5]) B.box(xg, py + 2.7, z, 0.4, 5.4, 0.4, '#c8c6be', { ao: 0.05 });
      boardX(ctx, atlas.get('tollGate'), xg - 3.06, py + 6.4, IC_RAMP.z, 4.4, 1.1, -1, '#1c7a4a');
      for (let k = 0; k < lanes; k++) ctx.litB.box(xg, py + 5.22, z0 + (k + 0.5) * lw, 3.0, 0.06, 0.3, '#ffffff', { ao: 0 });
      raiseSkyline(xg - 3, IC_RAMP.z - IC_RAMP.half - 1, xg + 3, IC_RAMP.z + IC_RAMP.half + 1, py + 7);
    }
    // a small office of the toll gate by the frontage road, and two tall lights
    const ox = IC.x0 + 5;
    B.box(ox, py + 1.6, IC.z0 + 1.6, 7.0, 3.2, 2.6, '#e8e4d8', { ao: 0.12 });
    B.box(ox, py + 3.3, IC.z0 + 1.6, 7.4, 0.2, 3.0, '#5a6068', { ao: 0 });
    for (let k = 0; k < 4; k++) ctx.win.box(ox - 2.4 + k * 1.6, py + 1.9, IC.z0 + 2.92, 1.1, 1.0, 0.04, '#9ec4dc', { ao: 0 });
    for (const s of [-1, 1]) {
      B.box(s * 5, py + 4.5, IC.z0 + 1.0, 0.2, 9, 0.2, '#8a9096', { ao: 0 });
      ctx.litB.box(s * 5, py + 9.05, IC.z0 + 1.0, 0.9, 0.15, 0.5, '#ffffff', { ao: 0 });
    }
    // the entrance: lane arrows from the access road and a green board pointing to the gates
    for (const s of [-1, 1]) B.box(s * 1.75, py + 0.02, IC.z0 + 4, 0.5, 0.02, 2.5, WHITE, { ao: 0 });
    // painted arrows to the ramps
    for (const s of [-1, 1]) B.box(s * 3.25, py + 0.02, IC_RAMP.z, 2.5, 0.02, 0.5, WHITE, { ao: 0 });
    raiseSkyline(ox - 4, IC.z0, ox + 4, IC.z0 + 3, py + 4);
  }
}

/**
 * The underpass: the frontage road runs down between concrete U-walls (with a walkway, lights and a fence along the
 * top), under a short bridge that carries the cross street; behind the walls the ground stays at its own level.
 */
export function buildUnderpass(at: (x: number) => Ctx) {
  const U = UNDERPASS;
  // heights interpolated between the road samples (the frontage runs along x here, the cross street along z)
  const along = (name: string, key: 'x' | 'z', v: number) => {
    const r = getRoad(name), a = r[key];
    for (let i = 0; i < r.len - 1; i++) {
      const lo = Math.min(a[i], a[i + 1]), hi = Math.max(a[i], a[i + 1]);
      if (v >= lo && v <= hi && hi > lo) return r.y[i] + ((r.y[i + 1] - r.y[i]) * (v - a[i])) / (a[i + 1] - a[i]);
    }
    return roadNear(key === 'x' ? v : U.x, key === 'z' ? v : U.z, (n) => n === name).y;
  };
  const fy = (x: number) => along('frontage', 'x', x);
  const cy = (z: number) => along('cross', 'z', z);
  const step = 2;
  for (let x0 = U.x - U.half; x0 < U.x + U.half - 0.01; x0 += step) {
    const x1 = x0 + step, xm = (x0 + x1) / 2;
    const B = at(xm).body;
    const ya = fy(x0), yb = fy(x1);
    for (const s of [-1, 1]) {
      const zo = U.z + s * (U.fill + 0.3);
      let ta = naturalHeight(x0, zo), tb = naturalHeight(x1, zo);
      // under the bridge the wall and the fill stop below the deck (which follows the cross street's slope)
      if (Math.abs(xm - U.x) < 5.2) ta = tb = Math.min(cy(U.z + s * U.wall), cy(U.z + s * (U.fill + 0.3))) - 1.2;
      // the wall with its cap, the fill behind it (its top is the ground), the walkway at its foot
      wallSeg(B, x0, U.z + s * (U.wall + 0.25), x1, U.z + s * (U.wall + 0.25), ya - 0.6, ta + 0.15, yb - 0.6, tb + 0.15, 0.5, '#b9b6ad', '#d2cfc6');
      wallSeg(B, x0, U.z + s * (U.wall + 0.5 + (U.fill - U.wall - 0.5) / 2), x1, U.z + s * (U.wall + 0.5 + (U.fill - U.wall - 0.5) / 2), ya - 0.6, ta, yb - 0.6, tb, U.fill - U.wall - 0.5, '#a9a69c', Math.abs(xm - U.x) < 4.6 ? '#7d7a72' : '#86b24e');
      wallSeg(B, x0, U.z + s * 3.85, x1, U.z + s * 3.85, ya - 0.5, ya + 0.15, yb - 0.5, yb + 0.15, 0.7, '#c4c0b6', '#cfcbc0');
      if (ta - ya > 1.2 && Math.abs(xm - U.x) > 5.2) fence(at(xm), x0, U.z + s * (U.wall + 0.4), ta + 0.15, x1, U.z + s * (U.wall + 0.4), tb + 0.15, 1.0, '#7d8a80');
      // lights on the wall faces, and a dark band of damp at the foot
      if (Math.round(x0) % 8 === 0 && ta - ya > 2.5) at(xm).litB.box(xm, ya + 3.0, U.z + s * (U.wall - 0.02), 1.2, 0.12, 0.08, '#ffffff', { ao: 0 });
      B.box(xm, (ya + yb) / 2 + 0.45, U.z + s * (U.wall - 0.005), step, 0.3, 0.01, '#8f8c84', { ao: 0 });
    }
  }
  // the bridge: a deck following the cross street's slope, parapets with a rail, a name plate
  const B = at(U.x).body;
  const z0 = U.z - U.fill - 0.3, z1 = U.z + U.fill + 0.3;
  for (let za = z0; za < z1 - 0.01; za += 1) {
    const zb = Math.min(z1, za + 1), ya = cy(za), yb = cy(zb);
    wallSeg(B, U.x, za, U.x, zb, ya - 1.0, ya - 0.01, yb - 1.0, yb - 0.01, 9.2, '#b3b0a7', '#9a978f');
    for (const s of [-1, 1]) {
      wallSeg(B, U.x + s * 4.4, za, U.x + s * 4.4, zb, ya - 0.02, ya + 0.95, yb - 0.02, yb + 0.95, 0.4, '#c9c6bd', '#d6d3ca');
      wallSeg(B, U.x + s * 4.4, za, U.x + s * 4.4, zb, ya + 0.95, ya + 1.1, yb + 0.95, yb + 1.1, 0.12, '#8a9096', '#8a9096');
    }
  }
  for (const s of [-1, 1]) B.box(U.x + s * 4.62, cy(U.z) + 0.5, U.z, 0.04, 0.3, 1.2, '#2f6a4a', { ao: 0 });
  raiseSkyline(U.x - 5, z0, U.x + 5, z1, cy(U.z) + 2);
}
