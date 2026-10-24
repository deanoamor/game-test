import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { Gait } from '../characters/gait';
import { blobTexture, loadCharacter } from '../characters/model';
import { heightAt, inTown, roadNear } from '../world/config';
import type { Signals } from '../world/signals';

/**
 * The people on the pavements of World 1. They are strangers: they do not know the player (no names, no waving, no
 * talking, they do not look at her), they just go about the town. How many there are follows the clock (busy
 * with the morning commute, at lunch and in the evening, hardly anyone late at night). Each walks from one end of the
 * streets to another along the pavements, and where it must cross a street it waits at the kerb for the walk signal and
 * crosses on the zebra only while it is safe. They stop for the player (and the cars stop for them: see Traffic.blockers).
 * They come and go only far from where the camera looks, so nobody pops in or out of sight.
 */

type P = [number, number];
const NW: P = [-5.4, 38.4], NE: P = [5.4, 38.4], SE: P = [5.4, 49.6], SW: P = [-5.4, 49.6];
type CornerId = 'NW' | 'NE' | 'SE' | 'SW';
const CORNER: Record<CornerId, P> = { NW, NE, SE, SW };
/** Where the pavements leave the area (far ends of the streets), and the corner they come to. */
const ARMS: { end: P; corner: CornerId }[] = [
  { end: [-68, 38.4], corner: 'NW' }, { end: [-4.8, 8], corner: 'NW' },
  { end: [-68, 49.6], corner: 'SW' }, { end: [-4.8, 80], corner: 'SW' },
  { end: [68, 38.4], corner: 'NE' }, { end: [4.8, 8], corner: 'NE' },
  { end: [68, 49.6], corner: 'SE' }, { end: [4.8, 80], corner: 'SE' },
];
/** Which corners are joined by a crossing, which signal group lets people cross, and how long the crossing is (m). */
const LINKS: Record<CornerId, { to: CornerId; gate: 'main' | 'cross'; len: number }[]> = {
  NW: [{ to: 'NE', gate: 'main', len: 10.8 }, { to: 'SW', gate: 'cross', len: 11.2 }],
  NE: [{ to: 'NW', gate: 'main', len: 10.8 }, { to: 'SE', gate: 'cross', len: 11.2 }],
  SE: [{ to: 'SW', gate: 'main', len: 10.8 }, { to: 'NE', gate: 'cross', len: 11.2 }],
  SW: [{ to: 'SE', gate: 'main', len: 10.8 }, { to: 'NW', gate: 'cross', len: 11.2 }],
};

/** How many people there are over the day (0..1 of the crowd). */
const DEMAND: [number, number][] = [[0, 0.06], [4.5, 0.06], [6.5, 0.35], [8, 1], [9.5, 0.75], [11.5, 0.5], [12.5, 0.85], [14, 0.5], [16.5, 0.8], [18, 1], [19.5, 0.8], [21, 0.5], [22.5, 0.15], [24, 0.06]];
export function crowdDemand(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DEMAND.length - 2 && DEMAND[i + 1][0] <= h) i++;
  const [h0, d0] = DEMAND[i], [h1, d1] = DEMAND[i + 1];
  return d0 + ((d1 - d0) * (h - h0)) / (h1 - h0);
}

