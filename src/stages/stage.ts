import type { Mesh, Vector3 } from 'three';
import type { Npc } from '../npc/npc';
import type { Signals } from '../world/signals';
import type { Traffic } from '../world/traffic';
import type { Obstacles } from '../world/village';
import type { InteriorBuild } from '../worlds/types';

/**
 * What a world is made of, as the game loop sees it: the town and its traffic (stages/outdoor.ts) or the rooms of a
 * house (stages/indoor.ts). The loop, the player, the camera, the sky and the picture are the same for both.
 */
export interface Stage {
  /** What the player bumps into. */
  obstacles: Obstacles;
  /** The floor's height under a point, for a world with no terrain (else the player stands on the town's ground). */
  floor?: (x: number, z: number) => number;
  /** The time of day changed (`night`: 0 by day, 1 in the dark; `hour`: the clock). */
  setNight(night: number, hour: number): void;
  /** Every frame. `frozen`: a test screenshot, where nothing moves. */
  step(dt: number, night: number, target: Vector3, cameraYaw: number, frozen: boolean): void;
  /** Haze: 1 in the open town, thicker in a zone, thin indoors. */
  fogScale: number;
  /** A tighter shadow area, for a small world (metres either side of the camera's target). */
  shadowHalf?: number;
  trees: number;
  /** The NPCs of this world (they are updated by the loop, and can be talked to). */
  npcs: Npc[];
  extra: { signals?: Signals; traffic?: Traffic; terrain?: Mesh; home?: InteriorBuild };
}
