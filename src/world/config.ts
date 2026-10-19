import { clamp, lerp, smoothstep } from '../util/rng';
import { fbm, ridged } from '../util/noise';

/**
 * The shape of the world: a Japanese village at the foot of a big mountain. Metres: x east, z south, y up.
 * The drone can fly over a 300 x 300 m map (HALF); the ground mesh reaches further so the mountain can rise behind it.
 */
export const HALF = 150;
export const TERRAIN_HALF = 290;

export const VILLAGE = { cx: 0, cz: 70, hx: 150, hz: 95 }; // the open country around the town (no forest)
export const MOUNTAIN = { x: 10, z: -270, radius: 270, height: 255 };
export const POND = { x: -100, z: 128, radius: 16 };
/** Terraced rice paddies on the slope below the town (edges on the 2.5 m terrain grid). */
export const PADDY = { x: 112.5, z: 123.75, hx: 27.5, hz: 18.75, rows: 6 };
export const SHRINE = { x: 66, z: -78, radius: 24, height: 50 };

/**
 * The town climbs the hillside in three terraces held up by retaining walls. Streets running east-west lie flat on a
 * terrace; the three streets running north-south ramp from one terrace to the next, and stairs climb the walls in
 * narrow alleys. The town's edges lie on the 2.5 m terrain grid so the terrain can be cut out cleanly beneath it.
 */
export const TOWN = { x0: -115, x1: 115, z0: -7.5, z1: 102.5 };
export const TERRACES = [
  { z0: -7.5, z1: 23.6, y: 17 },
  { z0: 23.6, z1: 69.5, y: 12 },
  { z0: 69.5, z1: 102.5, y: 7 },
];
/** The house rows on the uphill side of the back lanes stand on a raised strip behind a low wall. */
export const PLATFORMS = [{ z0: -7.5, z1: 5.7, dy: 0.75 }, { z0: 69.5, z1: 81.7, dy: 0.75 }];
export const RAMP_BANDS = [{ x: 0, half: 6 }, { x: -62, half: 3.4 }, { x: 62, half: 3.4 }];
export const RAMPS = [{ z0: 11, z1: 36, y0: 17, y1: 12 }, { z0: 52, z1: 80, y0: 12, y1: 7 }];
export const STAIRS = [{ x: -30, z: 23.6, w: 3 }, { x: 86, z: 23.6, w: 3 }, { x: 34, z: 69.5, w: 3 }, { x: -86, z: 69.5, w: 3 }];

export const inTown = (x: number, z: number) => x > TOWN.x0 && x < TOWN.x1 && z > TOWN.z0 && z < TOWN.z1;
export const townDist = (x: number, z: number) => Math.max(TOWN.x0 - x, x - TOWN.x1, TOWN.z0 - z, z - TOWN.z1);
/** The level of a terrace's streets. */
export const baseTerraceY = (z: number) => (z < TERRACES[0].z1 ? TERRACES[0].y : z < TERRACES[1].z1 ? TERRACES[1].y : TERRACES[2].y);
/** The level of the ground away from the ramp streets (with the raised strips). */
export const terraceY = (z: number) => baseTerraceY(z) + (PLATFORMS.find((p) => z >= p.z0 && z < p.z1)?.dy ?? 0);
/** The ramp band (north-south street) a point lies in, if any. */
export const rampBand = (x: number) => RAMP_BANDS.find((b) => Math.abs(x - b.x) <= b.half);
/** An even grade with rounded ends (a fifth of the length at each end). */
const ease = (t: number) => {
  const b = 0.2, v = 1 / (1 - b);
  if (t < b) return (v * t * t) / (2 * b);
  if (t > 1 - b) return 1 - (v * (1 - t) * (1 - t)) / (2 * b);
  return v * (t - b / 2);
};
/** The height of a ramp street at z (the terrace height outside the ramps). */
export function rampY(z: number): number {
  for (const r of RAMPS) if (z > r.z0 && z < r.z1) return r.y0 + (r.y1 - r.y0) * ease((z - r.z0) / (r.z1 - r.z0));
  return baseTerraceY(z);
}
/** The ground of the town: a terrace, or a ramp street. */
export const townGround = (x: number, z: number) => (rampBand(x) ? rampY(z) : terraceY(z));

