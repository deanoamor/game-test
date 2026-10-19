import { Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GeoBuilder } from '../util/builder';
import { pick, rng } from '../util/rng';
import { CITY } from './config';

type Kind = 'car' | 'van' | 'bus' | 'truck';

function vehicleGeometry(kind: Kind) {
  const b = new GeoBuilder();
  const white = '#ffffff';
  const glass = '#2a3340';
  if (kind === 'car') {
    b.box(0, 0.62, 0, 4.2, 0.7, 1.75, white, { ao: 0.25 });
    b.box(-0.25, 1.22, 0, 2.3, 0.62, 1.6, glass, { ao: 0.1 });
    b.box(-0.25, 1.56, 0, 2.15, 0.1, 1.5, white, { ao: 0 });
    b.box(2.12, 0.55, 0.55, 0.06, 0.18, 0.4, '#fff3c0', { ao: 0 });
    b.box(2.12, 0.55, -0.55, 0.06, 0.18, 0.4, '#fff3c0', { ao: 0 });
    b.box(-2.12, 0.6, 0.55, 0.06, 0.16, 0.4, '#e8402a', { ao: 0 });
    b.box(-2.12, 0.6, -0.55, 0.06, 0.16, 0.4, '#e8402a', { ao: 0 });
  } else if (kind === 'van') {
    b.box(0, 0.8, 0, 4.8, 1.1, 1.95, white, { ao: 0.25 });
    b.box(0.15, 1.65, 0, 3.9, 0.9, 1.85, white, { ao: 0.2 });
    b.box(1.95, 1.62, 0, 0.1, 0.62, 1.7, glass, { ao: 0 });
    b.box(2.42, 0.62, 0.65, 0.06, 0.18, 0.4, '#fff3c0', { ao: 0 });
    b.box(2.42, 0.62, -0.65, 0.06, 0.18, 0.4, '#fff3c0', { ao: 0 });
  } else if (kind === 'bus') {
    b.box(0, 1.7, 0, 10.4, 2.6, 2.5, white, { ao: 0.2 });
    for (let k = -4; k <= 4; k++) for (const s of [-1, 1]) b.box(k * 1.05, 2.1, s * 1.26, 0.85, 0.85, 0.06, glass, { ao: 0 });
    b.box(5.22, 2.1, 0, 0.06, 1.0, 2.2, glass, { ao: 0 });
    b.box(0, 3.05, 0, 10.2, 0.12, 2.3, '#e9e9e9', { ao: 0 });
  } else {
    b.box(-1.0, 1.7, 0, 6.2, 2.8, 2.4, white, { ao: 0.2 });
    b.box(3.0, 1.25, 0, 1.9, 1.9, 2.3, '#e6e6e6', { ao: 0.2 });
    b.box(3.7, 1.7, 0, 0.1, 0.8, 2.1, glass, { ao: 0 });
  }
  return b;
}

/** Wheels are drawn as dark boxes: simple and cheap. */
function withWheels(kind: Kind) {
  const b = vehicleGeometry(kind);
  const wheelX = kind === 'bus' ? [-3.4, 3.4] : kind === 'truck' ? [-3.0, 2.8] : kind === 'van' ? [-1.5, 1.6] : [-1.3, 1.3];
  const wz = kind === 'bus' ? 1.2 : 0.95;
  const geo = b;
  for (const x of wheelX) for (const z of [-wz, wz]) geo.box(x, 0.38, z, 0.78, 0.76, 0.3, '#15171a', { ao: 0 });
  return geo.toGeometry();
}

interface Vehicle { lane: number; s: number; kind: Kind; index: number }
interface Lane { axis: 'x' | 'z'; fixed: number; dir: 1 | -1; speed: number }

/** Cars, vans, buses and trucks driving on the left along every street of the city, in loops. */
export class Traffic {
  group = new Group();
  private meshes = new Map<Kind, InstancedMesh>();
  private lanes: Lane[] = [];
  private vehicles: Vehicle[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private up = new Vector3(0, 1, 0);
  private half = CITY.extent / 2 + 4;

  constructor(streetX: number[], streetZ: number[]) {
    const r = rng(555);
    const counts: Record<Kind, number> = { car: 62, van: 14, bus: 8, truck: 10 };
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 });
    const paints = ['#e8e8e8', '#d94f4f', '#3f6fd0', '#f2c230', '#2f2f35', '#b8bcc2', '#4a9a6a', '#f08a3a', '#d8d8d0'];
    const lane = 2.9;
    streetX.forEach((x) => { for (const dir of [1, -1] as const) this.lanes.push({ axis: 'z', fixed: x + dir * lane, dir, speed: 6.5 + r() * 5 }); });
    streetZ.forEach((z) => { for (const dir of [1, -1] as const) this.lanes.push({ axis: 'x', fixed: z - dir * lane, dir, speed: 6.5 + r() * 5 }); });
    (['car', 'van', 'bus', 'truck'] as Kind[]).forEach((kind) => {
      const mesh = new InstancedMesh(withWheels(kind), mat, counts[kind]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `Traffic ${kind}`;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
      for (let i = 0; i < counts[kind]; i++) {
        const li = Math.floor(r() * this.lanes.length);
        // buses keep to the middle avenues
        const l = kind === 'bus' ? 2 * (2 + Math.floor(r() * 3)) + Math.floor(r() * 2) : li;
        this.vehicles.push({ lane: l % this.lanes.length, s: (r() * 2 - 1) * this.half, kind, index: i });
        const col = new Color(kind === 'bus' ? pick(r, ['#3f9bd0', '#e8e8e8', '#4aa86a']) : kind === 'truck' ? pick(r, ['#f4f4f0', '#e8ecef', '#d8e4f0']) : pick(r, paints));
        mesh.setColorAt(i, col);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    // spread vehicles that share a lane so they do not start on top of one another
    const byLane = new Map<number, Vehicle[]>();
    this.vehicles.forEach((v) => byLane.set(v.lane, [...(byLane.get(v.lane) ?? []), v]));
    byLane.forEach((list) => list.forEach((v, k) => { v.s = -this.half + ((k + 0.5) / list.length) * this.half * 2 + (r() - 0.5) * 6; }));
    this.step(0);
  }

  step(dt: number) {
    const y = CITY.height + 0.06;
    for (const v of this.vehicles) {
      const l = this.lanes[v.lane];
      v.s += l.speed * l.dir * dt;
      if (v.s > this.half) v.s -= this.half * 2;
      if (v.s < -this.half) v.s += this.half * 2;
      const x = l.axis === 'x' ? CITY.cx + v.s : l.fixed;
      const z = l.axis === 'x' ? l.fixed : CITY.cz + v.s;
      const yaw = l.axis === 'x' ? (l.dir > 0 ? 0 : Math.PI) : l.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(new Vector3(x, y, z), this.q, new Vector3(1, 1, 1));
      this.meshes.get(v.kind)!.setMatrixAt(v.index, this.m);
    }
    this.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }
}
