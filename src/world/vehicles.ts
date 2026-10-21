import { GeoBuilder } from '../util/builder';

export type VehicleKind = 'car' | 'van' | 'kei' | 'bus' | 'truck' | 'keivan';

/** A little low-poly vehicle, nose toward +X, standing on y = 0, in the given body colour. */
export function buildVehicle(kind: VehicleKind, body = '#ffffff'): GeoBuilder {
  const b = new GeoBuilder();
  const glass = '#2c3a48';
  const dark = '#15171a';
  const wheel = (x: number, z: number, r = 0.34) => {
    b.box(x, r, z, r * 2.1, r * 2, 0.26, dark, { ao: 0 });
    b.box(x, r, z + Math.sign(z) * 0.14, r * 0.9, r * 0.9, 0.02, '#aeb4ba', { ao: 0 });
  };
  switch (kind) {
    case 'car': {
      b.box(0, 0.62, 0, 4.1, 0.62, 1.7, body, { ao: 0.25 });
      b.box(-0.15, 1.18, 0, 2.2, 0.55, 1.55, glass, { ao: 0.1 });
      b.box(-0.15, 1.5, 0, 2.0, 0.1, 1.45, body, { ao: 0 });
      b.box(2.06, 0.62, 0.55, 0.05, 0.14, 0.34, '#fff3c0', { ao: 0 });
      b.box(2.06, 0.62, -0.55, 0.05, 0.14, 0.34, '#fff3c0', { ao: 0 });
      b.box(-2.06, 0.66, 0.55, 0.05, 0.14, 0.34, '#e8402a', { ao: 0 });
      b.box(-2.06, 0.66, -0.55, 0.05, 0.14, 0.34, '#e8402a', { ao: 0 });
      for (const x of [-1.3, 1.3]) for (const z of [-0.85, 0.85]) wheel(x, z);
      break;
    }
    case 'van': {
      b.box(0, 0.8, 0, 4.5, 0.9, 1.8, body, { ao: 0.25 });
      b.box(-0.35, 1.58, 0, 3.6, 0.8, 1.72, body, { ao: 0.2 });
      b.box(1.5, 1.52, 0, 0.9, 0.62, 1.64, glass, { ao: 0 });
      b.box(-0.2, 1.55, 0, 2.2, 0.4, 1.76, glass, { ao: 0 });
      b.box(2.26, 0.7, 0.6, 0.05, 0.16, 0.36, '#fff3c0', { ao: 0 });
      b.box(2.26, 0.7, -0.6, 0.05, 0.16, 0.36, '#fff3c0', { ao: 0 });
      b.box(-2.26, 0.9, 0.6, 0.05, 0.2, 0.3, '#e8402a', { ao: 0 });
      b.box(-2.26, 0.9, -0.6, 0.05, 0.2, 0.3, '#e8402a', { ao: 0 });
      for (const x of [-1.4, 1.4]) for (const z of [-0.88, 0.88]) wheel(x, z);
      break;
    }
    case 'kei': {
      // a mini truck: a short cab at the front and a flat bed with low sides
      b.box(0.55, 0.68, 0, 2.2, 0.62, 1.42, body, { ao: 0.25 });
      b.box(0.55, 1.25, 0, 1.6, 0.52, 1.36, body, { ao: 0.2 });
      b.box(0.62, 1.28, 0, 1.4, 0.4, 1.4, glass, { ao: 0 });
      b.box(-1.15, 0.64, 0, 1.6, 0.1, 1.46, '#8a8f94', { ao: 0.1 });
      b.box(-1.15, 0.92, 0.72, 1.6, 0.46, 0.06, body, { ao: 0.15 });
      b.box(-1.15, 0.92, -0.72, 1.6, 0.46, 0.06, body, { ao: 0.15 });
      b.box(-1.93, 0.92, 0, 0.06, 0.46, 1.4, body, { ao: 0.15 });
      b.box(1.66, 0.7, 0.5, 0.05, 0.14, 0.3, '#fff3c0', { ao: 0 });
      b.box(1.66, 0.7, -0.5, 0.05, 0.14, 0.3, '#fff3c0', { ao: 0 });
      for (const x of [-1.05, 1.05]) for (const z of [-0.66, 0.66]) wheel(x, z, 0.3);
      break;
    }
    case 'truck': {
      // a delivery truck: a cab and a tall box
      b.box(2.1, 1.05, 0, 1.6, 1.5, 1.9, body, { ao: 0.2 });
      b.box(2.35, 1.45, 0, 1.0, 0.6, 1.92, glass, { ao: 0 });
      b.box(-0.7, 1.65, 0, 4.2, 2.3, 2.1, '#e8eaec', { ao: 0.18 });
      b.box(-0.7, 1.9, 1.06, 3.4, 0.5, 0.02, '#3a6ab8', { ao: 0 });
      b.box(-0.7, 1.9, -1.06, 3.4, 0.5, 0.02, '#3a6ab8', { ao: 0 });
      b.box(2.92, 0.7, 0.62, 0.05, 0.16, 0.36, '#fff3c0', { ao: 0 });
      b.box(2.92, 0.7, -0.62, 0.05, 0.16, 0.36, '#fff3c0', { ao: 0 });
      for (const x of [-1.9, 2.0]) for (const z of [-0.95, 0.95]) wheel(x, z, 0.4);
      break;
    }
    case 'keivan': {
      // a tall boxy kei car
      b.box(0, 0.62, 0, 3.4, 0.62, 1.48, body, { ao: 0.25 });
      b.box(-0.1, 1.3, 0, 2.9, 0.78, 1.44, body, { ao: 0.2 });
      b.box(1.2, 1.32, 0, 0.6, 0.6, 1.46, glass, { ao: 0 });
      b.box(-0.2, 1.36, 0, 2.2, 0.48, 1.5, glass, { ao: 0 });
      b.box(1.71, 0.7, 0.5, 0.05, 0.16, 0.3, '#fff3c0', { ao: 0 });
      b.box(1.71, 0.7, -0.5, 0.05, 0.16, 0.3, '#fff3c0', { ao: 0 });
      b.box(-1.71, 0.9, 0.55, 0.05, 0.3, 0.16, '#e8402a', { ao: 0 });
      b.box(-1.71, 0.9, -0.55, 0.05, 0.3, 0.16, '#e8402a', { ao: 0 });
      for (const x of [-1.15, 1.15]) for (const z of [-0.68, 0.68]) wheel(x, z, 0.3);
      break;
    }
    case 'bus': {
      b.box(0, 1.55, 0, 6.6, 2.3, 2.3, body, { ao: 0.2 });
      for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) b.box(k * 1.1, 1.95, s * 1.16, 0.9, 0.8, 0.06, glass, { ao: 0 });
      b.box(3.32, 1.95, 0, 0.06, 0.9, 2.0, glass, { ao: 0 });
      for (const x of [-2.2, 2.2]) for (const z of [-1.0, 1.0]) wheel(x, z, 0.42);
      break;
    }
  }
  return b;
}

