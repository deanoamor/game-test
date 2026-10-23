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

/** Ten more: the second set of the people of the streets. */
export const STREET_FOLK_2: NpcDef[] = [
  {
    id: 'haruto', name: 'Haruto', jp: 'ハルト', role: 'University student', model: 'hoodie',
    at: { x: -8, z: -6.4, yaw: 90 },
    route: [{ x: -8, z: -6.4, wait: 3 }, { x: -4.6, z: -6.4, wait: 4 }],
    speed: 1.1, greet: 'Yo!',
    lines: talk('Yo! Sorry, I have not slept. Three assignments due and one very good game.', 'The cafeteria has a katsu curry for 400 yen. It is the only reason I go to class.', 'If you see my friend Daichi running, tell him he left his bag.'),
  },
  {
    id: 'daichi', name: 'Daichi', jp: 'ダイチ', role: 'Jogger', model: 'street-daichi',
    at: { x: -10.5, z: 8, yaw: 90 },
    route: [{ x: -10.5, z: 8 }, { x: 10.5, z: 8 }, { x: 10.5, z: -8 }, { x: -10.5, z: -8 }],
    speed: 2.8, greet: 'On your left!',
    lines: talk('Huff... huff... Do not mind me! Five more laps!', 'I run the plaza every morning. Twenty laps, then a sports drink.', 'Join me sometime! Huff... bring water!'),
  },
  {
    id: 'hina', name: 'Hina', jp: 'ひな', role: 'Shopper', model: 'dress',
    at: { x: 4.5, z: 8, yaw: 90 },
    route: [{ x: 4.5, z: 8, wait: 5 }, { x: 8, z: 8, wait: 5 }],
    speed: 0.9, greet: 'Hello~',
    lines: talk('Hello~ Is this not the prettiest day for a dress?', 'I am looking for a present for my mother. Flowers, or maybe a scarf.', 'Which would you pick? Flowers fade, but a scarf is warm.'),
  },
  {
    id: 'aoi', name: 'Aoi', jp: '葵', role: 'Artist', model: 'street-aoi',
    at: { x: -5, z: 8.2, yaw: 270 },
    speed: 1.0, greet: 'Oh, hi!',
    lines: talk('Oh, hi! Sorry, I am drawing the lamp posts. They have such lovely shapes.', 'I paint the town, one corner at a time. The crossing is my favourite.', 'Do not move! ... Just kidding. Thank you for stopping by.'),
  },
  {
    id: 'taiga', name: 'Taiga', jp: 'タイガ', role: 'Ramen cook', model: 'chef',
    at: { x: 9.8, z: 0.2, yaw: 270 },
    route: [{ x: 9.8, z: 0.2, wait: 6 }, { x: 9.8, z: 1.8, wait: 6 }],
    speed: 0.8, greet: 'Welcome!',
    lines: talk('Welcome! I am on my break. Fifteen hours of broth, and my hands still smell of pork.', 'The shop on the corner is mine. Shoyu or miso? Come hungry.', 'And do not tell anyone, but the secret is a spoon of lard.'),
  },
  {
    id: 'goro', name: 'Goro', jp: 'ゴロー', role: 'Construction worker', model: 'street-goro',
    at: { x: 8.2, z: -0.8, yaw: 270 },
    route: [{ x: 8.2, z: -0.8, wait: 6 }, { x: 6.8, z: -0.8, wait: 5 }],
    speed: 0.8, greet: 'Mind the work!',
    lines: talk('Ho! Mind the work, kid. We are fixing the road by the station.', 'Thirty years on sites. My knees complain, but the town needs paving.', 'Drink your water. It is hot out there.'),
  },
  {
    id: 'kaito', name: 'Kaito', jp: 'カイト', role: 'Schoolboy', model: 'street-kaito', scale: 0.92,
    at: { x: -10, z: 5.6, yaw: 90 },
    route: [{ x: -10, z: 5.6, wait: 1 }, { x: -5.4, z: 5.6, wait: 2 }],
    speed: 1.3, greet: 'Good morning!',
    lines: talk('Good morning! I am on the way to school. I have a maths test first period.', 'I like the boys\' football club. We lost to the next town 5 to 0, but we ate well after.', 'See you! Do not be late like I always am!'),
  },
  {
    id: 'jake', name: 'Jake', jp: 'ジェイク', role: 'Tourist', model: 'street-jake',
    at: { x: 6.5, z: -4.4, yaw: 90 },
    route: [{ x: 6.5, z: -4.4, wait: 4 }, { x: 10, z: -4.4, wait: 5 }, { x: 10, z: -8, wait: 4 }, { x: 6.5, z: -8, wait: 4 }],
    speed: 1.0, greet: 'Hello! Hi!',
    lines: talk('Hello! Hi! Excuse me, you speak English? Great! I am from Canada.', 'Everything here is so clean. And the vending machines! They sell hot coffee in a can!', 'Do you know the way to the shrine? I have the map upside down, I think.'),
  },
  {
    id: 'kiyo', name: 'Auntie Kiyo', jp: 'キヨおばさん', role: 'Housewife', model: 'street-kiyo',
    at: { x: -1.2, z: -4, yaw: 0 },
    route: [{ x: -1.2, z: -4, wait: 3 }, { x: -1.2, z: 0.5, wait: 4 }],
    speed: 0.95, greet: 'Aiya, hello!',
    lines: talk('Aiya, hello! I am off to the supermarket. Cabbage is on sale until noon.', 'My son does not call me enough. He is a busy man, they say. Hmph.', 'You look hungry. Here, take this candy. Go on, I have a bag full!'),
  },
  {
    id: 'riku', name: 'Riku', jp: 'リク', role: 'Child', model: 'street-riku', scale: 0.7,
    at: { x: -7.8, z: -1.2, yaw: 90 },
    route: [{ x: -7.8, z: -1.2 }, { x: -10, z: -3.6 }, { x: -7.8, z: -5 }, { x: -5.2, z: -3 }],
    speed: 1.9, greet: 'Hi hi!',
    lines: talk('Hi hi! I found a beetle! Look! No, it is not scary, look!', 'I am going to be an astronaut. Or a ramen cook. Or both!', 'Mum says I cannot keep him. Can you hold him for me?'),
  },
];

/** All the people of the streets (the NPC test room). */
export const ALL_FOLK: NpcDef[] = [...STREET_FOLK, ...STREET_FOLK_2];
