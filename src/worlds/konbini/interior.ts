import { AmbientLight, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, SRGBColorSpace } from 'three';
import { GeoBuilder } from '../../util/builder';
import type { Solid } from '../../world/village/frame';
import type { InteriorBuild } from '../types';

/**
 * Hoshi Mart, the convenience store on the main street (World 3): 10 m by 8 m, seen from above like the home. No ceiling,
 * and the walls between the camera and the shop are cut down. The automatic door is in the north wall (a few steps in
 * from the street); inside are two aisles of shelves, a magazine rack, a drinks cooler and a chilled case for onigiri
 * and bento, an eat-in bar by the window, and the counter in the north-east corner with the till, the oden and the
 * clerk's side, closed off by the ATM and the copier. Nothing is built outside the walls, and the only light is the shop's own.
 *
 * Axes: x east, z south, y up. Everything is boxes with vertex colours, like the rest of the game.
 */

export const SHOP = {
  X0: -5, X1: 5, Z0: -4, Z1: 4, // the inside of the walls
  WALL: 2.8,
  /** The door (north wall, left of the middle) and the clerk's place behind the counter. */
  door: { x: -3, z: -4 },
};
const { X0, X1, Z0, Z1, WALL } = SHOP;
const WT = 0.2;

const C = {
  wallIn: '#f4f2ec', wallOut: '#d6d4cc', cap: '#8a8f94', slab: '#8d877c',
  blue: '#2a8fd8', blueD: '#1f70ac', blueL: '#8fd0f4', white: '#f6f6f2', grey: '#c9cdd0', greyD: '#8a9096', dark: '#2a2d33',
  wood: '#b98a5a', woodD: '#6f4d33', woodL: '#d9bb8c', orange: '#f08a2c', green: '#37a867', red: '#d8402a', frame: '#9aa0a6',
};
const GOODS = ['#e8402a', '#f2c230', '#4aa8e0', '#3a9a5a', '#f08aac', '#e8862a', '#7a4ab8', '#f4f4ee', '#8a5a3a', '#2f5ea8'];

type Side = 'N' | 'E' | 'S' | 'W';
interface Opening { a: number; b: number; y0: number; y1: number; kind: 'window' | 'door' }
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A repeatable "random" number for the goods (the same shop every time). */
const hash = (a: number, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

/** A flat sign with writing on it (a canvas texture), for the walls. */
function signPlane(text: string[], w: number, h: number, bg: string, fg: string, accent: string): Mesh {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const g = cv.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = accent; g.fillRect(0, cv.height - 14, cv.width, 14);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = text.length;
  text.forEach((t, i) => { g.font = `bold ${Math.round((cv.height - 24) / n * (i ? 0.62 : 0.78))}px sans-serif`; g.fillText(t, cv.width / 2, ((i + 0.5) * (cv.height - 14)) / n); });
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, toneMapped: false }));
}

