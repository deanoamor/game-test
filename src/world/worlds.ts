import { HALF, PLACES, type Place } from './config';

/**
 * The game is semi-open: the town is split into worlds (zones) you move between with a loading screen, so only one
 * zone is drawn in detail at a time. A zone keeps a ring of the real town around it as scenery (so its edge is never
 * a void) behind an invisible barrier; its exits, where the roads leave it, lead on to the next zone. The full map is
 * kept as a world of its own.
 */

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Exit {
  name: string;
  jp: string;
  /** The stretch of the zone's edge the exit covers. */
  at: Rect;
  /** The world it leads to (null: that area is not built yet). */
  to: string | null;
}
export interface WorldDef {
  key: string;
  name: string;
  jp: string;
  /** Where you can go (the invisible barrier); none for the full map. */
  bounds: Rect | null;
  /** How much of the town around the bounds is still built, as scenery. */
  margin: number;
  /** The view you arrive with. */
  start: Place;
  exits: Exit[];
}

const EKIMAE: Rect = { x0: -40, z0: 4, x1: 40, z1: 82 };

export const WORLDS: WorldDef[] = [
  {
    key: 'ekimae',
    name: 'Ekimae Crossing',
    jp: '駅前交差点',
    bounds: EKIMAE,
    margin: 60,
    start: { key: 'ekimae', name: 'Ekimae Crossing', jp: '駅前交差点', x: 0, z: 40, radius: 1, dist: 72, pitch: 58, yaw: 0 },
    exits: [
      { name: 'Hoshi Ginza West', jp: '星銀座 西', at: { x0: EKIMAE.x0 - 1, z0: 36, x1: EKIMAE.x0 + 3, z1: 52 }, to: null },
      { name: 'Ramen Corner East', jp: 'ラーメン角 東', at: { x0: EKIMAE.x1 - 3, z0: 36, x1: EKIMAE.x1 + 1, z1: 52 }, to: null },
      { name: 'Back Lane North', jp: '裏通り 北', at: { x0: -6, z0: EKIMAE.z0 - 1, x1: 6, z1: EKIMAE.z0 + 3 }, to: null },
      { name: 'Hoshi Slope South', jp: '星坂 南', at: { x0: -6, z0: EKIMAE.z1 - 3, x1: 6, z1: EKIMAE.z1 + 1 }, to: null },
    ],
  },
  {
    key: 'full',
    name: 'Hoshi Town (full map)',
    jp: '星の町 全体',
    bounds: null,
    margin: 0,
    start: PLACES[0],
    exits: [],
  },
];

/** The world this page shows: from the address (#world=… or ?world=…), the first zone by default. */
export function currentWorld(): WorldDef {
  const fromHash = /(?:^|[#&])world=([\w-]+)/.exec(location.hash)?.[1];
  const fromQuery = new URLSearchParams(location.search).get('world');
  return WORLDS.find((w) => w.key === (fromHash ?? fromQuery)) ?? WORLDS[0];
}

/** Go to another world: it is loaded afresh (the page reloads with the new world in its address). */
export function goToWorld(key: string) {
  location.hash = `world=${key}`;
  location.reload();
}

/** The part of the map the camera may look at and the minimap shows. */
export function mapView(w: WorldDef): { cx: number; cz: number; half: number } {
  if (!w.bounds) return { cx: 0, cz: 0, half: HALF };
  const b = w.bounds, m = 25;
  return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, half: Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + m };
}

/** The area that is built in detail (the bounds and the scenery ring around them). */
export function keepArea(w: WorldDef): Rect | null {
  if (!w.bounds) return null;
  const b = w.bounds, m = w.margin;
  return { x0: b.x0 - m, z0: b.z0 - m, x1: b.x1 + m, z1: b.z1 + m };
}

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/** The places of the full map that lie inside a world. */
export function placesIn(w: WorldDef): Place[] {
  if (!w.bounds) return PLACES;
  return [w.start, ...PLACES.filter((p) => inRect(w.bounds!, p.x, p.z) && p.key !== 'town' && p.key !== w.start.key)];
}
