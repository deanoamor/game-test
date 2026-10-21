import {
  BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SkinnedMesh, Vector3,
  type Bone, type BufferAttribute, type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
 * The rig: every bone starts unrotated and lined up with the world, the model faces +z (her left is +x). So a
 * negative turn about x swings a leg or an arm forward, a positive one bends a knee back. The poses below are written
 * as "forward is positive" and turned round in set().
 */

const WALK = 1.55, RUN = 4.3; // m/s
const RADIUS = 0.28;
const PAVEMENT = 0.17;
const STEP = 0.32; // the highest step she takes in one go (a curb is 0.17)
const GRID = 4;

type BoneName = 'Hips' | 'Spine' | 'Chest' | 'Neck' | 'Head' | 'Shoulder Left' | 'Elbow Left' | 'Wrist Left' | 'Shoulder Right' | 'Elbow Right' | 'Wrist Right' | 'Hip Left' | 'Knee Left' | 'Ankle Left' | 'Hip Right' | 'Knee Right' | 'Ankle Right';
const BONES: BoneName[] = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Shoulder Left', 'Elbow Left', 'Wrist Left', 'Shoulder Right', 'Elbow Right', 'Wrist Right', 'Hip Left', 'Knee Left', 'Ankle Left', 'Hip Right', 'Knee Right', 'Ankle Right'];

/** A single-file build carries the model inside the page (window.__GLB, base64) instead of fetching it. */
async function loadModel(): Promise<Group> {
  const loader = new GLTFLoader();
  const inline = (window as unknown as { __GLB?: Record<string, string> }).__GLB?.seifuku;
  if (inline) {
    const bin = atob(inline), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return (await loader.parseAsync(bytes.buffer, '')).scene;
  }
  return (await loader.loadAsync(`${import.meta.env.BASE_URL}characters/seifuku.glb`)).scene;
}

const ARM = /^(Shoulder|Elbow|Wrist|Fingers) /;
const SHIN = /^(Knee|Ankle|Toe) /;
const THIGH = /^Hip (Left|Right)$/;

/**
 * The model was skinned by distance, so a piece of clothing that hangs near a hand or a knee (the skirt by the hands)
 * picked up some of that bone and was dragged along when the arm swung. Each separate piece (a connected shell of
 * triangles) is checked: a piece that mostly follows the body lets go of the arm bones and the shins altogether, and
 * a piece that hangs from the hips without reaching the shins (the skirt) lets go of the thighs too, so the skirt, the
 * blouse and the collar move with the hips and the chest only; the sleeves, hands and legs keep their bones. Some
 * skirt pleats were bound to an elbow outright, so below the waist nothing but skin (the hands) may follow an arm.
 */
function untangle(g: BufferGeometry, names: string[], color: Color) {
  const pos = g.getAttribute('position') as BufferAttribute, si = g.getAttribute('skinIndex') as BufferAttribute, sw = g.getAttribute('skinWeight') as BufferAttribute;
  if (!si || !sw) return;
  const n = pos.count;
  // weld the corners by position, then join each triangle's corners: the shells fall out as the joined sets
  const id = new Int32Array(n), keys = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let v = keys.get(k);
    if (v === undefined) keys.set(k, (v = keys.size));
    id[i] = v;
  }
  const up = Int32Array.from({ length: keys.size }, (_, i) => i);
  const find = (a: number): number => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
  for (let t = 0; t + 2 < n; t += 3) for (const o of [1, 2]) { const a = find(id[t]), b = find(id[t + o]); if (a !== b) up[a] = b; }
  const WAIST = 0.72; // metres, in the model's rest pose
  const skin = color.r > 0.45 && color.r > color.b * 1.3;
  const ysum = new Map<number, number>(), cnt = new Map<number, number>();
  const arm = new Map<number, number>(), shin = new Map<number, number>(), hip = new Map<number, number>(), all = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (let i = 0; i < n; i++) {
    const c = find(id[i]);
    add(ysum, c, pos.getY(i));
    add(cnt, c, 1);
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j), name = names[si.getComponent(i, j)] ?? '';
      add(all, c, w);
      if (ARM.test(name)) add(arm, c, w);
      if (SHIN.test(name)) add(shin, c, w);
      if (name === 'Hips') add(hip, c, w);
    }
  }
  const hips = names.indexOf('Hips');
  for (let i = 0; i < n; i++) {
    const c = find(id[i]), total = all.get(c) || 1;
    const shinShare = (shin.get(c) ?? 0) / total;
    const low = (ysum.get(c) ?? 0) / (cnt.get(c) || 1) < WAIST;
    const dropArm = (arm.get(c) ?? 0) / total < 0.5 || (low && !skin), dropShin = shinShare < 0.5;
    const dropThigh = shinShare < 0.15 && (hip.get(c) ?? 0) / total > 0.15;
    let left = 0;
    const w = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      const name = names[si.getComponent(i, j)] ?? '';
      w[j] = (dropArm && ARM.test(name)) || (dropShin && SHIN.test(name)) || (dropThigh && THIGH.test(name)) ? 0 : sw.getComponent(i, j);
      left += w[j];
    }
    if (left < 1e-5) { si.setXYZW(i, Math.max(0, hips), 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); continue; }
    sw.setXYZW(i, w[0] / left, w[1] / left, w[2] / left, w[3] / left);
  }
  si.needsUpdate = sw.needsUpdate = true;
}

