import { Color, type ColorRepresentation } from 'three';
import type { V3 } from '../../util/builder';
import { rampY } from '../../world/config';
import { STREET, type DetailKit } from '../../world/village';
import type { Ctx } from '../../world/village/frame';
import { bench, board, nobori } from '../../world/village/fillers';
import { boxes, pot, shrub } from '../../world/village/props';

/**
 * World 1's own details: the camera is close to the street here, so the crossing gets what you would see standing on
 * it. Road paint (lane arrows, stop lines, crosswalk-ahead diamonds), manholes and patched asphalt;
 * a red postbox, a green phone, a koban-style notice board; nobori flags, red lanterns and crates at the
 * izakaya, a planter at the café, a delivery scooter at the ramen shop; pigeons, a cat, shop-street
 * banners on the lamps, utility cabinets along the cross street.
 *
 * Coordinates are the town's: the main street runs along x at z = 44, the cross street along z at x = 0.
 */

const { Y_M, SW, MAIN_Z, MAIN_HALF, WALK, CROSS_HALF, CROSS_WALK } = STREET;
const N_IN = MAIN_Z - MAIN_HALF, S_IN = MAIN_Z + MAIN_HALF; // the main street's curbs
const N_FRONT = N_IN - WALK + 0.25, S_FRONT = S_IN + WALK - 0.25; // along the shop fronts
const PAINT = '#f4f2ea';
const rgb = (c: ColorRepresentation): [number, number, number] => new Color(c).toArray() as [number, number, number];
/** The top of the cross street's pavement (it climbs with the ramps), and its road. */
const crossWalkY = (z: number) => rampY(z) + 0.17;
const crossRoadY = (z: number) => rampY(z) + 0.075;

export function ekimaeDetails(k: DetailKit) {
  roadPaint(k);
  manholes(k);
  cornerShop(k);
  izakaya(k);
  ramenFront(k);
  pavementLife(k);
  crossStreet(k);
  lampBanners(k);
  neonBlades(k);
}

// ---------------------------------------------------------------------------------------------------------------
// the road
// ---------------------------------------------------------------------------------------------------------------

/** A flat triangle on the road (both windings, so it shows whichever way it lies). */
function flatTri(c: Ctx, a: V3, b: V3, d: V3, col: string) {
  const k = rgb(col);
  c.body.tri(a, b, d, k);
  c.body.tri(a, d, b, k);
}

/** A straight-ahead lane arrow, pointing along local +z. */
function arrow(c: Ctx, len = 3.2) {
  c.body.box(0, 0.006, -0.35, 0.16, 0.012, len - 1.1, PAINT, { ao: 0 });
  flatTri(c, [-0.42, 0.012, len / 2 - 1.0], [0.42, 0.012, len / 2 - 1.0], [0, 0.012, len / 2], PAINT);
}

/** The ◇ that warns of a crosswalk ahead: an outline of four thin bars. */
function diamond(c: Ctx) {
  const L = 2.2, W = 0.75;
  const side = Math.hypot(L / 2, W / 2), a = (Math.atan2(W / 2, L / 2) * 180) / Math.PI;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    c.body.box((sx * W) / 4, 0.006, (sz * L) / 4, 0.13, 0.012, side, PAINT, { ao: 0, yaw: -sx * sz * a });
  }
}

function roadPaint(k: DetailKit) {
  const y = Y_M + 0.07;
  // the main street: arrows and diamonds in each lane as it comes up to the crossing (Japan drives on the left:
  // eastbound in the north lane, westbound in the south lane)
  k.put(-13, y, MAIN_Z - 2, 90, (c) => arrow(c));
  k.put(-21, y, MAIN_Z - 2, 90, diamond);
  k.put(-31, y, MAIN_Z - 2, 90, diamond);
  k.put(13, y, MAIN_Z + 2, -90, (c) => arrow(c));
  k.put(21, y, MAIN_Z + 2, -90, diamond);
  // the cross street: stop lines before its crosswalks, arrows, diamonds
  const zStopN = N_IN - 0.6 - 3.0, zStopS = S_IN + 0.6 + 3.0;
  k.put(CROSS_HALF / 2, crossRoadY(zStopN), zStopN, 0, (c) => c.body.box(0, 0, 0, CROSS_HALF - 0.4, 0.012, 0.4, PAINT, { ao: 0 }));
  k.put(-CROSS_HALF / 2, crossRoadY(zStopS), zStopS, 0, (c) => c.body.box(0, 0, 0, CROSS_HALF - 0.4, 0.012, 0.4, PAINT, { ao: 0 }));
  k.put(CROSS_HALF / 2, crossRoadY(30.5), 30.5, 0, (c) => arrow(c, 2.8));
  k.put(-CROSS_HALF / 2, crossRoadY(57.5), 57.5, 180, (c) => arrow(c, 2.8));
  k.put(-CROSS_HALF / 2, crossRoadY(63.5), 63.5, 180, diamond);
}

