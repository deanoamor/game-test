import { Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { pick, rng } from '../util/rng';
import { EXPRESSWAY, getRoad } from './config';
import type { SignalGroup, Signals } from './signals';
import { buildVehicle, type VehicleKind } from './vehicles';

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
interface Car { lane: Lane; s: number; v: number; cruise: number; kind: VehicleKind; index: number; len: number; wid: number; vNext: number }

/** The crossing: the stop lines frame it, the junction is where the two streets overlap. */
const STOP_RECT = { x0: -7.2, x1: 7.2, z0: 36.3, z1: 51.7 };
const JUNCTION = { x0: -3.7, x1: 3.7, z0: 39.8, z1: 48.2 };
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
      [town('main', false, 2.0), ['car', 'kei', 'van', 'car', 'kei'], [3.6, 5.2]],
      [town('main', true, 2.0), ['kei', 'car', 'van', 'car'], [3.6, 5.2]],
      [town('cross', false, 1.75), ['kei', 'car'], [3.0, 4.4]],
      [town('cross', true, 1.75), ['car', 'kei', 'kei'], [3.0, 4.4]],
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
    }
    const used = new Map<VehicleKind, number>();
    for (const [lane, kinds, [v0, v1]] of plan) {
      // spread evenly round the loop, with a little jitter that never closes a gap
      const step = lane.path.L / kinds.length;
      kinds.forEach((kind, k) => {
        const index = used.get(kind) ?? 0;
        used.set(kind, index + 1);
        const [len, wid] = Traffic.SIZE[kind] ?? [4.4, 2];
        const cruise = v0 + r() * (v1 - v0);
        this.cars.push({ lane, s: step * (k + 0.3 * r()), v: cruise, cruise, kind, index, len, wid, vNext: cruise });
        const mesh = this.meshes.get(kind)!;
        mesh.setColorAt(index, new Color(kind === 'kei' ? pick(r, ['#f4f4ee', '#f4f4ee', '#e8e8e8', '#d8e4f0']) : pick(r, paints)));
      });
    }
    this.meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    this.shadows = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: '#1a1c22', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), this.cars.length);
    this.shadows.frustumCulled = false;
    this.shadows.name = 'Traffic shadows';
    this.group.add(this.shadows);
    this.step(0);
  }

  /** Whether a car of the other street is in the junction now. */
  private junctionTaken(g: SignalGroup) {
    return this.cars.some((c) => c.lane.group && c.lane.group !== g && c.lane.box && c.s + c.len / 2 > c.lane.box[0] && c.s - c.len / 2 < c.lane.box[1]);
  }

  step(dt: number) {
    const taken: Record<SignalGroup, boolean> = { main: this.junctionTaken('main'), cross: this.junctionTaken('cross') };
    // first decide every car's speed from where everyone is, then move them all
    for (const c of this.cars) {
      const l = c.lane, L = l.path.L;
      // the car ahead in the same lane (lanes are loops)
      let gap = Infinity;
      for (const o of this.cars) {
        if (o === c || o.lane !== l) continue;
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
      let v = target > c.v ? Math.min(target, c.v + l.accel * dt) : target;
      // and never into the car ahead, however short the frame
      if (dt > 0) v = Math.min(v, Math.max(0, (gap - 0.6) / dt));
      c.vNext = v;
    }
    this.cars.forEach((c, n) => {
      c.v = c.vNext;
      const L = c.lane.path.L;
      c.s = (((c.s + c.v * dt) % L) + L) % L;
      const p = pointAt(c.lane, c.s);
      const yaw = Math.atan2(-p.tz, p.tx);
      this.q.setFromAxisAngle(this.up, yaw).multiply(this.qp.setFromAxisAngle(this.side, Math.atan(p.slope)));
      this.m.compose(this.v3.set(p.x, p.y, p.z), this.q, this.one);
      this.meshes.get(c.kind)!.setMatrixAt(c.index, this.m);
      this.sm.compose(this.v3.set(p.x, c.lane.yOff ? p.y - 0.01 : p.y + 0.03, p.z), this.qp.setFromAxisAngle(this.up, yaw).multiply(this.sq), this.size.set(c.len, c.wid, 1));
      this.shadows.setMatrixAt(n, this.sm);
    });
    this.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    if (this.shadows) this.shadows.instanceMatrix.needsUpdate = true;
  }
}
