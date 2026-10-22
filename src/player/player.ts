import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { Gait } from '../characters/gait';
import { blobTexture, loadCharacter, type Character } from '../characters/model';
import { heightAt, inTown, roadNear } from '../world/config';
import type { Obstacles } from '../world/village';
import type { Solid } from '../world/village/frame';
import type { Rect } from '../worlds/types';

/**
 * The player: the schoolgirl in seifuku (assets/core/characters/seifuku.glb). The model comes rigged but without
 * animations, so she is animated here, bone by bone: an idle sway, a walk and a run, blended by how fast she goes, with
 * the stride timed to the ground she covers so her feet do not slide. W A S D (or the arrows) move her relative to
 * the camera, Shift runs. She turns smoothly toward where she goes, steps up onto the pavements, and cannot walk
 * through buildings, poles and street furniture or past the world's invisible barrier.
 *
 * The model and the gait (the walk, the run, the idle) are shared with the NPCs: see src/characters/.
 */

const WALK = 1.4, RUN = 3.9; // m/s (for a girl 1.43 m tall: a brisk walk and a quick run)
const RADIUS = 0.28;
const PAVEMENT = 0.17;
const STEP = 0.32; // the highest step she takes in one go (a curb is 0.17)
const GRID = 4;

const smooth = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Player {
  group = new Group();
  readonly pos = new Vector3();
  private vel = new Vector3();
  private facing = 0; // the model's turn about y (0: facing +z, 90°: facing +x)
  readonly gait: Gait;
  /** While she is in a conversation she stands still (the keys do nothing). */
  frozen = false;
  /** Characters she cannot walk through (circles that move: the NPCs). */
  blockers: { x: number; z: number; r: number }[] = [];
  private keys = new Set<string>();
  private shadow: Mesh;
  private grid = new Map<number, Solid[]>();
  private floorFn: ((x: number, z: number) => number) | null = null;

  private constructor(ch: Character, obstacles: Obstacles, private bounds: Rect | null) {
    // the solids by 4 m cells, each in every cell its footprint touches
    for (const s of obstacles.solids) {
      const r = s.t === 'box' ? Math.hypot(s.hw, s.hd) : s.len + s.land;
      const cx = s.t === 'box' ? s.x : s.x + s.dx * (s.len + s.land) / 2, cz = s.t === 'box' ? s.z : s.z + s.dz * (s.len + s.land) / 2;
      const rr = s.t === 'box' ? r : r / 2 + s.hw;
      for (let j = Math.floor((cz - rr) / GRID); j <= Math.floor((cz + rr) / GRID); j++) for (let i = Math.floor((cx - rr) / GRID); i <= Math.floor((cx + rr) / GRID); i++) {
        const k = i * 10007 + j;
        let c = this.grid.get(k);
        if (!c) this.grid.set(k, (c = []));
        c.push(s);
      }
    }
    this.gait = new Gait(ch.bones, ch.hipsY, { walk: WALK, run: RUN });
    this.group.name = 'Player';
    this.group.add(ch.root);
    // a soft shadow under her (the sun's shadow map is cached, so moving things carry their own)
    this.shadow = new Mesh(new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.shadow.renderOrder = 1;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** `floor`: the height of the floor under a point, in a world with no town (the rooms of a house). */
  static async create(obstacles: Obstacles, bounds: Rect | null, at: { x: number; z: number; yaw: number }, floor?: (x: number, z: number) => number) {
    const p = new Player(await loadCharacter('seifuku', 'Player'), obstacles, bounds);
    p.floorFn = floor ?? null;
    p.pos.set(at.x, p.groundY(at.x, at.z), at.z);
    p.facing = (at.yaw * Math.PI) / 180;
    p.update(0, 0);
    return p;
  }

  /** Put her somewhere else at once (a place picked from the list or the map), clear of walls. */
  teleport(x: number, z: number) {
    const p = new Vector3(x, 0, z);
    for (let i = 0; i < 4; i++) this.collide(p);
    this.pos.set(p.x, this.groundY(p.x, p.z), p.z);
    this.vel.set(0, 0, 0);
  }

  /** What she walks on now (for the sound of her steps). */
  get surface(): 'road' | 'pavement' | 'stairs' | 'grass' | 'floor' {
    if (this.floorFn) return 'floor';
    const { x, z } = this.pos;
    for (const w of this.near(x, z)) {
      if (w.t !== 'walk') continue;
      const rx = x - w.x, rz = z - w.z;
      const along = rx * w.dx + rz * w.dz, across = Math.abs(rx * w.dz - rz * w.dx);
      if (across <= w.hw && along >= 0 && along <= w.len && this.pos.y > heightAt(x, z) + 0.4) return 'stairs';
    }
    if (!inTown(x, z)) return 'grass';
    const rd = roadNear(x, z);
    return rd.d >= rd.width / 2 ? 'pavement' : 'road';
  }

  /** The blob shadow, to be added to the scene beside the player. */
  get shadowMesh() { return this.shadow; }

  /** The ground under a point: the road, or the raised pavement beside it. */
  private groundY(x: number, z: number) {
    if (this.floorFn) return this.floorFn(x, z);
    let y = heightAt(x, z);
    if (inTown(x, z)) {
      const rd = roadNear(x, z);
      if (rd.d >= rd.width / 2) y += PAVEMENT;
    }
    // on a flight of stairs or its landing
    for (const w of this.near(x, z)) {
      if (w.t !== 'walk') continue;
      const rx = x - w.x, rz = z - w.z;
      const along = rx * w.dx + rz * w.dz, across = Math.abs(rx * w.dz - rz * w.dx);
      if (across > w.hw || along < 0 || along > w.len + w.land) continue;
      y = Math.max(y, w.y0 + (w.y1 - w.y0) * Math.min(1, along / w.len));
    }
    return y;
  }

  /** The solids in the grid cells around a point. */
  private near(x: number, z: number): Solid[] {
    const out: Solid[] = [];
    const i0 = Math.floor(x / GRID), j0 = Math.floor(z / GRID);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const c = this.grid.get(i * 10007 + j);
      if (c) for (const s of c) if (!out.includes(s)) out.push(s);
    }
    return out;
  }

  /** Push a point out of the boxes (walls, poles, fences, parked cars), and back inside the barrier. */
  private collide(p: Vector3) {
    for (const s of this.near(p.x, p.z)) {
      if (s.t !== 'box') continue;
      const a = (s.a * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      const dx = p.x - s.x, dz = p.z - s.z;
      // into the box's own frame (the inverse of u, v -> x + u cos + v sin, z - u sin + v cos)
      let u = dx * cs - dz * sn, v = dx * sn + dz * cs;
      const ou = s.hw + RADIUS - Math.abs(u), ov = s.hd + RADIUS - Math.abs(v);
      if (ou <= 0 || ov <= 0) continue;
      if (ou < ov) u += Math.sign(u || 1) * ou;
      else v += Math.sign(v || 1) * ov;
      p.x = s.x + u * cs + v * sn;
      p.z = s.z - u * sn + v * cs;
    }
    for (const c of this.blockers) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + RADIUS;
      if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
    }
    if (this.bounds) {
      const b = this.bounds;
      p.x = Math.min(b.x1, Math.max(b.x0, p.x));
      p.z = Math.min(b.z1, Math.max(b.z0, p.z));
    }
  }

  /** Whether she can go from the ground at `from` to a point: no step up or down higher than a curb. */
  private canStep(from: number, x: number, z: number) {
    return Math.abs(this.groundY(x, z) - from) <= STEP;
  }

  /** Move by the keys (relative to the camera's turn `camYaw`), then pose the bones for this moment. */
  update(dt: number, camYaw: number) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (this.frozen) k.clear();
    if (k.has('KeyW') || k.has('ArrowUp')) iz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) iz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
    const running = k.has('ShiftLeft') || k.has('ShiftRight');
    const want = new Vector3();
    if (ix || iz) {
      const l = Math.hypot(ix, iz), cs = Math.cos(camYaw), sn = Math.sin(camYaw);
      want.set((ix * cs + iz * sn) / l, 0, (-ix * sn + iz * cs) / l).multiplyScalar(running ? RUN : WALK);
    }
    // speed up and slow down smoothly (quicker to stop than to start)
    this.vel.lerp(want, smooth(want.lengthSq() > this.vel.lengthSq() ? 5 : 8, dt));
    // move, sliding along what stops her: the whole step, or else along x or z alone
    const here = this.groundY(this.pos.x, this.pos.z);
    const step = this.vel.clone().multiplyScalar(dt);
    let next = this.pos.clone();
    for (const [sx, sz] of [[1, 1], [1, 0], [0, 1]]) {
      const t = this.pos.clone().add(new Vector3(step.x * sx, 0, step.z * sz));
      this.collide(t);
      if (this.canStep(here, t.x, t.z)) { next = t; break; }
    }
    const moved = Math.hypot(next.x - this.pos.x, next.z - this.pos.z);
    const speed = dt > 0 ? moved / dt : 0;
    this.pos.x = next.x;
    this.pos.z = next.z;
    // step up and down the curbs and slopes smoothly
    const gy = this.groundY(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * (dt > 0 ? smooth(14, dt) : 1);
    // turn toward the way she is going
    if (want.lengthSq() > 0.01) {
      const aim = Math.atan2(want.x, want.z);
      this.facing += wrap(aim - this.facing) * smooth(running ? 12 : 9, dt);
    }

    // the gait: weights for walking and running from the speed, the stride timed to the ground covered
    this.gait.step(dt, speed, moved);

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
  }
}
