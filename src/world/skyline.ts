import { HALF } from './config';

/** A coarse map of how high the buildings stand, so the drone camera can fly above them instead of through them. */
const CELL = 6;
const N = Math.ceil((HALF * 2) / CELL) + 1;
const tops = new Float32Array(N * N);

const idx = (v: number) => Math.min(N - 1, Math.max(0, Math.floor((v + HALF) / CELL)));

export function raiseSkyline(x0: number, z0: number, x1: number, z1: number, top: number) {
  for (let j = idx(z0); j <= idx(z1); j++) for (let i = idx(x0); i <= idx(x1); i++) if (tops[j * N + i] < top) tops[j * N + i] = top;
}

/** The highest roof within `r` metres of a point (0 when there is none). */
export function skylineAround(x: number, z: number, r = 10): number {
  let m = 0;
  for (let j = idx(z - r); j <= idx(z + r); j++) for (let i = idx(x - r); i <= idx(x + r); i++) m = Math.max(m, tops[j * N + i]);
  return m;
}
