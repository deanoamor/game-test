import type { WorldDef } from '../types';
import { PLAZA, buildPlaza } from './plaza';

/**
 * A room to try the NPCs in, before any of them is put into a world of the game: a tiled plaza with a nurse who walks a
 * round, waves when you come near, and talks (F). Nothing of it is in the town. (Listed in the World menu while the
 * NPCs are being made; take it out of src/worlds/index.ts when they have their places.)
 */
export const npclab: WorldDef = {
  key: 'npclab',
  name: 'NPC test room',
  jp: 'NPC テスト',
  bounds: { x0: PLAZA.x0, z0: PLAZA.z0, x1: PLAZA.x1, z1: PLAZA.z1 },
  margin: 0,
  minDist: 16,
  maxDist: 16,
  start: { key: 'npclab', name: 'NPC test room', jp: 'NPC テスト', x: -1, z: 3, radius: 1, dist: 16, pitch: 46, yaw: 15 },
  exits: [],
  interior: buildPlaza,
  player: { x: -1, z: 3, yaw: 0 },
};
