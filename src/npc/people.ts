import type { NpcDef } from './npc';

/**
 * The NPCs of the game, as data. (None of them is in a world yet: see src/worlds/npclab/ for the room they are tried in.)
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
