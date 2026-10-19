import { clamp, lerp, smoothstep } from '../util/rng';
import { fbm, ridged } from '../util/noise';

/** The shape of the world. Everything is in metres: x east, z south, y up. The map is 1000 x 1000 m. */
export const HALF = 500;

export const CITY = {
  cx: 0,
  cz: 120,
  blocks: 6,
  block: 52,
  street: 12,
  height: 3,
  get pitch() { return this.block + this.street; },
  get extent() { return this.blocks * this.pitch + this.street; },
};

export const FUJI = { x: -80, z: -410, radius: 300, height: 440 };
export const LAKE = { x: 350, z: 200, radius: 95 };
export const SHRINE = { x: 215, z: -232, radius: 62, height: 58 };
export const SEA_Z = 395; // the coast starts here
export const WATER_Y = 0;

/** Distance outside the city square (negative inside). */
export const cityDist = (x: number, z: number) => Math.max(Math.abs(x - CITY.cx), Math.abs(z - CITY.cz)) - CITY.extent / 2;

const northMask = (z: number) => smoothstep(-90, -330, z);
const sideMask = (x: number, z: number) => smoothstep(300, 470, Math.abs(x)) * (z < 380 ? 1 : smoothstep(470, 380, z));
export const mountainMask = (x: number, z: number) => Math.max(northMask(z), sideMask(x, z) * 0.8);

/** The ground height before the village and the roads are cut into it. */
function baseHeight(x: number, z: number): number {
  let h = 5 + fbm(x * 0.006, z * 0.006, 4) * 16 + fbm(x * 0.02 + 50, z * 0.02, 2) * 2.5;
  // the mountain wall in the north and the ridges on both sides
  const m = mountainMask(x, z);
  if (m > 0) {
    const ridge = ridged(x * 0.005 + 7, z * 0.005 - 3, 4);
    h += (ridge * 0.75 + (fbm(x * 0.012, z * 0.012, 3) * 0.5 + 0.5) * 0.25) * m * 210;
  }
  // the big volcano
  const df = Math.hypot(x - FUJI.x, z - FUJI.z);
  if (df < FUJI.radius) {
    const t = 1 - df / FUJI.radius;
    let cone = FUJI.height * Math.pow(t, 1.55);
    cone += fbm(x * 0.03, z * 0.03, 3) * 7 * t;
    cone -= Math.max(0, 1 - df / 30) * 20;
    h += cone;
  }
  // the lake
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  h = lerp(h, -9, smoothstep(LAKE.radius + 22, LAKE.radius - 28, dl));
  // the sea in the south
  h = lerp(h, -9, smoothstep(SEA_Z, SEA_Z + 70, z));
  // the shelf of the shrine
  const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  h = lerp(h, SHRINE.height, 1 - smoothstep(SHRINE.radius - 6, SHRINE.radius + 95, ds));
  // the flat city
  const dc = cityDist(x, z);
  h = lerp(h, CITY.height, 1 - smoothstep(0, 70, dc));
  return h;
}

export const VILLAGE = { x: -345, z: 165, radius: 46, height: 0 };
VILLAGE.height = Math.max(4, baseHeight(VILLAGE.x, VILLAGE.z));

/** The ground height before the roads are carved into it. */
export function rawHeight(x: number, z: number): number {
  const h = baseHeight(x, z);
  const d = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  return d > VILLAGE.radius + 40 ? h : lerp(h, VILLAGE.height, 1 - smoothstep(VILLAGE.radius - 6, VILLAGE.radius + 36, d));
}

/** The roads: each is a smooth path sampled every 3 m, with a smoothed height so it never jumps. */
export interface RoadPath { name: string; width: number; x: number[]; z: number[]; y: number[]; len: number; box: [number, number, number, number] }
const ROAD_DEFS: { name: string; width: number; pts: [number, number][] }[] = [
  { name: 'mountain', width: 7, pts: [[64, -78], [62, -104], [92, -126], [140, -132], [182, -146], [208, -166], [215, -184], [215, -198]] },
  { name: 'coast', width: 10, pts: [[0, 318], [0, 340], [0, 366], [0, 388]] },
  { name: 'promenade', width: 8, pts: [[-250, 391], [-125, 388], [0, 388], [125, 388], [250, 391]] },
  { name: 'west', width: 8, pts: [[-198, 120], [-246, 126], [-296, 146], [-330, 160], [-345, 165]] },
  { name: 'east', width: 8, pts: [[198, 120], [226, 132], [246, 158], [254, 184]] },
];
function buildRoad(def: (typeof ROAD_DEFS)[number]): RoadPath {
  const P = def.pts;
  const pts: [number, number][] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[P.length - 1]);
  const raw = pts.map(([x, z]) => rawHeight(x, z));
  const y = raw.map((_, i) => {
    let sum = 0, n = 0;
    for (let k = -8; k <= 8; k++) {
      const j = i + k;
      if (j >= 0 && j < raw.length) { sum += raw[j]; n++; }
    }
    return sum / n;
  });
  // the roads that leave the city start at its level
  if (def.name === 'mountain' || def.name === 'west' || def.name === 'east' || def.name === 'coast') {
    const blend = 14;
    for (let i = 0; i < Math.min(blend, y.length); i++) y[i] = lerp(CITY.height, y[i], i / blend);
  }
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const m = def.width / 2 + 20;
  return { name: def.name, width: def.width, x: xs, z: zs, y, len: pts.length, box: [Math.min(...xs) - m, Math.min(...zs) - m, Math.max(...xs) + m, Math.max(...zs) + m] };
}
let roads: RoadPath[] | null = null;
export const getRoads = (): RoadPath[] => (roads ??= ROAD_DEFS.map(buildRoad));
export const getRoadPath = (name = 'mountain'): RoadPath => getRoads().find((r) => r.name === name)!;
export const PATH_WIDTH = 7;

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