export const inPaddy = (x: number, z: number) => Math.abs(x - PADDY.x) < PADDY.hx && Math.abs(z - PADDY.z) < PADDY.hz;
export const paddyRow = (z: number) => clamp(Math.floor(((z - (PADDY.z - PADDY.hz)) / (PADDY.hz * 2)) * PADDY.rows), 0, PADDY.rows - 1);
export const paddyRowZ = (row: number) => PADDY.z - PADDY.hz + ((row + 0.5) * PADDY.hz * 2) / PADDY.rows;
/** The level of a paddy row, a step below the one above it. */
export const paddyY = (row: number) => hillBase(paddyRowZ(row)) - 0.35;

/** The long slope of the land: high under the mountain, low by the paddies. */
export function hillBase(z: number): number {
  const s = 130 - z;
  return 1.4 + (0.13 * (s + Math.sqrt(s * s + 100))) / 2;
}
export const WATER_Y = 0.25;

/** How far a point is outside the flat village ground (negative inside). */
export const villageDist = (x: number, z: number) => Math.max(Math.abs(x - VILLAGE.cx) - VILLAGE.hx, Math.abs(z - VILLAGE.cz) - VILLAGE.hz);

/** 0 in the village .. 1 on the mountain. */
export const mountainMask = (x: number, z: number) => smoothstep(-5, -90, z) * 0.9 + smoothstep(60, 130, Math.abs(x)) * smoothstep(40, -60, z) * 0.35;

function baseHeight(x: number, z: number): number {
  const quiet = smoothstep(0, 40, townDist(x, z));
  let h = hillBase(z) + (fbm(x * 0.012, z * 0.012, 3) * 3.2 + fbm(x * 0.05 + 50, z * 0.05, 2) * 0.5) * quiet;
  // wooded hills rise on both sides of the town, leaving a saddle where the main street runs out
  const side = smoothstep(118, 172, Math.abs(x)) * (1 - 0.75 * Math.exp(-(((z - 44) / 16) ** 2)));
  h += side * (20 + fbm(x * 0.03 + 4, z * 0.03, 2) * 6);
  // the big mountain behind the village, with a ridge of lower peaks on both sides
  const dm = Math.hypot((x - MOUNTAIN.x) * 0.9, z - MOUNTAIN.z);
  if (dm < MOUNTAIN.radius) {
    const t = 1 - dm / MOUNTAIN.radius;
    h += (MOUNTAIN.height * Math.pow(t, 1.5) + fbm(x * 0.03, z * 0.03, 3) * 10 * t) * (0.25 + 0.75 * smoothstep(4, 110, townDist(x, z)));
    h -= Math.max(0, 1 - dm / 20) * 12; // a crater at the top
  }
  const m = mountainMask(x, z);
  // the ridges calm down into gentle foothills around the town
  if (m > 0) h += (ridged(x * 0.012 + 7, z * 0.012 - 3, 4) * 0.75 + (fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5) * 0.25) * m * 62 * smoothstep(6, 100, townDist(x, z));
  // the terrace of the shrine
  const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  h = lerp(h, SHRINE.height, 1 - smoothstep(SHRINE.radius - 4, SHRINE.radius + 38, ds));
  // the pond, dug into the slope
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h = lerp(h, -3, smoothstep(POND.radius + 6, POND.radius - 8, dp));
  return h;
}

/** The ground height before the roads are cut into it. */
export const rawHeight = baseHeight;