/** The model has one skinned part per colour (44 of them): merge them into one, the colours baked into the vertices. */
function mergeSkinned(root: Group): SkinnedMesh {
  const parts: SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) parts.push(o as SkinnedMesh); });
  const geos: BufferGeometry[] = parts.map((m) => {
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    const mat = m.material as Material & { color?: Color };
    const c = mat.color ?? new Color(1, 1, 1);
    const n = g.getAttribute('position').count;
    const col = g.getAttribute('color') as BufferAttribute | undefined;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = col ? col.getX(i) : 1, gg = col ? col.getY(i) : 1, b = col ? col.getZ(i) : 1;
      out[i * 3] = r * c.r; out[i * 3 + 1] = gg * c.g; out[i * 3 + 2] = b * c.b;
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
    untangle(g, m.skeleton.bones.map((b) => b.name.replace(/_/g, ' ')), c);
    g.setAttribute('color', new Float32BufferAttribute(out, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  const mesh = new SkinnedMesh(merged, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02 }));
  mesh.name = 'Player';
  const first = parts[0];
  mesh.bind(first.skeleton, first.bindMatrix);
  first.parent!.add(mesh);
  for (const p of parts) p.removeFromParent();
  return mesh;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

const smooth = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Player {
  group = new Group();
  readonly pos = new Vector3();
  private vel = new Vector3();
  private facing = 0; // the model's turn about y (0: facing +z, 90°: facing +x)
  private phase = 0;
  private t = 0;
  private bones = new Map<BoneName, Bone>();
  private hipsY = 0;
  private keys = new Set<string>();
  private walkW = 0;
  private runW = 0;
  private shadow: Mesh;
  private grid = new Map<number, Solid[]>();

  private constructor(root: Group, obstacles: Obstacles, private bounds: Rect | null) {
    mergeSkinned(root);
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
    root.traverse((o) => {
      // (the loader writes the names with underscores for spaces)
      const name = o.name.replace(/_/g, ' ') as BoneName;
      if ((o as Bone).isBone && BONES.includes(name)) this.bones.set(name, o as Bone);
      if ((o as Mesh).isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; }
    });
    if (this.bones.size !== BONES.length) console.warn('player: missing bones', BONES.filter((b) => !this.bones.has(b)));
    this.hipsY = this.bones.get('Hips')!.position.y;
    this.group.name = 'Player';
    this.group.add(root);
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

  static async create(obstacles: Obstacles, bounds: Rect | null, at: { x: number; z: number; yaw: number }) {
    const p = new Player(await loadModel(), obstacles, bounds);
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

  /** The blob shadow, to be added to the scene beside the player. */
  get shadowMesh() { return this.shadow; }

  /** The ground under a point: the road, or the raised pavement beside it. */
  private groundY(x: number, z: number) {
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
    this.t += dt;
    const k = this.keys;
    let ix = 0, iz = 0;
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
    this.walkW += (Math.min(1, speed / WALK) - this.walkW) * smooth(10, dt);
    this.runW += (Math.min(1, Math.max(0, (speed - WALK) / (RUN - WALK))) - this.runW) * smooth(6, dt);
    const stride = 1.15 + this.runW * 1.15; // metres per full cycle (two steps)
    this.phase = (this.phase + (moved / stride) * Math.PI * 2) % (Math.PI * 2);
    this.pose();

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
  }

  private pose() {
    const w = this.walkW, r = this.runW, idle = 1 - w;
    const φ = this.phase, t = this.t;
    // forward is positive in the poses below; on this rig forward is a negative turn about x
    const set = (name: BoneName, x: number, y = 0, z = 0) => this.bones.get(name)?.rotation.set(-x, y, z);
    const mix = (a: number, b: number) => a + (b - a) * r; // walk -> run
    const amp = { hip: mix(0.42, 0.85), knee0: mix(0.12, 0.35), knee1: mix(0.62, 1.35), arm: mix(0.32, 0.85), elbow: mix(0.18, 1.25), bob: mix(0.025, 0.06), lean: mix(-0.04, -0.2), twist: mix(0.08, 0.14) };
    for (const [side, off] of [['Left', 0], ['Right', Math.PI]] as const) {
      const a = φ + off;
      const swing = Math.sin(a);
      // the knee bends while the leg swings forward, the ankle keeps the foot flat on the ground
      const knee = amp.knee0 + amp.knee1 * Math.max(0, Math.cos(a)) * (0.6 + 0.4 * Math.max(0, swing));
      set(`Hip ${side}`, w * amp.hip * swing, 0, 0);
      set(`Knee ${side}`, -w * knee, 0, 0);
      set(`Ankle ${side}`, w * (0.35 * knee - 0.3 * amp.hip * swing), 0, 0);
      // the arms swing against the legs, the elbows bend more when running; at rest they hang with a slight sway
      const arm = -swing * amp.arm * w + idle * 0.03 * Math.sin(t * 1.3 + off);
      // a little away from the body (her left is +x: a positive turn about z lifts the left arm out)
      const out = (side === 'Left' ? 1 : -1) * (0.06 + idle * 0.02 + r * 0.05);
      set(`Shoulder ${side}`, arm, 0, out);
      set(`Elbow ${side}`, 0.08 + w * amp.elbow * (0.6 + 0.4 * Math.max(0, -swing)), 0, 0);
      set(`Wrist ${side}`, 0, 0, 0);
    }
    // the body: a bob twice per cycle, a twist of the hips against the shoulders, a lean into the run, breathing at rest
    const hips = this.bones.get('Hips')!;
    hips.position.y = this.hipsY - w * amp.bob * (0.5 + 0.5 * Math.cos(φ * 2)) + idle * 0.004 * Math.sin(t * 1.8);
    hips.rotation.set(0, w * amp.twist * Math.sin(φ), 0);
    set('Spine', w * amp.lean * 0.5 + idle * 0.015 * Math.sin(t * 1.8), -w * amp.twist * 0.7 * Math.sin(φ), 0);
    set('Chest', w * amp.lean * 0.5, -w * amp.twist * 0.4 * Math.sin(φ), 0);
    set('Neck', -w * amp.lean * 0.4, 0, 0);
    set('Head', -w * amp.lean * 0.3 + idle * 0.03 * Math.sin(t * 0.7), idle * 0.12 * Math.sin(t * 0.35), 0);
  }
}
