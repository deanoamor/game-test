import type { NpcDef } from './npc';

/**
 * The NPCs of the game, as data. (The nurse is not in a world yet: see src/worlds/npclab/ for the room she is tried in. The clerk works in Hoshi Mart, World 3.)
 */

/** The nurse of the Hoshi clinic, the one with the sign by the crossing. */
export const NURSE: NpcDef = {
  id: 'nurse',
  name: 'Nurse Hanae',
  jp: '看護師 はなえ',
  role: 'Hoshi Clinic',
  model: 'gamenurse',
  at: { x: 2.5, z: -1.5, yaw: 180 },
  // a slow round of the plaza, stopping at the bench, the lamp and the tree
  route: [
    { x: 2.5, z: -1.5, wait: 4 },
    { x: 7.5, z: -1.5, wait: 3 },
    { x: 7.5, z: 3.5, wait: 5 },
    { x: 2.5, z: 3.5, wait: 3 },
  ],
  speed: 1.1,
  greet: 'Oh, hello!',
  lines: [
    'Oh, hello there! You are out early. Are you feeling all right?',
    'I am Hanae, the nurse at the Hoshi Clinic, right by the crossing. If you catch a cold, come and see us.',
    'And do mind the iron stairs by the shop on the corner. They are steeper than they look!',
    'Take care now. Drink something warm, and get some sleep tonight.',
  ],
};

/** The clerk of the Hoshi Mart, the konbini by the crossing. */
export const CLERK: NpcDef = {
  id: 'clerk',
  name: 'Clerk Kenta',
  jp: '店員 けんた',
  role: 'Hoshi Mart',
  model: 'konbini',
  at: { x: -6, z: -2.5, yaw: 0 },
  // a short stretch of the legs: out of the shop for a minute, to the lamp and back
  route: [
    { x: -6, z: -2.5, wait: 5 },
    { x: -6, z: 2.5, wait: 4 },
    { x: -2.5, z: 2.5, wait: 3 },
    { x: -2.5, z: -2.5, wait: 4 },
  ],
  speed: 1.2,
  greet: 'Irasshaimase!',
  shop: true,
  lines: [
    'Irasshaimase! Welcome to Hoshi Mart!',
    'I am Kenta. We are open all day and all night, right by the crossing.',
    'Hot onigiri, fresh bento and warm drinks from the machine. The cream bread sells out before noon, so come early!',
    'Take a basket from the stack by the door, pick what you like from the shelves, and bring it to the register. I will ring you up!',
  ],
};
