import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { GeoBuilder, type V3 } from '../../util/builder';
import { pick, rng, yieldUI } from '../../util/rng';
import { EXPRESSWAY, IC_RAMP, PADDY, PLATFORMS, POND, STAIRS, TERRACES, WATER_Y, heightAt, rampY, roadNear } from '../config';
import type { TreeField } from '../forest';
import { raiseSkyline } from '../skyline';
import type { SignAtlas } from '../signs';
import { apartmentBlock, konbini, officeBlock, supermarket } from './buildings';
import { appendCtx, newCtx, type Ctx } from './frame';
import { Occupancy, fillEmpty } from './fillers';
import { buildPaddies, buildTownGround, wallSeg } from './ground';
import { buildGasStation } from './gas';
import { buildExpressway, buildUnderpass } from './highway';
import { buildHouse, type HouseSpec } from './house';
import {
  aBoard, bicycle, bins, blockWall, boxes, busStop, classicLamp, cone, convexMirror, doubleLamp, guardPipe, hydrant, jizo, parkedVehicle, pot, roadPaint,
  roadSign, scarecrow, shrub, signPole, tileFence, trafficLight, utilityPole, vendingMachine, wireSpan,
} from './props';

/**
 * Hoshi Town: a dense little Japanese street grid on a hillside. Buildings stand shoulder to shoulder along a main street with raised
 * pavements and a signalled crossing, and along two narrow back lanes. Every building is drawn from a recipe with its
 * own dice, so no two are alike. Paddies, a pond and the mountain path lie around it.
 */

// the three terraces: the back lane up the hill, the main street, the back lane down the hill
const Y_N = TERRACES[0].y, Y_M = TERRACES[1].y, Y_S = TERRACES[2].y, RAISE = PLATFORMS[0].dy;
const SW = Y_M + 0.17; // the top of the main street pavements
const MAIN_Z = 44, MAIN_HALF = 4, WALK = 3;
const CROSS_HALF = 3.5, CROSS_WALK = 2.5;
const BACK_N = 8, BACK_S = 84, BACK_HALF = 2.3;
const LANE_X = 62;
const X_MIN = -110, X_MAX = 110;

const SHOP_WALLS = ['#e9e4d8', '#d8d4c8', '#cfd6d8', '#e6dccb', '#f1ede4', '#c9ccc4', '#dde3e6', '#e2d6c4', '#b9c4cc', '#e8e0d0'];
const HOUSE_WALLS = ['#efe9dc', '#e8d46a', '#dcd8cb', '#cfe0e6', '#f2e0d8', '#d9d2c0', '#c9d8c4', '#e6dccb', '#f4f1ea', '#d5dad8', '#e9d8b8', '#bcc9d2'];
const ROOFS = ['#3e4856', '#4a3f3a', '#35465a', '#52463f', '#3b4a40', '#2f3a46', '#5a3a30', '#46505a'];
const TRIMS = ['#8a8f96', '#f2efe6', '#6b5a48', '#7a838c', '#4a5560', '#a89a86'];
const AWNINGS: [string, string][] = [['#c8322e', '#f4f4f0'], ['#17a39a', '#e8f6f4'], ['#3b9a3a', '#f6f2e0'], ['#1f5ea8', '#f4f4f0'], ['#e8a030', '#fff6e0'], ['#7a2db8', '#f4f0f8'], ['#5a3a24', '#e8dcc0'], ['#2a2c32', '#f2c230']];

interface Lot { x: number; z: number; yaw: number; w: number; d: number; y: number; ctx: Ctx; height: number }

export interface VillageBuild { group: Group; update(night: number): void }

