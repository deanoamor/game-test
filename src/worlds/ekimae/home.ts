import type { Rect } from '../types';

/**
 * The door to the character's home (World 2): at the top of the outside stairs of the building by the crossing, on the
 * north side of the main street, east of the cross street. Where exactly depends on how that building was laid out, so
 * the details (details.ts) fill these in when the town is built; the world definition holds on to the same objects.
 */
export const HOME = {
  /** Where she must stand to be at the door. */
  door: { x0: 0, z0: 0, x1: 0, z1: 0 } as Rect,
  /** The door's panel: only from the landing at the top, not from the street under it. */
  info: { prompt: 'Go in', minY: 0 },
  /** Where she arrives when she comes out of the door. */
  out: { x: 0, z: 0, yaw: 0 },
  /** The stairs it belongs to are looked for round here. */
  near: { x: 7, z: 36.8 },
};
