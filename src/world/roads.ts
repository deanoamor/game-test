import { Group, Mesh, MeshStandardMaterial } from 'three';
import { GeoBuilder, toRgb, type V3 } from '../util/builder';
import { getRoads, onBridge, type RoadPath } from './config';

const ASPHALT = '#4a4e55';

/** One road as a ribbon draped over the carved ground, with markings and skirts. */
function ribbon(b: GeoBuilder, p: RoadPath, o: { stoneFrom?: number; center?: 'dash' | 'none'; yellowEdges?: boolean; whiteEdges?: boolean; rails?: boolean }) {
  const dirt = toRgb('#6f5a43');
  const stone = [toRgb('#d9cdb2'), toRgb('#c8baa0')];
  const W = p.width / 2;
  const stoneStart = o.stoneFrom ?? p.len + 1;
  const frame = (i: number) => {
    const a = Math.max(0, i - 1), c = Math.min(p.len - 1, i + 1);
    let tx = p.x[c] - p.x[a], tz = p.z[c] - p.z[a];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return { tx, tz, nx: -tz, nz: tx };
  };
  const lift = 0.04;
  for (let i = 0; i < p.len - 1; i++) {
    const f0 = frame(i), f1 = frame(i + 1);
    const isStone = i >= stoneStart;
    const w = isStone ? W * 0.8 : W;
    const y0 = p.y[i] + lift, y1 = p.y[i + 1] + lift;
    const L0: V3 = [p.x[i] + f0.nx * w, y0, p.z[i] + f0.nz * w];
    const R0: V3 = [p.x[i] - f0.nx * w, y0, p.z[i] - f0.nz * w];
    const L1: V3 = [p.x[i + 1] + f1.nx * w, y1, p.z[i + 1] + f1.nz * w];
    const R1: V3 = [p.x[i + 1] - f1.nx * w, y1, p.z[i + 1] - f1.nz * w];
    const stoneCol = stone[Math.floor(i / 1) % 2];
    b.quadFacing(L0, R0, R1, L1, [0, 1, 0], isStone ? stoneCol : toRgb(ASPHALT));
    const drop = 1.4;
    // no earth skirts where the road crosses the bridge over the underpass
    if (!onBridge(p.x[i], p.z[i]) || p.name !== 'cross') {
      b.quadFacing(L0, L1, [L1[0] + f1.nx * 1.0, y1 - drop, L1[2] + f1.nz * 1.0], [L0[0] + f0.nx * 1.0, y0 - drop, L0[2] + f0.nz * 1.0], [f0.nx, 0.4, f0.nz], dirt);
      b.quadFacing(R0, R1, [R1[0] - f1.nx * 1.0, y1 - drop, R1[2] - f1.nz * 1.0], [R0[0] - f0.nx * 1.0, y0 - drop, R0[2] - f0.nz * 1.0], [-f0.nx, 0.4, -f0.nz], dirt);
    }
    const line = (off: number, cw: number, color: string) => {
      const a: V3 = [p.x[i] + f0.nx * (off + cw), y0 + 0.012, p.z[i] + f0.nz * (off + cw)], c: V3 = [p.x[i] + f0.nx * (off - cw), y0 + 0.012, p.z[i] + f0.nz * (off - cw)];
      const d: V3 = [p.x[i + 1] + f1.nx * (off + cw), y1 + 0.012, p.z[i + 1] + f1.nz * (off + cw)], e: V3 = [p.x[i + 1] + f1.nx * (off - cw), y1 + 0.012, p.z[i + 1] + f1.nz * (off - cw)];
      b.quadFacing(a, c, e, d, [0, 1, 0], toRgb(color));
    };
    if (!isStone && o.center === 'dash' && Math.floor(i / 2) % 2 === 0) line(0, 0.1, '#f1efe2');
    if (!isStone && o.yellowEdges) { line(W - 0.3, 0.1, '#e8c43a'); line(-(W - 0.3), 0.1, '#e8c43a'); }
    if (!isStone && o.whiteEdges) { line(W - 0.25, 0.06, '#f1efe2'); line(-(W - 0.25), 0.06, '#f1efe2'); }
    if (isStone && i % 2 === 0) {
      // the joints between flat stones
      const a: V3 = [L0[0], y0 + 0.012, L0[2]], c: V3 = [R0[0], y0 + 0.012, R0[2]];
      const d: V3 = [R0[0] + f0.tx * 0.07, y0 + 0.012, R0[2] + f0.tz * 0.07], e: V3 = [L0[0] + f0.tx * 0.07, y0 + 0.012, L0[2] + f0.tz * 0.07];
      b.quadFacing(a, c, d, e, [0, 1, 0], toRgb('#9d9382'));
    }
  }
  if (o.rails) {
    for (let i = 3; i < Math.min(p.len - 2, stoneStart - 2); i += 4) {
      const f = frame(i);
      for (const s of [-1, 1]) {
        const x = p.x[i] + f.nx * (W + 0.4) * s, z = p.z[i] + f.nz * (W + 0.4) * s;
        b.box(x, p.y[i] + 0.55, z, 0.12, 0.95, 0.12, '#e9e6dc', { ao: 0.1 });
        if (i + 4 < Math.min(p.len - 2, stoneStart - 2)) {
          const f2 = frame(i + 4);
          const x2 = p.x[i + 4] + f2.nx * (W + 0.4) * s, z2 = p.z[i + 4] + f2.nz * (W + 0.4) * s;
          // the rails follow the slope of the path from post to post
          b.cable([[x, p.y[i] + 0.85, z], [x2, p.y[i + 4] + 0.85, z2]], 0.05, '#d8d5ca');
          b.cable([[x, p.y[i] + 0.45, z], [x2, p.y[i + 4] + 0.45, z2]], 0.04, '#d8d5ca');
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
      for (const s of [-1, 1]) b.box(p.x[i] + f.nx * 2.2 * s, base + 1.9, p.z[i] + f.nz * 2.2 * s, 0.4, 3.8, 0.4, '#c93a2b', { ao: 0.12 });
      b.box(p.x[i], base + 2.9, p.z[i], 0.3, 0.26, 5.4, '#c93a2b', { yaw, ao: 0 });
      b.box(p.x[i], base + 3.9, p.z[i], 0.46, 0.3, 6.0, '#232323', { yaw, ao: 0 });
    }
  }
}

/** Every road of the world: the main street, the lanes and the mountain path to the shrine. */
export function buildRoads(): Group {
  const g = new Group();
  g.name = 'Roads';
  const b = new GeoBuilder();
  for (const p of getRoads()) {
    // the school road is the main street carried on up the hill: the same width and markings
    if (p.name === 'main' || p.name === 'school road') ribbon(b, p, { center: 'dash', yellowEdges: true });
    else if (p.name === 'cross') ribbon(b, p, { center: 'dash', whiteEdges: true });
    else if (p.name === 'shrine path') ribbon(b, p, { stoneFrom: Math.floor(p.len * 0.3), whiteEdges: false, rails: true });
    else ribbon(b, p, { whiteEdges: true });
  }
  const mesh = new Mesh(b.toGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'Road ribbons';
  g.add(mesh);
  return g;
}