export function buildShop(): InteriorBuild {
  const group = new Group();
  group.name = 'Hoshi Mart';
  const solids: Solid[] = [];
  const S = (x: number, z: number, hw: number, hd: number, a = 0) => { solids.push({ t: 'box', x, z, hw, hd, a }); };

  const body = new GeoBuilder(); // furniture, floor: always there
  const lit = new GeoBuilder(); // coolers, shelf lights, the till: lit
  const screen = new GeoBuilder(); // the ATM and the till screen
  const side: Record<Side, { shell: GeoBuilder; glass: GeoBuilder; decor: GeoBuilder }> = {
    N: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    E: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    S: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
    W: { shell: new GeoBuilder(), glass: new GeoBuilder(), decor: new GeoBuilder() },
  };
  const bx = (b: GeoBuilder, x: number, y0: number, z: number, w: number, h: number, d: number, color: string, o: { ao?: number; yaw?: number } = {}) => b.box(x, y0 + h / 2, z, w, h, d, color, { ao: 0.08, ...o });

  // ---------------------------------------------------------------------------------------------------------------
  // the floor: pale tiles in a loose chequer, a blue border strip at the entrance, a mat
  // ---------------------------------------------------------------------------------------------------------------
  bx(body, 0, -0.37, 0, 10.7, 0.35, 8.7, C.slab, { ao: 0.2 }); // (its top is under the pavement outside: no two faces share a plane)
  for (let i = 0; i < 20; i++) for (let j = 0; j < 16; j++) bx(body, X0 + 0.25 + i * 0.5, 0, Z0 + 0.25 + j * 0.5, 0.5, 0.02, 0.5, (i + j) % 2 ? '#e6e5df' : '#dcdbd4', { ao: 0.01 });
  bx(body, -3, 0.02, -3.35, 2.0, 0.012, 0.8, '#3a4a5a', { ao: 0 }); // the door mat
  bx(body, -3, 0.032, -3.35, 1.84, 0.004, 0.64, '#4a5c6e', { ao: 0 });

  // ---------------------------------------------------------------------------------------------------------------
  // walls, with their openings
  // ---------------------------------------------------------------------------------------------------------------
  const AXIS = (s: Side) => s === 'N' || s === 'S';
  const SIGN = (s: Side) => (s === 'N' || s === 'W' ? -1 : 1);
  const BASE = (s: Side) => (s === 'N' ? Z0 : s === 'S' ? Z1 : s === 'W' ? X0 : X1);
  const piece = (s: Side, t0: number, t1: number, y0: number, y1: number) => {
    if (t1 - t0 < 1e-4 || y1 - y0 < 1e-4) return;
    const mid = (t0 + t1) / 2, len = t1 - t0, B = side[s].shell;
    for (const [off, col] of [[0.05, C.wallIn], [0.15, C.wallOut]] as const) {
      const c = BASE(s) + SIGN(s) * off;
      if (AXIS(s)) B.box(mid, (y0 + y1) / 2, c, len, y1 - y0, 0.1, col, { ao: 0.04 });
      else B.box(c, (y0 + y1) / 2, mid, 0.1, y1 - y0, len, col, { ao: 0.04 });
    }
    if (y1 >= WALL - 1e-4) {
      const c = BASE(s) + SIGN(s) * 0.1;
      if (AXIS(s)) B.box(mid, WALL + 0.025, c, len, 0.05, WT + 0.02, C.cap, { ao: 0 });
      else B.box(c, WALL + 0.025, mid, WT + 0.02, 0.05, len, C.cap, { ao: 0 });
    }
  };
  const onWall = (s: Side, b: GeoBuilder, t: number, y0: number, w: number, h: number, depth: number, color: string, off = 0) => {
    const c = BASE(s) - SIGN(s) * (depth / 2 + off);
    if (AXIS(s)) bx(b, t, y0, c, w, h, depth, color, { ao: 0.02 });
    else bx(b, c, y0, t, depth, h, w, color, { ao: 0.02 });
  };
  const wall = (s: Side, openings: Opening[]) => {
    const [lo, hi] = AXIS(s) ? [X0 - WT, X1 + WT] : [Z0, Z1];
    let t = lo;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      piece(s, t, o.a, -0.35, WALL);
      piece(s, o.a, o.b, -0.35, o.y0);
      piece(s, o.a, o.b, o.y1, WALL);
      t = o.b;
      const sh = side[s].shell, mid = (o.a + o.b) / 2, w = o.b - o.a, h = o.y1 - o.y0;
      const c = BASE(s) + SIGN(s) * 0.1, G = side[s].glass;
      const p = (tt: number, y: number): [number, number, number] => (AXIS(s) ? [tt, y, c] : [c, y, tt]);
      G.quad(p(o.a, o.y0), p(o.b, o.y0), p(o.b, o.y1), p(o.a, o.y1), [1, 1, 1]);
      // the frame on the inner face (aluminium)
      onWall(s, sh, o.a + 0.03, o.y0, 0.06, h, 0.06, C.frame);
      onWall(s, sh, o.b - 0.03, o.y0, 0.06, h, 0.06, C.frame);
      onWall(s, sh, mid, o.y1 - 0.06, w, 0.06, 0.06, C.frame);
      if (o.kind === 'window') {
        onWall(s, sh, mid, o.y0, w, 0.05, 0.14, C.white); // the sill
        const n = Math.max(1, Math.round(w / 1.6));
        for (let k = 1; k < n; k++) onWall(s, sh, o.a + (k * w) / n, o.y0, 0.04, h, 0.05, C.frame);
      } else {
        // an automatic door: two sliding leaves, with a centre bar, a handle bar each and a sensor on top
        onWall(s, sh, mid, o.y0, 0.05, h, 0.07, C.frame);
        for (const k of [-1, 1]) onWall(s, sh, mid + k * 0.12, o.y0 + 0.9, 0.03, 0.5, 0.09, C.greyD);
        onWall(s, sh, mid, o.y1 + 0.02, 0.5, 0.1, 0.1, C.dark);
        onWall(s, sh, mid, o.y0, w - 0.1, 0.06, 0.07, C.frame);
      }
    }
    piece(s, t, hi, -0.35, WALL);
    const c = BASE(s) + SIGN(s) * 0.1;
    if (AXIS(s)) S((lo + hi) / 2, c, (hi - lo) / 2, 0.1);
    else S(c, (lo + hi) / 2, 0.1, (hi - lo) / 2);
  };
  wall('N', [{ a: SHOP.door.x - 0.9, b: SHOP.door.x + 0.9, y0: 0, y1: 2.3, kind: 'door' }]);
  wall('S', [{ a: -4.0, b: -0.5, y0: 0.7, y1: 2.2, kind: 'window' }, { a: 0.5, b: 4.0, y0: 0.7, y1: 2.2, kind: 'window' }]);
  wall('W', [{ a: 0.7, b: 3.5, y0: 0.95, y1: 2.2, kind: 'window' }]);
  wall('E', [{ a: -3.0, b: -1.0, y0: 0.95, y1: 2.2, kind: 'window' }]);
  // the Hoshi Mart stripes round the whole shop, above the windows: blue, white, light blue
  for (const s of ['N', 'E', 'S', 'W'] as Side[]) {
    const len = AXIS(s) ? X1 - X0 : Z1 - Z0, mid = 0;
    onWall(s, side[s].shell, mid, 2.3, len, 0.26, 0.04, C.blue);
    onWall(s, side[s].shell, mid, 2.56, len, 0.05, 0.04, C.white);
    onWall(s, side[s].shell, mid, 2.61, len, 0.1, 0.04, C.blueL);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // furniture
  // ---------------------------------------------------------------------------------------------------------------
  /** A gondola shelf along x (double-sided): the spine, four shelves a side, goods, a lit price rail and a blue header. */
  const gondola = (x0: number, x1: number, z: number, seed: number) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    bx(body, cx, 0, z, w, 0.12, 0.62, C.greyD, { ao: 0.1 });
    bx(body, cx, 0.12, z, w, 1.4, 0.04, C.grey, { ao: 0.05 });
    for (const sx of [x0 + 0.02, x1 - 0.02]) bx(body, sx, 0.12, z, 0.04, 1.4, 0.6, C.grey, { ao: 0.05 });
    bx(body, cx, 1.52, z, w, 0.06, 0.6, C.blue, { ao: 0.05 }); // the header strip
    bx(lit, cx, 1.585, z, w - 0.04, 0.02, 0.5, '#e6f4ff', { ao: 0 });
    for (const sd of [-1, 1]) for (let lv = 0; lv < 4; lv++) {
      const y = 0.2 + lv * 0.31, zc = z + sd * 0.15;
      bx(body, cx, y, zc, w - 0.1, 0.025, 0.28, C.white, { ao: 0.03 });
      bx(body, cx, y + 0.005, z + sd * 0.295, w - 0.1, 0.05, 0.012, C.blueL, { ao: 0 }); // the price rail
      let x = x0 + 0.1, k = 0;
      while (x < x1 - 0.14) {
        const ww = 0.09 + hash(seed, lv + sd * 7, k) * 0.07, h = 0.12 + hash(seed + 1, lv, k + sd * 3) * 0.1;
        bx(body, x + ww / 2, y + 0.025, zc, ww, h, 0.18, GOODS[Math.floor(hash(seed + 2, lv + sd, k) * GOODS.length)], { ao: 0.04 });
        x += ww + 0.012; k++;
      }
    }
    S(cx, z, w / 2 + 0.02, 0.32);
  };
  gondola(-1.6, 2.4, -0.4, 1);
  gondola(-1.6, 2.4, 1.5, 2);

  /** A reach-in cooler row along the south wall: a dark cabinet, glowing shelves of drinks, door frames and handles. */
  const cooler = (x0: number, x1: number, zFront: number, seed: number) => {
    const w = x1 - x0, cx = (x0 + x1) / 2, d = 0.7, zc = zFront + d / 2;
    bx(body, cx, 0, zc, w, 2.05, d, '#e4e7ea', { ao: 0.1 });
    bx(body, cx, 2.05, zc, w, 0.12, d, C.blue, { ao: 0.05 });
    bx(lit, cx, 2.17, zFront + 0.2, w - 0.1, 0.03, 0.2, '#ffffff', { ao: 0 });
    const n = Math.max(1, Math.round(w / 0.7)), dw = w / n;
    for (let i = 0; i < n; i++) {
      const dx = x0 + (i + 0.5) * dw;
      bx(lit, dx, 0.18, zFront - 0.002, dw - 0.1, 1.75, 0.012, '#dff2fa', { ao: 0 });
      for (let lv = 0; lv < 5; lv++) {
        let x = dx - dw / 2 + 0.08, k = 0;
        while (x < dx + dw / 2 - 0.13) {
          const ww = 0.07 + hash(seed, i * 5 + lv, k) * 0.03;
          bx(lit, x + ww / 2, 0.22 + lv * 0.34, zFront - 0.006, ww, 0.2 + hash(seed + 3, i, k + lv) * 0.06, 0.012, GOODS[Math.floor(hash(seed + 4, i + lv, k) * GOODS.length)], { ao: 0 });
          x += ww + 0.02; k++;
        }
      }
      bx(body, dx, 0.12, zFront - 0.02, dw - 0.04, 0.06, 0.04, C.greyD, { ao: 0 }); // the frame, bottom and top
      bx(body, dx, 1.95, zFront - 0.02, dw - 0.04, 0.08, 0.04, C.greyD, { ao: 0 });
      for (const e of [-1, 1]) bx(body, dx + e * (dw / 2 - 0.03), 0.12, zFront - 0.02, 0.04, 1.9, 0.04, C.greyD, { ao: 0 });
      bx(body, dx + dw / 2 - 0.1, 0.9, zFront - 0.05, 0.025, 0.4, 0.03, C.dark, { ao: 0 }); // the handle
    }
    S(cx, zc, w / 2, d / 2);
  };
  cooler(-1.5, 3.8, 3.3, 11); // the drinks, along the south wall

  /** The open chilled case for onigiri, bento and sandwiches, against the east wall (it faces west). */
  const chilled = (z0: number, z1: number) => {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    bx(body, 4.6, 0, cz, 0.7, 0.3, len, '#e4e7ea', { ao: 0.1 });
    bx(body, 4.76, 0.3, cz, 0.38, 1.55, len, '#e4e7ea', { ao: 0.08 });
    bx(body, 4.8, 1.85, cz, 0.4, 0.14, len, C.blue, { ao: 0.05 });
    bx(lit, 4.58, 1.78, cz, 0.04, 0.04, len - 0.1, '#ffffff', { ao: 0 });
    for (let lv = 0; lv < 4; lv++) {
      const y = 0.3 + lv * 0.4, dd = 0.55 - lv * 0.04;
      bx(body, 4.95 - dd / 2 - 0.2, y, cz, dd, 0.03, len - 0.06, C.white, { ao: 0.03 });
      let z = z0 + 0.1, k = 0;
      while (z < z1 - 0.15) {
        const ww = 0.13 + hash(21, lv, k) * 0.08;
        bx(lit, 4.95 - dd / 2 - 0.2 - 0.04, y + 0.03, z + ww / 2, dd - 0.15, 0.15 + hash(22, lv, k) * 0.05, ww, ['#f4f4ee', '#f2c230', '#e8862a', '#c8322e', '#8fbf6a', '#f4f4ee'][Math.floor(hash(23, lv, k) * 6)], { ao: 0 });
        z += ww + 0.03; k++;
      }
    }
    S(4.6, cz, 0.38, len / 2);
  };
  chilled(-1.2, 1.6);

  // the magazine rack by the west window ("tachiyomi": the people reading standing up)
  const rackZ0 = -2.1, rackZ1 = 0.3;
  bx(body, -4.55, 0, (rackZ0 + rackZ1) / 2, 0.55, 0.2, rackZ1 - rackZ0, C.woodD, { ao: 0.1 });
  for (let lv = 0; lv < 4; lv++) {
    const y = 0.2 + lv * 0.32;
    for (let z = rackZ0 + 0.05, k = 0; z < rackZ1 - 0.15; z += 0.2, k++) {
      bx(body, -4.56 + lv * 0.03, y + 0.01, z + 0.09, 0.4 - lv * 0.06, 0.02, 0.18, '#e6e4dc', { ao: 0 }); // a magazine, leaning
      bx(body, -4.5 + lv * 0.03, y + 0.03, z + 0.09, 0.28, 0.3, 0.17, GOODS[Math.floor(hash(31, lv, k) * GOODS.length)], { ao: 0, yaw: 0 });
    }
  }
  bx(body, -4.82, 0.2, (rackZ0 + rackZ1) / 2, 0.1, 1.3, rackZ1 - rackZ0, C.woodD, { ao: 0.05 });
  S(-4.55, (rackZ0 + rackZ1) / 2, 0.3, (rackZ1 - rackZ0) / 2);

  // the eat-in bar under the west window, with three stools
  bx(body, -4.7, 0, 2.2, 0.55, 0.92, 2.6, C.woodL, { ao: 0.08 });
  bx(body, -4.66, 0.92, 2.2, 0.62, 0.05, 2.7, C.wood, { ao: 0.05 });
  for (const z of [1.3, 2.2, 3.1]) {
    body.frustum(-4.1, 0.02, z, 0.17, 0.17, 0.03, 10, C.dark, { ao: 0 }); // (on the tiles, not in their plane)
    bx(body, -4.1, 0.05, z, 0.04, 0.57, 0.04, C.greyD, { ao: 0 });
    body.frustum(-4.1, 0.62, z, 0.17, 0.16, 0.06, 10, C.blue, { ao: 0.05 });
  }
  S(-4.65, 2.2, 0.32, 1.38);
  bx(body, -4.7, 0.97, 1.6, 0.14, 0.14, 0.14, C.white, { ao: 0.02 }); // a cup and a bento box on the bar
  bx(body, -4.66, 0.97, 2.5, 0.3, 0.06, 0.22, C.orange, { ao: 0.02 });
  bx(body, -4.66, 1.03, 2.5, 0.28, 0.02, 0.2, '#f4f4ee', { ao: 0 });

  // a freezer chest with ice cream by the south-west corner
  bx(body, -3.1, 0, 3.4, 1.4, 0.82, 0.8, '#eceef0', { ao: 0.08 });
  bx(body, -3.1, 0.82, 3.4, 1.34, 0.04, 0.74, '#bfe4f4', { ao: 0 });
  for (let k = 0; k < 6; k++) bx(body, -3.65 + k * 0.22, 0.86, 3.4, 0.14, 0.1, 0.5, GOODS[(k * 3) % GOODS.length], { ao: 0 });
  bx(body, -3.1, 0.88, 3.4, 1.34, 0.02, 0.01, C.blue, { ao: 0 });
  S(-3.1, 3.4, 0.72, 0.42);

  // by the door: a basket stack, an umbrella stand, and three bins (burnable, cans, plastic)
  // the stack of baskets: a grey wire stand with six red plastic baskets nested in each other (the rims show in rings)
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.27, 0.27]) bx(body, -4.45 + sx, 0, -3.5 + sz, 0.035, 0.6, 0.035, C.greyD, { ao: 0.05 });
  bx(body, -4.45, 0.6, -3.5, 0.46, 0.03, 0.62, C.grey, { ao: 0.05 });
  const basketAt = (y0: number, n: number) => {
    const x = -4.45, z = -3.5, W = 0.36, L = 0.52, H = 0.2, t = 0.025;
    bx(body, x, y0, z, W - 0.02, t, L - 0.02, '#a8301e', { ao: 0.02 }); // the floor of the basket
    for (const sx of [-1, 1]) bx(body, x + sx * (W / 2 - t / 2), y0, z, t, H, L, '#d8402a', { ao: 0.02 }); // the long sides
    for (const sz of [-1, 1]) bx(body, x, y0, z + sz * (L / 2 - t / 2), W - 2 * t, H, t, '#d8402a', { ao: 0.02 }); // the ends
    bx(body, x, y0 + H - 0.012, z, W + 0.02, 0.024, L + 0.02, '#f0604a', { ao: 0 }); // the rim, a lighter line round the top
    bx(body, x, y0 + H - 0.012, z, W - 0.05, 0.03, L - 0.05, '#7a2416', { ao: 0 }); // the dark inside (what shows in the nest)
    for (const sz of [-1, 1]) { // the handles: a white bar between two posts at each end, pointing out
      bx(body, x, y0 + H + 0.005, z + sz * (L / 2 + 0.035), 0.2, 0.025, 0.025, '#f4f4f0', { ao: 0 });
      for (const sx of [-1, 1]) bx(body, x + sx * 0.1, y0 + H - 0.05, z + sz * (L / 2 + 0.018), 0.025, 0.075, 0.03, '#f4f4f0', { ao: 0 });
    }
    void n;
  };
  for (let k = 0; k < 6; k++) basketAt(0.63 + k * 0.055, k);
  S(-4.45, -3.5, 0.28, 0.36);
  body.frustum(-1.75, 0, -3.65, 0.13, 0.11, 0.5, 10, '#3a4a5a', { ao: 0.05 });
  for (let k = 0; k < 3; k++) bx(body, -1.4 + k * 0.1, 0.5, -3.65, 0.02, 0.4, 0.02, ['#d23a3a', '#2a3a8a', '#e8c43a'][k], { ao: 0, yaw: 6 - k * 6 });
  S(-1.75, -3.65, 0.14, 0.14);
  for (let k = 0; k < 3; k++) {
    const x = -1.05 + k * 0.42;
    bx(body, x, 0, -3.62, 0.36, 0.7, 0.36, ['#37a867', '#2a8fd8', '#e8a030'][k], { ao: 0.08 });
    bx(body, x, 0.7, -3.62, 0.38, 0.04, 0.38, '#d8d8d4', { ao: 0 });
  }
  S(-0.64, -3.62, 0.62, 0.2);

  // ---- the counter: the till, a hot case, candy, the oden pot; the clerk stands behind it
  const CX0 = 0.9, CX1 = 4.6, CZ = -2.2;
  bx(body, (CX0 + CX1) / 2, 0, CZ, CX1 - CX0, 1.0, 0.8, C.white, { ao: 0.1 });
  bx(body, (CX0 + CX1) / 2, 0.15, CZ + 0.4, CX1 - CX0 - 0.1, 0.7, 0.02, C.blue, { ao: 0 });
  bx(body, (CX0 + CX1) / 2, 0.86, CZ + 0.41, CX1 - CX0 - 0.1, 0.05, 0.02, C.blueL, { ao: 0 });
  bx(body, (CX0 + CX1) / 2, 1.0, CZ, CX1 - CX0 + 0.04, 0.05, 0.86, C.grey, { ao: 0.05 });
  S((CX0 + CX1) / 2, CZ, (CX1 - CX0) / 2, 0.42);
  // the till and its screen, a card reader and a tray of coins
  bx(body, 2.6, 1.05, CZ - 0.1, 0.5, 0.18, 0.4, C.dark, { ao: 0.05 });
  bx(screen, 2.6, 1.25, CZ - 0.22, 0.34, 0.2, 0.02, '#9bbcff', { ao: 0, yaw: 0 });
  bx(body, 2.6, 1.23, CZ - 0.24, 0.38, 0.24, 0.02, C.dark, { ao: 0 });
  bx(body, 3.1, 1.05, CZ + 0.05, 0.16, 0.06, 0.12, C.greyD, { ao: 0 });
  bx(body, 3.25, 1.05, CZ - 0.15, 0.2, 0.025, 0.14, '#b87333', { ao: 0 });
  // the hot case (fried chicken and nikuman) at the east end
  bx(body, 4.1, 1.05, CZ + 0.05, 0.7, 0.05, 0.55, C.greyD, { ao: 0.05 });
  bx(lit, 4.1, 1.1, CZ + 0.05, 0.6, 0.38, 0.45, '#ffe0a0', { ao: 0 });
  for (let k = 0; k < 5; k++) bx(body, 3.88 + k * 0.11, 1.12, CZ + 0.05, 0.08, 0.1, 0.3, ['#c9803a', '#f1e7c8', '#d8a050'][k % 3], { ao: 0 });
  bx(body, 4.1, 1.5, CZ + 0.05, 0.7, 0.03, 0.55, C.greyD, { ao: 0 });
  // the oden pot and a rack of candy and gum by the till
  bx(body, 1.5, 1.05, CZ + 0.05, 0.55, 0.16, 0.5, C.greyD, { ao: 0.05 });
  bx(lit, 1.5, 1.21, CZ + 0.05, 0.46, 0.02, 0.4, '#d8a050', { ao: 0 });
  for (let k = 0; k < 4; k++) bx(body, 1.35 + k * 0.1, 1.23, CZ + 0.05, 0.02, 0.14, 0.02, '#f4f0e0', { ao: 0 });
  for (let k = 0; k < 6; k++) bx(body, 3.45 + (k % 3) * 0.11, 1.05, CZ + 0.2 - Math.floor(k / 3) * 0.12, 0.09, 0.1, 0.09, GOODS[k + 2], { ao: 0 });

  // behind the counter: a back shelf with cigarettes, a coffee machine and a rack of cups
  bx(body, 3.0, 0, -3.78, 3.2, 1.0, 0.4, C.white, { ao: 0.1 });
  bx(body, 3.0, 1.0, -3.78, 3.24, 0.04, 0.44, C.grey, { ao: 0 });
  for (let lv = 0; lv < 3; lv++) for (let k = 0; k < 12; k++) bx(body, 1.6 + k * 0.115, 1.12 + lv * 0.26, -3.88, 0.09, 0.18, 0.08, GOODS[(k + lv * 4) % GOODS.length], { ao: 0 });
  for (let lv = 0; lv < 3; lv++) bx(body, 3.0, 1.06 + lv * 0.26, -3.86, 3.1, 0.02, 0.2, C.grey, { ao: 0 });
  bx(body, 4.1, 1.04, -3.7, 0.5, 0.52, 0.34, C.dark, { ao: 0.05 }); // the coffee machine
  bx(lit, 4.1, 1.28, -3.52, 0.34, 0.14, 0.012, '#7fd4d0', { ao: 0 });
  bx(body, 4.1, 1.04, -3.55, 0.2, 0.02, 0.1, C.greyD, { ao: 0 });
  S(3.0, -3.8, 1.62, 0.22);
  // the ATM and the copier close the clerk's side at the counter's west end
  bx(body, 0.5, 0, -3.5, 0.7, 1.75, 0.6, '#d8dde0', { ao: 0.08 });
  bx(body, 0.5, 1.75, -3.5, 0.7, 0.12, 0.6, C.green, { ao: 0.05 });
  bx(screen, 0.5, 1.28, -3.19, 0.46, 0.34, 0.012, '#9bbcff', { ao: 0 });
  bx(body, 0.5, 0.95, -3.17, 0.46, 0.06, 0.06, C.dark, { ao: 0 });
  bx(body, 0.5, 0, -2.55, 0.7, 1.1, 0.5, '#e8eaec', { ao: 0.08 });
  bx(body, 0.5, 1.1, -2.55, 0.7, 0.08, 0.5, C.dark, { ao: 0.05 });
  bx(screen, 0.38, 1.0, -2.3, 0.18, 0.1, 0.01, '#9bbcff', { ao: 0, yaw: 0 });
  S(0.5, -3.0, 0.38, 1.0);

  // a plant, a poster stand, and the lamp posts of the aisles: shelf-end boards
  const pot = (x: number, z: number) => {
    body.frustum(x, 0, z, 0.2, 0.16, 0.34, 10, '#b9704a', { ao: 0.1 });
    for (const [dx, dy, dz, rr, c] of [[0, 0.55, 0, 0.3, '#4f9a45'], [0.12, 0.8, 0.05, 0.22, '#5aa845'], [-0.12, 0.7, -0.06, 0.2, '#3f8a3b']] as const) body.blob(x + dx, dy, z + dz, rr, rr * 1.2, rr, c, { seed: Math.round(x * 7 + dy * 13) });
    S(x, z, 0.22, 0.22);
  };
  pot(4.6, 3.55);
  pot(-4.55, 3.7);

  // ---------------------------------------------------------------------------------------------------------------
  // what hangs on the walls (hidden while the wall is cut down)
  // ---------------------------------------------------------------------------------------------------------------
  const poster = (s: Side, t: number, y: number, w: number, h: number, c: string, inner: string) => {
    onWall(s, side[s].decor, t, y, w, h, 0.04, c);
    onWall(s, side[s].decor, t, y + 0.04, w - 0.08, h - 0.08, 0.05, inner);
  };
  poster('N', -4.4, 1.2, 0.5, 0.7, C.blue, '#f6e08a'); // posters beside the door
  poster('N', -1.4, 1.2, 0.6, 0.8, C.red, '#f6f6f2');
  poster('E', 1.7, 1.3, 0.8, 0.9, C.blue, '#f8f4e2');
  poster('E', 3.0, 1.3, 0.8, 0.9, C.orange, '#f6f6f2');
  poster('W', -3.0, 1.35, 0.6, 0.8, C.green, '#f6f6f2');
  poster('S', 0.0, 1.0, 0.5, 0.6, C.blue, '#f6e08a');
  const hang = signPlane(['ほしマート', 'HOSHI MART  24h'], 2.6, 0.5, C.blue, '#ffffff', C.orange);
  hang.position.set(3.0, 2.06, Z0 + 0.08);
  hang.name = 'Counter sign';
  const menu = signPlane(['おでん  一本 100円', 'ODEN  fresh and hot'], 1.4, 0.4, '#f6f0d8', '#7a2d1a', C.red);
  menu.position.set(0.0, 2.05, Z0 + 0.08);
  menu.name = 'Oden menu';

  // ---------------------------------------------------------------------------------------------------------------
  // meshes, lights
  // ---------------------------------------------------------------------------------------------------------------
  const wallMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  const litMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const screenMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const glassMat = new MeshBasicMaterial({ color: '#c6e4ff', transparent: true, opacity: 0.3, side: DoubleSide, depthWrite: false });
  const mesh = (b: GeoBuilder, m: MeshStandardMaterial | MeshBasicMaterial, shadow: boolean, name: string) => {
    const o = new Mesh(b.toGeometry(), m);
    o.name = name; o.castShadow = shadow; o.receiveShadow = true;
    return o;
  };
  group.add(mesh(body, bodyMat, true, 'Shop furniture'), mesh(lit, litMat, false, 'Shop lit'), mesh(screen, screenMat, false, 'Shop screens'));
  const walls = (Object.keys(side) as Side[]).map((k) => {
    const g = new Group();
    g.name = `Wall ${k}`;
    const shell = mesh(side[k].shell, wallMat, true, `Wall ${k} shell`), glass = mesh(side[k].glass, glassMat, false, `Wall ${k} glass`), decor = mesh(side[k].decor, bodyMat, true, `Wall ${k} decor`);
    glass.receiveShadow = false;
    g.add(shell, glass, decor);
    if (k === 'N') g.add(hang, menu);
    group.add(g);
    return { k, g, shell, glass, decor, cut: 0 };
  });

  const cool = new Color('#f4f8ff');
  const lights = [[-2.6, -1.8], [0.4, 0.6], [3.3, -0.8], [-2.8, 2.2], [2.8, 2.6]].map(([x, z]) => {
    const l = new PointLight(cool, 0, 10, 1.3);
    l.position.set(x, 2.5, z);
    group.add(l);
    return l;
  });
  const ambient = new AmbientLight('#f4f4ff', 0.12);
  group.add(ambient);

  const day = new Color('#c6e4ff'), nightGlass = new Color('#0d1a3a');
  const scrDay = new Color('#5f7fb0'), scrNight = new Color('#ffffff');
  const tmp = new Color();

  return {
    group,
    solids,
    shadowHalf: 13,
    // where to press F: the stack of baskets by the door, each shelf (it sells its own things), the register
    spots: [
      { x0: -4.45, z0: -3.5, x1: -4.45, z1: -3.5, r: 1.5, label: 'Basket', kind: 'basket' },
      { x0: -1.6, z0: -0.4, x1: 2.4, z1: -0.4, r: 1.5, label: 'Snacks', kind: 'shelf', shelf: 'snacks' },
      { x0: -1.6, z0: 1.5, x1: 2.4, z1: 1.5, r: 1.4, label: 'Daily goods', kind: 'shelf', shelf: 'daily' },
      { x0: -1.5, z0: 3.3, x1: 3.8, z1: 3.3, r: 1.5, label: 'Drinks', kind: 'shelf', shelf: 'drinks' },
      { x0: 4.6, z0: -1.2, x1: 4.6, z1: 1.6, r: 1.8, label: 'Fresh food', kind: 'shelf', shelf: 'fresh' },
      { x0: -3.8, z0: 3.4, x1: -2.4, z1: 3.4, r: 1.5, label: 'Freezer', kind: 'shelf', shelf: 'frozen' },
      { x0: -4.55, z0: -2.1, x1: -4.55, z1: 0.3, r: 1.5, label: 'Magazines', kind: 'shelf', shelf: 'magazines' },
      { x0: 1.6, z0: -1.5, x1: 4.4, z1: -1.5, r: 1.0, label: 'Pay at the register', kind: 'register' },
    ],
    floor: () => 0,
    surface: () => 'tile',
    update(night) {
      // a shop is lit all the time (it is a konbini): the light only follows the day a little
      for (const l of lights) l.intensity = 1.1 + 2.4 * night;
      ambient.intensity = 0.1 + 0.22 * night;
      litMat.color.setScalar(0.9 + night * 0.4);
      screenMat.color.copy(tmp.copy(scrDay).lerp(scrNight, night));
      glassMat.color.copy(tmp.copy(day).lerp(nightGlass, night));
      glassMat.opacity = 0.3 + 0.4 * night;
    },
    frame(dt, yaw) {
      const toward: Record<Side, number> = { N: -Math.cos(yaw), S: Math.cos(yaw), E: Math.sin(yaw), W: -Math.sin(yaw) };
      for (const w of walls) {
        const want = smoothstep(0.12, 0.55, toward[w.k]);
        w.cut += (want - w.cut) * (dt > 0 ? 1 - Math.exp(-dt * 9) : 1);
        const sy = 1 - 0.62 * w.cut;
        w.shell.scale.y = sy;
        w.glass.scale.y = sy;
        w.decor.visible = w.cut < 0.25;
        if (w.k === 'N') { hang.visible = menu.visible = w.cut < 0.25; }
      }
    },
  };
}