export async function buildVillage(trees: TreeField, atlas: SignAtlas, onStep: (f: number, label: string) => void = () => {}): Promise<VillageBuild> {
  // the town is built in steps, letting the loading screen repaint in between
  const step = async (f: number, label: string) => { onStep(f, label); await yieldUI(); };
  const r = rng(77777);
  const chunks = new Map<number, Ctx>();
  const at = (x: number): Ctx => {
    const k = Math.floor((x + 170) / 40);
    let c = chunks.get(k);
    if (!c) chunks.set(k, (c = newCtx(r)));
    return c;
  };
  const lots: Lot[] = [];
  const occ = new Occupancy();

  // ---------------------------------------------------------------------------------------------
  // recipes: a shop-house, a house, and their dice
  // ---------------------------------------------------------------------------------------------
  let lastWall = '', lastRoof = '';
  const notLike = (list: string[], prev: string) => {
    let c = pick(r, list);
    for (let k = 0; k < 4 && c === prev; k++) c = pick(r, list);
    return c;
  };
  const shopSpec = (w: number, d: number): HouseSpec => {
    const wall = notLike(SHOP_WALLS, lastWall);
    const roof = notLike(['flat', 'gable', 'hip', 'gable', 'flat'], lastRoof) as HouseSpec['roof'];
    lastWall = wall; lastRoof = roof;
    const style = pick(r, ['stripes', 'box', 'box', 'none', 'stripes'] as const);
    const board = style === 'none' || r() < 0.3 ? pick(r, atlas.wideNames.filter((n) => n !== 'parking')) : undefined;
    return {
      w, d, floors: r() < 0.3 ? 3 : 2, fh: 2.9 + r() * 0.3, wall, wall2: r() < 0.4 ? pick(r, SHOP_WALLS) : undefined, trim: pick(r, TRIMS), roof, roofColor: pick(r, ROOFS),
      gableFront: roof === 'gable' && r() < 0.5, pent: roof !== 'flat' && r() < 0.6 ? pick(r, ['#464c54', '#3a3f46', '#5a4a40']) : undefined,
      shop: { awning: pick(r, AWNINGS), style, curved: r() < 0.35, sign: style !== 'none' && !board && r() < 0.7 ? pick(r, atlas.wideNames.filter((n) => n !== 'parking')) : undefined, noren: r() < 0.5 ? pick(r, ['#b3322a', '#2c3f6e', '#3a2a1a', '#e8dfc6']) : undefined, banners: r() < 0.6 ? [pick(r, atlas.tallNames), ...(r() < 0.4 ? [pick(r, atlas.tallNames)] : [])] : [], menu: r() < 0.35 },
      board, roundSign: r() < 0.08 ? 'sushiRound' : undefined, lattice: r() < 0.12 ? '#6b4a32' : undefined, planters: r() < 0.45, stairs: r() < 0.22 ? pick(r, ['left', 'right'] as const) : undefined,
      tiles: r() < 0.12 ? pick(r, ['#cfe0e4', '#e8e0d0', '#d8dcd8']) : undefined, ac: 1 + Math.floor(r() * 3), antenna: r() < 0.3, stack: r() < 0.08, shutters: r() < 0.2 ? pick(r, ['#7a5a3c', '#5a6a4a']) : undefined,
      balcony: r() < 0.25, slats: r() < 0.2, lit: 0.35 + r() * 0.4, parapet: pick(r, TRIMS),
    };
  };
  const houseSpec = (w: number, d: number): HouseSpec => {
    const wall = notLike(HOUSE_WALLS, lastWall);
    const roof = notLike(['gable', 'hip', 'gable', 'flat', 'hip'], lastRoof) as HouseSpec['roof'];
    lastWall = wall; lastRoof = roof;
    const floors = r() < 0.82 ? 2 : 1;
    return {
      w, d, floors, fh: 2.85 + r() * 0.35, wall, wall2: r() < 0.25 ? pick(r, HOUSE_WALLS) : undefined, trim: pick(r, TRIMS), roof, roofColor: pick(r, ROOFS),
      gableFront: roof === 'gable' && r() < 0.4, pent: floors > 1 && roof !== 'flat' && r() < 0.65 ? pick(r, ['#464c54', '#3a3f46', '#5a4a40']) : undefined,
      shutters: r() < 0.3 ? pick(r, ['#7a5a3c', '#5a6a4a', '#6a4a3a', '#4a5a6a']) : undefined, balcony: floors > 1 && r() < 0.45, planters: r() < 0.4, bars: r() < 0.35,
      tiles: r() < 0.22 ? pick(r, ['#cfe0e4', '#e8e0d0', '#dfe4e0', '#e4d8d8']) : undefined, stairs: floors > 1 && r() < 0.15 ? pick(r, ['left', 'right'] as const) : undefined,
      ac: 1 + Math.floor(r() * 3), antenna: r() < 0.6, chimney: r() < 0.08, slats: r() < 0.3, door: pick(r, ['#7a5a3c', '#5a4a3a', '#4a6a5a', '#8a3a30', '#6a7a8a', '#e8e4d8']),
      doorU: -w / 2 + 1.5 + r() * Math.max(0.3, w - 3.2), lit: 0.25 + r() * 0.35, parapet: pick(r, TRIMS),
    };
  };

  /** Steps from a raised strip down to the lane in front of it (the lane lies toward +z). */
  const steps = (c: Ctx, x: number, edge: number, top: number, bottom: number, w: number) => {
    const n = Math.max(2, Math.round((top - bottom) / 0.19)), rise = (top - bottom) / n;
    for (let k = 1; k < n; k++) c.body.box(x, bottom + (n - k) * rise / 2 - 0.02, edge + (k - 0.5) * 0.28, w, (n - k) * rise + 0.04, 0.28, k % 2 ? '#c4bfb4' : '#bab5aa', { ao: 0.05 });
  };

  /** The strip behind a building, up to the next retaining wall: a garden, a shed, a parked car, laundry, AC units. */
  const backyard = (x0: number, x1: number, zA: number, zB: number, y: number) => {
    const depth = Math.abs(zB - zA), dir = Math.sign(zB - zA);
    occ.mark(x0, zA, x1, zB);
    if (depth < 2.2 || x1 - x0 < 3) return;
    const c = at((x0 + x1) / 2), xm = (x0 + x1) / 2, zm = (zA + zB) / 2;
    const t = r();
    c.body.box(xm, y + 0.03, zm, x1 - x0 - 0.2, 0.06, depth - 0.3, pick(r, ['#9c9488', '#8f9a7a', '#a7a196', '#7f9a62']), { ao: 0 });
    if (t < 0.3) {
      trees.add(pick(r, ['round', 'sakura', 'jacaranda', 'maple', 'ginkgo'] as const), xm + (r() - 0.5) * (x1 - x0 - 3), zm, 0.6 + r() * 0.3, y);
      shrub(c, pick(r, ['round', 'hedge', 'flower'] as const), x0 + 1.2, y, zm, 0.8, Math.floor(r() * 9));
    } else if (t < 0.5 && depth > 4.5) {
      parkedVehicle(c, pick(r, ['kei', 'keivan', 'car'] as const), pick(r, ['#f4f4ee', '#3a4a6a', '#7a2a2e', '#d8d8d0', '#2f2f35']), xm, y + 0.05, zm, 90);
    } else if (t < 0.7) {
      const sw = Math.min(3, x1 - x0 - 1), sd = Math.min(2.2, depth - 0.8);
      const sx = x0 + 0.6 + sw / 2, sz = zB - dir * (sd / 2 + 0.3);
      c.body.box(sx, y + 1.0, sz, sw, 2.0, sd, pick(r, ['#c9c2b0', '#8a9aa6', '#b8a07a', '#d8d4c8']), { ao: 0.15 });
      c.body.box(sx, y + 2.07, sz, sw + 0.25, 0.14, sd + 0.25, '#5a6068', { ao: 0 });
      c.body.box(sx, y + 0.8, sz - dir * (sd / 2 + 0.01), sw * 0.6, 1.5, 0.02, '#9aa2a8', { ao: 0 });
      if (x1 - x0 > 6) bicycle(c, x1 - 1.5, y, zm, 0, pick(r, ['#4f7fd9', '#d94f4f', '#7fb8b0']));
    } else if (t < 0.85) {
      // a laundry frame with washing
      const lx0 = x0 + 1, lx1 = Math.min(x1 - 1, x0 + 5);
      for (const lx of [lx0, lx1]) c.body.box(lx, y + 0.9, zm, 0.06, 1.8, 0.06, '#c0c4c8', { ao: 0 });
      c.body.cable([[lx0, y + 1.75, zm], [lx1, y + 1.75, zm]], 0.02, '#c0c4c8');
      for (let k = 0; k < 4; k++) c.body.box(lx0 + 0.5 + k * ((lx1 - lx0 - 1) / 3), y + 1.4, zm, 0.5, 0.65, 0.03, pick(r, ['#f4f4ee', '#7fa8d8', '#e8b0b8', '#f2d36a', '#9ad0a0']), { ao: 0 });
      pot(c, x1 - 1, y, zm, Math.floor(r() * 5));
    } else {
      boxes(c, x0 + 1.2, y, zm, 2);
      bins(c, x1 - 1.2, y, zm);
    }
  };

  /** Put a finished building down, register its roof for the camera. */
  const place = (ctx: Ctx, x: number, z: number, yaw: number, y: number, w: number, d: number, height: number) => {
    // never on a street: a building whose footprint touches a road is left out (the lot gets filled later)
    for (let a = -w / 2; a <= w / 2 + 1e-6; a += w / Math.ceil(w / 1.5)) for (let b = -d / 2; b <= d / 2 + 1e-6; b += d / Math.ceil(d / 1.5)) {
      const rd = roadNear(x + a, z + b);
      if (rd.d < rd.width / 2 + 0.2) return;
    }
    appendCtx(at(x), ctx, x, y, z, yaw);
    const rr = Math.max(w, d) / 2 + 1;
    raiseSkyline(x - rr, z - rr, x + rr, z + rr, y + height + 2.5);
    lots.push({ x, z, yaw, w, d, y, ctx, height });
    occ.mark(x - w / 2 - 0.2, z - d / 2 - 0.2, x + w / 2 + 0.2, z + d / 2 + 0.2);
  };

  // ---------------------------------------------------------------------------------------------
  // a row of buildings along one side of a street
  // ---------------------------------------------------------------------------------------------
  interface Row { front: number; yaw: 0 | 180; depth: number; y: number; ground: number; raised?: number; yard?: number; kind: 'main' | 'back'; skip: [number, number][]; specials?: (x: number) => { w: number; build: () => { ctx: Ctx; w: number; d: number; height: number; setback?: number } } | null }
  const rowFill = (row: Row) => {
    let x = X_MIN;
    while (x < X_MAX - 5) {
      const block = row.skip.find(([a, b]) => x >= a - 0.01 && x < b);
      if (block) { x = block[1]; continue; }
      const next = row.skip.filter(([a]) => a > x).reduce((m, [a]) => Math.min(m, a), X_MAX);
      const special = row.specials?.(x);
      if (special) {
        const s = special.build();
        if (x + s.w > next) { x = next; continue; }
        const setback = s.setback ?? 0;
        occ.mark(x, row.front, x + s.w, row.yaw === 0 ? row.front - setback : row.front + setback);
        const cx = x + s.w / 2;
        const cz = row.yaw === 0 ? row.front - setback - s.d / 2 : row.front + setback + s.d / 2;
        place(s.ctx, cx, cz, row.yaw, row.y, s.w, s.d, s.height);
        if (row.yard !== undefined) backyard(x, x + s.w, row.yaw === 0 ? cz - s.d / 2 : cz + s.d / 2, row.yard, row.ground);
        x += s.w + 0.3;
        continue;
      }
      // a gap now and then: a driveway with a parked car, or a little garden
      if (row.kind === 'back' && r() < 0.1 && next - x > 7) {
        const gw = 3 + r() * 2;
        occ.mark(x, row.front, x + gw, row.yaw === 0 ? row.front - row.depth : row.front + row.depth);
        const gc = x + gw / 2;
        const gz = row.yaw === 0 ? row.front - 3 : row.front + 3;
        if (row.raised === undefined && r() < 0.6) parkedVehicle(at(gc), pick(r, ['kei', 'keivan', 'car'] as const), pick(r, ['#f4f4ee', '#3a4a6a', '#7a2a2e', '#d8d8d0', '#2f2f35']), gc, row.ground + 0.05, gz, row.yaw === 0 ? 90 + (r() - 0.5) * 10 : -90 + (r() - 0.5) * 10);
        else { trees.add(pick(r, ['jacaranda', 'sakura', 'round'] as const), gc, gz, 0.8 + r() * 0.3, row.ground); shrub(at(gc), 'flower', gc + 1, row.ground, gz + 1, 0.9, Math.floor(r() * 9)); }
        x += gw;
        continue;
      }
      const isHouse = row.kind === 'back' ? r() < 0.68 : r() < 0.18;
      const isApt = !isHouse && r() < (row.kind === 'back' ? 0.35 : 0.12);
      let w = isApt ? 11 + r() * 3 : isHouse ? 7 + r() * 3 : 6 + r() * 3.2;
      const d = Math.min(row.depth, isApt ? 9.5 : isHouse ? 7.5 + r() * 2 : 8.5 + r() * 3.5);
      if (x + w > next - 0.2) {
        w = next - x - 0.2;
        if (w < 5) { x = next; continue; }
      }
      let ctx: Ctx, height: number, foot = w, doorAt = 0;
      if (isApt) {
        const floors = 3 + Math.floor(r() * 2);
        ctx = apartmentBlock(r, w, d, floors, pick(r, ['#e9e0cc', '#d9dcd8', '#e4d6c0', '#cfd8dc']));
        height = floors * 2.9 + 0.8;
      } else {
        const spec = isHouse ? houseSpec(w, d) : shopSpec(w, d);
        if (spec.stairs) { spec.w = w - 1.3; foot = w; }
        ctx = buildHouse(spec, r, atlas);
        height = spec.floors * (spec.fh ?? 3) + 2.5;
        // the front yard of a house: a tiled or block wall with a gate, pots and a plant
        if (isHouse && row.kind === 'back') {
          const fz = spec.d / 2 + 2.25;
          const hw = foot / 2;
          const gate = (spec.doorU ?? 0);
          doorAt = gate;
          ctx.body.box(0, 0.06, spec.d / 2 + 1.2, foot + 0.2, 0.12, 2.4, '#cdc9be', { ao: 0.05 });
          const fence = r() < 0.55 ? tileFence : blockWall;
          fence(ctx, -hw, fz, gate - 1.1, fz, 0.12, 1.15);
          fence(ctx, gate + 1.1, fz, hw, fz, 0.12, 1.15);
          pot(ctx, gate - 1.6, 0.12, fz - 0.5, Math.floor(r() * 5));
          if (r() < 0.6) shrub(ctx, pick(r, ['round', 'cone', 'flower'] as const), hw - 1.0, 0.12, spec.d / 2 + 1.0, 0.7 + r() * 0.4, Math.floor(r() * 9));
          if (r() < 0.4) bicycle(ctx, gate + 1.6, 0.12, spec.d / 2 + 1.3, 90, pick(r, ['#4f7fd9', '#d94f4f', '#7fb8b0', '#e0b341']));
        }
      }
      // stairs stick out on one side: shift so the whole footprint fits the lot
      const spec2 = (ctx as unknown as { stairsSide?: number }).stairsSide;
      void spec2;
      const cx = x + foot / 2;
      const cz = row.yaw === 0 ? row.front - d / 2 : row.front + d / 2;
      place(ctx, cx, cz, row.yaw, row.y, foot, d, height);
      if (row.yard !== undefined) backyard(x, x + foot, row.yaw === 0 ? row.front - d : row.front + d, row.yard, row.ground);
      // on a raised strip: little steps down from the gate (or the shop door) to the lane
      if (row.raised !== undefined) {
        const gx = isHouse ? cx + doorAt : cx;
        steps(at(gx), gx, row.raised, row.ground, row.ground - RAISE, isHouse ? 1.3 : Math.min(2.4, foot - 1));
        if (isApt) steps(at(cx), cx - foot / 2 + 1.4, row.raised, row.ground, row.ground - RAISE, 1.2);
      }
      x += foot + (r() < 0.55 ? 0.05 : 0.3 + r() * 0.7);
    }
  };

  const mainSkip: [number, number][] = [[-CROSS_HALF - CROSS_WALK - 0.3, CROSS_HALF + CROSS_WALK + 0.3], [-LANE_X - 3.8, -LANE_X + 3.8], [LANE_X - 3.8, LANE_X + 3.8]];
  const backSkip: [number, number][] = [[-CROSS_HALF - CROSS_WALK - 0.3, CROSS_HALF + CROSS_WALK + 0.3], [-LANE_X - 3.6, -LANE_X + 3.6], [LANE_X - 3.6, LANE_X + 3.6]];

  // the stair alleys between the terraces
  const alley = (zb: number): [number, number][] => STAIRS.filter((s) => s.z === zb).map((s) => [s.x - s.w / 2 - 0.35, s.x + s.w / 2 + 0.35]);
  const upAlleys = alley(TERRACES[0].z1), downAlleys = alley(TERRACES[1].z1);

  await step(0.05, 'Main street…');
  // the main street, north side: the sushi shop, an izakaya and a café by the crossing; the ramen shop further east
  rowFill({
    front: MAIN_Z - MAIN_HALF - WALK, yaw: 0, depth: 12, y: SW, ground: Y_M, yard: TERRACES[0].z1 + 0.1, kind: 'main', skip: [...mainSkip, ...upAlleys],
    specials: (x) => {
      if (Math.abs(x - -14.3) < 0.5) return { w: 8, build: () => ({ ctx: buildHouse({ ...shopSpec(8, 10), floors: 2, roof: 'gable', gableFront: false, roofColor: '#3a3f46', wall: '#f2efe8', shop: { awning: ['#c8322e', '#f4f4f0'], style: 'box', sign: undefined, noren: '#2c3f6e', banners: ['izakaya'], menu: true }, board: 'sushiBoard', roundSign: 'sushiRound', stack: true, stairs: undefined, lattice: undefined }, r, atlas), w: 8, d: 10, height: 9 }) };
      if (Math.abs(x - -22.6) < 0.5) return { w: 7.6, build: () => ({ ctx: buildHouse({ ...shopSpec(6.3, 9), floors: 3, roof: 'flat', wall: '#d8e2e6', shop: { awning: ['#2b2a28', '#f4e6c8'], style: 'none', banners: ['ramenBanner'], menu: true }, board: 'cafeBoard', stairs: 'left', planters: true, roundSign: undefined, lattice: undefined }, r, atlas), w: 7.6, d: 9, height: 11 }) };
      if (Math.abs(x - 26.0) < 0.5) return { w: 7.6, build: () => ({ ctx: buildHouse({ ...shopSpec(7.6, 9), floors: 2, wall: '#d6d3c8', wall2: '#cdc8ba', roof: 'gable', gableFront: false, roofColor: '#38414c', pent: '#2f3a46', stack: true, shop: { awning: ['#17a39a', '#e8f6f4'], style: 'stripes', curved: true, sign: 'ramenAwning', noren: '#b3322a', banners: ['sukiyaki', 'ramenBanner'], menu: true }, board: undefined, stairs: undefined, roundSign: undefined, lattice: undefined, tiles: undefined }, r, atlas), w: 7.6, d: 9, height: 9 }) };
      if (Math.abs(x - 33.9) < 0.5) return { w: 9.4, build: () => ({ ctx: buildHouse({ ...houseSpec(9.4, 8.4), floors: 2, wall: '#e8d46a', wall2: '#e8d46a', trim: '#f4f1e8', roof: 'hip', roofColor: '#3a3f46', shutters: '#7a5a3c', balcony: true, antenna: true, ac: 2, pent: '#3a3f46', gableFront: false, stairs: undefined, tiles: undefined }, r, atlas), w: 9.4, d: 8.4, height: 9, setback: 2.4 }) };
      return null;
    },
  });
  await step(0.2, 'Konbini and supermarket…');
  // the main street, south side: the convenience store and the supermarket stand back behind their car parks
  rowFill({
    front: MAIN_Z + MAIN_HALF + WALK, yaw: 180, depth: 12, y: SW, ground: Y_M, yard: TERRACES[1].z1 - 0.4, kind: 'main', skip: [...mainSkip, ...downAlleys],
    specials: (x) => {
      if (Math.abs(x - 6.3) < 0.5) return { w: 15, build: () => ({ ctx: konbini(r, atlas, 15, 11), w: 15, d: 11, height: 5.5, setback: 6.5 }) };
      if (Math.abs(x - -50) < 2.0 && x > -52) return { w: 24, build: () => ({ ctx: supermarket(r, atlas, 24, 12), w: 24, d: 12, height: 9, setback: 6 }) };
      return null;
    },
  });
  await step(0.35, 'Back lanes…');
  // the back lanes
  rowFill({ front: BACK_N + BACK_HALF + 2.4, yaw: 180, depth: 9.5, y: Y_N + 0.12, ground: Y_N, kind: 'back', skip: [...backSkip, ...upAlleys] });
  rowFill({ front: BACK_N - BACK_HALF - 2.4, yaw: 0, depth: 8.5, y: Y_N + RAISE + 0.12, ground: Y_N + RAISE, raised: PLATFORMS[0].z1, kind: 'back', skip: backSkip });
  rowFill({ front: BACK_S - BACK_HALF - 2.4, yaw: 0, depth: 9.5, y: Y_S + RAISE + 0.12, ground: Y_S + RAISE, raised: PLATFORMS[1].z1, kind: 'back', skip: [...backSkip, ...downAlleys, [-53, -24]] });
  rowFill({
    front: BACK_S + BACK_HALF + 2.4, yaw: 180, depth: 11, y: Y_S + 0.12, ground: Y_S, yard: 102, kind: 'back', skip: backSkip,
    specials: (x) => (r() < 0.22 ? { w: 13, build: () => { const f = 4 + Math.floor(r() * 4); return { ctx: officeBlock(r, atlas, 13, 10, f, pick(r, ['#e8e4dc', '#d8dcd8', '#cfd6dc', '#e6dccb'])), w: 13, d: 10, height: f * 3.3 + 4 }; } } : null) || (x > 300 ? null : null),
  });

  // the pavements of the main street, the front strips of the back rows, the stair alleys
  occ.mark(-200, MAIN_Z - MAIN_HALF - WALK - 0.9, 200, MAIN_Z + MAIN_HALF + WALK + 0.9);
  for (const lz of [BACK_N, BACK_S]) occ.mark(-200, lz - BACK_HALF - 2.5, 200, lz + BACK_HALF + 2.5);
  for (const st of STAIRS) {
    const [za, zb] = st.z === TERRACES[0].z1 ? [BACK_N, MAIN_Z] : [MAIN_Z, BACK_S];
    occ.mark(st.x - st.w / 2 - 0.4, za, st.x + st.w / 2 + 0.4, zb);
  }

  await step(0.55, 'Terraces and retaining walls…');
  buildTownGround(at);
  await step(0.62, 'Pavements, poles and wires…');
  streets(at, atlas, r, trees, occ);
  outskirts(at, atlas, r, trees);
  await step(0.72, 'Filling the empty lots…');
  fillEmpty(occ, at, atlas, r, trees);
  await step(0.8, 'Expressway and toll gate…');
  buildExpressway(at, atlas);
  buildUnderpass(at);
  buildGasStation(at, atlas, r);
  // the stair alleys: a lamp at the top and the bottom of each flight, pots along one side
  for (const st of STAIRS) {
    const yU = heightAt(st.x, st.z - 0.5), yL = heightAt(st.x, st.z + 9);
    const side = st.x + st.w / 2 - 0.25;
    classicLamp(at(st.x), st.x - st.w / 2 + 0.25, yU, st.z - 1.0);
    classicLamp(at(st.x), side, yL, st.z + 9.2);
    const [za, zb] = st.z === TERRACES[0].z1 ? [BACK_N + BACK_HALF + 2.6, st.z - 1.2] : [st.z + 9.6, BACK_S - BACK_HALF - 0.3];
    for (let z = za; z < zb - 0.4; z += 0.9) if (r() < 0.6) pot(at(st.x), side, heightAt(side, z), z, Math.floor(r() * 5));
  }
  await step(0.9, 'Putting the town together…');
  return assemble(chunks, atlas);
}

