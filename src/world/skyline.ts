import { HALF } from './config';

/** A coarse map of how high the buildings stand, so the drone camera can fly above them instead of through them. */
const CELL = 6;
const N = Math.ceil((HALF * 2) / CELL) + 1;
const tops = new Float32Array(N * N);

const idx = (v: number) => Math.min(N - 1, Math.max(0, Math.floor((v + HALF) / CELL)));

export function raiseSkyline(x0: number, z0: number, x1: number, z1: number, top: number) {
  for (let j = idx(z0); j <= idx(z1); j++) for (let i = idx(x0); i <= idx(x1); i++) if (tops[j * N + i] < top) tops[j * N + i] = top;
  smooth = null;
}

/** The highest roof within `r` metres of a point (0 when there is none). */
export function skylineAround(x: number, z: number, r = 10): number {
  let m = 0;
  for (let j = idx(z - r); j <= idx(z + r); j++) for (let i = idx(x - r); i <= idx(x + r); i++) m = Math.max(m, tops[j * N + i]);
  return m;
}

// a smooth version of the map for the camera to ride on: every roof spread over the cells around it, softened twice,
// read with bilinear filtering, so the height it gives changes gently as the camera moves instead of in steps
let smooth: Float32Array | null = null;
function smoothField(): Float32Array {
  if (smooth) return smooth;
  const at = (a: Float32Array, i: number, j: number) => a[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  let f = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let m = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (di * di + dj * dj <= 2) m = Math.max(m, at(tops, i + di, j + dj));
    f[j * N + i] = m;
  }
  for (let pass = 0; pass < 2; pass++) {
    const g = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += at(f, i + di, j + dj) * (di ? 1 : 2) * (dj ? 1 : 2);
      g[j * N + i] = s / 16;
    }
    f = g;
  }
  return (smooth = f);
}

/** The roofs around a point, smoothed out (for the camera to fly over without jolts). */
export function skylineSmooth(x: number, z: number): number {
  const f = smoothField();
  const u = Math.min(N - 1.001, Math.max(0, (x + HALF) / CELL - 0.5)), v = Math.min(N - 1.001, Math.max(0, (z + HALF) / CELL - 0.5));
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const p = (ii: number, jj: number) => f[Math.min(N - 1, jj) * N + Math.min(N - 1, ii)];
  return (p(i, j) * (1 - a) + p(i + 1, j) * a) * (1 - b) + (p(i, j + 1) * (1 - a) + p(i + 1, j + 1) * a) * b;
}
