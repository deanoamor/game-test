import { Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { pick, rng } from '../util/rng';
import { EXPRESSWAY, getRoad } from './config';
import { buildVehicle, type VehicleKind } from './vehicles';

interface Lane { s: number; dir: 1 | -1; speed: number; kind: VehicleKind; index: number; offset: number; highway?: boolean }

/** A few cars, mini trucks and vans driving slowly along the main street (on the left, as in Japan). */
export class Traffic {
  group = new Group();
  private meshes = new Map<VehicleKind, InstancedMesh>();
  private cars: Lane[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private up = new Vector3(0, 1, 0);
  private road = getRoad('main');

  constructor() {
    const r = rng(808);
    const counts: Partial<Record<VehicleKind, number>> = { car: 4, kei: 3, van: 2 };
    // and on the expressway: cars, vans, lorries and coaches at speed, two lanes each way
    const fast: Partial<Record<VehicleKind, number>> = { car: 10, van: 4, truck: 5, bus: 3 };
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
    const paints = ['#e8e8e8', '#d94f4f', '#3f6fd0', '#f2c230', '#2f2f35', '#b8bcc2', '#4a9a6a', '#f4f4ee'];
    for (const kind of ['car', 'kei', 'van', 'truck', 'bus'] as VehicleKind[]) {
      const town = counts[kind] ?? 0, n = town + (fast[kind] ?? 0);
      if (n === 0) continue;
      const mesh = new InstancedMesh(buildVehicle(kind).toGeometry(), mat, n);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `Traffic ${kind}`;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
      for (let i = 0; i < n; i++) {
        const dir = (i % 2 ? 1 : -1) as 1 | -1;
        if (i < town) this.cars.push({ s: r() * this.road.len * 2, dir, speed: 2.2 + r() * 1.6, kind, index: i, offset: 2.0 });
        else {
          const slow = kind === 'truck' || kind === 'bus';
          this.cars.push({ s: r() * (EXPRESSWAY.x1 - EXPRESSWAY.x0), dir, speed: slow ? 13 + r() * 3 : 18 + r() * 6, kind, index: i, offset: slow || r() < 0.5 ? 2.35 : 5.85, highway: true });
        }
        mesh.setColorAt(i, new Color(kind === 'kei' ? pick(r, ['#f4f4ee', '#f4f4ee', '#e8e8e8', '#d8e4f0']) : pick(r, paints)));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.step(0);
  }

  step(dt: number) {
    const R = this.road;
    const total = R.len - 1; // samples are 2 m apart
    for (const c of this.cars) {
      if (c.highway) {
        // a straight run along the deck, wrapping round at the ends of the map; eastbound keeps to the north half
        const L = EXPRESSWAY.x1 - EXPRESSWAY.x0;
        c.s = (((c.s + c.speed * dt) % L) + L) % L;
        const x = c.dir > 0 ? EXPRESSWAY.x0 + c.s : EXPRESSWAY.x1 - c.s;
        const z = EXPRESSWAY.z + (c.dir > 0 ? -c.offset : c.offset);
        this.q.setFromAxisAngle(this.up, c.dir > 0 ? 0 : Math.PI);
        this.m.compose(new Vector3(x, EXPRESSWAY.y + 0.04, z), this.q, new Vector3(1, 1, 1));
        this.meshes.get(c.kind)!.setMatrixAt(c.index, this.m);
        continue;
      }
      c.s += (c.speed * c.dir * dt) / 2;
      if (c.s > total) c.s -= total;
      if (c.s < 0) c.s += total;
      const i = Math.min(R.len - 2, Math.floor(c.s));
      const f = c.s - i;
      const x = R.x[i] + (R.x[i + 1] - R.x[i]) * f, z = R.z[i] + (R.z[i + 1] - R.z[i]) * f, y = R.y[i] + (R.y[i + 1] - R.y[i]) * f;
      // the road runs east-west: traffic keeps left (north lane heading east would be on the south side of the centre)
      const lane = c.dir > 0 ? -c.offset : c.offset;
      const yaw = c.dir > 0 ? 0 : Math.PI;
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(new Vector3(x, y + 0.08, z + lane), this.q, new Vector3(1, 1, 1));
      this.meshes.get(c.kind)!.setMatrixAt(c.index, this.m);
    }
    this.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }
}
