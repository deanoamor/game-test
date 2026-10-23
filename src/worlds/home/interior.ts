import { AmbientLight, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight } from 'three';
import { GeoBuilder } from '../../util/builder';
import type { Solid } from '../../world/village/frame';
import type { InteriorBuild } from '../types';

/**
 * The character's home: a flat above a shop, 8 m by 9 m, seen from above like a doll's house. There is no ceiling and
 * the walls between the camera and the rooms are cut down (they come back as the camera turns away), so she is always
 * in view. Rooms: the entrance (genkan, a step lower, with the door on the north wall), the hall, a kitchen and dining
 * corner, a living room with tatami and a kotatsu, her bedroom and the bathroom.
 *
 * Axes: x east, z south, y up; the floor of the rooms is 0.2 m above the entrance. Everything is boxes with vertex
 * colours, like the rest of the game. `S()` records what she bumps into.
 */

export const HOME = {
  X0: -4, X1: 4, Z0: -4.5, Z1: 4.5, // the inside of the walls
  FLOOR: 0.2, // the rooms stand a step above the entrance
  WALL: 2.5,
  /** The entrance door (north wall) and the spot where she stands to open it. */
  door: { x: -3.1, z: -4.5 },
};
const { X0, X1, Z0, Z1, FLOOR: FL, WALL } = HOME;
const WT = 0.2;
const PART = 1.15; // partitions between the rooms are low, so the whole flat shows

const COLOR = {
  wallIn: '#efe7d8', wallOut: '#cbc3b4', cap: '#7a6c5a', slab: '#8d877c',
  wood: '#b98a5a', woodD: '#6f4d33', woodL: '#d9bb8c', white: '#f3f0ea', steel: '#c9cdd0', dark: '#2a2d33',
  frame: '#f4f1ea', paper: '#f7f2e4',
};

type Side = 'N' | 'E' | 'S' | 'W';
interface Opening { a: number; b: number; y0: number; y1: number; kind: 'window' | 'door'; curtain?: string }