/** The roads: smooth paths sampled every 2 m, with a smoothed height so they never jump. */
export interface RoadPath { name: string; width: number; x: number[]; z: number[]; y: number[]; len: number; box: [number, number, number, number] }
const ROAD_DEFS: { name: string; width: number; pts: [number, number][]; even?: boolean }[] = [
  { name: 'main', width: 8, pts: [[-152, 44], [-60, 44], [0, 44], [60, 44], [152, 44]] },
  { name: 'cross', width: 7, pts: [[0, 126], [0, 84], [0, 44], [0, 8], [0, 2]] },
  { name: 'back north', width: 4.6, pts: [[-112, 8], [-60, 8], [0, 8], [60, 8], [112, 8]] },
  { name: 'back south', width: 4.6, pts: [[-112, 84], [-60, 84], [0, 84], [60, 84], [92, 84]] },
  { name: 'west lane', width: 4.6, pts: [[-62, 8], [-62, 44], [-62, 84], [-62, 106], [-46, 134]] },
  { name: 'east lane', width: 4.6, pts: [[62, 8], [62, 44], [62, 84], [62, 106], [72, 124]] },
  { name: 'shrine path', width: 4.2, even: true, pts: [[0, 2], [0, -8], [4, -26], [20, -42], [42, -52], [58, -56], [66, -62], [66, -66]] },
];
function buildRoad(def: (typeof ROAD_DEFS)[number]): RoadPath {
  const P = def.pts;
  const pts: [number, number][] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[P.length - 1]);
  // in town a road lies exactly on its terrace or ramp; outside it follows the smoothed ground and eases into the town
  const town = pts.map(([x, z]) => inTown(x, z));
  const raw = pts.map(([x, z], i) => (town[i] ? townGround(x, z) : baseHeight(x, z)));
  const smooth = raw.map((_, i) => {
    let sum = 0, n = 0;
    for (let k = -9; k <= 9; k++) {
      const j = i + k;
      if (j >= 0 && j < raw.length) { sum += raw[j]; n++; }
    }
    return sum / n;
  });
  const y = raw.map((v, i) => {
    if (town[i]) return v;
    for (let k = 1; k <= 16; k++) {
      for (const j of [i - k, i + k]) if (j >= 0 && j < raw.length && town[j]) return lerp(raw[j], smooth[i], k / 16);
    }
    return smooth[i];
  });
  // a path that climbs at an even grade from the town's edge to its end (cut into the hillside)
  if (def.even) {
    const i0 = town.indexOf(false), n = y.length - 1;
    if (i0 > 0) for (let i = i0; i <= n; i++) y[i] = lerp(raw[i0 - 1], raw[n], (i - i0 + 1) / (n - i0 + 1));
  }
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const m = def.width / 2 + 20;
  return { name: def.name, width: def.width, x: xs, z: zs, y, len: pts.length, box: [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m] };
}
let roads: RoadPath[] | null = null;
export const getRoads = (): RoadPath[] => (roads ??= ROAD_DEFS.map(buildRoad));
export const getRoad = (name: string): RoadPath => getRoads().find((r) => r.name === name)!;

/** Distance to the nearest road and that road's height there. */
export function roadNear(x: number, z: number): { d: number; y: number; width: number } {
  let best = Infinity, by = 0, bw = 0;
  for (const r of getRoads()) {
    if (x < r.box[0] || x > r.box[2] || z < r.box[1] || z > r.box[3]) continue;
    for (let i = 0; i < r.len; i++) {
      const dx = x - r.x[i], dz = z - r.z[i];
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; by = r.y[i]; bw = r.width; }
    }
  }
  return { d: Math.sqrt(best), y: by, width: bw };
}

/** The ground you stand on: the town's terraces, the paddy steps, or the natural ground with the roads cut in. */
export function heightAt(x: number, z: number): number {
  if (inTown(x, z)) return townGround(x, z);
  if (inPaddy(x, z)) return paddyY(paddyRow(z));
  return naturalHeight(x, z);
}

/** The natural ground with the roads cut in (what the terrain mesh shows outside the town and the paddies). */
export function naturalHeight(x: number, z: number): number {
  const h = baseHeight(x, z);
  const { d, y, width } = roadNear(x, z);
  if (!isFinite(d)) return h;
  // fully cut down for a terrain cell's diagonal (3.6 m) beyond the road edge, so no grid triangle can poke through the
  // road surface on a slope; then blending back into the hillside
  const w = 1 - smoothstep(width * 0.5 + 3.6, width * 0.5 + 11, d);
  return w > 0 ? lerp(h, y - 0.25, w) : h;
}

