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

/**
 * The people of the streets: ten ordinary townsfolk, made from a few bodies in different clothes and hair (the models are
 * in assets/core/characters: suit, office, street-*). They are tried in the NPC test room first.
 */
const talk = (...lines: string[]) => lines;

export const STREET_FOLK: NpcDef[] = [
  {
    id: 'tanaka', name: 'Tanaka', jp: '田中', role: 'Salaryman', model: 'suit',
    at: { x: -3, z: -6, yaw: 0 },
    route: [{ x: -3, z: -6, wait: 1 }, { x: -3, z: 6, wait: 1 }],
    speed: 1.5, greet: 'Good morning!',
    lines: talk('Sorry, I cannot stop long. The 8:15 does not wait for anyone!', 'Three more stops, a meeting at nine, and my boss is already in the office.', 'Have a good day. Do not run for the train like I do!'),
  },
  {
    id: 'sato', name: 'Sato', jp: '佐藤', role: 'Salesman', model: 'street-sato', scale: 1.05,
    at: { x: 3.4, z: -4.6, yaw: 270 },
    route: [{ x: 3.4, z: -4.6, wait: 8 }, { x: 1.6, z: -4.6, wait: 6 }],
    speed: 1.0, greet: 'Oh, hello.',
    lines: talk('Hm? Sorry, I was checking the schedule on my phone.', 'I sell insurance, believe it or not. Everyone says they have no time, and then they ask me to stay for tea.', 'If you ever need anything, I am always around the station.'),
  },
  {
    id: 'gen', name: 'Grandpa Gen', jp: 'ゲンじいさん', role: 'Retired', model: 'street-gen',
    at: { x: -4.5, z: -2.5, yaw: 270 },
    route: [{ x: -4.5, z: -2.5, wait: 6 }, { x: -8.5, z: -2.5, wait: 7 }, { x: -8.5, z: 1, wait: 5 }, { x: -4.5, z: 1, wait: 6 }],
    speed: 0.65, greet: 'Ho ho, young one.',
    lines: talk('Ah, a young person. These legs are slow, but my walks are long.', 'This town used to be all rice fields, you know. The station came, and then everything else.', 'Be good to your elders, and drink your tea warm. That is my whole secret!'),
  },
  {
    id: 'yamada', name: 'Yamada', jp: '山田', role: 'Office worker', model: 'office',
    at: { x: 6, z: 2.5, yaw: 90 },
    route: [{ x: 6, z: 2.5, wait: 2 }, { x: 9.5, z: 2.5, wait: 1 }, { x: 9.5, z: 5, wait: 2 }, { x: 6, z: 5, wait: 1 }],
    speed: 1.25, greet: 'Hello!',
    lines: talk('Oh, hello! I am on my way to lunch. I just found a place with the best curry.', 'Work has been busy, but the cherry trees in the plaza cheer me up.', 'Bring an umbrella if the sky turns grey. It always rains right when I forget mine.'),
  },
  {
    id: 'kobayashi', name: 'Kobayashi', jp: '小林', role: 'Office worker', model: 'street-kobayashi',
    at: { x: -1.6, z: -7.4, yaw: 180 },
    speed: 1.1, greet: 'Excuse me.',
    lines: talk('Oh, I am reading the notice board. They put up the festival dates here.', 'The shrine festival is my favourite day. Lanterns, fried noodles, everything.', 'You should go. Wear something nice!'),
  },
  {
    id: 'tomi', name: 'Grandma Tomi', jp: 'トミばあちゃん', role: 'Neighbour', model: 'street-tomi',
    at: { x: 2, z: 6.6, yaw: 270 },
    route: [{ x: 2, z: 6.6, wait: 5 }, { x: -2.4, z: 6.6, wait: 6 }],
    speed: 0.6, greet: 'Oh my, hello dear.',
    lines: talk('Hello, dear. Come and sit with me. No? Then walk with me, slowly.', 'I know every house on this street. The baker, the clinic, the little cat that sleeps on the wall.', 'Eat well, dear. You are much too thin.'),
  },
  {
    id: 'mio', name: 'Mio', jp: 'ミオ', role: 'Student', model: 'street-mio',
    at: { x: -9, z: 3, yaw: 90 },
    route: [{ x: -9, z: 3, wait: 1 }, { x: -3.5, z: 3, wait: 3 }],
    speed: 1.3, greet: 'Hi!',
    lines: talk('Hi! I am going to my cram school. Exams are in three weeks.', 'I wanted to join the tea club, but the entrance test is harder than the one for the school!', 'Wish me luck, okay?'),
  },
  {
    id: 'rin', name: 'Rin', jp: 'りん', role: 'Part-timer', model: 'street-rin',
    at: { x: 3.5, z: -2.4, yaw: 90 },
    route: [{ x: 3.5, z: -2.4, wait: 2 }, { x: 9, z: -2.4, wait: 4 }],
    speed: 1.3, greet: 'Hey!',
    lines: talk('Hey! Do you know a good place for crepes? I have one hour before my shift.', 'I work part-time at a record shop. The boss lets me pick the music, so it is the best job.', 'Oh, I am late. See you around!'),
  },
  {
    id: 'ken', name: 'Ken', jp: 'ケン', role: 'Delivery', model: 'street-ken',
    at: { x: -10, z: -1, yaw: 90 },
    route: [{ x: -10, z: -1, wait: 0.5 }, { x: 10, z: -1, wait: 0.5 }],
    speed: 2.0, greet: 'Delivery!',
    lines: talk('Delivery! No, not for you, sorry. I have eleven more parcels before noon.', 'People ask if I get tired of running. The secret is not to look at the clock.', 'See you! I must go!'),
  },
  {
    id: 'sora', name: 'Sora', jp: 'そら', role: 'Child', model: 'street-sora', scale: 0.72,
    at: { x: 1.5, z: 1, yaw: 90 },
    route: [{ x: 1.5, z: 1, wait: 0.5 }, { x: 4, z: 3.5, wait: 0.5 }, { x: 1.5, z: 5, wait: 0.5 }, { x: -1, z: 3, wait: 0.5 }],
    speed: 1.7, greet: 'Wow!',
    lines: talk('Wow! Are you a big sister? I am Sora! I am seven!', 'I am playing tag. If you stand there, you are the base, okay?', 'Bye bye! Do not tell mum I climbed the tree!'),
  },
];
