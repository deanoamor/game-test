import type { Place } from '../world/config';
import type { DetailKit } from '../world/village';

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
  /** How close the camera may come and how far it may pull back (equal: the zoom is fixed). */
  minDist: number;
  maxDist: number;
  /** The view you arrive with. */
  start: Place;
  exits: Exit[];
  /** Where the player starts, if the world is played on foot (yaw: the way she faces, 0 = +z, 90 = +x). */
  player?: { x: number; z: number; yaw: number };
  /** The world's own details, added to the town where it stands (they show on the full map too). */
  details?: (kit: DetailKit) => void;
}
