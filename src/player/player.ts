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

const WALK = 1.4, RUN = 3.9; // m/s (for a girl 1.43 m tall: a brisk walk and a quick run)
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

/** A soft bump of height 1 centred on `c`, `s` wide (angles in radians, the difference wrapped round the circle). */
const bump = (x: number, c: number, s: number) => {
  const d = Math.atan2(Math.sin(x - c), Math.cos(x - c)) / s;
  return Math.exp(-d * d);
};
/** The height of the heel and of the toes above the ankle's height-line, for a foot tilted `tilt` (toes up positive). */
const heelY = (tilt: number) => -0.05 * Math.sin(tilt) - 0.13 * Math.cos(tilt);
const toeY = (tilt: number) => 0.12 * Math.sin(tilt) - 0.1 * Math.cos(tilt);

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
  private hipLift = 0;

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
    const stride = 1.1 + this.runW * 0.8; // metres per full cycle (two steps)
    this.phase = (this.phase + (moved / stride) * Math.PI * 2) % (Math.PI * 2);
    this.pose(dt);

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
  }

  private pose(dt = 0) {
    const w = this.walkW, r = this.runW, idle = 1 - w;
    const φ = this.phase, t = this.t;
    const bone = (n: BoneName) => this.bones.get(n);
    // the poses are written for the limbs as "forward is positive" (a hip that swings the thigh forward, a shoulder
    // that swings the arm forward, a knee that bends back); on this rig that is a negative turn about x
    const fwd = (name: BoneName, x: number, y = 0, z = 0) => bone(name)?.rotation.set(-x, y, z);
    const mix = (a: number, b: number) => a + (b - a) * r; // walk -> run

    const angles: Record<'Left' | 'Right', { hip: number; knee: number; foot: number }> = { Left: { hip: 0, knee: 0, foot: 0 }, Right: { hip: 0, knee: 0, foot: 0 } };
    for (const [side, off] of [['Left', 0], ['Right', Math.PI]] as const) {
      const a = φ + off;
      const aw = Math.atan2(Math.sin(a), Math.cos(a)); // -π..π: 0 is the thigh passing the other leg moving forward, ±π/2 the extremes
      // the thigh: forward at heel strike (aw = π/2), back at toe-off (aw = -π/2)
      const hip = mix(0.05 + 0.48 * Math.sin(a), 0.2 + 0.8 * Math.sin(a));
      // the knee: a small bend as the weight comes on, straight at mid stance, and a big bend to carry the foot through
      const knee = mix(0.12, 0.5) * bump(aw, 2.0, 0.5) + mix(0.9, 1.55) * bump(aw, mix(-0.5, -0.4), mix(0.8, 0.9));
      // the foot's own tilt in the world (toes up is positive): toes up at heel strike, flat in stance, rolling onto the
      // toes at push-off, hanging toes-down while it swings through
      const foot = mix(0.22, -0.1) * bump(aw, 1.45, 0.5) - mix(0.45, 0.55) * bump(aw, -1.7, 0.6) - mix(0.15, 0.45) * bump(aw, -0.3, 0.8);
      angles[side] = { hip: w * hip, knee: w * knee, foot: w * foot };
      // the joints that turn: the ankle makes up the difference so the foot has the tilt above whatever the leg does
      fwd(`Hip ${side}`, w * hip);
      fwd(`Knee ${side}`, -w * knee);
      fwd(`Ankle ${side}`, w * foot - w * hip + w * knee);
      // the arms swing against the legs, the elbows bent, more the faster she goes; at rest they hang with a slight sway
      const swing = Math.sin(a);
      const arm = -swing * w * mix(0.5, 0.95) + w * mix(0.0, 0.2) + idle * 0.03 * Math.sin(t * 1.3 + off);
      const out = (side === 'Left' ? 1 : -1) * (0.07 + idle * 0.02 - r * 0.02);
      fwd(`Shoulder ${side}`, arm, 0, out);
      const forwardArm = Math.max(0, -swing);
      fwd(`Elbow ${side}`, 0.1 + w * (mix(0.25, 1.5) + mix(0.25, 0.25) * forwardArm), 0, 0);
      fwd(`Wrist ${side}`, w * 0.05, 0, 0);
    }

    // the hips rise and fall so that the lower foot is always on the ground: the leg's reach follows from its angles
    // (thigh and shin 0.20 and 0.23 m, the foot 0.13 m below the ankle), the height of the pelvis from the longer reach
    let lowest = Infinity;
    for (const side of ['Left', 'Right'] as const) {
      const { hip, knee, foot } = angles[side];
      const th = hip, sh = hip - knee;
      const reach = 0.2 * Math.cos(th) + 0.23 * Math.cos(sh);
      // the sole's lowest point (heel 0.05 behind and 0.13 under the ankle, toes 0.12 ahead and 0.10 under)
      const lowY = Math.min(heelY(foot), toeY(foot));
      lowest = Math.min(lowest, -reach + lowY);
    }
    const rest = -(0.2 + 0.23) - 0.13;
    const hips = bone('Hips')!;
    // (in the run a little spring on top: higher while the legs are spread, in the air)
    // (the height follows whichever foot is lower, which hands over from one leg to the other: eased so it does not jolt)
    const target = w * (rest - lowest) + w * r * 0.035 * (0.5 - 0.5 * Math.cos(2 * φ));
    this.hipLift += (target - this.hipLift) * (dt > 0 ? smooth(40, dt) : 1);
    hips.position.y = this.hipsY + this.hipLift + idle * 0.004 * Math.sin(t * 1.8);

    // the body: the pelvis turns with the leg that is forward, the shoulders against it, a lean into the run, breathing at rest
    const twist = mix(0.1, 0.22) * w, lean = mix(0.05, 0.27) * w;
    hips.rotation.set(0, -twist * Math.sin(φ), 0);
    fwd('Spine', -lean * 0.4, 0.9 * twist * Math.sin(φ), 0);
    fwd('Chest', -lean * 0.4, 0.8 * twist * Math.sin(φ), 0);
    fwd('Neck', lean * 0.1, 0, 0);
    // the head stays up, looking ahead, and turns idly at rest
    fwd('Head', lean * 0.55 + idle * 0.03 * Math.sin(t * 0.7), idle * 0.12 * Math.sin(t * 0.35), 0);
    bone('Spine')!.rotation.x += idle * 0.015 * Math.sin(t * 1.8);
  }
}