function manholes(k: DetailKit) {
  const lid = (c: Ctx, r = 0.34) => {
    c.body.disc(0, 0.01, 0, r + 0.05, 0.02, 'y', '#4a4c50', 16);
    c.body.disc(0, 0.022, 0, r, 0.02, 'y', '#5e6066', 16);
    // the raised grid of a Japanese cover
    for (const d of [-0.16, 0, 0.16]) {
      c.body.box(d, 0.034, 0, 0.035, 0.008, r * 1.6, '#45474c', { ao: 0 });
      c.body.box(0, 0.034, d, r * 1.6, 0.008, 0.035, '#45474c', { ao: 0 });
    }
  };
  for (const [x, z] of [[-18, MAIN_Z - 1.6], [17, MAIN_Z + 1.4], [-38, MAIN_Z + 1.8]]) k.put(x, Y_M + 0.055, z, 0, (c) => lid(c));
  for (const [x, z] of [[1.6, 27], [-1.6, 61]]) k.put(x, crossRoadY(z) - 0.02, z, 0, (c) => lid(c));
  // small square valve covers and patched asphalt
  for (const [x, z] of [[-26, MAIN_Z + 3.2], [9, MAIN_Z - 3.3]]) k.put(x, Y_M + 0.06, z, 0, (c) => { c.body.box(0, 0.01, 0, 0.42, 0.02, 0.42, '#6a6c70', { ao: 0 }); c.body.box(0, 0.022, 0, 0.3, 0.01, 0.3, '#56585c', { ao: 0 }); });
  for (const [x, z, w, d] of [[-29, MAIN_Z - 1.0, 2.4, 1.3], [25, MAIN_Z + 2.6, 1.6, 2.0], [-9.5, MAIN_Z + 0.4, 1.1, 0.9]]) k.put(x, Y_M + 0.06, z, 0, (c) => c.body.box(0, 0.005, 0, w, 0.01, d, '#34363b', { ao: 0 }));
  k.put(-1.9, crossRoadY(21) - 0.01, 21, 0, (c) => c.body.box(0, 0.005, 0, 1.4, 0.01, 2.6, '#34363b', { ao: 0 }));
}

// ---------------------------------------------------------------------------------------------------------------
// the shops along the main street
// ---------------------------------------------------------------------------------------------------------------

/** By the crossing: a red postbox, a green phone and a community notice board. */
function cornerShop(k: DetailKit) {
  const { atlas } = k;
  // the round-topped red postbox (south-west corner)
  k.put(-8.4, SW, S_FRONT - 0.35, 180, (c) => {
    c.body.box(0, 0.35, 0, 0.18, 0.7, 0.18, '#3a3d42', { ao: 0.1 });
    c.body.box(0, 0.95, 0, 0.5, 0.6, 0.44, '#d8322e', { ao: 0 });
    c.body.frustum(0, 1.25, 0, 0.25, 0.08, 0.16, 10, '#d8322e', { sx: 1, sz: 0.88, cap: true });
    c.body.box(0, 1.08, 0.225, 0.3, 0.05, 0.02, '#2a2a2a', { ao: 0 });
    c.body.box(0, 0.86, 0.225, 0.26, 0.16, 0.02, '#f4f2ea', { ao: 0 });
  });
  // a green public telephone on its post, at the first free spot by the crossing
  const phoneAt = [[-9.8, S_FRONT - 0.3], [-11.2, S_FRONT - 0.3], [-44.5, N_FRONT + 0.3], [16.8, N_FRONT + 0.3]].find(([x, z]) => k.free(x, z, 0.5));
  if (phoneAt) {
    k.put(phoneAt[0], SW, phoneAt[1], phoneAt[1] > MAIN_Z ? 180 : 0, (c) => {
      c.body.box(0, 0.6, 0, 0.12, 1.2, 0.12, '#9aa0a6', { ao: 0.1 });
      c.body.box(0, 1.35, 0.02, 0.5, 0.6, 0.34, '#2f9a4a', { ao: 0 });
      c.body.box(0, 1.72, 0.04, 0.6, 0.08, 0.44, '#e8e8e2', { ao: 0 });
      board(c, atlas.get('phone'), 0, 1.45, 0.2, 0.2, 0.2, '#2f9a4a', false);
    });
  }
  // the notice board of the neighbourhood association, with posters
  const boardAt = [-31.5, -34.5, -23.5, -40.5].find((x) => k.free(x, S_FRONT - 0.15, 1.1));
  if (boardAt !== undefined) {
    k.put(boardAt, SW, S_FRONT - 0.15, 180, (c) => {
      for (const s of [-0.75, 0.75]) c.body.box(s, 0.8, 0, 0.08, 1.6, 0.08, '#6b5a48', { ao: 0.1 });
      c.body.box(0, 1.25, 0, 1.6, 0.8, 0.06, '#7a6450', { ao: 0 });
      c.body.box(0, 1.72, 0.05, 1.8, 0.06, 0.24, '#4a3f3a', { ao: 0 });
      const posters = ['#f4f2ea', '#f2d36a', '#e8b0b8', '#9ad0e8', '#f4f2ea'];
      posters.forEach((p, i) => c.body.box(-0.6 + i * 0.3, 1.2 + (i % 2) * 0.12, 0.035, 0.24, 0.32, 0.01, p, { ao: 0 }));
    });
  }
}