/** The ground height at a point, with the roads carved in. Deterministic and cheap enough for tens of thousands of calls. */
export function heightAt(x: number, z: number): number {
  const h = rawHeight(x, z);
  const { d, y, width } = roadNear(x, z);
  if (!isFinite(d)) return h;
  const w = 1 - smoothstep(width * 0.5 + 1.5, width * 0.5 + 16, d);
  return w > 0 ? lerp(h, y - 0.15, w) : h;
}

/** Slope (rise over run) from a short central difference. */
export function slopeAt(x: number, z: number, d = 3): number {
  const dx = heightAt(x + d, z) - heightAt(x - d, z);
  const dz = heightAt(x, z + d) - heightAt(x, z - d);
  return Math.hypot(dx, dz) / (2 * d);
}

/** How much forest grows here: 0 (none) to 1 (dense). */
export function forestDensity(x: number, z: number, h = heightAt(x, z)): number {
  if (h < 1.5 || h > 235) return 0;
  const dc = cityDist(x, z);
  if (dc < 40) return 0;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 12) return 0;
  if (z > SEA_Z - 25) return 0;
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.radius + 4) return 0.15;
  const n = fbm(x * 0.009 + 10, z * 0.009 - 4, 3) * 0.5 + 0.5;
  const base = smoothstep(0.34, 0.6, n);
  const mt = mountainMask(x, z);
  const hi = 1 - smoothstep(140, 235, h);
  return clamp((base * 0.85 + mt * 0.55) * hi * smoothstep(40, 110, dc), 0, 1);
}

/** Names of the places on the map, used by the HUD and the fly-to buttons. */
export interface Place {
  key: string;
  name: string;
  jp: string;
  x: number;
  z: number;
  radius: number;
  dist: number; // the camera distance when flying there
  pitch: number; // degrees above the horizon
  yaw: number; // degrees
}

const blockCenter = (i: number, j: number): [number, number] => [
  CITY.cx - CITY.extent / 2 + CITY.street + i * CITY.pitch + CITY.block / 2,
  CITY.cz - CITY.extent / 2 + CITY.street + j * CITY.pitch + CITY.block / 2,
];

export const BLOCK_USE: Record<string, [number, number]> = {
  danchi: [0, 4],
  school: [5, 4],
  alley: [1, 3],
  park: [3, 1],
  shrineGate: [2, 0],
};

export const PLACES: Place[] = [
  { key: 'downtown', name: 'Sakura City', jp: '桜シティ', x: CITY.cx, z: CITY.cz, radius: 120, dist: 300, pitch: 50, yaw: 20 },
  { key: 'alley', name: 'Yokocho Alley', jp: '横丁', x: blockCenter(...BLOCK_USE.alley)[0], z: blockCenter(...BLOCK_USE.alley)[1], radius: 30, dist: 90, pitch: 46, yaw: 8 },
  { key: 'park', name: 'Neko Sushi Plaza', jp: '猫寿司広場', x: blockCenter(...BLOCK_USE.park)[0], z: blockCenter(...BLOCK_USE.park)[1], radius: 26, dist: 45, pitch: 42, yaw: -35 },
  { key: 'danchi', name: 'Kaze Danchi', jp: '風団地', x: blockCenter(...BLOCK_USE.danchi)[0], z: blockCenter(...BLOCK_USE.danchi)[1], radius: 40, dist: 110, pitch: 38, yaw: 70 },
  { key: 'school', name: 'Sakura Gakuen', jp: '桜学園', x: blockCenter(...BLOCK_USE.school)[0], z: blockCenter(...BLOCK_USE.school)[1], radius: 40, dist: 110, pitch: 40, yaw: -60 },
  { key: 'shrine', name: 'Kamigawa Shrine', jp: '神川神社', x: SHRINE.x, z: SHRINE.z, radius: 90, dist: 170, pitch: 40, yaw: 20 },
  { key: 'fuji', name: 'Mt. Hoshi', jp: '星山', x: FUJI.x, z: FUJI.z + 190, radius: 230, dist: 720, pitch: 17, yaw: 0 },
  { key: 'lake', name: 'Kagami Lake', jp: '鏡湖', x: LAKE.x, z: LAKE.z, radius: LAKE.radius + 25, dist: 250, pitch: 40, yaw: -40 },
  { key: 'coast', name: 'Shiosai Coast', jp: '潮騒海岸', x: 0, z: SEA_Z - 20, radius: 120, dist: 240, pitch: 30, yaw: 180 },
];

/** Which named place a point belongs to (for the HUD label). */
export function placeAt(x: number, z: number): Place {
  let best: Place | null = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z) / p.radius;
    if (d < 1 && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (best) return best;
  const h = heightAt(x, z);
  if (cityDist(x, z) < 0) return { key: 'city', name: 'Sakura City', jp: '桜シティ', x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 };
  if (h > 120) return { key: 'mountain', name: 'Hoshi Mountains', jp: '星山脈', x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 };
  if (z > SEA_Z - 30) return { key: 'sea', name: 'Shiosai Coast', jp: '潮騒海岸', x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 };
  if (forestDensity(x, z, h) > 0.35) return { key: 'forest', name: 'Mori no Sato Forest', jp: '森の里', x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 };
  return { key: 'fields', name: 'Hanano Fields', jp: '花野', x, z, radius: 1, dist: 1, pitch: 1, yaw: 0 };
}

/** The centre of a city block (i east, j south), 0..5. */
export const blockAt = blockCenter;