const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildHome(): InteriorBuild {
  const group = new Group();
  group.name = 'Home';
  const solids: Solid[] = [];
  const S = (x: number, z: number, hw: number, hd: number, a = 0) => { solids.push({ t: 'box', x, z, hw, hd, a }); };

  const body = new GeoBuilder(); // furniture, floors, partitions: always there
  const screen = new GeoBuilder(); // the TV and the laptop: dark by day, lit at night
  const lamp = new GeoBuilder(); // lamp shades: lit
  const side: Record<Side, { shell: GeoBuilder; glass: GeoBuilder; decor: GeoBuilder }> = {
    N: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    E: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    S: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    W: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
  };
  /** A box standing on `y0`. */
  const bx = (b: GeoBuilder, x: number, y0: number, z: number, w: number, h: number, d: number, color: string, o: { ao?: number; yaw?: number } = {}) => b.box(x, y0 + h / 2, z, w, h, d, color, { ao: 0.08, ...o });
  /** Build something around its own origin, then set it down at (x, z) turned `yaw` degrees (0: it faces +z). */
  const place = (x: number, y: number, z: number, yaw: number, fn: (b: GeoBuilder, l: GeoBuilder, s: GeoBuilder) => void, into: GeoBuilder = body) => {
    const t = new GeoBuilder(), l = new GeoBuilder(), s = new GeoBuilder();
    fn(t, l, s);
    into.appendTransformed(t, x, y, z, yaw);
    lamp.appendTransformed(l, x, y, z, yaw);
    screen.appendTransformed(s, x, y, z, yaw);
  };

  // ---------------------------------------------------------------------------------------------------------------
  // the shell: floors, outer walls with their windows, the low partitions
  // ---------------------------------------------------------------------------------------------------------------
  bx(body, 0, -0.35, 0, 8.7, 0.35, 9.7, COLOR.slab, { ao: 0.2 });

  const planks = (x0: number, x1: number, z0: number, z1: number, a: string, b: string) => {
    let i = 0;
    for (let x = x0; x < x1 - 1e-6; x += 0.18, i++) {
      const w = Math.min(0.18, x1 - x);
      bx(body, x + w / 2, 0, (z0 + z1) / 2, w, FL, z1 - z0, i % 2 ? a : b, { ao: 0.02 });
    }
  };
  const tiles = (x0: number, x1: number, z0: number, z1: number, top: number, color: string, line: string) => {
    bx(body, (x0 + x1) / 2, top - 0.2, (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0, color, { ao: 0.02 });
    for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.3) bx(body, x, top, (z0 + z1) / 2, 0.02, 0.004, z1 - z0, line, { ao: 0 });
    for (let z = z0 + 0.3; z < z1 - 0.1; z += 0.3) bx(body, (x0 + x1) / 2, top, z, x1 - x0, 0.004, 0.02, line, { ao: 0 });
  };
  tiles(X0, -2.2, Z0, -2.7, 0, '#bcb6a8', '#8f8a7e'); // the entrance
  planks(X0, -2.2, -2.7, 0.8, '#c9a06b', '#c19863'); // the hall
  planks(-2.2, 1.2, Z0, 0.8, '#cfa774', '#c79f6b'); // the kitchen and dining corner
  planks(-2.2, 4, 0.8, Z1, '#c9a06b', '#c19863'); // the bedroom
  tiles(X0, -2.2, 0.8, Z1, FL, '#b4cdda', '#8fb0c2'); // the bathroom
  // tatami: nine mats with dark borders
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x0 = 1.2 + i * (2.8 / 3), z0 = Z0 + j * (5.3 / 3), w = 2.8 / 3, d = 5.3 / 3;
    bx(body, x0 + w / 2, 0, z0 + d / 2, w - 0.01, FL, d - 0.01, '#aab57a', { ao: 0.02 });
    const border = '#33452a', t = 0.035;
    bx(body, x0 + w / 2, FL, z0 + 0.02, w - 0.04, 0.006, t, border, { ao: 0 });
    bx(body, x0 + w / 2, FL, z0 + d - 0.02, w - 0.04, 0.006, t, border, { ao: 0 });
  }
  // the step up from the entrance, with its wooden edge
  bx(body, -3.1, FL, -2.68, 1.8, 0.05, 0.14, COLOR.woodD, { ao: 0.1 });

  // a wall: its pieces between the openings, in two layers (inner and outer colour), a cap on the top
  const AXIS = (s: Side) => s === 'N' || s === 'S';
  const SIGN = (s: Side) => (s === 'N' || s === 'W' ? -1 : 1); // outward
  const BASE = (s: Side) => (s === 'N' ? Z0 : s === 'S' ? Z1 : s === 'W' ? X0 : X1);
  const piece = (s: Side, t0: number, t1: number, y0: number, y1: number) => {
    if (t1 - t0 < 1e-4 || y1 - y0 < 1e-4) return;
    const mid = (t0 + t1) / 2, len = t1 - t0, B = side[s].shell;
    for (const [off, col] of [[0.05, COLOR.wallIn], [0.15, COLOR.wallOut]] as const) {
      const c = BASE(s) + SIGN(s) * off;
      if (AXIS(s)) B.box(mid, (y0 + y1) / 2, c, len, y1 - y0, 0.1, col, { ao: 0.04 });
      else B.box(c, (y0 + y1) / 2, mid, 0.1, y1 - y0, len, col, { ao: 0.04 });
    }
    if (y1 >= WALL - 1e-4) {
      const c = BASE(s) + SIGN(s) * 0.1;
      if (AXIS(s)) B.box(mid, WALL + 0.025, c, len, 0.05, WT + 0.02, COLOR.cap, { ao: 0 });
      else B.box(c, WALL + 0.025, mid, WT + 0.02, 0.05, len, COLOR.cap, { ao: 0 });
    }
  };
  /** A box on the inner face of a wall (`t`: along the wall, `y0`: its bottom, `depth`: how far it stands out). */
  const onWall = (s: Side, b: GeoBuilder, t: number, y0: number, w: number, h: number, depth: number, color: string, off = 0) => {
    const c = BASE(s) - SIGN(s) * (depth / 2 + off);
    if (AXIS(s)) bx(b, t, y0, c, w, h, depth, color, { ao: 0.02 });
    else bx(b, c, y0, t, depth, h, w, color, { ao: 0.02 });
  };
  const wall = (s: Side, openings: Opening[]) => {
    const [lo, hi] = AXIS(s) ? [X0 - WT, X1 + WT] : [Z0, Z1];
    const sorted = [...openings].sort((p, q) => p.a - q.a);
    let t = lo;
    for (const o of sorted) {
      piece(s, t, o.a, -0.35, WALL);
      piece(s, o.a, o.b, -0.35, o.y0);
      piece(s, o.a, o.b, o.y1, WALL);
      t = o.b;
      const sh = side[s].shell, mid = (o.a + o.b) / 2, w = o.b - o.a, h = o.y1 - o.y0;
      // the frame on the inner face
      onWall(s, sh, o.a + 0.03, o.y0, 0.06, h, 0.05, COLOR.frame);
      onWall(s, sh, o.b - 0.03, o.y0, 0.06, h, 0.05, COLOR.frame);
      onWall(s, sh, mid, o.y1 - 0.06, w, 0.06, 0.05, COLOR.frame);
      if (o.kind === 'window') {
        onWall(s, sh, mid, o.y0, w, 0.06, 0.12, COLOR.frame); // the sill
        onWall(s, sh, mid, o.y0, 0.04, h, 0.04, COLOR.frame, 0.03); // the mullion
        onWall(s, sh, mid, o.y0 + h * 0.55, w, 0.04, 0.04, COLOR.frame, 0.03);
        // the glass: a quad in the middle of the wall
        const c = BASE(s) + SIGN(s) * 0.1, G = side[s].glass;
        const p = (tt: number, y: number): [number, number, number] => (AXIS(s) ? [tt, y, c] : [c, y, tt]);
        G.quad(p(o.a, o.y0), p(o.b, o.y0), p(o.b, o.y1), p(o.a, o.y1), [1, 1, 1]);
        if (o.curtain) {
          // a rod and two curtains, drawn back to the sides
          onWall(s, sh, mid, o.y1 + 0.12, w + 0.5, 0.03, 0.04, COLOR.woodD, 0.07);
          for (const k of [-1, 1]) onWall(s, sh, mid + k * (w / 2 + 0.02 - 0.17), Math.max(0.1, o.y0 - 0.25), 0.34, o.y1 + 0.12 - Math.max(0.1, o.y0 - 0.25), 0.05, o.curtain, 0.08);
        }
      } else {
        // the door itself: a wooden slab in the doorway, with a frosted pane, a handle and a letter slot
        onWall(s, sh, mid, o.y0, w - 0.1, h - 0.07, 0.06, '#7a4f32', 0.0);
        onWall(s, sh, mid, o.y0 + h * 0.58, w * 0.42, h * 0.26, 0.07, '#e6dcc0', 0.0);
        onWall(s, sh, mid + w * 0.33, o.y0 + 1.0, 0.05, 0.14, 0.1, '#d8b04a', 0.04);
      }
    }
    piece(s, t, hi, -0.35, WALL);
    // the whole wall stops her (the door is for the trigger, not for walking out)
    const c = BASE(s) + SIGN(s) * 0.1;
    if (AXIS(s)) S((lo + hi) / 2, c, (hi - lo) / 2, 0.1);
    else S(c, (lo + hi) / 2, 0.1, (hi - lo) / 2);
  };
  wall('N', [
    { a: HOME.door.x - 0.45, b: HOME.door.x + 0.45, y0: 0, y1: 2.05, kind: 'door' },
    { a: 0.25, b: 1.05, y0: 1.15, y1: 2.1, kind: 'window', curtain: '#e7d9a8' },
  ]);
  wall('E', [{ a: -3.4, b: -0.2, y0: 0.35, y1: 2.15, kind: 'window', curtain: '#9fb8cf' }]);
  wall('S', [
    { a: -1.2, b: 1.7, y0: 0.85, y1: 2.1, kind: 'window', curtain: '#d8a8a8' },
    { a: -3.4, b: -2.6, y0: 1.4, y1: 2.0, kind: 'window' },
  ]);
  wall('W', [
    { a: -1.9, b: -0.7, y0: 0.95, y1: 2.05, kind: 'window', curtain: '#cfd8a8' },
    { a: 3.1, b: 4.1, y0: 1.25, y1: 2.0, kind: 'window' },
  ]);

  // the low partitions (with their doorways) and the solids that go with them
  const partX = (x: number, z0: number, z1: number) => {
    bx(body, x, 0, (z0 + z1) / 2, 0.12, PART, z1 - z0, COLOR.wallIn, { ao: 0.04 });
    bx(body, x, PART, (z0 + z1) / 2, 0.14, 0.04, z1 - z0, COLOR.cap, { ao: 0 });
    S(x, (z0 + z1) / 2, 0.07, (z1 - z0) / 2);
  };
  const partZ = (z: number, x0: number, x1: number) => {
    bx(body, (x0 + x1) / 2, 0, z, x1 - x0, PART, 0.12, COLOR.wallIn, { ao: 0.04 });
    bx(body, (x0 + x1) / 2, PART, z, x1 - x0, 0.04, 0.14, COLOR.cap, { ao: 0 });
    S((x0 + x1) / 2, z, (x1 - x0) / 2, 0.07);
  };
  partX(-2.2, Z0, -2.7); // the entrance's east wall
  partX(-2.2, -2.7, -2.0); // the hall's east wall, with a doorway to the kitchen
  partX(-2.2, -0.9, 0.8);
  partZ(0.8, X0, -3.6); // the bathroom's north wall, with its door
  partZ(0.8, -2.7, -2.2);
  partX(-2.2, 0.8, Z1); // the bathroom's east wall
  partZ(0.8, -2.2, -1.6); // the bedroom's north wall, with a wide opening
  partZ(0.8, 0.2, X1);

  // ---------------------------------------------------------------------------------------------------------------
  // furniture
  // ---------------------------------------------------------------------------------------------------------------
  const chair = (x: number, z: number, yaw: number) => {
    place(x, FL, z, yaw, (b) => {
      bx(b, 0, 0.42, 0, 0.42, 0.05, 0.42, COLOR.woodL);
      bx(b, 0, 0.47, -0.19, 0.42, 0.42, 0.04, COLOR.woodL);
      for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) bx(b, sx, 0, sz, 0.04, 0.42, 0.04, COLOR.woodD);
    });
    S(x, z, 0.22, 0.22);
  };
  const cushion = (x: number, z: number, color: string, yaw = 0) => place(x, FL, z, yaw, (b) => { bx(b, 0, 0, 0, 0.5, 0.07, 0.5, color, { ao: 0.12 }); });
  const book = (b: GeoBuilder, x: number, y0: number, z: number, h: number, color: string, w = 0.035, d = 0.2) => bx(b, x, y0, z, w, h, d, color, { ao: 0 });
  const pot = (x: number, y0: number, z: number, r = 0.18) => {
    body.frustum(x, y0, z, r, r * 0.8, r * 1.4, 10, '#b9704a', { ao: 0.1 });
    for (const [dx, dy, dz, rr, c] of [[0, 0.55, 0, 0.3, '#4f9a45'], [0.12, 0.8, 0.05, 0.22, '#5aa845'], [-0.12, 0.7, -0.06, 0.2, '#3f8a3b']] as const) body.blob(x + dx, y0 + dy, z + dz, rr, rr * 1.2, rr, c, { seed: Math.round(x * 7 + dy * 13) });
  };
  const lampShade = (b: GeoBuilder, l: GeoBuilder, x: number, y0: number, z: number, r: number, h: number) => {
    b.frustum(x, y0, z, r * 0.45, r * 0.45, 0.02, 10, COLOR.dark, { ao: 0 });
    l.frustum(x, y0 + 0.02, z, r * 0.6, r, h, 12, '#fff0cf', { ao: 0, cap: false });
  };

  // --- the entrance
  place(-2.42, 0, -3.7, 90, (b) => { // the shoe cabinet, with a lucky cat on it
    bx(b, 0, 0, 0, 1.2, 1.05, 0.32, '#d8c9ac');
    for (const x of [-0.3, 0.3]) bx(b, x, 0.08, 0.165, 0.5, 0.9, 0.01, '#bba98a', { ao: 0 });
    for (const x of [-0.04, 0.04]) bx(b, x, 0.7, 0.175, 0.025, 0.12, 0.02, '#8a7a5e', { ao: 0 });
    bx(b, 0, 1.05, 0.02, 0.5, 0.02, 0.2, '#f1e7cc', { ao: 0 }); // a mat for the things on top
    b.blob(-0.2, 1.17, 0.02, 0.1, 0.12, 0.09, '#f6f2ea', { seed: 3 });
    b.blob(-0.2, 1.3, 0.02, 0.075, 0.07, 0.07, '#f6f2ea', { seed: 4 });
    bx(b, -0.2, 1.27, 0.07, 0.04, 0.03, 0.01, '#d23a3a', { ao: 0 });
    bx(b, 0.25, 1.07, 0.02, 0.2, 0.025, 0.14, '#c9a05a', { ao: 0 }); // a key tray
  });
  S(-2.42, -3.7, 0.16, 0.6);
  const shoes = (x: number, z: number, color: string, yaw: number) => place(x, 0, z, yaw, (b) => { for (const s of [-0.07, 0.07]) { bx(b, s, 0, 0, 0.09, 0.07, 0.27, color, { ao: 0.1 }); bx(b, s, 0, 0, 0.09, 0.015, 0.27, '#2a2a2a', { ao: 0 }); } });
  shoes(-3.55, -3.05, '#2b2b30', 10);
  shoes(-3.2, -3.1, '#6a4a32', -8);
  shoes(-3.85, -3.15, '#d9d4c8', 4);
  bx(body, -3.1, 0, -3.95, 0.9, 0.012, 0.6, '#5a6a4a', { ao: 0 }); // the door mat
  body.frustum(-3.82, 0, -4.2, 0.1, 0.1, 0.45, 10, '#3a4a5a', { ao: 0.05 }); // an umbrella stand and its umbrella
  bx(body, -3.82, 0.1, -4.2, 0.02, 0.8, 0.02, '#2a3a8a', { ao: 0, yaw: 8 });
  S(-3.82, -4.2, 0.12, 0.12);

  // --- the hall
  place(-3.7, FL, -1.3, 90, (b, l) => { // a console table with a lamp and a photo
    bx(b, 0, 0.74, 0, 1.0, 0.05, 0.32, COLOR.wood);
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.13, 0.13]) bx(b, sx, 0, sz, 0.04, 0.74, 0.04, COLOR.woodD);
    bx(b, 0, 0.5, 0, 0.9, 0.03, 0.28, COLOR.woodD);
    lampShade(b, l, -0.3, 0.79, 0, 0.17, 0.22);
    bx(b, -0.3, 0.79, 0, 0.03, 0.2, 0.03, '#b8a070', { ao: 0 });
    bx(b, 0.1, 0.79, 0.02, 0.18, 0.14, 0.02, '#c9a05a', { ao: 0 }); // a framed photo
    bx(b, 0.1, 0.82, 0.035, 0.14, 0.1, 0.005, '#9ab4cc', { ao: 0 });
    bx(b, 0.35, 0.79, 0, 0.16, 0.04, 0.12, '#8a5a3a', { ao: 0 });
  });
  S(-3.7, -1.3, 0.17, 0.52);
  bx(body, -3.1, FL, -0.9, 0.8, 0.012, 2.6, '#7a8a9a', { ao: 0 }); // a runner

  // --- the kitchen
  place(-1.7, FL, -4.15, 0, (b) => { // a fridge with a few magnets
    bx(b, 0, 0, 0, 0.62, 1.7, 0.7, '#e9ecee');
    bx(b, 0, 1.15, 0.351, 0.62, 0.012, 0.01, '#9aa0a6', { ao: 0 });
    bx(b, -0.24, 1.25, 0.36, 0.03, 0.3, 0.03, '#8a9096', { ao: 0 });
    bx(b, -0.24, 0.8, 0.36, 0.03, 0.3, 0.03, '#8a9096', { ao: 0 });
    for (const [x, y, c] of [[0.05, 1.4, '#e8402a'], [0.15, 1.35, '#f2c230'], [0.1, 1.5, '#3a9a5a']] as const) bx(b, x, y, 0.352, 0.05, 0.05, 0.01, c, { ao: 0 });
    bx(b, 0.18, 1.0, 0.352, 0.12, 0.16, 0.005, '#f7f2e4', { ao: 0 });
  });
  S(-1.7, -4.15, 0.31, 0.35);
  place(-0.1, FL, -4.19, 0, (b) => { // the counter: cupboards, a stove, a sink
    bx(b, 0, 0, 0, 2.4, 0.84, 0.62, '#e8e0d0');
    bx(b, 0, 0.84, 0, 2.4, 0.04, 0.64, COLOR.steel, { ao: 0.05 });
    for (let k = -3; k <= 3; k++) bx(b, k * 0.3 + 0.05, 0.05, 0.311, 0.01, 0.75, 0.005, '#b8aa90', { ao: 0 });
    for (const x of [-0.95, -0.4, 0.45, 0.95]) bx(b, x, 0.6, 0.315, 0.12, 0.02, 0.02, '#8a8f94', { ao: 0 });
    // the stove: two burners and a grill door
    for (const x of [-0.85, -0.55]) b.disc(x, 0.89, 0.02, 0.1, 0.012, 'y', '#1a1c1f', 14);
    bx(b, -0.7, 0.35, 0.314, 0.55, 0.3, 0.008, '#6a6e74', { ao: 0 });
    // the sink: a dark basin and a tap
    bx(b, 0.65, 0.835, 0.0, 0.62, 0.012, 0.42, '#5f6b78', { ao: 0 });
    bx(b, 0.65, 0.88, -0.2, 0.04, 0.2, 0.04, '#b8bec4', { ao: 0 });
    bx(b, 0.65, 1.07, -0.12, 0.04, 0.03, 0.2, '#b8bec4', { ao: 0 });
    // things on the counter: a rice cooker, a kettle, a dish rack
    bx(b, -0.05, 0.88, -0.05, 0.28, 0.26, 0.28, '#f1efe8');
    bx(b, -0.05, 1.14, -0.05, 0.28, 0.03, 0.28, '#c8c4b8', { ao: 0 });
    b.frustum(0.2, 0.88, 0.0, 0.08, 0.06, 0.2, 10, '#d23a3a', { ao: 0.1 });
    bx(b, 1.1, 0.88, 0.1, 0.34, 0.03, 0.24, '#9aa0a6', { ao: 0 });
    for (let k = 0; k < 4; k++) b.disc(1.0 + k * 0.07, 1.0, 0.1, 0.075, 0.01, 'z', '#f4f4ee', 10);
  });
  S(-0.1, -4.19, 1.2, 0.31);
  bx(body, -0.7, FL + 1.55, -4.25, 0.9, 0.14, 0.5, '#9aa0a6', { ao: 0.05 }); // the hood over the stove
  bx(body, -0.7, FL + 1.69, -4.34, 0.3, 0.6, 0.3, '#8a9096', { ao: 0.05 });
  body.frustum(-1.18, FL, -3.55, 0.12, 0.1, 0.3, 10, '#4a6a8a', { ao: 0.1 }); // a bin
  S(-1.18, -3.55, 0.12, 0.12);
  // the dining table: a runner, a teapot, cups, fruit; four chairs
  place(-0.5, FL, -1.9, 0, (b) => {
    bx(b, 0, 0.7, 0, 1.3, 0.05, 0.8, COLOR.wood);
    for (const sx of [-0.58, 0.58]) for (const sz of [-0.34, 0.34]) bx(b, sx, 0, sz, 0.06, 0.7, 0.06, COLOR.woodD);
    bx(b, 0, 0.75, 0, 0.4, 0.008, 0.78, '#8a3a3a', { ao: 0 });
    b.frustum(-0.1, 0.758, 0.05, 0.07, 0.05, 0.1, 10, '#f4f4ee', { ao: 0.05 });
    bx(b, -0.1, 0.84, 0.05, 0.03, 0.04, 0.03, '#f4f4ee', { ao: 0 });
    for (const [x, z] of [[-0.3, -0.2], [0.38, 0.22]] as const) b.frustum(x, 0.758, z, 0.04, 0.035, 0.06, 8, '#e4dfd2', { ao: 0.05 });
    b.frustum(0.2, 0.758, -0.12, 0.13, 0.09, 0.06, 12, '#d8b88a', { ao: 0.05 });
    for (const [x, z, c] of [[0.17, -0.12, '#e8862a'], [0.24, -0.1, '#e8a02a'], [0.2, -0.16, '#d8402a']] as const) b.blob(x, 0.84, z, 0.04, 0.04, 0.04, c, { detail: 0, seed: 2 });
  });
  S(-0.5, -1.9, 0.65, 0.4);
  chair(-0.9, -2.55, 0);
  chair(-0.1, -2.55, 0);
  chair(-0.9, -1.25, 180);
  chair(-0.1, -1.25, 180);

  // --- the living room
  place(2.6, FL, -4.25, 0, (b, _l, s) => { // the TV and its cabinet
    bx(b, 0, 0, 0, 1.3, 0.45, 0.4, COLOR.wood);
    for (const x of [-0.32, 0.32]) bx(b, x, 0.05, 0.201, 0.58, 0.3, 0.01, '#a67a4a', { ao: 0 });
    bx(b, 0, 0.45, 0, 0.5, 0.04, 0.2, COLOR.dark, { ao: 0 });
    bx(b, 0, 0.49, 0, 1.15, 0.68, 0.07, '#15171a', { ao: 0.02 });
    bx(s, 0, 0.53, 0.04, 1.07, 0.6, 0.012, '#9bbcff', { ao: 0 });
    for (const x of [-0.78, 0.78]) bx(b, x, 0, 0, 0.14, 0.9, 0.16, '#3a3a3a', { ao: 0.05 }); // speakers
  });
  S(2.6, -4.25, 0.66, 0.2);
  place(1.55, FL, -4.22, 0, (b) => { // a tall bookcase full of books
    bx(b, 0, 0, 0, 0.84, 1.85, 0.3, COLOR.woodL);
    const cols = ['#c8322e', '#2f5ea8', '#3a9a5a', '#e0b341', '#7a2db8', '#e8862a', '#2a2c32', '#4aa8e0'];
    for (let row = 0; row < 5; row++) {
      bx(b, 0, 0.1 + row * 0.36, 0.02, 0.8, 0.02, 0.27, COLOR.woodD, { ao: 0 });
      let x = -0.36;
      for (let k = 0; x < 0.34; k++) { const w = 0.03 + ((k * 7 + row * 3) % 4) * 0.01, h = 0.24 + ((k * 5 + row) % 3) * 0.04; book(b, x + w / 2, 0.125 + row * 0.36, 0.02, h, cols[(k + row * 3) % cols.length], w, 0.22); x += w + 0.004; }
    }
  });
  S(1.55, -4.22, 0.42, 0.15);
  pot(3.7, FL, -4.15, 0.2);
  S(3.7, -4.15, 0.22, 0.22);
  // the kotatsu: a low table under a futon, mikan on top, a sleeping cat
  place(2.7, FL, -2.2, 0, (b) => {
    bx(b, 0, 0.36, 0, 1.0, 0.04, 1.0, COLOR.woodL);
    bx(b, 0, 0.12, 0, 1.55, 0.26, 1.55, '#c46a6a', { ao: 0.1 });
    bx(b, 0, 0.12, 0, 1.58, 0.05, 1.58, '#f2d6b0', { ao: 0 });
    bx(b, 0, 0.3, 0.0, 1.56, 0.012, 1.56, '#a85252', { ao: 0 });
    b.frustum(0.2, 0.4, 0.1, 0.12, 0.09, 0.06, 12, '#d8b88a', { ao: 0.05 });
    for (const [x, z] of [[0.17, 0.08], [0.24, 0.12], [0.2, 0.15]] as const) b.blob(x, 0.47, z, 0.045, 0.04, 0.045, '#e8862a', { detail: 0, seed: 5 });
    b.blob(-0.45, 0.36, 0.5, 0.17, 0.09, 0.12, '#e89a4a', { seed: 8 }); // the cat
    b.blob(-0.32, 0.4, 0.55, 0.075, 0.07, 0.07, '#e89a4a', { seed: 9 });
    bx(b, -0.3, 0.45, 0.58, 0.03, 0.04, 0.02, '#c8803a', { ao: 0 });
    bx(b, -0.34, 0.45, 0.58, 0.03, 0.04, 0.02, '#c8803a', { ao: 0 });
  });
  S(2.7, -2.2, 0.78, 0.78);
  cushion(1.75, -2.2, '#4a6a9a', 90);
  cushion(3.7, -2.2, '#9a5a6a', 90);
  cushion(2.7, -0.95, '#6a9a6a');
  place(3.62, FL, 0.4, 0, (b, l) => { // a standing lamp
    b.frustum(0, 0, 0, 0.12, 0.12, 0.03, 10, COLOR.dark, { ao: 0 });
    bx(b, 0, 0.03, 0, 0.03, 1.35, 0.03, '#6a6e74', { ao: 0 });
    l.frustum(0, 1.3, 0, 0.14, 0.22, 0.3, 12, '#fff0cf', { ao: 0, cap: false });
  });
  S(3.62, 0.4, 0.14, 0.14);

  // --- the bedroom
  place(-0.8, FL, 3.5, 0, (b) => { // her bed: a blanket, two pillows, a bear and the cat
    bx(b, 0, 0, 0, 2.0, 0.28, 1.1, COLOR.wood);
    bx(b, 0, 0.28, 0, 1.9, 0.2, 1.0, '#f4f1ea', { ao: 0.1 });
    bx(b, 0.35, 0.48, 0, 1.2, 0.09, 1.04, '#5b7fb5', { ao: 0.1 });
    bx(b, 0.95, 0.48, 0, 0.12, 0.1, 1.06, '#e8e2d4', { ao: 0 });
    for (const z of [-0.26, 0.26]) bx(b, -0.7, 0.48, z, 0.34, 0.12, 0.42, '#f7f4ee', { ao: 0.1 });
    bx(b, -1.04, 0, 0, 0.08, 0.95, 1.1, COLOR.woodD, { ao: 0.05 });
    b.blob(-0.5, 0.64, 0.12, 0.13, 0.15, 0.1, '#b98a5a', { seed: 11 }); // a plush bear
    b.blob(-0.5, 0.82, 0.12, 0.09, 0.09, 0.08, '#b98a5a', { seed: 12 });
    b.blob(0.3, 0.6, -0.1, 0.17, 0.1, 0.13, '#e89a4a', { seed: 14 }); // the cat
    b.blob(0.46, 0.64, -0.1, 0.075, 0.07, 0.07, '#e89a4a', { seed: 15 });
  });
  S(-0.8, 3.5, 1.05, 0.58);
  place(-1.95, FL, 2.55, 0, (b, l) => { // a nightstand with a lamp and a clock
    bx(b, 0, 0, 0, 0.42, 0.5, 0.42, COLOR.woodL);
    bx(b, 0, 0.18, 0.211, 0.3, 0.02, 0.005, COLOR.woodD, { ao: 0 });
    lampShade(b, l, -0.07, 0.5, 0, 0.16, 0.2);
    bx(b, -0.07, 0.5, 0, 0.025, 0.22, 0.025, '#b8a070', { ao: 0 });
    bx(b, 0.12, 0.5, 0.05, 0.1, 0.07, 0.06, '#d23a3a', { ao: 0 });
  });
  S(-1.95, 2.55, 0.22, 0.22);
  // the desk: a laptop, a lamp, books and a pencil cup; her chair
  place(2.0, FL, 1.25, 0, (b, l, s) => {
    bx(b, 0, 0.72, 0, 1.3, 0.04, 0.6, COLOR.woodL);
    bx(b, -0.58, 0, 0, 0.05, 0.72, 0.58, COLOR.wood);
    bx(b, 0.2, 0, 0, 0.5, 0.72, 0.58, COLOR.wood);
    for (const y of [0.1, 0.34, 0.54]) bx(b, 0.2, y, 0.295, 0.42, 0.14, 0.01, '#a67a4a', { ao: 0 });
    bx(b, -0.1, 0.76, 0.02, 0.3, 0.015, 0.21, '#aeb4ba', { ao: 0 });
    bx(b, -0.1, 0.775, -0.11, 0.3, 0.2, 0.012, '#aeb4ba', { ao: 0 });
    bx(s, -0.1, 0.79, -0.103, 0.27, 0.17, 0.006, '#9bbcff', { ao: 0 });
    for (let k = 0; k < 4; k++) bx(b, 0.45, 0.76 + k * 0.035, -0.1, 0.22 - k * 0.012, 0.035, 0.16, ['#c8322e', '#2f5ea8', '#e0b341', '#3a9a5a'][k], { ao: 0 });
    b.frustum(-0.5, 0.76, 0.12, 0.04, 0.04, 0.1, 8, '#4a6a8a', { ao: 0.05 });
    bx(b, -0.5, 0.82, 0.12, 0.012, 0.12, 0.012, '#e8402a', { ao: 0, yaw: 20 });
    lampShade(b, l, 0.55, 0.76, 0.15, 0.2, 0.18);
    bx(b, 0.55, 0.76, 0.15, 0.025, 0.3, 0.025, '#6a6e74', { ao: 0 });
  });
  S(2.0, 1.25, 0.65, 0.3);
  chair(2.0, 2.0, 180);
  bx(body, 3.0, FL, 1.6, 0.34, 0.3, 0.12, '#7a4a3a', { ao: 0.1, yaw: 20 }); // her school bag on the floor
  // the wardrobe along the east wall, and a rack with her uniform
  place(3.65, FL, 3.0, -90, (b) => {
    bx(b, 0, 0, 0, 1.4, 1.95, 0.6, '#e8dcc6');
    bx(b, 0, 0.05, 0.301, 0.01, 1.8, 0.005, '#b8a98a', { ao: 0 });
    for (const x of [-0.04, 0.04]) bx(b, x, 0.95, 0.31, 0.02, 0.18, 0.02, '#8a8f94', { ao: 0 });
  });
  S(3.65, 3.0, 0.3, 0.7);
  place(3.2, FL, 1.5, 0, (b) => {
    b.frustum(0, 0, 0, 0.2, 0.2, 0.03, 12, COLOR.dark, { ao: 0 });
    bx(b, 0, 0.03, 0, 0.03, 1.5, 0.03, '#6a6e74', { ao: 0 });
    bx(b, 0, 1.45, 0, 0.45, 0.025, 0.025, '#6a6e74', { ao: 0 });
    bx(b, 0, 1.0, 0, 0.36, 0.42, 0.1, '#f7f4ee', { ao: 0.05 }); // the sailor top: white, a navy collar, a red ribbon
    bx(b, 0, 1.3, 0.06, 0.34, 0.12, 0.02, '#27386f', { ao: 0 });
    bx(b, 0, 1.2, 0.07, 0.07, 0.06, 0.02, '#c8322e', { ao: 0 });
    bx(b, 0, 0.62, 0, 0.4, 0.36, 0.1, '#27386f', { ao: 0.05 }); // the navy skirt
  });
  S(3.2, 1.5, 0.22, 0.22);
  body.disc(0.9, FL + 0.006, 2.5, 1.0, 0.012, 'y', '#e2b5b0', 24); // a round rug
  body.disc(0.9, FL + 0.013, 2.5, 0.65, 0.012, 'y', '#f2d6d0', 24);
  place(0.9, FL, 4.2, 180, (b) => { // a low bookshelf
    bx(b, 0, 0, 0, 1.0, 0.8, 0.3, COLOR.woodL);
    for (let row = 0; row < 2; row++) {
      bx(b, 0, 0.1 + row * 0.35, 0.02, 0.96, 0.02, 0.27, COLOR.woodD, { ao: 0 });
      let x = -0.44;
      for (let k = 0; x < 0.4; k++) { const w = 0.035, h = 0.22 + ((k * 3 + row) % 3) * 0.03; book(b, x + w / 2, 0.125 + row * 0.35, 0.02, h, ['#e8862a', '#4aa8e0', '#c8322e', '#3a9a5a', '#7a2db8'][(k + row) % 5], w, 0.22); x += w + 0.004; }
    }
  });
  S(0.9, 4.2, 0.52, 0.17);
  body.blob(2.5, FL + 0.28, 3.5, 0.38, 0.28, 0.38, '#8aa0c0', { seed: 21 }); // a bean bag
  S(2.5, 3.5, 0.4, 0.4);
  pot(3.7, FL, 4.15, 0.2);
  S(3.7, 4.15, 0.22, 0.22);

  // --- the bathroom
  place(-3.45, FL, 3.6, 0, (b) => { // the tub, with a lid half rolled back
    bx(b, 0, 0, 0, 0.9, 0.55, 1.6, '#f4f6f6', { ao: 0.08 });
    bx(b, 0, 0.55, 0, 0.7, 0.01, 1.4, '#8fd0e8', { ao: 0 });
    bx(b, 0, 0.5, 0.2, 0.7, 0.04, 0.6, '#cfd8dc', { ao: 0 });
    bx(b, 0.3, 0.55, -0.8, 0.04, 0.2, 0.04, '#b8bec4', { ao: 0 });
  });
  S(-3.45, 3.6, 0.45, 0.8);
  place(-3.75, FL, 1.5, 90, (b) => { // the wash basin
    bx(b, 0, 0, 0, 0.9, 0.8, 0.46, '#efe9dc');
    bx(b, 0, 0.8, 0, 0.9, 0.04, 0.46, '#f4f6f6', { ao: 0 });
    b.disc(0, 0.845, 0.02, 0.17, 0.02, 'y', '#dfe6ea', 14);
    bx(b, 0, 0.84, -0.17, 0.04, 0.16, 0.04, '#b8bec4', { ao: 0 });
  });
  S(-3.75, 1.5, 0.23, 0.45);
  place(-2.45, FL, 1.5, 180, (b) => { // the washing machine
    bx(b, 0, 0, 0, 0.55, 0.9, 0.6, '#f1f3f4');
    b.disc(0, 0.45, 0.301, 0.2, 0.02, 'z', '#8a9aa6', 16);
    b.disc(0, 0.45, 0.31, 0.15, 0.02, 'z', '#cfe4ee', 16);
    bx(b, 0.12, 0.8, 0.301, 0.2, 0.05, 0.01, '#6a6e74', { ao: 0 });
  });
  S(-2.45, 1.5, 0.28, 0.3);
  place(-2.6, FL, 3.9, -90, (b) => { // the toilet
    bx(b, 0, 0, -0.1, 0.4, 0.78, 0.2, '#f4f6f6');
    b.blob(0, 0.22, 0.12, 0.2, 0.2, 0.28, '#f4f6f6', { seed: 31 });
    bx(b, 0, 0.4, 0.12, 0.34, 0.04, 0.42, '#e8ecee', { ao: 0 });
  });
  S(-2.6, 3.9, 0.3, 0.2);
  body.frustum(-3.15, FL, 2.3, 0.15, 0.13, 0.22, 10, '#e8e2d4', { ao: 0.1 }); // a bath stool and a bucket
  body.frustum(-3.55, FL, 2.0, 0.12, 0.1, 0.2, 10, '#e8862a', { ao: 0.1 });

  // ---------------------------------------------------------------------------------------------------------------
  // what hangs on the walls (it is hidden while the wall is cut down)
  // ---------------------------------------------------------------------------------------------------------------
  const frame = (s: Side, t: number, y: number, w: number, h: number, c: string, inner: string) => {
    onWall(s, side[s].decor, t, y, w, h, 0.04, c);
    onWall(s, side[s].decor, t, y + 0.04, w - 0.08, h - 0.08, 0.05, inner);
  };
  frame('N', 2.6, 1.7, 0.7, 0.5, '#6f4d33', '#9ab4cc'); // a picture over the TV
  onWall('N', side.N.decor, -1.2, 1.5, 0.3, 0.3, 0.05, '#f7f4ee'); // a clock
  onWall('N', side.N.decor, -1.2, 1.57, 0.02, 0.15, 0.06, '#2a2d33');
  onWall('N', side.N.decor, -2.0, 1.2, 0.3, 0.42, 0.04, '#f7f2e4'); // a calendar
  onWall('N', side.N.decor, -2.0, 1.52, 0.3, 0.1, 0.045, '#c8322e');
  frame('W', -3.3, 1.5, 0.5, 0.6, '#d8c9ac', '#e8dcc0'); // a mirror in the entrance... and photos in the hall
  frame('W', -2.3, 1.55, 0.4, 0.5, '#6f4d33', '#a8c4a0');
  onWall('W', side.W.decor, -0.2, 1.65, 1.0, 0.03, 0.1, COLOR.woodD); // the coat rail, with her jacket and bag
  for (const t of [-0.5, -0.2, 0.1]) onWall('W', side.W.decor, t, 1.6, 0.03, 0.08, 0.14, '#b8a070');
  onWall('W', side.W.decor, -0.5, 0.95, 0.4, 0.65, 0.07, '#27386f', 0.1);
  onWall('W', side.W.decor, 0.1, 1.05, 0.34, 0.3, 0.14, '#7a4a3a', 0.1);
  onWall('W', side.W.decor, 1.5, 1.3, 0.7, 0.6, 0.03, '#dfe6ea'); // the bathroom mirror
  onWall('W', side.W.decor, 2.4, 1.2, 0.04, 0.9, 0.04, '#b8bec4', 0.02); // the shower rail
  onWall('E', side.E.decor, 0.5, 1.6, 0.6, 0.45, 0.04, '#f2c230'); // posters in the bedroom
  onWall('E', side.E.decor, 1.5, 1.4, 0.4, 0.55, 0.04, '#e86a92');
  frame('S', 3.2, 1.6, 0.6, 0.45, '#6f4d33', '#c9a05a');

  // ---------------------------------------------------------------------------------------------------------------
  // meshes, lights
  // ---------------------------------------------------------------------------------------------------------------
  const wallMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  const lampMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const screenMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const glassMat = new MeshBasicMaterial({ color: '#c6e4ff', transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false });
  const mesh = (b: GeoBuilder, m: MeshStandardMaterial | MeshBasicMaterial, shadow: boolean, name: string) => {
    const o = new Mesh(b.toGeometry(), m);
    o.name = name;
    o.castShadow = shadow;
    o.receiveShadow = true;
    return o;
  };
  group.add(mesh(body, bodyMat, true, 'Home furniture'), mesh(lamp, lampMat, false, 'Home lamps'), mesh(screen, screenMat, false, 'Home screens'));
  const walls = (Object.keys(side) as Side[]).map((k) => {
    const g = new Group();
    g.name = `Wall ${k}`;
    const shell = mesh(side[k].shell, wallMat, true, `Wall ${k} shell`), glass = mesh(side[k].glass, glassMat, false, `Wall ${k} glass`), decor = mesh(side[k].decor, bodyMat, true, `Wall ${k} decor`);
    glass.receiveShadow = false;
    g.add(shell, glass, decor);
    group.add(g);
    return { k, g, shell, glass, decor, cut: 0 };
  });

  const warm = new Color('#ffe0b0');
  const lights = [[-0.4, -2.6], [2.7, -2.0], [0.8, 2.6], [-3.1, -1.0], [-3.1, 2.6]].map(([x, z]) => {
    const l = new PointLight(warm, 0, 9, 1.3);
    l.position.set(x, 2.3, z);
    group.add(l);
    return l;
  });
  const ambient = new AmbientLight('#ffe9cf', 0.1);
  group.add(ambient);

  const day = new Color('#c6e4ff'), nightGlass = new Color('#0d1a3a');
  const tvDay = new Color('#1c2230'), tvNight = new Color('#ffffff');
  const tmp = new Color();

  return {
    group,
    solids,
    shadowHalf: 12,
    spots: [{ x0: 3.65, z0: 3.0, x1: 3.65, z1: 3.0, r: 1.9, label: 'Wardrobe: change your bag, keep things', kind: 'wardrobe' }],
    floor: (x, z) => (x < -2.2 && z < -2.7 ? 0 : FL),
    surface: (x, z) => ((x < -2.2 && z < -2.7) || (x < -2.2 && z > 0.8) ? 'tile' : x > 1.2 ? 'tatami' : 'wood'),
    update(night) {
      for (const l of lights) l.intensity = 0.25 + 3.2 * night;
      ambient.intensity = 0.04 + 0.28 * night;
      lampMat.color.setScalar(0.8 + night * 0.5);
      screenMat.color.copy(tmp.copy(tvDay).lerp(tvNight, night));
      glassMat.color.copy(tmp.copy(day).lerp(nightGlass, night));
      glassMat.opacity = 0.35 + 0.4 * night;
    },
    frame(dt, yaw) {
      // the camera stands toward (sin yaw, cos yaw) from the player: a wall facing that way is between them
      const toward: Record<Side, number> = { N: -Math.cos(yaw), S: Math.cos(yaw), E: Math.sin(yaw), W: -Math.sin(yaw) };
      for (const w of walls) {
        const want = smoothstep(0.12, 0.55, toward[w.k]);
        w.cut += (want - w.cut) * (dt > 0 ? 1 - Math.exp(-dt * 9) : 1);
        const sy = 1 - 0.62 * w.cut;
        w.shell.scale.y = sy;
        w.glass.scale.y = sy;
        w.decor.visible = w.cut < 0.25;
      }
    },
  };
}