/** The izakaya on the north side, just west of the crossing: nobori, red lanterns, beer crates. */
function izakaya(k: DetailKit) {
  const { atlas } = k;
  for (const x of [-13.6, -10.6]) if (k.free(x, N_FRONT + 0.7, 0.3)) k.put(x, SW, N_FRONT + 0.7, 0, (c) => nobori(c, atlas.get('izakaya'), 0, 0, 2.5));
  for (const x of [-12.8, -9.0]) {
    // hung from the front edge of the awning (it reaches 1.3 m out from the wall, its edge 2.55 m up)
    k.put(x, SW, N_IN - WALK + 1.2, 0, (c) => {
      c.body.box(0, 2.48, 0, 0.02, 0.14, 0.02, '#2a2a2a', { ao: 0 });
      c.litA.blob(0, 2.08, 0, 0.2, 0.28, 0.2, '#e0402e', { detail: 1 });
      c.body.disc(0, 2.38, 0, 0.13, 0.05, 'y', '#1a1a1a', 10);
      c.body.disc(0, 1.79, 0, 0.13, 0.05, 'y', '#1a1a1a', 10);
      c.glow.push({ x: 0, y: 0, z: 0.3, h: 2.0, r: 2.6, color: '#ff8a5a', k: 1 });
    });
  }
  if (k.free(-12.0, N_FRONT + 0.15, 0.4)) {
    k.put(-12.0, SW, N_FRONT + 0.15, 0, (c) => {
      // stacked beer crates
      for (let n = 0; n < 3; n++) {
        c.body.box(0, 0.16 + n * 0.3, 0, 0.5, 0.28, 0.36, n % 2 ? '#e8b030' : '#d8322e', { ao: 0.05, yaw: n * 4 });
        c.body.box(0, 0.3 + n * 0.3, 0, 0.46, 0.01, 0.32, '#3a2a1a', { ao: 0, yaw: n * 4 });
      }
    });
  }
  // a planter of flowers in front of the café next door
  if (k.free(-19.5, N_FRONT + 0.1, 1.2)) {
    k.put(-19.5, SW, N_FRONT + 0.1, 0, (c) => {
      c.body.box(0, 0.22, 0, 2.2, 0.44, 0.45, '#8a6a4a', { ao: 0.15 });
      c.body.box(0, 0.45, 0, 2.24, 0.04, 0.49, '#6b5a48', { ao: 0 });
      for (let n = 0; n < 5; n++) shrub(c, 'flower', -0.85 + n * 0.42, 0.42, 0, 0.42, n + 3);
    });
  }
}

/** The ramen shop on the north side, east of the crossing: its nobori and a delivery scooter. */
function ramenFront(k: DetailKit) {
  const { atlas } = k;
  for (const x of [26.8, 33.0]) if (k.free(x, N_FRONT + 0.7, 0.3)) k.put(x, SW, N_FRONT + 0.7, 0, (c) => nobori(c, atlas.get('ramenBanner'), 0, 0, 2.5));
  // the scooter waits on the road by the curb, not on the pavement
  k.put(28.3, Y_M + 0.05, N_IN + 0.55, 90, scooter);
}

