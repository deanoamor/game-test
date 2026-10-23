import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Points, PointsMaterial, Quaternion, Vector3 } from 'three';
import { pick, rng } from '../util/rng';
import { EXPRESSWAY, getRoad } from './config';
import type { SignalGroup, Signals } from './signals';
import { LAMPS, buildVehicle, vehicleLamps, type VehicleKind } from './vehicles';

/**
 * Cars, mini trucks and vans in the town (along the main street and the cross street, keeping left as in Japan), and
 * cars, lorries and coaches on the expressway. Every lane is a loop. A car follows the one ahead and never closes in
 * on it: when the car in front slows or stops, the one behind does too. At the crossing a car stops at the stop line
 * on red (and on yellow, if it still can), and waits while a car of the other street is still in the junction.
 */

interface Path { x: number[]; z: number[]; y: number[]; d: number[]; L: number }
interface Lane {
  path: Path;
  /** To the left of the direction of travel. */
  offset: number;
  yOff: number;
  /** How quickly a car closes up on the one ahead (1/s), its acceleration (m/s²). */
  follow: number;
  accel: number;
  /** At the crossing: the street's signal, the stop line and the stretch inside the junction (along the lane). */
  group?: SignalGroup;
  stop?: number;
  box?: [number, number];
}
interface Car { lane: Lane; s: number; v: number; cruise: number; kind: VehicleKind; index: number; len: number; wid: number; vNext: number; brake: number; blockT: number; honkT: number; honks: number; on: boolean; rank: number }

/** The crossing: the stop lines frame it, the junction is where the two streets overlap. */
const STOP_RECT = { x0: -7.2, x1: 7.2, z0: 36.3, z1: 51.7 };
const JUNCTION = { x0: -3.7, x1: 3.7, z0: 39.8, z1: 48.2 };
/**
 * How busy the roads are over the day (0..1): the morning rush from 6 to 10, lighter at noon, busy again from the
 * afternoon into the evening, and quiet from 10 at night until dawn.
 */
const DEMAND: [number, number][] = [[0, 0.1], [4.5, 0.1], [6, 0.55], [7.5, 1], [10, 0.9], [11.5, 0.5], [13.5, 0.38], [15, 0.65], [17, 1], [19.5, 0.95], [21, 0.65], [22, 0.25], [24, 0.1]];
export function trafficDemand(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DEMAND.length - 2 && DEMAND[i + 1][0] <= h) i++;
  const [h0, d0] = DEMAND[i], [h1, d1] = DEMAND[i + 1];
  return d0 + ((d1 - d0) * (h - h0)) / (h1 - h0);
}
/** Cars appear and disappear only this far from where the camera looks, so nobody pops in or out of sight. */
const SPAWN_DIST = 58;
const GAP = 2.0; // metres kept to the car ahead when stopped

function makePath(xs: number[], zs: number[], ys: number[], reverse: boolean): Path {
  const x = reverse ? [...xs].reverse() : [...xs], z = reverse ? [...zs].reverse() : [...zs], y = reverse ? [...ys].reverse() : [...ys];
  const d = [0];
  for (let i = 1; i < x.length; i++) d.push(d[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]));
  return { x, z, y, d, L: d[d.length - 1] };
}

const tmpP = { x: 0, y: 0, z: 0, tx: 1, tz: 0, slope: 0 };
/** The point of a lane `s` metres along it, with its direction and slope. */
function pointAt(l: Lane, s: number) {
  const P = l.path;
  s = ((s % P.L) + P.L) % P.L;
  let lo = 0, hi = P.d.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.d[m] <= s) lo = m; else hi = m; }
  const seg = P.d[hi] - P.d[lo] || 1, f = (s - P.d[lo]) / seg;
  const tx = (P.x[hi] - P.x[lo]) / seg, tz = (P.z[hi] - P.z[lo]) / seg;
  // left of the direction of travel: (tz, -tx)
  tmpP.x = P.x[lo] + (P.x[hi] - P.x[lo]) * f + tz * l.offset;
  tmpP.z = P.z[lo] + (P.z[hi] - P.z[lo]) * f - tx * l.offset;
  tmpP.y = P.y[lo] + (P.y[hi] - P.y[lo]) * f + l.yOff;
  tmpP.tx = tx; tmpP.tz = tz;
  tmpP.slope = (P.y[hi] - P.y[lo]) / seg;
  return tmpP;
}