/** Where a vehicle's lamps are, on its front and back faces (it faces +x): [x, y, z, height, width]. */
export const LAMPS: Record<VehicleKind, { head: [number, number, number, number, number][]; tail: [number, number, number, number, number][] }> = {
  car: { head: [[2.085, 0.62, 0.55, 0.14, 0.34], [2.085, 0.62, -0.55, 0.14, 0.34]], tail: [[-2.085, 0.66, 0.55, 0.14, 0.34], [-2.085, 0.66, -0.55, 0.14, 0.34]] },
  van: { head: [[2.285, 0.7, 0.6, 0.16, 0.36], [2.285, 0.7, -0.6, 0.16, 0.36]], tail: [[-2.285, 0.9, 0.6, 0.2, 0.3], [-2.285, 0.9, -0.6, 0.2, 0.3]] },
  kei: { head: [[1.685, 0.7, 0.5, 0.14, 0.3], [1.685, 0.7, -0.5, 0.14, 0.3]], tail: [[-1.965, 0.8, 0.52, 0.14, 0.2], [-1.965, 0.8, -0.52, 0.14, 0.2]] },
  truck: { head: [[2.945, 0.7, 0.62, 0.16, 0.36], [2.945, 0.7, -0.62, 0.16, 0.36]], tail: [[-2.805, 0.8, 0.8, 0.22, 0.24], [-2.805, 0.8, -0.8, 0.22, 0.24]] },
  keivan: { head: [[1.735, 0.7, 0.5, 0.16, 0.3], [1.735, 0.7, -0.5, 0.16, 0.3]], tail: [[-1.735, 0.9, 0.55, 0.3, 0.16], [-1.735, 0.9, -0.55, 0.3, 0.16]] },
  bus: { head: [[3.31, 0.78, 0.85, 0.18, 0.4], [3.31, 0.78, -0.85, 0.18, 0.4]], tail: [[-3.31, 0.85, 0.95, 0.26, 0.2], [-3.31, 0.85, -0.95, 0.26, 0.2]] },
};

/** The glowing faces of a vehicle's head or tail lamps, just proud of the body. */
export function vehicleLamps(kind: VehicleKind, which: 'head' | 'tail'): GeoBuilder {
  const b = new GeoBuilder();
  for (const [x, y, z, h, w] of LAMPS[kind][which]) b.box(x + Math.sign(x) * 0.02, y, z, 0.03, h, w, which === 'head' ? '#fff4d6' : '#ff2414', { ao: 0 });
  return b;
}
