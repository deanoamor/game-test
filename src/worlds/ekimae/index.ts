import type { Rect, WorldDef } from '../types';
import { ekimaeDetails } from './details';

/**
 * World 1: Ekimae Crossing, where the main street (along x, z = 44) meets the cross street (along z, x = 0). It covers
 * the crossing and the first two or three lots along each arm, about x -50..34, z 18..70; the barrier keeps the
 * camera's target a few metres inside that, so the view never shows the edge up close.
 */
const BOUNDS: Rect = { x0: -42, z0: 24, x1: 28, z1: 64 };
/** Where she can walk: a little past the bounds, so the stairs at the edges are whole and every exit is on a street. Not
 *  so far south that she could go half way down the stair alley there, which ends outside this world. */
const WALK: Rect = { x0: -52, z0: 16, x1: 36, z1: 69 };

export const ekimae: WorldDef = {
  key: 'ekimae',
  name: 'Ekimae Crossing',
  jp: '駅前交差点',
  bounds: BOUNDS,
  walk: WALK,
  margin: 60,
  // a fixed game camera, tilt and distance: no zooming in or out, and turning never tips it
  minDist: 26,
  maxDist: 26,
  // close to the street, at the corner with the vending machine
  start: { key: 'ekimae', name: 'Ekimae Crossing', jp: '駅前交差点', x: -6, z: 40, radius: 1, dist: 26, pitch: 38, yaw: -70 },
  exits: [
    { name: 'Hoshi Ginza West', jp: '星銀座 西', at: { x0: WALK.x0 - 1, z0: 36, x1: WALK.x0 + 3, z1: 52 }, to: null },
    { name: 'Ramen Corner East', jp: 'ラーメン角 東', at: { x0: WALK.x1 - 3, z0: 36, x1: WALK.x1 + 1, z1: 52 }, to: null },
    { name: 'Back Lane North', jp: '裏通り 北', at: { x0: -6.5, z0: WALK.z0 - 1, x1: 6.5, z1: WALK.z0 + 3 }, to: null },
    { name: 'Hoshi Slope South', jp: '星坂 南', at: { x0: -6.5, z0: WALK.z1 - 3, x1: 6.5, z1: WALK.z1 + 1 }, to: null },
  ],
  details: ekimaeDetails,
  // on the corner pavement by the vending machine, facing the crossing
  player: { x: -5, z: 38.6, yaw: 90 },
};
