import { Group, Mesh, MeshStandardMaterial } from 'three';
import { GeoBuilder, toRgb, type V3 } from '../util/builder';
import { getRoads, type RoadPath } from './config';

const ASPHALT = '#464a51';

/** One road as a ribbon draped over the carved ground, with its markings, skirts and decorations. */
function ribbon(b: GeoBuilder, p: RoadPath, o: { surface: string; stoneFrom?: number; edgeLine?: boolean; dashes?: boolean; rails?: boolean }) {
  const dirt = toRgb('#6f5a43');
  const stone = [toRgb('#d4c7aa'), toRgb('#c3b595')];
  const W = p.width / 2;
  const stoneStart = o.stoneFrom ?? p.len + 1;
  const frame = (i: number) => {
    const a = Math.max(0, i - 1), c = Math.min(p.len - 1, i + 1);
    let tx = p.x[c] - p.x[a], tz = p.z[c] - p.z[a];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return { tx, tz, nx: -tz, nz: tx };
  };
  for (let i = 0; i < p.len - 1; i++) {
    const f0 = frame(i), f1 = frame(i + 1);
    const isStone = i >= stoneStart;
    const w = isStone ? W * 0.72 : W;
    const y0 = p.y[i] + 0.08, y1 = p.y[i + 1] + 0.08;
    const L0: V3 = [p.x[i] + f0.nx * w, y0, p.z[i] + f0.nz * w];
    const R0: V3 = [p.x[i] - f0.nx * w, y0, p.z[i] - f0.nz * w];
    const L1: V3 = [p.x[i + 1] + f1.nx * w, y1, p.z[i + 1] + f1.nz * w];
    const R1: V3 = [p.x[i + 1] - f1.nx * w, y1, p.z[i + 1] - f1.nz * w];
    b.quadFacing(L0, R0, R1, L1, [0, 1, 0], isStone ? stone[i % 2] : toRgb(o.surface));
    const drop = 1.6;
    b.quadFacing(L0, L1, [L1[0] + f1.nx * 1.2, y1 - drop, L1[2] + f1.nz * 1.2], [L0[0] + f0.nx * 1.2, y0 - drop, L0[2] + f0.nz * 1.2], [f0.nx, 0.4, f0.nz], dirt);
    b.quadFacing(R0, R1, [R1[0] - f1.nx * 1.2, y1 - drop, R1[2] - f1.nz * 1.2], [R0[0] - f0.nx * 1.2, y0 - drop, R0[2] - f0.nz * 1.2], [-f0.nx, 0.4, -f0.nz], dirt);
    const line = (off: number, cw: number, color: string) => {
      const a: V3 = [p.x[i] + f0.nx * (off + cw), y0 + 0.03, p.z[i] + f0.nz * (off + cw)], c: V3 = [p.x[i] + f0.nx * (off - cw), y0 + 0.03, p.z[i] + f0.nz * (off - cw)];
      const d: V3 = [p.x[i + 1] + f1.nx * (off + cw), y1 + 0.03, p.z[i + 1] + f1.nz * (off + cw)], e: V3 = [p.x[i + 1] + f1.nx * (off - cw), y1 + 0.03, p.z[i + 1] + f1.nz * (off - cw)];
      b.quadFacing(a, c, e, d, [0, 1, 0], toRgb(color));
    };
    if (!isStone && o.dashes !== false && Math.floor(i / 2) % 2 === 0) line(0, 0.14, '#f1efe2');
    if (!isStone && o.edgeLine) { line(W - 0.45, 0.08, '#f1efe2'); line(-(W - 0.45), 0.08, '#f1efe2'); }
  }
  if (o.rails) {
    for (let i = 4; i < Math.min(p.len - 2, stoneStart - 2); i += 5) {
      const f = frame(i);
      for (const s of [-1, 1]) {
        const x = p.x[i] + f.nx * (W + 0.35) * s, z = p.z[i] + f.nz * (W + 0.35) * s;
        b.box(x, p.y[i] + 0.55, z, 0.14, 0.95, 0.14, '#e9e6dc', { ao: 0.1 });
        if (i + 5 < Math.min(p.len - 2, stoneStart - 2)) {
          const f2 = frame(i + 5);
          const x2 = p.x[i + 5] + f2.nx * (W + 0.35) * s, z2 = p.z[i + 5] + f2.nz * (W + 0.35) * s;
          const len = Math.hypot(x2 - x, z2 - z);
          const yaw = (Math.atan2(-(z2 - z), x2 - x) * 180) / Math.PI;
          b.box((x + x2) / 2, (p.y[i] + p.y[i + 5]) / 2 + 0.78, (z + z2) / 2, len, 0.12, 0.08, '#d8d5ca', { yaw, ao: 0 });
        }
      }
    }
  }
  // red torii gates over the stone approach
  if (o.stoneFrom !== undefined) {
    for (let k = 0; k < 4; k++) {
      const i = Math.min(p.len - 2, stoneStart + 3 + k * 5);
      const f = frame(i);
      const yaw = (Math.atan2(f.nx, f.nz) * 180) / Math.PI;
      const base = p.y[i];
      for (const s of [-1, 1]) b.box(p.x[i] + f.nx * 3.4 * s, base + 2.4, p.z[i] + f.nz * 3.4 * s, 0.55, 4.8, 0.55, '#c93a2b', { ao: 0.12 });
      b.box(p.x[i], base + 3.7, p.z[i], 0.38, 0.32, 7.8, '#c93a2b', { yaw, ao: 0 });
      b.box(p.x[i], base + 4.95, p.z[i], 0.6, 0.38, 8.6, '#232323', { yaw, ao: 0 });
    }
  }
}

/** Every road of the world: the mountain road to the shrine, the coast road, the promenade and the country roads. */
export function buildRoads(): Group {
  const g = new Group();
  g.name = 'Roads';
  const b = new GeoBuilder();
  for (const p of getRoads()) {
    if (p.name === 'mountain') ribbon(b, p, { surface: ASPHALT, stoneFrom: p.len - 22, rails: true });
    else if (p.name === 'promenade') ribbon(b, p, { surface: '#cfc6b4', dashes: false, edgeLine: false });
    else ribbon(b, p, { surface: ASPHALT, edgeLine: true });
  }
  const mesh = new Mesh(b.toGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'Road ribbons';
  g.add(mesh);
  return g;
}