const inside = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** Where a lane crosses the crossing: its stop line, and its stretch inside the junction. */
function markCrossing(l: Lane, group: SignalGroup) {
  let stop = -1, b0 = -1, b1 = -1;
  for (let s = 0; s < l.path.L; s += 0.2) {
    const p = pointAt(l, s);
    if (stop < 0 && inside(STOP_RECT, p.x, p.z)) stop = s;
    if (inside(JUNCTION, p.x, p.z)) { if (b0 < 0) b0 = s; b1 = s; }
  }
  if (stop >= 0 && b0 >= 0) { l.group = group; l.stop = stop; l.box = [b0, b1]; }
}

export class Traffic {
  group = new Group();
  private meshes = new Map<VehicleKind, InstancedMesh>();
  // the lamps: head lamps and tail lamps of each kind (same instances as the bodies), and the beams on the road
  private heads = new Map<VehicleKind, InstancedMesh>();
  private tails = new Map<VehicleKind, InstancedMesh>();
  private headMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private tailMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private beams: InstancedMesh | null = null;
  private beamMat: MeshBasicMaterial | null = null;
  private glows: InstancedMesh | null = null;
  private glowMat: MeshBasicMaterial | null = null;
  private haloGeo: BufferGeometry | null = null;
  private haloMat: PointsMaterial | null = null;
  private lampV = new Vector3();
  private tc = new Color();
  private cars: Car[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private qp = new Quaternion();
  private up = new Vector3(0, 1, 0);
  private side = new Vector3(0, 0, 1);
  private v3 = new Vector3();
  private one = new Vector3(1, 1, 1);
  private size = new Vector3();
  // moving cars do not cast into the (cached) shadow map: each gets a soft dark patch under it instead
  private shadows!: InstancedMesh;
  private sm = new Matrix4();
  private sq = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  private static SIZE: Partial<Record<VehicleKind, [number, number]>> = { car: [4.6, 2.1], kei: [3.8, 1.9], van: [5.0, 2.2], truck: [7.2, 2.7], bus: [10.5, 2.9] };

  /** People standing on the road (the player, the NPCs): a car stops short of one in its way. */
  blockers: { x: number; y: number; z: number; r: number }[] = [];
  /** Where the camera looks: cars only come and go far from here. */
  focus = { x: 0, z: 44 };
  private demand = 1;
  /** The time of day: the busier the hour, the more cars are on the road. `instant`: settle the whole road at once. */
  setHour(hour: number, instant = false) {
    this.demand = trafficDemand(hour);
    if (instant) for (const c of this.cars) c.on = c.rank < this.demand;
  }
  /** How many cars are on the road now (for tests). */
  get active() { return this.cars.filter((c) => c.on).length; }
  /** Called when a car that has been stopped by someone in its way sounds its horn (`n`: which honk of this wait). */
  onHonk: ((car: { x: number; y: number; z: number; kind: VehicleKind; n: number }) => void) | null = null;

  constructor(private signals?: Signals) {
    const r = rng(808);
    const town = (name: string, reverse: boolean, offset: number): Lane => {
      const R = getRoad(name);
      const l: Lane = { path: makePath(R.x, R.z, R.y, reverse), offset, yOff: 0.08, follow: 1.1, accel: 1.8 };
      markCrossing(l, name === 'main' ? 'main' : 'cross');
      return l;
    };
    const hw = (reverse: boolean, offset: number): Lane => {
      const y = EXPRESSWAY.y + 0.04;
      return { path: makePath([EXPRESSWAY.x0, EXPRESSWAY.x1], [EXPRESSWAY.z, EXPRESSWAY.z], [y, y], reverse), offset, yOff: 0, follow: 0.7, accel: 2.5 };
    };
    // which vehicles go where: [lane, kinds, cruising speed range]
    const plan: [Lane, VehicleKind[], [number, number]][] = [
      [town('main', false, 2.0), ['car', 'kei', 'van', 'car', 'kei', 'car', 'van', 'kei', 'car', 'kei', 'car', 'van'], [3.6, 5.2]],
      [town('main', true, 2.0), ['kei', 'car', 'van', 'car', 'car', 'kei', 'van', 'car', 'kei', 'car'], [3.6, 5.2]],
      [town('cross', false, 1.75), ['kei', 'car', 'car', 'kei', 'van', 'car'], [3.0, 4.4]],
      [town('cross', true, 1.75), ['car', 'kei', 'kei', 'car', 'van', 'kei', 'car'], [3.0, 4.4]],
      [hw(false, 2.35), ['truck', 'car', 'bus', 'van', 'truck', 'car'], [13, 16]],
      [hw(false, 5.85), ['car', 'car', 'van', 'car', 'car'], [18, 24]],
      [hw(true, 2.35), ['bus', 'truck', 'car', 'van', 'truck', 'car'], [13, 16]],
      [hw(true, 5.85), ['car', 'van', 'car', 'car', 'bus'], [18, 24]],
    ];
    const count = new Map<VehicleKind, number>();
    for (const [, kinds] of plan) for (const k of kinds) count.set(k, (count.get(k) ?? 0) + 1);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
    const paints = ['#e8e8e8', '#d94f4f', '#3f6fd0', '#f2c230', '#2f2f35', '#b8bcc2', '#4a9a6a', '#f4f4ee'];
    for (const [kind, n] of count) {
      const mesh = new InstancedMesh(buildVehicle(kind).toGeometry(), mat, n);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `Traffic ${kind}`;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
      for (const [which, map, lm] of [['head', this.heads, this.headMat], ['tail', this.tails, this.tailMat]] as const) {
        const lamps = new InstancedMesh(vehicleLamps(kind, which).toGeometry(), lm, n);
        lamps.frustumCulled = false;
        lamps.name = `Traffic ${kind} ${which} lamps`;
        if (which === 'tail') for (let i = 0; i < n; i++) lamps.setColorAt(i, this.tc.setScalar(1));
        map.set(kind, lamps);
        this.group.add(lamps);
      }
    }
    const used = new Map<VehicleKind, number>();
    let laneNo = 0;
    for (const [lane, kinds, [v0, v1]] of plan) {
      laneNo++;
      // spread evenly round the loop, with a little jitter that never closes a gap
      const step = lane.path.L / kinds.length;
      kinds.forEach((kind, k) => {
        const index = used.get(kind) ?? 0;
        used.set(kind, index + 1);
        const [len, wid] = Traffic.SIZE[kind] ?? [4.4, 2];
        const cruise = v0 + r() * (v1 - v0);
        this.cars.push({ lane, s: step * (k + 0.3 * r()), v: cruise, cruise, kind, index, len, wid, vNext: cruise, brake: 0, blockT: 0, honkT: 0, honks: 0, on: true, rank: (k * 0.618034 + laneNo * 0.37) % 1 });
        const mesh = this.meshes.get(kind)!;
        mesh.setColorAt(index, new Color(kind === 'kei' ? pick(r, ['#f4f4ee', '#f4f4ee', '#e8e8e8', '#d8e4f0']) : pick(r, paints)));
      });
    }
    this.meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    this.shadows = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: '#1a1c22', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), this.cars.length);
    this.shadows.frustumCulled = false;
    this.shadows.name = 'Traffic shadows';
    this.group.add(this.shadows);
    // the light the lamps throw: two soft cones on the road ahead, a faint red glow behind, and a halo round each lamp
    if (typeof document !== 'undefined') {
      const add = { transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false } as const;
      this.beamMat = new MeshBasicMaterial({ ...add, map: beamTexture(), color: '#ffeccc', polygonOffset: true, polygonOffsetFactor: -3 });
      // the texture's near edge (at the car) at the plane's -x end, its far edge at +x
      const flat = () => new PlaneGeometry(1, 1).rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2);
      this.beams = new InstancedMesh(flat(), this.beamMat, this.cars.length);
      this.glowMat = new MeshBasicMaterial({ ...add, map: roundTexture(), color: '#ff3a24', polygonOffset: true, polygonOffsetFactor: -3 });
      this.glows = new InstancedMesh(flat(), this.glowMat, this.cars.length);
      for (const [m, name] of [[this.beams, 'Traffic beams'], [this.glows, 'Traffic tail glow']] as const) {
        m.frustumCulled = false;
        m.name = name;
        this.group.add(m);
      }
      for (let i = 0; i < this.cars.length; i++) this.glows.setColorAt(i, this.tc.setScalar(1));
      // halos: a soft round sprite on every lamp, facing the camera
      const nLamps = this.cars.length * 4;
      this.haloGeo = new BufferGeometry();
      this.haloGeo.setAttribute('position', new BufferAttribute(new Float32Array(nLamps * 3), 3).setUsage(DynamicDrawUsage));
      this.haloGeo.setAttribute('color', new BufferAttribute(new Float32Array(nLamps * 3), 3).setUsage(DynamicDrawUsage));
      this.haloMat = new PointsMaterial({ ...add, map: roundTexture(), vertexColors: true, size: 1.1, sizeAttenuation: true });
      const halos = new Points(this.haloGeo, this.haloMat);
      halos.frustumCulled = false;
      halos.name = 'Traffic lamp halos';
      this.group.add(halos);
    }
    this.step(0);
  }

  /** Whether a car of the other street is in the junction now. */
  private junctionTaken(g: SignalGroup) {
    return this.cars.some((c) => c.on && c.lane.group && c.lane.group !== g && c.lane.box && c.s + c.len / 2 > c.lane.box[0] && c.s - c.len / 2 < c.lane.box[1]);
  }

  /** Lamps on at night: 0 by day, 1 in the dark. */
  setNight(n: number) {
    this.headMat.color.setScalar(0.35 + n * 2.0);
    this.tailMat.color.setScalar(0.4 + n * 0.9);
    if (this.beamMat) {
      this.beamMat.opacity = n * 0.5;
      this.glowMat!.opacity = n * 0.35;
      this.haloMat!.opacity = n * 0.75;
      this.beams!.visible = this.glows!.visible = n > 0.02;
    }
  }

  /** How loud the traffic is at a point (0: silent, about 1: beside a busy road): every moving car adds what its speed and its
   *  distance give, a bus or a truck more than a car. */
  loudness(x: number, z: number): number {
    let sum = 0;
    for (const c of this.cars) {
      if (!c.on) continue;
      const p = pointAt(c.lane, c.s);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > 80) continue;
      const weight = c.kind === 'bus' || c.kind === 'truck' ? 1.6 : 1;
      sum += (weight * (0.12 + Math.min(1, c.v / 9))) / (1 + (d / 9) * (d / 9));
    }
    return Math.min(1.4, sum * 0.9);
  }

  /** The moving cars near a point as circles (a few along each car's length), for the player to bump into. `y`: her height
   *  (a car on the road below a landing does not stop her). */
  circlesNear(x: number, z: number, range: number, y: number): { x: number; z: number; r: number }[] {
    const out: { x: number; z: number; r: number }[] = [];
    for (const c of this.cars) {
      if (!c.on) continue;
      const p = pointAt(c.lane, c.s);
      if (Math.abs(p.y - y) > 1.6 || Math.hypot(p.x - x, p.z - z) > range + c.len / 2) continue;
      const r = c.wid / 2, n = Math.max(1, Math.ceil((c.len - c.wid) / (r * 1.1)) + 1), half = (c.len - c.wid) / 2;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : -half + (2 * half * i) / (n - 1);
        out.push({ x: p.x + p.tx * a, z: p.z + p.tz * a, r });
      }
    }
    return out;
  }

  /** Take a car off the road: every instance of it shrunk to nothing. */
  private hide(c: Car, n: number, P: BufferAttribute | undefined) {
    this.m.makeScale(0, 0, 0);
    this.meshes.get(c.kind)!.setMatrixAt(c.index, this.m);
    this.heads.get(c.kind)!.setMatrixAt(c.index, this.m);
    this.tails.get(c.kind)!.setMatrixAt(c.index, this.m);
    this.shadows.setMatrixAt(n, this.m);
    if (this.beams) {
      this.beams.setMatrixAt(n, this.m);
      this.glows!.setMatrixAt(n, this.m);
      for (let j = n * 4; j < n * 4 + 4; j++) P!.setXYZ(j, 0, -1000, 0);
    }
  }

  /** A car that is off the road comes back on when the day wants it, far from the camera and with room to spare. */
  private maybeCome(c: Car) {
    if (c.rank >= this.demand) return;
    const l = c.lane, L = l.path.L, p = pointAt(l, c.s);
    if (Math.hypot(p.x - this.focus.x, p.z - this.focus.z) < SPAWN_DIST + 4) return;
    for (const o of this.cars) {
      if (o === c || !o.on || o.lane !== l) continue;
      const d = Math.abs((((o.s - c.s) % L) + L + L / 2) % L - L / 2);
      if (d < c.len / 2 + o.len / 2 + 10 + Math.max(c.cruise, o.v) * 1.5) return;
    }
    // not at the crossing, where the signals and the junction decide who goes
    if (l.stop !== undefined) {
      const toLine = l.stop - (c.s + c.len / 2);
      if (toLine > -8 && toLine < 45) return;
      if (l.box && c.s + c.len > l.box[0] - 4 && c.s - c.len < l.box[1] + 4) return;
    }
    c.on = true;
    c.v = c.vNext = c.cruise;
  }

  step(dt: number) {
    const taken: Record<SignalGroup, boolean> = { main: this.junctionTaken('main'), cross: this.junctionTaken('cross') };
    // first decide every car's speed from where everyone is, then move them all
    for (const c of this.cars) {
      const l = c.lane, L = l.path.L;
      // a car that is off the road drives on in the dark, so it comes back round somewhere else
      if (!c.on) { c.vNext = c.cruise; continue; }
      // the car ahead in the same lane (lanes are loops)
      let gap = Infinity;
      for (const o of this.cars) {
        if (o === c || o.lane !== l || !o.on) continue;
        const ahead = (((o.s - c.s) % L) + L) % L;
        gap = Math.min(gap, ahead - (c.len + o.len) / 2);
      }
      let target = Math.min(c.cruise, Math.max(0, (gap - GAP) * l.follow));
      // the signal: stop at the line on red, on yellow if there is still room, or while the junction is taken
      if (l.group && l.stop !== undefined && this.signals) {
        const front = c.s + c.len / 2;
        const toLine = l.stop - front;
        if (toLine > -0.3 && toLine < 60) {
          const light = this.signals.light(l.group);
          const stop = light === 'red' || (light === 'yellow' && toLine > (c.v * c.v) / (2 * 3.0) + 0.5) || taken[l.group];
          if (stop) target = Math.min(target, Math.max(0, (toLine - 0.4) * 1.2));
        }
      }
      // someone standing in the lane ahead: stop short of them (and honk, see below)
      let block = Infinity;
      if (this.blockers.length) {
        const p = pointAt(l, c.s), px = p.x, pz = p.z, py = p.y, tx = p.tx, tz = p.tz;
        for (const b of this.blockers) {
          if (Math.abs(b.y - py) > 1.6) continue;
          const dx = b.x - px, dz = b.z - pz;
          const along = dx * tx + dz * tz, lat = Math.abs(dx * tz - dz * tx);
          const reach = c.len / 2 + b.r;
          if (along > 0 && along < reach + 3 + c.v * 1.3 + (c.v * c.v) / 5 && lat < c.wid / 2 + b.r + 0.25) block = Math.min(block, along - reach - 1.5);
        }
        if (block < Infinity) target = Math.min(target, Math.max(0, block * 1.3));
      }
      if (block === Infinity) { c.blockT = 0; c.honks = 0; c.honkT = 0; }
      let v = target > c.v ? Math.min(target, c.v + l.accel * dt) : target;
      if (dt > 0 && block < Infinity) v = Math.min(v, Math.max(0, (block + 0.6) / dt));
      // and never into the car ahead, however short the frame
      if (dt > 0) v = Math.min(v, Math.max(0, (gap - 0.6) / dt));
      c.vNext = v;
      if (block < Infinity && v < 0.4) {
        c.blockT += dt;
        // held up: a honk after a moment, then again and again, quicker as it goes on
        if (c.blockT > 1.0) {
          c.honkT -= dt;
          if (c.honkT <= 0) {
            c.honks++;
            c.honkT = c.honks > 12 ? 2.6 : c.honks > 4 ? 0.9 : 1.5; // (it tires out in the end)
            const p = pointAt(l, c.s);
            this.onHonk?.({ x: p.x, y: p.y, z: p.z, kind: c.kind, n: c.honks });
          }
        }
      }
    }
    const P0 = this.haloGeo?.getAttribute('position') as BufferAttribute | undefined;
    this.cars.forEach((c, n) => {
      if (!c.on) {
        c.v = c.vNext;
        c.s = (((c.s + c.v * dt) % c.lane.path.L) + c.lane.path.L) % c.lane.path.L;
        this.hide(c, n, P0);
        this.maybeCome(c);
        return;
      }
      // brake lights while slowing down or standing still
      const braking = c.vNext < c.v - 0.02 || c.vNext < 0.3 ? 1 : 0;
      c.brake += (braking - c.brake) * Math.min(1, dt * 8);
      if (dt === 0) c.brake = braking;
      c.v = c.vNext;
      const L = c.lane.path.L;
      c.s = (((c.s + c.v * dt) % L) + L) % L;
      const p = pointAt(c.lane, c.s);
      const yaw = Math.atan2(-p.tz, p.tx);
      this.q.setFromAxisAngle(this.up, yaw).multiply(this.qp.setFromAxisAngle(this.side, Math.atan(p.slope)));
      this.m.compose(this.v3.set(p.x, p.y, p.z), this.q, this.one);
      this.meshes.get(c.kind)!.setMatrixAt(c.index, this.m);
      this.heads.get(c.kind)!.setMatrixAt(c.index, this.m);
      const tail = this.tails.get(c.kind)!;
      tail.setMatrixAt(c.index, this.m);
      tail.setColorAt(c.index, this.tc.setScalar(0.8 + c.brake * 1.6));
      if (this.beams) {
        const gy = c.lane.yOff ? p.y - 0.02 : p.y + 0.02;
        const ahead = c.len / 2 + 4.4;
        this.sm.compose(this.v3.set(p.x + p.tx * ahead, gy, p.z + p.tz * ahead), this.qp.setFromAxisAngle(this.up, yaw), this.size.set(9, 1, c.wid * 2.0));
        this.beams.setMatrixAt(n, this.sm);
        const behind = c.len / 2 + 0.6;
        this.sm.compose(this.v3.set(p.x - p.tx * behind, gy, p.z - p.tz * behind), this.qp.setFromAxisAngle(this.up, yaw), this.size.set(2.6, 1, c.wid * 1.2));
        this.glows!.setMatrixAt(n, this.sm);
        this.glows!.setColorAt(n, this.tc.setScalar(0.5 + c.brake * 1.0));
        // the halos, at the lamps as the car stands now
        const P = this.haloGeo!.getAttribute('position') as BufferAttribute, C = this.haloGeo!.getAttribute('color') as BufferAttribute;
        const lamps = LAMPS[c.kind];
        let j = n * 4;
        for (const [which, list] of [['head', lamps.head], ['tail', lamps.tail]] as const) {
          for (const [lx, ly, lz] of list.slice(0, 2)) {
            this.lampV.set(lx + Math.sign(lx) * 0.08, ly, lz).applyMatrix4(this.m);
            P.setXYZ(j, this.lampV.x, this.lampV.y, this.lampV.z);
            if (which === 'head') C.setXYZ(j, 1.0, 0.92, 0.75);
            else { const b = 0.45 + c.brake * 0.55; C.setXYZ(j, b, b * 0.12, b * 0.06); }
            j++;
          }
        }
      }
      this.sm.compose(this.v3.set(p.x, c.lane.yOff ? p.y - 0.01 : p.y + 0.03, p.z), this.qp.setFromAxisAngle(this.up, yaw).multiply(this.sq), this.size.set(c.len, c.wid, 1));
      this.shadows.setMatrixAt(n, this.sm);
      // a car the day no longer needs leaves the road, far from where anyone is looking
      if (c.rank >= this.demand + 0.04 && Math.hypot(p.x - this.focus.x, p.z - this.focus.z) > SPAWN_DIST) c.on = false;
    });
    this.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    this.heads.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    this.tails.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    if (this.beams) {
      this.beams.instanceMatrix.needsUpdate = true;
      this.glows!.instanceMatrix.needsUpdate = true;
      if (this.glows!.instanceColor) this.glows!.instanceColor.needsUpdate = true;
      this.haloGeo!.getAttribute('position').needsUpdate = true;
      this.haloGeo!.getAttribute('color').needsUpdate = true;
    }
    if (this.shadows) this.shadows.instanceMatrix.needsUpdate = true;
  }
}

/** Two soft cones of head-lamp light on the road, widening and fading with distance (near edge at the bottom). */
function beamTexture() {
  const W = 64, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!, img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = 1 - y / H; // 0 at the car, 1 far ahead
    const fade = Math.min(1, v / 0.06) * Math.pow(1 - v, 1.8);
    const width = 0.07 + v * 0.3;
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      let a = 0;
      for (const cu of [0.32, 0.68]) a += Math.exp(-(((u - cu) / width) ** 2));
      a = Math.min(1, a * 0.75) * fade;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}

/** A soft round spot (a gaussian), for halos and glows. */
function roundTexture() {
  const N = 64, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!, img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);
    const i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(Math.exp(-d * d * 5) * (1 - Math.min(1, d)) * 255);
  }
  g.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}
