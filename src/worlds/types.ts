import type { Group } from 'three';
import type { Place } from '../world/config';
import type { DetailKit } from '../world/village';
import type { Npc } from '../npc/npc';
import type { Solid } from '../world/village/frame';

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Exit {
  name: string;
  jp: string;
  /** The stretch of the zone's edge the exit covers. */
  at: Rect;
  /** The world it leads to (null: that area is not built yet). */
  to: string | null;
  /** A door rather than the end of a street: the panel says so, and Enter (or Space) takes it. `minY`: only from a
   *  platform at least this high (a door at the top of a flight of stairs is not reached from the street under it). */
  door?: { prompt: string; minY?: number };
}

/** A furnished room (or rooms) to walk about in: a world with no town round it. */
export interface InteriorBuild {
  group: Group;
  /** What she bumps into: walls, partitions, furniture. */
  solids: Solid[];
  /** The height of the floor under a point (the entrance is a step lower than the rooms). */
  floor(x: number, z: number): number;
  /** Lamps, windows and screens follow the time of day (`night`: 0 by day, 1 in the dark). */
  update(night: number, hour: number): void;
  /** What the floor is made of under a point (the sound of her steps). */
  surface?(x: number, z: number): 'wood' | 'tile' | 'tatami';
  /** Every frame: the camera's turn about the room, so the walls between it and the rooms can be cut down. */
  frame(dt: number, cameraYaw: number): void;
  /** How big the shadow-casting sun's area should be (metres either side of the room). */
  shadowHalf: number;
  /** Places to press F at (the wardrobe at home). */
  spots?: { x0: number; z0: number; x1: number; z1: number; r: number; label: string; kind: 'wardrobe' | 'basket' | 'shelf' | 'register'; shelf?: string }[];
  /** The NPCs that are in it. */
  npcs?: Npc[];
}

export interface WorldDef {
  key: string;
  name: string;
  jp: string;
  /** Where the point the camera looks at may go (the invisible barrier); none for the full map. */
  bounds: Rect | null;
  /** For a world played on foot: where the player may walk (the invisible barrier). The camera follows her, so its
   *  barrier is the same; the exits sit on its edge. Defaults to the bounds. */
  walk?: Rect;
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
  /** People walk the pavements (they are strangers, and they follow the clock). */
  pedestrians?: boolean;
  /** An interior world that is out in the open (the NPC test plaza): it keeps the sun and the sky; rooms are lit by their lamps only. */
  daylight?: boolean;
  /** An interior world: built from this instead of the town. */
  interior?: () => InteriorBuild | Promise<InteriorBuild>;
  /** Where she arrives when she comes from another world (the key of the world she left; none: `player`). */
  spawns?: Record<string, { x: number; z: number; yaw: number }>;
}
