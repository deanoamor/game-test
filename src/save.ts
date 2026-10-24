/**
 * The saved game (in the game, not dev mode): where she is (the world, the spot, the way she faces) and the time of day, so
 * a restart goes on from there. The bag and the guide keep themselves (see inventory/store.ts and ui/guide.ts); "new game"
 * clears all three.
 */
export interface Save { world: string; x: number; z: number; yaw: number; hour: number }
const KEY = 'hoshi.save';

export function loadSave(): Save | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s.world === 'string' && [s.x, s.z, s.yaw, s.hour].every((n) => typeof n === 'number' && Number.isFinite(n))) return s as Save;
  } catch { /* no storage */ }
  return null;
}

export function writeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no storage */ }
}

/** A new game: forget the save, the bag and the guide. */
export function clearAll() {
  try {
    for (const k of ['hoshi.save', 'hoshi.bag', 'hoshi.guide']) localStorage.removeItem(k);
    sessionStorage.removeItem('hoshi.next');
  } catch { /* no storage */ }
}