// ---------------------------------------------------------------------------------------------
// pavements, the crossing, poles and wires, lamps and everything on the pavement
// ---------------------------------------------------------------------------------------------
function streets(at: (x: number) => Ctx, atlas: SignAtlas, r: () => number, trees: TreeField, occ: Occupancy) {
  const pave = (x0: number, x1: number, z0: number, z1: number, curbSide: 'n' | 's' | 'e' | 'w') => {
    const ctx = at((x0 + x1) / 2);
    const B = ctx.body;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0;
    B.box(cx, (Y_M - 0.05 + SW) / 2, cz, sx, SW - Y_M + 0.05, sz, '#c9c4b8', { ao: 0.1 });
    // paving joints every metre, a yellow tactile strip and the curb stones
    const along = curbSide === 'n' || curbSide === 's';
    const L = along ? sx : sz;
    for (let k = 1; k < Math.floor(L); k++) {
      if (along) B.box(x0 + k, SW + 0.002, cz, 0.03, 0.01, sz, '#aea89c', { ao: 0 });
      else B.box(cx, SW + 0.002, z0 + k, sx, 0.01, 0.03, '#aea89c', { ao: 0 });
    }
    const tact = 0.8;
    if (along) B.box(cx, SW + 0.005, curbSide === 'n' ? z0 + tact : z1 - tact, sx, 0.012, 0.3, '#e8c43a', { ao: 0 });
    else B.box(curbSide === 'e' ? x0 + tact : x1 - tact, SW + 0.005, cz, 0.3, 0.012, sz, '#e8c43a', { ao: 0 });
    const cw = 0.18;
    if (curbSide === 'n') B.box(cx, SW - 0.07, z0 + cw / 2, sx, 0.18, cw, '#dedad0', { ao: 0 });
    if (curbSide === 's') B.box(cx, SW - 0.07, z1 - cw / 2, sx, 0.18, cw, '#dedad0', { ao: 0 });
    if (curbSide === 'e') B.box(x0 + cw / 2, SW - 0.07, cz, cw, 0.18, sz, '#dedad0', { ao: 0 });
    if (curbSide === 'w') B.box(x1 - cw / 2, SW - 0.07, cz, cw, 0.18, sz, '#dedad0', { ao: 0 });
    // a gutter with grates on the road side
    const gz = curbSide === 'n' ? z0 - 0.25 : curbSide === 's' ? z1 + 0.25 : 0;
    const gx = curbSide === 'e' ? x0 - 0.25 : curbSide === 'w' ? x1 + 0.25 : 0;
    if (along) {
      B.box(cx, Y_M + 0.06, gz, sx, 0.02, 0.4, '#5f6268', { ao: 0 });
      for (let x = x0 + 3; x < x1 - 1; x += 7) B.box(x, Y_M + 0.075, gz, 0.9, 0.02, 0.36, '#3a3d42', { ao: 0 });
    } else {
      B.box(gx, Y_M + 0.06, cz, 0.4, 0.02, sz, '#5f6268', { ao: 0 });
      for (let z = z0 + 3; z < z1 - 1; z += 7) B.box(gx, Y_M + 0.075, z, 0.36, 0.02, 0.9, '#3a3d42', { ao: 0 });
    }
  };
  const nIn = MAIN_Z - MAIN_HALF, sIn = MAIN_Z + MAIN_HALF;
  const xC = CROSS_HALF + CROSS_WALK;
  // the main street pavements, cut where the lanes come in
  for (const [a, b] of [[X_MIN - 4, -LANE_X - 2.3], [-LANE_X + 2.3, -CROSS_HALF], [CROSS_HALF, LANE_X - 2.3], [LANE_X + 2.3, X_MAX + 4]]) {
    pave(a, b, nIn - WALK - 0.6, nIn, 's');
    pave(a, b, sIn, sIn + WALK + 0.6, 'n');
  }
  // the cross street pavements
  // the cross street pavements climb with the ramps between the terraces
  const rampPave = (xa: number, xb: number, z0: number, z1: number, curbX: number) => {
    const B = at(curbX).body;
    const cx = (xa + xb) / 2, w = xb - xa, s = Math.sign(cx - curbX);
    const pts: number[] = [];
    for (let z = z0; z < z1 - 0.01; z += 1) pts.push(z);
    pts.push(z1);
    for (let k = 0; k < pts.length - 1; k++) {
      const za = pts[k], zb = pts[k + 1], ya = rampY(za), yb = rampY(zb);
      wallSeg(B, cx, za, cx, zb, ya - 0.05, ya + 0.17, yb - 0.05, yb + 0.17, w, '#c9c4b8', '#cdc8bc');
      wallSeg(B, curbX + s * 0.09, za, curbX + s * 0.09, zb, ya - 0.05, ya + 0.172, yb - 0.05, yb + 0.172, 0.18, '#dedad0', '#e2ded4');
      wallSeg(B, curbX + s * 0.8, za, curbX + s * 0.8, zb, ya + 0.17, ya + 0.182, yb + 0.17, yb + 0.182, 0.3, '#e8c43a', '#e8c43a');
      wallSeg(B, curbX - s * 0.25, za, curbX - s * 0.25, zb, ya + 0.0, ya + 0.06, yb + 0.0, yb + 0.06, 0.4, '#5f6268', '#5f6268');
      wallSeg(B, xa, za, xb, za, ya + 0.16, ya + 0.176, ya + 0.16, ya + 0.176, 0.03, '#aea89c', '#aea89c');
      if (k % 7 === 3) wallSeg(B, curbX - s * 0.25, za, curbX - s * 0.25, za + 0.9, ya + 0.0, ya + 0.075, yb + 0.0, ya + 0.075 + (yb - ya) * 0.9, 0.36, '#3a3d42', '#3a3d42');
    }
  };
  for (const [z0, z1] of [[BACK_N + BACK_HALF, nIn - WALK - 0.6], [sIn + WALK + 0.6, BACK_S - BACK_HALF]]) {
    rampPave(-xC, -CROSS_HALF, z0, z1, -CROSS_HALF);
    rampPave(CROSS_HALF, xC, z0, z1, CROSS_HALF);
  }

  // the signalled crossing
  const X = at(0);
  const stripe = (x0: number, z0: number, x1: number, z1: number) => X.body.box((x0 + x1) / 2, Y_M + 0.075, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, '#f4f2ea', { ao: 0 });
  for (const sx of [-1, 1]) {
    const cx = sx * (CROSS_HALF + 1.9);
    for (let k = 0; k < 8; k++) stripe(cx - 1.4, nIn + 0.3 + k * 0.95, cx + 1.4, nIn + 0.75 + k * 0.95);
    stripe(sx * (CROSS_HALF + 3.7) - 0.15, sx > 0 ? nIn + 0.2 : MAIN_Z, sx * (CROSS_HALF + 3.7) + 0.15, sx > 0 ? MAIN_Z : sIn - 0.2);
  }
  for (const sz of [-1, 1]) {
    const cz = MAIN_Z + sz * (MAIN_HALF + 1.9);
    for (let k = 0; k < 7; k++) stripe(-CROSS_HALF + 0.25 + k * 0.95, cz - 1.4, -CROSS_HALF + 0.7 + k * 0.95, cz + 1.4);
  }
  trafficLight(X, xC - 0.4, SW, nIn - 0.4, -90, 6.5, 'green');
  trafficLight(X, -xC + 0.4, SW, sIn + 0.4, 90, 6.5, 'green');
  trafficLight(X, -xC + 0.4, SW, nIn - 0.4, 0, 4.5, 'red');
  trafficLight(X, xC - 0.4, SW, sIn + 0.4, 180, 4.5, 'red');
  for (const [x, z, yaw] of [[-xC + 0.3, nIn - 1.6, 0], [xC - 0.3, sIn + 1.6, 180], [xC - 0.3, nIn - 1.6, 0], [-xC + 0.3, sIn + 1.6, 180]] as const) signPole(X, atlas, 'pedCross', x, SW, z, yaw, 2.6, 0.7);
  // the back lanes meet the cross street: red paint, a stop line, 止まれ, a triangle sign, a mirror
  for (const lz of [BACK_N, BACK_S]) for (const sx of [-1, 1]) {
    const c = at(sx * 8);
    const LY = lz === BACK_N ? Y_N : Y_S;
    c.body.box(sx * (CROSS_HALF + 5), LY + 0.07, lz, 7.5, 0.02, BACK_HALF * 2 - 0.3, '#b9554a', { ao: 0 });
    c.body.box(sx * (CROSS_HALF + 1.4), LY + 0.08, lz, 0.35, 0.02, BACK_HALF * 2 - 0.4, '#f4f2ea', { ao: 0 });
    roadPaint(c, atlas, 'roadStop', sx * (CROSS_HALF + 4.2), LY + 0.09, lz, 2.6, sx > 0 ? 90 : -90);
    const sz = lz + (lz === BACK_N ? -BACK_HALF - 0.5 : BACK_HALF + 0.5), mz = lz + (lz === BACK_N ? BACK_HALF + 0.6 : -BACK_HALF - 0.6);
    roadSign(c, atlas, 'stopSign', sx * (CROSS_HALF + 2.2), heightAt(sx * (CROSS_HALF + 2.2), sz) + 0.05, sz, sx > 0 ? -90 : 90, 2.5);
    convexMirror(c, sx * (CROSS_HALF + 1.2), heightAt(sx * (CROSS_HALF + 1.2), mz) + 0.05, mz, sx > 0 ? -90 : 90);
  }

  // utility poles with wires along both pavements and the back lanes
  type Pole = { x: number; z: number; w: ReturnType<typeof utilityPole> };
  const line = (xs: number[], z: number, y: number | null, tr: number) => xs.map((x, k): Pole => ({ x, z, w: utilityPole(at(x), y ?? heightAt(x, z) + 0.05, z, 0, { transformer: k % tr === 1 }) }));
  const xsN = [-104, -82, -56, -34, -12, 12, 34, 56, 80, 104];
  const xsS = [-94, -70, -46, -22, 22, 46, 70, 94];
  const lines: Pole[][] = [line(xsN, nIn - 0.45, SW, 3), line(xsS, sIn + 0.45, SW, 4), line([-100, -76, -50, -26, -8, 8, 26, 50, 76, 100], BACK_N + BACK_HALF + 0.5, null, 3), line([-100, -76, -50, -26, -8, 8, 26, 50, 76], BACK_S - BACK_HALF - 0.5, null, 3)];
  for (const ln of lines) {
    for (let i = 0; i < ln.length - 1; i++) {
      wireSpan(at(ln[i].x), ln[i].w.power, ln[i + 1].w.power, 0.5);
      wireSpan(at(ln[i].x), ln[i].w.phone, ln[i + 1].w.phone, 0.4, 0.022, '#34383d');
    }
  }
  for (let i = 0; i < 7; i++) wireSpan(at(lines[0][i].x), [lines[0][i].w.power[1], lines[0][i].w.phone[0]], [lines[1][Math.min(i, lines[1].length - 1)].w.power[1], lines[1][Math.min(i, lines[1].length - 1)].w.phone[1]], 0.6);
  for (let i = 0; i < 9; i += 2) wireSpan(at(lines[0][i].x), [lines[0][i].w.phone[1]], [lines[2][Math.min(i, lines[2].length - 1)].w.phone[0]], 1.2, 0.02);

  // lamps, guard pipes, hydrants, cones, vending machines, bikes and pots on the pavements
  const curbN = nIn - 0.4, curbS = sIn + 0.4;
  for (const x of [-112, -92, -70, -44, -24, 24, 44, 68, 92, 112]) {
    doubleLamp(at(x), x + 6, SW, curbN);
    doubleLamp(at(x), x - 5, SW, curbS);
  }
  for (const [a, b] of [[-108, -66], [-58, -9], [9, 58], [66, 108]]) {
    for (let x = a; x < b - 3; x += 6.4) {
      if (r() < 0.75) guardPipe(at(x), x, curbN - 0.15, x + 3.4, curbN - 0.15, SW, r() < 0.15 ? '#c8322e' : '#4caf50');
      if (r() < 0.6 && !(x > 6 && x < 22) && !(x > -50 && x < -26)) guardPipe(at(x + 2), x + 2, curbS + 0.15, x + 5.4, curbS + 0.15, SW, '#4caf50');
    }
  }
  for (const x of [-86, -40, 18, 74]) hydrant(at(x), x, SW, curbN - 0.6);
  for (const x of [-64, 40, 98]) hydrant(at(x), x, SW, curbS + 0.6);
  for (let k = 0; k < 6; k++) cone(at(-30 + k * 0.8), -30 + k * 0.8, Y_M + 0.05, MAIN_Z - MAIN_HALF + 0.6);
  cone(at(-40), -40.5, SW, nIn - 1.4);
  for (let k = 0; k < 14; k++) {
    const x = X_MIN + 6 + r() * (X_MAX - X_MIN - 12);
    if (Math.abs(x) < 8 || Math.abs(Math.abs(x) - LANE_X) < 4) continue;
    const north = r() < 0.5;
    const z = north ? nIn - WALK + 0.55 : sIn + WALK - 0.55;
    const c = at(x);
    const t = r();
    if (t < 0.3) { vendingMachine(c, atlas, x, SW, z, north ? 0 : 180, r() < 0.5 ? 'vendRed' : 'vendBlue'); bins(c, x + 0.9, SW, z); }
    else if (t < 0.55) { pot(c, x, SW, z, k); pot(c, x + 0.6, SW, z + 0.1, k + 1); shrub(c, 'flower', x + 1.3, SW, z, 0.7, k); }
    else if (t < 0.75) { bicycle(c, x, SW, z + (north ? -0.4 : 0.4), 0, pick(r, ['#4f7fd9', '#d94f4f', '#7fb8b0', '#e0b341'])); bicycle(c, x + 0.8, SW, z + (north ? -0.4 : 0.4), 0, pick(r, ['#9a9a9a', '#2a2a2a', '#f4f4ee'])); }
    else if (t < 0.88) boxes(c, x, SW, z, 3);
    else aBoard(c, atlas, pick(r, ['menu', 'cafeMenu', 'sale']), x, SW, z + (north ? 0.6 : -0.6), north ? 0 : 180);
  }
  vendingMachine(at(-5), atlas, -7.6, SW, nIn - WALK + 0.5, 0, 'vendBlue');
  vendingMachine(at(38), atlas, 38.8, SW + 0.0, nIn - WALK - 1.6, 0, 'vendRed');
  bins(at(38), 39.8, SW, nIn - WALK - 1.6);
  busStop(at(-80), atlas, -80, SW, sIn + 1.4, 180);
  signPole(at(-60), atlas, 'blueArrow', -LANE_X - 2.8, SW, nIn - 0.8, 0, 2.6);
  signPole(at(60), atlas, 'noEntry', LANE_X + 2.8, SW, sIn + 0.8, 180, 2.6);
  signPole(at(-30), atlas, 'speed30', -30, SW, nIn - 0.5, 0, 2.6);
  signPole(at(30), atlas, 'speed30', 30, SW, sIn + 0.5, 180, 2.6);
  // the konbini and supermarket car parks: lines, wheel stops, cars and a tall sign
  const park = (x0: number, n: number, zEdge: number, zDeep: number) => {
    const c = at(x0 + n * 1.5);
    occ.mark(x0 - 0.3, zEdge, x0 + n * 2.8 + 0.3, zDeep + 0.3);
    for (let k = 0; k <= n; k++) c.body.box(x0 + k * 2.8, Y_M + 0.08, (zEdge + zDeep) / 2, 0.12, 0.02, Math.abs(zDeep - zEdge) - 0.6, '#f4f2ea', { ao: 0 });
    for (let k = 0; k < n; k++) {
      c.body.box(x0 + 1.4 + k * 2.8, Y_M + 0.12, zDeep - 0.5, 1.4, 0.12, 0.18, '#c9c6bd', { ao: 0.1 });
      if (r() < 0.55) parkedVehicle(c, pick(r, ['car', 'keivan', 'van', 'kei'] as const), pick(r, ['#f4f4ee', '#3a4a6a', '#7a2a2e', '#d8d8d0', '#2f2f35', '#c8c0a8']), x0 + 1.4 + k * 2.8, Y_M + 0.05, (zEdge + zDeep) / 2 + 0.3, 90);
    }
  };
  const parkTop = sIn + WALK + 0.2;
  park(6.6, 5, parkTop, parkTop + 6.3);
  park(-49.6, 8, parkTop, parkTop + 5.8);
  {
    const c = at(22);
    c.body.box(22.5, SW + 3.2, parkTop + 0.8, 0.3, 6.4, 0.3, '#9aa0a6', { ao: 0.05 });
    c.body.box(22.5, SW + 6.4, parkTop + 0.8, 0.5, 1.8, 2.2, '#2a8fd8', { ao: 0 });
    const cell = atlas.get('konbini');
    for (const side of [1, -1]) {
      const x = 22.5 + side * 0.26;
      const uL = side > 0 ? cell.u1 : cell.u0, uR = side > 0 ? cell.u0 : cell.u1;
      c.sign.quadFacing([x, SW + 5.8, parkTop + 0.8 - 0.95], [x, SW + 5.8, parkTop + 0.8 + 0.95], [x, SW + 7.0, parkTop + 0.8 + 0.95], [x, SW + 7.0, parkTop + 0.8 - 0.95], [side, 0, 0], [1, 1, 1], [[uL, cell.v0], [uR, cell.v0], [uR, cell.v1], [uL, cell.v1]]);
    }
  }
  parkedVehicle(at(28), 'truck', '#f4f4f0', 28.5, Y_M + 0.05, MAIN_Z + 2.0, 180);
  parkedVehicle(at(-12), 'kei', '#f4f4ee', -36.0, Y_N + 0.05, BACK_N + 0.6, 180);
  // the back lanes: lamps, a mirror, a vending machine by a tiled wall, cones
  for (const x of [-90, -40, 16, 44, 90]) classicLamp(at(x), x, heightAt(x, BACK_N - BACK_HALF - 0.4) + 0.05, BACK_N - BACK_HALF - 0.4);
  for (const x of [-88, -36, 18, 70]) classicLamp(at(x), x, heightAt(x, BACK_S + BACK_HALF + 0.4) + 0.05, BACK_S + BACK_HALF + 0.4);
  vendingMachine(at(-24), atlas, -23.8, Y_N + RAISE + 0.02, BACK_N - BACK_HALF - 0.9, 0, 'vendRed');
  bins(at(-24), -22.9, Y_N + RAISE + 0.02, BACK_N - BACK_HALF - 0.9);
  for (const x of [-48, 30]) for (let k = 0; k < 2; k++) cone(at(x), x + k * 0.9, Y_S + 0.05, BACK_S - 0.8);
  // trees on the pavement corners
  for (const [x, z, kind] of [[-9.4, nIn - WALK - 0.3, 'jacaranda'], [9.6, nIn - WALK - 0.5, 'sakura'], [-58, sIn + WALK + 0.4, 'jacaranda'], [58, nIn - WALK - 0.3, 'jacaranda'], [100, sIn + WALK + 0.3, 'sakura']] as const) trees.add(kind, x, z, 0.85, SW);
  void wireSpan;
}

