import { HALF, PLACES, type Place } from '../world/config';
import { ekimae } from './ekimae';
import { full } from './full';
import { home } from './home';
import { konbini } from './konbini';
import { npclab } from './npclab';
import type { Rect, WorldDef } from './types';

export type { Exit, Rect, WorldDef } from './types';

/**
 * The game is semi-open: the town is split into worlds (zones) you move between with a loading screen, so only one
 * zone is drawn in detail at a time. A zone keeps a ring of the real town around it as scenery (so its edge is never
 * a void) behind an invisible barrier; its exits, where the roads leave it, lead on to the next zone. The full map is
 * kept as a world of its own.
 *
 * Each world lives in its own folder (src/worlds/<key>/) and is listed here; the town they are cut from is built by
 * src/world/.
 */
export const WORLDS: WorldDef[] = [ekimae, home, konbini, full, npclab];

/** The world this page shows: from the address (#world=… or ?world=…), the first zone by default. */
export function currentWorld(): WorldDef {
  const fromHash = /(?:^|[#&])world=([\w-]+)/.exec(location.hash)?.[1];
  const fromQuery = new URLSearchParams(location.search).get('world');
  return WORLDS.find((w) => w.key === (fromHash ?? fromQuery ?? remembered().world)) ?? WORLDS[0];
}

/** Which world she came from (the address has `from=…`), so she arrives at the right door. */
export function cameFrom(): string | null {
  return /[#&]from=([\w-]+)/.exec(location.hash)?.[1] ?? new URLSearchParams(location.search).get('from') ?? remembered().from ?? null;
}

/** Where she arrives in a world: at the place for the world she came from, else the world's own start. */
export function arrival(w: WorldDef): { x: number; z: number; yaw: number } | undefined {
  const from = cameFrom();
  return (from ? w.spawns?.[from] : undefined) ?? w.player;
}

// Going to another world reloads the page. The target is in the address, and also kept for the next load alone (a page
// shown inside a frame may drop the address on a reload), together with the time of day, so the clock carries over.
const KEY = 'hoshi.next';
function remembered(): { world?: string; from?: string } {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    return v;
  } catch { return {}; }
}
/** The clock carried over from the world she left (hours), if any. */
export function carriedHour(): number | null {
  try {
    const h = JSON.parse(sessionStorage.getItem(KEY) ?? '{}').hour;
    return typeof h === 'number' ? h : null;
  } catch { return null; }
}
/** Called once the page has read what was left for it. */
export function forgetCarried() {
  try { sessionStorage.removeItem(KEY); } catch { /* no storage */ }
}

/** Go to another world: it is loaded afresh (the page reloads with the new world in its address). */
export function goToWorld(key: string, from?: string, hour?: number) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ world: key, from, hour })); } catch { /* no storage */ }
  location.hash = from ? `world=${key}&from=${from}` : `world=${key}`;
  // a short fade, then the new world loads behind the loading screen
  document.body.classList.add('leaving');
  setTimeout(() => location.reload(), 280);
}

/** The area a world is played in: where she walks if it is played on foot, else where the camera may go. */
export const areaOf = (w: WorldDef): Rect | null => w.walk ?? w.bounds;

/** The part of the map the minimap shows. */
export function mapView(w: WorldDef): { cx: number; cz: number; half: number } {
  const b = areaOf(w), m = 25;
  if (!b) return { cx: 0, cz: 0, half: HALF };
  return { cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, half: Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + m };
}

/** The area that is built in detail (the bounds and the scenery ring around them). */
export function keepArea(w: WorldDef): Rect | null {
  const b = areaOf(w), m = w.margin;
  if (!b) return null;
  return { x0: b.x0 - m, z0: b.z0 - m, x1: b.x1 + m, z1: b.z1 + m };
}

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/** The places of the full map that lie inside a world. */
export function placesIn(w: WorldDef): Place[] {
  const b = areaOf(w);
  if (!b) return PLACES;
  return [w.start, ...PLACES.filter((p) => inRect(b, p.x, p.z) && p.key !== 'town' && p.key !== w.start.key && p.name !== w.start.name)];
}
