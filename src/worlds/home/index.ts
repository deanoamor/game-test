import type { WorldDef } from '../types';
import { HOME, buildHome } from './interior';

/**
 * World 2: the character's home, the flat at the top of the outside stairs by the Ekimae crossing. You come in by the
 * door at the top of those stairs and leave by the door of the entrance. It is a world of its own (no town round it):
 * a doll's-house view of the rooms, walls cut down on the camera's side.
 */
export const home: WorldDef = {
  key: 'home',
  name: 'Home',
  jp: '自宅',
  // the camera may follow her over the whole floor
  bounds: { x0: HOME.X0 - 0.2, z0: HOME.Z0 - 0.2, x1: HOME.X1 + 0.2, z1: HOME.Z1 + 0.2 },
  margin: 0,
  // a fixed doll's-house view: no zooming, and the tilt stays
  minDist: 15,
  maxDist: 15,
  start: { key: 'home', name: 'Home', jp: '自宅', x: -3.1, z: -3, radius: 1, dist: 15, pitch: 52, yaw: 30 },
  // the front door, at the north wall of the entrance (Enter, or Space, to go out)
  exits: [{ name: 'Front door', jp: '玄関', at: { x0: -3.75, z0: -4.45, x1: -2.45, z1: -3.45 }, to: 'ekimae', door: { prompt: 'Go out' } }],
  interior: buildHome,
  player: { x: -3.1, z: -3, yaw: 0 },
};