/** What they say to someone who stands in their way: first a question, then a kind word as they ask her to leave the way open. */
const ASK: [string, string][] = [['大丈夫ですか？', 'Are you okay?'], ['どうして立ち止まっているの？', 'Why are you standing still?'], ['何かお困りですか？', 'Do you need any help?'], ['ずっと立っているけど、どうしたの？', 'You have been standing there a while. What is wrong?']];
const KIND: [string, string][] = [['お元気でね。通り道はあけてね。', 'I hope you are well. Please keep the way open, okay?'], ['よい一日を！ ここは通り道だから、気をつけてね。', 'Have a nice day! This is a walkway, so take care.'], ['無理しないでね。ちょっと通るよ。', 'Do not push yourself. I will just pass by.'], ['元気を出してね。道をあけてくれるとうれしいな。', 'Cheer up. It would be nice if you let people by.']];
const FEMALE = ['office', 'street-kobayashi', 'street-tomi', 'street-mio', 'street-rin', 'dress', 'street-aoi', 'street-kiyo', 'street-sora'];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** The models they are made from (see people.ts): [model, scale]. */
const MODELS: [string, number][] = [
  ['suit', 1], ['street-sato', 1.05], ['street-gen', 1], ['office', 1], ['street-kobayashi', 1], ['street-tomi', 1], ['street-mio', 1], ['street-rin', 1],
  ['hoodie', 1], ['street-daichi', 1], ['dress', 1], ['street-aoi', 1], ['chef', 1], ['street-kaito', 0.92], ['street-jake', 1], ['street-kiyo', 1],
  ['street-sora', 0.72], ['street-riku', 0.7],
];

const SPAWN_DIST = 40;
const RADIUS = 0.3;
const smooth = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where a person may walk when not crossing: the pavements (the strips along the main street, and along the cross street
 * north and south of it), never the road and never the shop fronts. The crossing between corners is the one place off it.
 */
export function walkable(x: number, z: number): boolean {
  const ax = Math.abs(x);
  const inMain = (z >= 37.1 && z <= 39.9) || (z >= 48.1 && z <= 50.9);
  if (inMain && ax >= 3.55) return true;
  return ax >= 3.6 && ax <= 5.9 && (z <= 39.9 || z >= 48.1);
}

/** The ground under a point: the road, or the pavement a little higher (as for the player). */
export function walkY(x: number, z: number) {
  let y = heightAt(x, z);
  if (inTown(x, z)) { const rd = roadNear(x, z); if (rd.d >= rd.width / 2) y += 0.17; }
  return y;
}

interface Way { x: number; z: number; gate?: { group: 'main' | 'cross'; len: number }; back?: boolean }

class Walker {
  readonly group = new Group();
  readonly shadow: Mesh;
  readonly pos = new Vector3();
  readonly blocker = { x: 0, y: 0, z: 0, r: RADIUS, quiet: true };
  on = false;
  private gait!: Gait;
  private root!: Group;
  private base = 1;
  private facing = 0;
  private speed = 0;
  private cruise = 1.3;
  private path: Way[] = [];
  private seg = 0;
  private crossing = false;
  private fade = 0;
  private leaving = false;
  waiting = false;
  /** How long the player has stood in its way (s), and how far its patience has gone (0: none, 1: it has spoken, 2: it goes round). */
  private blockedT = 0;
  private patience = 0;
  /** How many times it has gone round her for the point it is going to (it gives the point up after two). */
  private detours = 0;
  /** Called when it speaks up (the Japanese, the English, and where its head is). */
  onShout: ((w: Walker, text: string, en: string) => void) | null = null;
  /** Which voice it speaks with (a higher one for the women and the children). */
  get voice() { return FEMALE.includes(this.model) ? 'nurse' : 'default'; }