// ---------------------------------------------------------------------------------------------
// around the town: paddies, the pond, jizo on the shrine path
// ---------------------------------------------------------------------------------------------
function outskirts(at: (x: number) => Ctx, atlas: SignAtlas, r: () => number, trees: TreeField) {
  const A = at;
  buildPaddies(A(PADDY.x), A, r);
  scarecrow(A(PADDY.x), PADDY.x - 8, heightAt(PADDY.x - 8, PADDY.z + 4), PADDY.z + 4);
  scarecrow(A(PADDY.x), PADDY.x + 12, heightAt(PADDY.x + 12, PADDY.z - 8), PADDY.z - 8);
  {
    const shed = buildHouse({ w: 4.6, d: 3.6, floors: 1, wall: '#d8c9a6', trim: '#6b5a48', roof: 'gable', roofColor: '#6a5648', door: '#6a4a3a', doorU: 0, ac: 0, antenna: false, lit: 0 }, r, atlas);
    const sx = PADDY.x - PADDY.hx - 5, sz = PADDY.z - PADDY.hz + 6;
    appendCtx(A(PADDY.x), shed, sx, heightAt(sx, sz) - 0.1, sz, 90);
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    const rx = POND.x + Math.cos(a) * (POND.radius - 1.2), rz = POND.z + Math.sin(a) * (POND.radius - 1.2);
    A(rx).body.blob(rx, WATER_Y + 0.15, rz, 1.0 + (k % 3) * 0.4, 0.6, 0.9, ['#8f8b82', '#a29d92', '#7d7a72'][k % 3], { seed: k });
  }
  for (let k = 0; k < 7; k++) A(POND.x).body.disc(POND.x + Math.cos(k * 2.3) * (4 + k * 1.1), WATER_Y + 0.06, POND.z + Math.sin(k * 2.3) * (3 + k), 0.7, 0.04, 'y', '#5aa845', 10);
  A(POND.x).body.box(POND.x + POND.radius - 4, WATER_Y + 0.5, POND.z, 8, 0.2, 2.0, '#9a7a52', { ao: 0.1 });
  jizo(A(2), 3.0, Y_N + 0.1, -2, -20);
  jizo(A(-2), -3.0, Y_N + 0.1, -4, 25);
  for (const [gx, gz, n] of [[-28, 115, 24], [-132, 60, 14], [-134, 116, 18], [30, 115, 18], [134, 20, 14], [-132, 0, 16], [134, 70, 12], [-60, 165, 18], [40, 168, 20]] as const) {
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 12;
      const tx = gx + Math.cos(a) * rad, tz = gz + Math.sin(a) * rad;
      const rd = roadNear(tx, tz);
      if (rd.d < rd.width / 2 + 2.5 || Math.abs(tz - EXPRESSWAY.z) < 12 || (Math.abs(tz - IC_RAMP.z) < 14 && Math.abs(tx) < 200)) continue;
      trees.add(pick(r, ['round', 'round', 'ginkgo', 'sakura', 'cedar', 'maple', 'jacaranda'] as const), tx, tz, 0.8 + r() * 0.5, heightAt(tx, tz) - 0.2);
    }
  }
}

