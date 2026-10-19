import { clamp, lerp, smoothstep } from '../util/rng';
import { fbm, ridged } from '../util/noise';

/**
 * The shape of the world: a Japanese village at the foot of a big mountain. Metres: x east, z south, y up.
 * The drone can fly over a 300 x 300 m map (HALF); the ground mesh reaches further so the mountain can rise behind it.
 */
export const HALF = 150;
export const TERRAIN_HALF = 290;

export const VILLAGE = { cx: 0, cz: 70, hx: 150, hz: 95, height: 2 }; // the flat ground the village stands on
export const MOUNTAIN = { x: 10, z: -270, radius: 270, height: 255 };
export const POND = { x: -102, z: 108, radius: 17 };
export const PADDY = { x: 120, z: 104, hx: 26, hz: 20, height: 1.2 };
export const SHRINE = { x: 66, z: -78, radius: 24, height: 30 };
export const WATER_Y = 0.25;

/** How far a point is outside the flat village ground (negative inside). */
export const villageDist = (x: number, z: number) => Math.max(Math.abs(x - VILLAGE.cx) - VILLAGE.hx, Math.abs(z - VILLAGE.cz) - VILLAGE.hz);

/** 0 in the village .. 1 on the mountain. */
export const mountainMask = (x: number, z: number) => smoothstep(-5, -90, z) * 0.9 + smoothstep(60, 130, Math.abs(x)) * smoothstep(40, -60, z) * 0.35;

function baseHeight(x: number, z: number): number {
  let h = 2 + fbm(x * 0.012, z * 0.012, 3) * 3.2 + fbm(x * 0.05 + 50, z * 0.05, 2) * 0.5;
  // the big mountain behind the village, with a ridge of lower peaks on both sides
  const dm = Math.hypot((x - MOUNTAIN.x) * 0.9, z - MOUNTAIN.z);
  if (dm < MOUNTAIN.radius) {
    const t = 1 - dm / MOUNTAIN.radius;
    h += MOUNTAIN.height * Math.pow(t, 1.5) + fbm(x * 0.03, z * 0.03, 3) * 10 * t;
    h -= Math.max(0, 1 - dm / 20) * 12; // a crater at the top
  }
  const m = mountainMask(x, z);
  if (m > 0) h += (ridged(x * 0.012 + 7, z * 0.012 - 3, 4) * 0.75 + (fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5) * 0.25) * m * 62;
  // the terrace of the shrine
  const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  h = lerp(h, SHRINE.height, 1 - smoothstep(SHRINE.radius - 4, SHRINE.radius + 38, ds));
  // the flat ground of the village (and its paddies)
  const dv = villageDist(x, z);
  const flat = 1 - smoothstep(0, 46, dv);
  h = lerp(h, VILLAGE.height, flat);
  // the pond, dug into the village ground
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h = lerp(h, -3, smoothstep(POND.radius + 6, POND.radius - 8, dp));
  // the paddies sit a little lower than the road, with a bank around them
  const pd = Math.max(Math.abs(x - PADDY.x) - PADDY.hx, Math.abs(z - PADDY.z) - PADDY.hz);
  if (pd < 6) h = lerp(h, PADDY.height, 1 - smoothstep(-2, 5, pd));
  return h;
}

/** The ground height before the roads are cut into it. */
export const rawHeight = baseHeight;

/** The roads: smooth paths sampled every 2 m, with a smoothed height so they never jump. */
export interface RoadPath { name: string; width: number; x: number[]; z: number[]; y: number[]; len: number; box: [number, number, number, number] }
const ROAD_DEFS: { name: string; width: number; pts: [number, number][] }[] = [
  { name: 'main', width: 8, pts: [[-152, 44], [-60, 44], [0, 44], [60, 44], [152, 44]] },
  { name: 'cross', width: 7, pts: [[0, 126], [0, 84], [0, 44], [0, 8], [0, 2]] },
  { name: 'back north', width: 4.6, pts: [[-112, 8], [-60, 8], [0, 8], [60, 8], [112, 8]] },
  { name: 'back south', width: 4.6, pts: [[-112, 84], [-60, 84], [0, 84], [60, 84], [92, 84]] },
  { name: 'west lane', width: 4.6, pts: [[-62, 8], [-62, 44], [-62, 84], [-60, 112], [-44, 134]] },
  { name: 'east lane', width: 4.6, pts: [[62, 8], [62, 44], [62, 84], [70, 104], [88, 118]] },
  { name: 'shrine path', width: 4.2, pts: [[0, 2], [0, -8], [4, -26], [20, -42], [42, -52], [58, -56], [66, -62], [66, -66]] },
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
  const raw = pts.map(([x, z]) => baseHeight(x, z));
  const y = raw.map((_, i) => {
    let sum = 0, n = 0;
    for (let k = -9; k <= 9; k++) {
      const j = i + k;
      if (j >= 0 && j < raw.length) { sum += raw[j]; n++; }
    }
    return sum / n;
  });
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

/** The ground height at a point, with the roads cut in. */
export function heightAt(x: number, z: number): number {
  const h = baseHeight(x, z);
  const { d, y, width } = roadNear(x, z);
  if (!isFinite(d)) return h;
  const w = 1 - smoothstep(width * 0.5 + 1, width * 0.5 + 9, d);
  return w > 0 ? lerp(h, y - 0.06, w) : h;
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