  constructor(readonly model: string, scale: number) {
    this.base = scale;
    this.shadow = new Mesh(new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.shadow.renderOrder = 1;
    this.group.visible = this.shadow.visible = false;
  }

  async load() {
    const ch = await loadCharacter(this.model, `Walker ${this.model}`);
    this.root = ch.root;
    this.group.add(ch.root);
    this.gait = new Gait(ch.bones, ch.hipsY, { walk: 1.4, run: 3.9 });
    ch.root.scale.setScalar(this.base);
    this.gait.pose(0);
  }

  /** Start on a path, at `at` metres along it (0: at its start). */
  start(path: Way[], at = 0) {
    this.path = path;
    this.cruise = 1.05 + Math.random() * 0.55;
    this.seg = 1;
    this.crossing = false;
    this.leaving = false;
    this.waiting = false;
    let left = at;
    let p = path[0];
    while (this.seg < path.length) {
      const q = path[this.seg], d = Math.hypot(q.x - p.x, q.z - p.z);
      if (left < d && !q.gate) { p = { x: p.x + ((q.x - p.x) * left) / d, z: p.z + ((q.z - p.z) * left) / d }; break; }
      left = Math.max(0, left - d); p = q; this.seg++;
    }
    if (this.seg >= path.length) { this.seg = path.length - 1; p = path[this.seg]; }
    this.pos.set(p.x, walkY(p.x, p.z), p.z);
    const q = path[this.seg];
    this.facing = Math.atan2(q.x - p.x, q.z - p.z);
    this.on = true;
    this.fade = at > 0 ? 1 : 0;
    this.speed = 0;
    this.group.visible = this.shadow.visible = true;
    this.apply();
  }

  /** Drop out (it has reached the end of its way, or the day no longer wants it). */
  stop() { this.on = false; this.group.visible = this.shadow.visible = false; }
  /** Walk off the way you are on, to the nearest end (the day needs fewer people). */
  dismiss() { this.leaving = true; }
  get isLeaving() { return this.leaving; }

  update(dt: number, signals: Signals | undefined, player: Vector3 | null) {
    if (!this.on) return;
    this.fade = Math.min(1, this.fade + dt * 1.6);
    const w = this.path[this.seg];
    let want = this.cruise;
    this.waiting = false;
    // at the kerb: wait for the walk signal (and the time to cross before the cars go)
    if (w.gate && !this.crossing) {
      const ok = !signals || (signals.light(w.gate.group) === 'green' && signals.safeFor(w.gate.group) > w.gate.len / (this.cruise * 1.25) + 1.5);
      if (ok) this.crossing = true; else { want = 0; this.waiting = true; }
    }
    if (this.crossing) want = this.cruise * 1.25;
    // off the pavement (and not crossing)? back to the nearest bit of it
    if (!this.crossing && !w.gate && !walkable(this.pos.x, this.pos.z) && !this.path[this.seg].back) {
      let best: Way | null = null, bd = 1e9;
      for (let r = 0.3; r <= 3.3 && !best; r += 0.3) for (let k = 0; k < 16; k++) {
        const x = this.pos.x + Math.cos((k / 16) * Math.PI * 2) * r, z = this.pos.z + Math.sin((k / 16) * Math.PI * 2) * r;
        if (walkable(x, z) && r < bd) { bd = r; best = { x, z, back: true } as Way; }
      }
      if (best) this.path.splice(this.seg, 0, best);
    }
    const dx = w.x - this.pos.x, dz = w.z - this.pos.z, d = Math.hypot(dx, dz);
    // a stranger in the way (the player): stop short of her; if she stays, it asks her kindly what is wrong, wishes her well, and goes round her
    let blocked = false;
    if (player && d > 0.01 && Math.abs(player.y - this.pos.y) < 1.5) {
      const px = player.x - this.pos.x, pz = player.z - this.pos.z;
      const along = (px * dx + pz * dz) / d, lat = Math.abs(px * dz - pz * dx) / d;
      if (along > 0 && along < 1.1 && lat < 0.55) {
        blocked = true;
        want = 0;
        this.blockedT += dt;
        // it looks at her while it waits
        this.facing += wrap(Math.atan2(px, pz) - this.facing) * smooth(5, dt);
        if (this.patience === 0 && this.blockedT > 1.3) { this.patience = 1; { const [t, e] = pick(ASK); this.onShout?.(this, t, e); } }
        if (this.patience === 1 && this.blockedT > 3.2) {
          this.patience = 2;
          { const [t, e] = pick(KIND); this.onShout?.(this, t, e); }
          // two points beside her and past her, on the pavement (never out on the road): the side away from her first, the
          // widest that fits; where the pavement is too narrow, a narrower way
          const lean = Math.sign(-(px * dz - pz * dx)) || (Math.random() < 0.5 ? 1 : -1);
          let way: Way[] | null = null;
          for (const lateral of [1.5, 1.2, 0.95, 0.75]) {
            for (const side of [lean, -lean]) {
              const nx = (dz / d) * side, nz = (-dx / d) * side;
              const wp = (k: number): Way => ({ x: player.x + nx * lateral + (dx / d) * k, z: player.z + nz * lateral + (dz / d) * k });
              const a = wp(0.1), b = wp(1.9), m = wp(1.0);
              if ([a, b, m].every((q) => walkable(q.x, q.z)) && walkable((this.pos.x + a.x) / 2, (this.pos.z + a.z) / 2)) { way = [a, b]; break; }
            }
            if (way) break;
          }
          if (++this.detours > 2 && !w.gate && this.seg < this.path.length - 1) this.seg++; // (it keeps coming back to the same spot: it lets that point go)
          else if (way) this.path.splice(this.seg, 0, ...way);
          this.blockedT = 0;
        }
      }
    }
    if (!blocked) { this.blockedT = Math.max(0, this.blockedT - dt * 2); if (this.blockedT === 0) this.patience = 0; }
    if (want > 0 && d > 0.01) this.facing += wrap(Math.atan2(dx, dz) - this.facing) * smooth(8, dt);
    this.speed += (want - this.speed) * smooth(want > this.speed ? 3 : 8, dt);
    const step = Math.min(d, this.speed * dt);
    if (d > 0.01) { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; }
    this.gait.step(dt, dt > 0 ? step / dt : 0, step);
    this.pos.y += (walkY(this.pos.x, this.pos.z) - this.pos.y) * (dt > 0 ? smooth(14, dt) : 1);
    // (she is standing on the point it is going to: near enough, it carries on from here)
    const taken = player && Math.hypot(player.x - w.x, player.z - w.z) < 1.1 && Math.abs(player.y - this.pos.y) < 1.5;
    if (d < (taken ? 1.7 : 0.25)) {
      this.detours = 0;
      if (w.gate) this.crossing = false; // (a point of the way round someone does not end a crossing)
      if (++this.seg >= this.path.length) { this.stop(); return; }
    }
    this.apply();
  }

  private apply() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.root.scale.setScalar(this.base * this.fade);
    this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
    this.shadow.scale.setScalar(this.base * this.fade);
    this.blocker.x = this.pos.x; this.blocker.y = this.pos.y; this.blocker.z = this.pos.z;
  }