/** A delivery scooter with its box (along local +z). */
function scooter(c: Ctx) {
  for (const z of [-0.55, 0.55]) c.body.disc(0, 0.24, z, 0.24, 0.1, 'x', '#1e1e20', 12);
  c.body.box(0, 0.38, 0, 0.32, 0.22, 1.0, '#f4f2ea', { ao: 0.1 });
  c.body.box(0, 0.62, -0.25, 0.3, 0.12, 0.5, '#2a2a2a', { ao: 0 });
  c.body.box(0, 0.75, 0.48, 0.3, 0.6, 0.14, '#f4f2ea', { ao: 0, shade: 0.95 });
  c.body.box(0, 1.08, 0.5, 0.6, 0.04, 0.04, '#2a2a2a', { ao: 0 });
  c.body.disc(0, 0.92, 0.57, 0.07, 0.03, 'z', '#fff4c0', 8);
  c.body.box(0, 0.95, -0.55, 0.5, 0.42, 0.5, '#c8322e', { ao: 0.05 });
  c.body.box(0, 1.17, -0.55, 0.52, 0.03, 0.52, '#a82a26', { ao: 0 });
}

// ---------------------------------------------------------------------------------------------------------------
// life on the pavements
// ---------------------------------------------------------------------------------------------------------------

