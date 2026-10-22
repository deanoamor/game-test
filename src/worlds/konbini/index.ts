import type { WorldDef } from '../types';
import { Npc } from '../../npc/npc';
import { CLERK } from '../../npc/people';
import { SHOP, buildShop } from './interior';

/**
 * World 3: Hoshi Mart, the convenience store on the main street south of the Ekimae crossing. You come in by the
 * automatic door and leave by the same door. Clerk Kenta works behind the counter. A world of its own (no town round
 * it): a doll's-house view of the shop, walls cut down on the camera's side.
 */
export const konbini: WorldDef = {
  key: 'konbini',
  name: 'Hoshi Mart',
  jp: 'ほしマート',
  bounds: { x0: SHOP.X0 - 0.2, z0: SHOP.Z0 - 0.2, x1: SHOP.X1 + 0.2, z1: SHOP.Z1 + 0.2 },
  margin: 0,
  minDist: 17,
  maxDist: 17,
  start: { key: 'konbini', name: 'Hoshi Mart', jp: 'ほしマート', x: -3, z: -2.4, radius: 1, dist: 17, pitch: 52, yaw: 30 },
  // the automatic door in the north wall (Enter, or Space, to go out)
  exits: [{ name: 'Automatic door', jp: '自動ドア', at: { x0: SHOP.door.x - 0.95, z0: SHOP.Z0 - 0.05, x1: SHOP.door.x + 0.95, z1: SHOP.Z0 + 0.95 }, to: 'ekimae', door: { prompt: 'Go out' } }],
  interior: async () => {
    const shop = buildShop();
    // the clerk stays behind his counter: a few steps along it, then back
    const kenta = await Npc.create({
      ...CLERK,
      at: { x: 2.4, z: -3.1, yaw: 0 },
      route: [
        { x: 2.4, z: -3.1, wait: 6 },
        { x: 3.7, z: -3.1, wait: 5 },
        { x: 1.7, z: -3.1, wait: 4 },
      ],
      speed: 0.9,
    });
    shop.group.add(kenta.group, kenta.shadow);
    shop.npcs = [kenta];
    return shop;
  },
  player: { x: -3, z: -2.4, yaw: 0 },
};