  get distTo() { return (x: number, z: number) => Math.hypot(this.pos.x - x, this.pos.z - z); }
}

/** A way from one end of the streets to another, by the corners and the crossings between them. */
function makeWay(from: number, to: number, jitter: P): Way[] {
  const a = ARMS[from], b = ARMS[to];
  const off = (p: P, s = 1): Way => ({ x: p[0] + jitter[0] * s, z: p[1] + jitter[1] * s });
  const corner = (id: CornerId): Way => off(CORNER[id], 0.6);
  const way: Way[] = [{ x: a.end[0] + (a.end[0] === -4.8 || a.end[0] === 4.8 ? jitter[0] : 0), z: a.end[1] + (a.end[1] === 38.4 || a.end[1] === 49.6 ? jitter[1] : 0) }];
  let at: CornerId = a.corner;
  way.push(corner(at));
  // the shortest way round the four corners (at most two crossings)
  const seen = new Set<CornerId>([at]);
  let queue: { id: CornerId; hops: { id: CornerId; gate: 'main' | 'cross'; len: number }[] }[] = [{ id: at, hops: [] }];
  let hops: { id: CornerId; gate: 'main' | 'cross'; len: number }[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === b.corner) { hops = cur.hops; break; }
    for (const l of LINKS[cur.id]) if (!seen.has(l.to)) { seen.add(l.to); queue.push({ id: l.to, hops: [...cur.hops, { id: l.to, gate: l.gate, len: l.len }] }); }
  }
  for (const h of hops) { const c = corner(h.id); way.push({ ...c, gate: { group: h.gate, len: h.len } }); at = h.id; }
  way.push({ x: b.end[0] + (b.end[0] === -4.8 || b.end[0] === 4.8 ? jitter[0] : 0), z: b.end[1] + (b.end[1] === 38.4 || b.end[1] === 49.6 ? jitter[1] : 0) });
  return way;
}