/** One mesh per kind of surface for every chunk of the town. */
function assemble(chunks: Map<number, Ctx>, atlas: SignAtlas): VillageBuild {
  const group = new Group();
  group.name = 'Town';
  const body = new MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 });
  const win = new MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.4, envMapIntensity: 1.4 });
  const litA = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#ffcf7a'), emissiveIntensity: 0 });
  const litB = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#e6f4ff'), emissiveIntensity: 0 });
  const sign = new MeshStandardMaterial({ map: atlas.texture, emissiveMap: atlas.texture, emissive: new Color('#ffffff'), emissiveIntensity: 0.3, roughness: 0.55, alphaTest: 0.4, side: 2 });
  // regroup every chunk's triangles into 40 m cells, so the camera and the shadow pass skip what they cannot see
  const kinds: [keyof Omit<Ctx, 'r'>, MeshStandardMaterial, boolean, string][] = [['body', body, true, 'Buildings'], ['win', win, false, 'Windows'], ['litA', litA, false, 'Lit windows'], ['litB', litB, false, 'Lit windows 2'], ['sign', sign, false, 'Signs']];
  for (const [part, mat, shadow, name] of kinds) {
    const cells = GeoBuilder.splitByCell([...chunks.values()].map((c) => c[part]), 40);
    for (const [k, geo] of cells) {
      const m = new Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.name = `${name} ${k}`;
      group.add(m);
    }
  }
  return {
    group,
    update(night: number) {
      litA.emissiveIntensity = 0.05 + night * 1.2;
      litB.emissiveIntensity = 0.04 + night * 1.0;
      sign.emissiveIntensity = 0.3 + night * 0.9;
    },
  };
}

export type { V3 };