function pavementLife(k: DetailKit) {
  const { r } = k;
  // a bench and an ashtray stand at the konbini corner
  if (k.free(-15.6, S_FRONT - 0.3, 1.0)) k.put(-15.6, SW, S_FRONT - 0.3, 180, (c) => bench(c.body, 0, 0, 0, '#4a6a8a'));
  // pots and crates by doorways
  for (const [x, z] of [[-24.2, N_FRONT + 0.05], [-23.6, N_FRONT + 0.1], [15.2, N_FRONT + 0.05], [-36.0, S_FRONT - 0.05], [-35.4, S_FRONT - 0.1], [30.8, S_FRONT - 0.05]]) {
    if (k.free(x, z, 0.25)) k.put(x, SW, z, 0, (c) => pot(c, 0, 0, 0, Math.floor(r() * 5)));
  }
  if (k.free(-41.0, S_FRONT - 0.1, 0.4)) k.put(-41.0, SW, S_FRONT - 0.1, 0, (c) => boxes(c, 0, 0, 0, 2));
  // pigeons pecking on the pavement
  for (let i = 0; i < 6; i++) {
    const x = -27 + r() * 4, z = N_FRONT + 0.9 + r() * 1.2;
    if (!k.free(x, z, 0.1)) continue;
    k.put(x, SW, z, r() * 360, (c) => {
      c.body.blob(0, 0.12, 0, 0.09, 0.08, 0.14, '#8a8f99', { detail: 0, seed: i });
      c.body.blob(0, 0.21, 0.1, 0.05, 0.05, 0.05, '#6a707a', { detail: 0, seed: i + 3 });
      c.body.box(0, 0.2, 0.15, 0.02, 0.015, 0.04, '#d8a040', { ao: 0 });
      c.body.box(0, 0.15, -0.14, 0.08, 0.015, 0.1, '#5a5f68', { ao: 0 });
    });
  }
  // a cat sitting by the vending machine
  k.put(-6.7, SW, N_FRONT + 0.25, 200, (c) => {
    c.body.blob(0, 0.16, 0, 0.13, 0.16, 0.17, '#e8a050', { detail: 1, seed: 2 });
    c.body.blob(0, 0.36, 0.1, 0.1, 0.09, 0.09, '#e8a050', { detail: 1, seed: 5 });
    for (const s of [-1, 1]) flatTri(c, [s * 0.03, 0.42, 0.11], [s * 0.09, 0.42, 0.1], [s * 0.07, 0.5, 0.1], '#c8803a');
    c.body.box(0.06, 0.06, -0.2, 0.04, 0.04, 0.24, '#e8a050', { ao: 0, yaw: 30 });
    c.body.box(0, 0.37, 0.19, 0.04, 0.02, 0.01, '#3a2a1a', { ao: 0 });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// the cross street and the lamps
// ---------------------------------------------------------------------------------------------------------------

function crossStreet(k: DetailKit) {
  const edge = CROSS_HALF + CROSS_WALK - 0.35;
  // grey and green utility cabinets
  for (const [x, z, col] of [[edge - 0.05, 29.5, '#9aa4a8'], [-edge + 0.05, 58.5, '#5f8a6a'], [-edge + 0.05, 31.5, '#9aa4a8']] as const) {
    k.put(x, crossWalkY(z), z, x > 0 ? -90 : 90, (c) => {
      c.body.box(0, 0.62, 0, 0.9, 1.24, 0.45, col, { ao: 0.15 });
      c.body.box(0, 1.27, 0, 0.98, 0.06, 0.52, new Color(col).multiplyScalar(0.8), { ao: 0 });
      c.body.box(-0.22, 0.65, 0.23, 0.02, 0.9, 0.01, '#6a7478', { ao: 0 });
      c.body.box(0.22, 0.65, 0.23, 0.02, 0.9, 0.01, '#6a7478', { ao: 0 });
      c.body.box(0, 0.95, 0.235, 0.22, 0.12, 0.01, '#f2c230', { ao: 0 });
    });
  }
}

/** Shop-street banners hung from the street lamps, facing the road. */
function lampBanners(k: DetailKit) {
  const colours = ['#e86a92', '#f2a0b8', '#e86a92'];
  const lamps: [number, number, number][] = [[-18, N_IN - 0.4, 1], [-38, N_IN - 0.4, 1], [30, N_IN - 0.4, 1], [-29, S_IN + 0.4, -1], [19, S_IN + 0.4, -1], [-49, S_IN + 0.4, -1]];
  lamps.forEach(([x, z, side], i) => {
    k.put(x, SW, z, 0, (c) => {
      const col = colours[i % colours.length];
      c.body.box(0, 4.25, side * 0.3, 0.04, 0.04, 0.6, '#9aa0a6', { ao: 0 });
      c.body.box(0, 3.6, side * 0.33, 0.03, 1.25, 0.52, col, { ao: 0 });
      c.body.box(0, 3.85, side * 0.33, 0.035, 0.28, 0.4, '#f4f2ea', { ao: 0 });
      c.body.box(0, 3.3, side * 0.33, 0.035, 0.1, 0.52, '#c84a72', { ao: 0 });
    });
  });
}

/** Upright neon blade signs sticking out from the shop fronts above the awnings, lit in their own colours at night. */
function neonBlades(k: DetailKit) {
  const { atlas } = k;
  // [x along the street, which side, the sign, the colour of its tube]
  const blades: [number, 'n' | 's', string, string][] = [
    [-15.0, 'n', 'karaoke', '#d07aff'], [-6.6, 'n', 'yakitori', '#ff4a6a'], [25.8, 'n', 'sushi', '#4ad8ff'],
    [-6.8, 's', 'beer', '#ffd23a'], [-19.6, 's', 'gyoza', '#ff7a3a'], [22.4, 's', 'sake', '#5a9aff'],
  ];
  for (const [x, side, name, tube] of blades) {
    const wall = side === 'n' ? N_IN - WALK : S_IN + WALK;
    const out = side === 'n' ? 1 : -1;
    // only on a real wall: a building must stand right behind it, across the sign's whole width
    if (![-0.35, 0, 0.35].every((dx) => k.inBuilding(x + dx, wall - out * 0.4))) continue;
    // turned so that the sign's faces look along the street
    k.put(x, SW, wall + out * 0.72, 90, (c) => {
      const cell = atlas.get(name), w = 0.5, h = Math.min(1.7, w / cell.aspect);
      const y = 4.4;
      c.body.box(0, y, 0, 0.62, h + 0.14, 0.1, '#1e1f24', { ao: 0 });
      // two arms back to the wall (local x runs toward it: the sign is turned 90°)
      for (const dy of [h / 2 - 0.1, -h / 2 + 0.1]) c.body.box(out * 0.49, y + dy, 0, 0.5, 0.05, 0.05, '#5a5e64', { ao: 0 });
      board(c, cell, 0, y, 0, w, h, '#1e1f24');
      // the neon tube round the edge, on both faces
      for (const f of [0.065, -0.065]) {
        c.neon.box(0, y + h / 2 + 0.035, f, w + 0.1, 0.035, 0.02, tube, { ao: 0 });
        c.neon.box(0, y - h / 2 - 0.035, f, w + 0.1, 0.035, 0.02, tube, { ao: 0 });
        for (const sx of [-1, 1]) c.neon.box(sx * (w / 2 + 0.05), y, f, 0.035, h + 0.1, 0.02, tube, { ao: 0 });
      }
      c.glow.push({ x: 0, y: 0, z: 0, h: 3.6, r: 3.2, color: tube, k: 0.9 });
    });
  }
}
