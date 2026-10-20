import type { Rect, WorldDef } from '../types';

/**
 * World 1: Ekimae Crossing, where the main street (along x, z = 44) meets the cross street (along z, x = 0). It covers
 * the crossing and the first two or three lots along each arm, about x -50..34, z 18..70; the barrier keeps the
 * camera's target a few metres inside that, so the view never shows the edge up close.
 */
const BOUNDS: Rect = { x0: -42, z0: 24, x1: 28, z1: 64 };

export const ekimae: WorldDef = {
  key: 'ekimae',
  name: 'Ekimae Crossing',
  jp: '駅前交差点',
  bounds: BOUNDS,
  margin: 60,
  maxDist: 45,
  // close to the street, at the corner with the vending machine
  start: { key: 'ekimae', name: 'Ekimae Crossing', jp: '駅前交差点', x: -6, z: 40, radius: 1, dist: 28, pitch: 40, yaw: -70 },
  exits: [
    { name: 'Hoshi Ginza West', jp: '星銀座 西', at: { x0: BOUNDS.x0 - 1, z0: 38, x1: BOUNDS.x0 + 3, z1: 50 }, to: null },
    { name: 'Ramen Corner East', jp: 'ラーメン角 東', at: { x0: BOUNDS.x1 - 3, z0: 38, x1: BOUNDS.x1 + 1, z1: 50 }, to: null },
    { name: 'Back Lane North', jp: '裏通り 北', at: { x0: -5, z0: BOUNDS.z0 - 1, x1: 5, z1: BOUNDS.z0 + 3 }, to: null },
    { name: 'Hoshi Slope South', jp: '星坂 南', at: { x0: -5, z0: BOUNDS.z1 - 3, x1: 5, z1: BOUNDS.z1 + 1 }, to: null },
  ],
};
