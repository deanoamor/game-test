import type { Place } from '../world/config';

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
  /** Where the point the camera looks at may go (the invisible barrier); none for the full map. */
  bounds: Rect | null;
  /** How much of the town around the bounds is still built, as scenery. */
  margin: number;
  /** How far the camera may pull back. */
  maxDist: number;
  /** The view you arrive with. */
  start: Place;
  exits: Exit[];
}