/** Slope (rise over run) from a short central difference. */
export function slopeAt(x: number, z: number, d = 2): number {
  const dx = heightAt(x + d, z) - heightAt(x - d, z);
  const dz = heightAt(x, z + d) - heightAt(x, z - d);
  return Math.hypot(dx, dz) / (2 * d);
}

/** How much forest grows here: 0 (none) to 1 (dense). */
export function forestDensity(x: number, z: number, h = heightAt(x, z)): number {
  if (h < 0.8 || h > 110) return 0;
  const dv = villageDist(x, z);
  if (dv < 2) return 0;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 6) return 0;
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.radius - 2) return 0.1;
  const n = fbm(x * 0.022 + 10, z * 0.022 - 4, 3) * 0.5 + 0.5;
  const base = smoothstep(0.3, 0.55, n);
  const mt = clamp(mountainMask(x, z) * 1.2, 0, 1);
  const hi = 1 - smoothstep(70, 110, h);
  return clamp((base * 0.6 + mt * 0.7) * hi * smoothstep(2, 18, dv), 0, 1);
}

export interface Place {
  key: string;
  name: string;
  jp: string;
  x: number;
  z: number;
  radius: number;
  dist: number;
  pitch: number; // degrees above the horizon
  yaw: number; // degrees
}

export const PLACES: Place[] = [
  { key: 'street', name: 'Hoshi Ginza', jp: '星銀座', x: -16, z: 42, radius: 30, dist: 15, pitch: 9, yaw: 70 },
  { key: 'crossing', name: 'Ekimae Crossing', jp: '駅前交差点', x: 0, z: 44, radius: 18, dist: 24, pitch: 12, yaw: 200 },
  { key: 'konbini', name: 'Hoshi Mart', jp: 'ほしマート', x: 16, z: 56, radius: 16, dist: 22, pitch: 12, yaw: 150 },
  { key: 'ramen', name: 'Ramen Corner', jp: 'ラーメン角', x: 34, z: 40, radius: 16, dist: 20, pitch: 12, yaw: 20 },
  { key: 'backlane', name: 'Back Lane', jp: '裏通り', x: -30, z: 8, radius: 26, dist: 16, pitch: 10, yaw: 80 },
  { key: 'slope', name: 'Hoshi Slope', jp: '星坂', x: 0, z: 64, radius: 12, dist: 34, pitch: 20, yaw: 160 },
  { key: 'stairs', name: 'Stone Steps', jp: '石段', x: 34, z: 72, radius: 9, dist: 30, pitch: 52, yaw: 0 },
  { key: 'hillside', name: 'Hillside Terraces', jp: '段々の町', x: -30, z: 60, radius: 6, dist: 130, pitch: 17, yaw: 32 },
  { key: 'town', name: 'Hoshi Town', jp: '星の町', x: 0, z: 46, radius: 110, dist: 190, pitch: 42, yaw: 16 },
  { key: 'paddies', name: 'Rice Paddies', jp: '田んぼ', x: PADDY.x, z: PADDY.z, radius: 34, dist: 80, pitch: 32, yaw: -28 },
  { key: 'pond', name: 'Koi Pond', jp: '鯉の池', x: POND.x, z: POND.z, radius: 24, dist: 56, pitch: 34, yaw: 30 },
  { key: 'shrine', name: 'Kamigawa Shrine', jp: '神川神社', x: SHRINE.x, z: SHRINE.z + 8, radius: 32, dist: 80, pitch: 30, yaw: 12 },
  { key: 'mountain', name: 'Mt. Hoshi', jp: '星山', x: 6, z: -40, radius: 120, dist: 360, pitch: 14, yaw: 4 },
];

export function placeAt(x: number, z: number): Place {
  let best: Place | null = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z) / p.radius;
    if (d < 1 && d < bestD) { best = p; bestD = d; }
  }
  if (best) return best;
  const h = heightAt(x, z);
  const mk = (key: string, name: string, jp: string): Place => ({ key, name, jp, x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 });
  if (h > 70) return mk('peak', 'Mt. Hoshi', '星山');
  if (villageDist(x, z) > 2 && forestDensity(x, z, h) > 0.3) return mk('forest', 'Hoshi Forest', '星の森');
  return mk('town', 'Hoshi Town', '星の町');
}