export class Crowd {
  /** Where people may walk (for tests). */
  static walkable = walkable;
  readonly group = new Group();
  readonly walkers: Walker[] = [];
  /** Where the camera looks: people come and go only far from here. */
  focus = { x: 0, z: 44 };
  private demand = 1;
  private spawnT = 0;
  private seen = 0;
  /** Someone speaks up (the Japanese, the English, and where): for the game to show over their head. */
  onShout: ((x: number, y: number, z: number, text: string, en: string, voice: string) => void) | null = null;

  /** The crowd loads its models one by one after the game has started (people appear as they are ready). */
  static start() {
    const c = new Crowd();
    c.group.name = 'Crowd';
    void c.loadAll();
    return c;
  }

  private async loadAll() {
    for (const [m, s] of MODELS) {
      const w = new Walker(m, s);
      await w.load();
      w.onShout = (who, text, en) => this.onShout?.(who.pos.x, who.pos.y + 1.9, who.pos.z, text, en, who.voice);
      this.walkers.push(w);
      this.group.add(w.group, w.shadow);
    }
  }

  /** All the models are loaded. */
  get ready() { return this.walkers.length === MODELS.length; }

  /** The time of day: the busier the hour, the more people. */
  setHour(hour: number) { this.demand = crowdDemand(hour); }
  /** How many people are on the streets now (for tests). */
  get active() { return this.walkers.filter((w) => w.on).length; }
  /** The people as circles, for the cars to stop short of (and the player to bump into). */
  get blockers() { return this.walkers.filter((w) => w.on).map((w) => w.blocker); }

  private spawn(w: Walker, anywhere: boolean) {
    for (let tries = 0; tries < 12; tries++) {
      const from = Math.floor(Math.random() * ARMS.length);
      let to = Math.floor(Math.random() * ARMS.length);
      if (to === from) to = (to + 3) % ARMS.length;
      const jitter: P = [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5];
      const way = makeWay(from, to, jitter);
      if (anywhere) {
        // somewhere along the way (the day has begun with people already out)
        let len = 0;
        for (let i = 1; i < way.length; i++) len += Math.hypot(way[i].x - way[i - 1].x, way[i].z - way[i - 1].z);
        w.start(way, Math.random() * len * 0.9);
        return true;
      }
      const e = ARMS[from].end;
      if (Math.hypot(e[0] - this.focus.x, e[1] - this.focus.z) < SPAWN_DIST) continue;
      w.start(way, 0);
      return true;
    }
    return false;
  }

  update(dt: number, signals: Signals | undefined, player: Vector3 | null) {
    const target = Math.round(this.demand * MODELS.length);
    // the people that have just been loaded: the day has begun, so they are already out along the pavements
    for (; this.seen < this.walkers.length; this.seen++) if (this.active < target) this.spawn(this.walkers[this.seen], true);
    const act = this.active;
    this.spawnT -= dt;
    if (act < target && this.spawnT <= 0) {
      const free = this.walkers.filter((w) => !w.on);
      if (free.length && this.spawn(free[Math.floor(Math.random() * free.length)], false)) this.spawnT = 0.8 + Math.random() * 1.5; else this.spawnT = 1;
    } else if (act > target + 1) {
      // too many for the hour: one that is far from the camera goes home
      const far = this.walkers.filter((w) => w.on && !w.isLeaving && !w.waiting && w.distTo(this.focus.x, this.focus.z) > SPAWN_DIST + 4);
      if (far.length) far[0].stop();
    }
    for (const w of this.walkers) w.update(dt, signals, player);
  }
}
