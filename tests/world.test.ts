import { describe, expect, it } from 'vitest';
import { HALF, MOUNTAIN, PADDY, PLACES, POND, SHRINE, VILLAGE, WATER_Y, forestDensity, getRoad, getRoads, heightAt, placeAt, roadNear, villageDist } from '../src/world/config';
import { fbm, noise2 } from '../src/util/noise';
import { rng } from '../src/util/rng';

describe('the shape of the world', () => {
  it('is deterministic: the same point always has the same height', () => {
    for (const [x, z] of [[0, 0], [123.4, -88.8], [-140, 100], [66, -78]]) expect(heightAt(x, z)).toBe(heightAt(x, z));
    expect(noise2(1.3, 4.7)).toBe(noise2(1.3, 4.7));
    expect(rng(5)()).toBe(rng(5)());
  });

  it('keeps noise in a sane range', () => {
    for (let i = 0; i < 400; i++) {
      const v = fbm(i * 0.37, i * 0.11, 4);
      expect(v).toBeGreaterThan(-1.3);
      expect(v).toBeLessThan(1.3);
    }
  });

  it('has flat ground for the village', () => {
    for (let i = 0; i < 40; i++) {
      const x = VILLAGE.cx + Math.sin(i * 12.9) * (VILLAGE.hx - 30);
      const z = VILLAGE.cz + Math.cos(i * 7.3) * (VILLAGE.hz - 30);
      expect(villageDist(x, z)).toBeLessThan(0);
      if (roadNear(x, z).d > 14 && Math.hypot(x - POND.x, z - POND.z) > POND.radius + 25 && Math.max(Math.abs(x - PADDY.x) - PADDY.hx, Math.abs(z - PADDY.z) - PADDY.hz) > 8) expect(Math.abs(heightAt(x, z) - VILLAGE.height)).toBeLessThan(0.3);
    }
  });

  it('has a tall mountain behind the village, a pond below the water line and a shrine terrace', () => {
    expect(heightAt(MOUNTAIN.x, MOUNTAIN.z)).toBeGreaterThan(120);
    expect(heightAt(POND.x, POND.z)).toBeLessThan(WATER_Y - 1.5);
    expect(heightAt(SHRINE.x, SHRINE.z)).toBeCloseTo(SHRINE.height, 0);
    expect(heightAt(PADDY.x, PADDY.z)).toBeLessThan(VILLAGE.height);
  });

  it('keeps every place on the map and names it', () => {
    for (const p of PLACES) {
      expect(Math.abs(p.x)).toBeLessThan(HALF);
      expect(Math.abs(p.z)).toBeLessThan(HALF);
      expect(placeAt(p.x, p.z).key).toBe(p.key);
    }
  });

  it('cuts the roads into the ground and joins them to the main street', () => {
    const roads = getRoads();
    expect(roads.map((r) => r.name)).toEqual(['main', 'cross', 'back north', 'back south', 'west lane', 'east lane', 'shrine path']);
    for (const r of roads) {
      for (let i = 0; i < r.len; i += 5) {
        expect(roadNear(r.x[i], r.z[i]).d).toBeLessThan(0.5);
        expect(Math.abs(heightAt(r.x[i], r.z[i]) - (r.y[i] - 0.06))).toBeLessThan(0.6);
      }
      for (let i = 1; i < r.len; i++) expect(Math.abs(r.y[i] - r.y[i - 1])).toBeLessThan(1.2);
    }
    // every street meets another one somewhere
    for (const r of roads) {
      let best = Infinity;
      for (const o of roads) {
        if (o === r) continue;
        for (let i = 0; i < r.len; i += 2) for (let j = 0; j < o.len; j += 2) best = Math.min(best, Math.hypot(r.x[i] - o.x[j], r.z[i] - o.z[j]));
      }
      expect(best).toBeLessThan(2.5);
    }
    // the shrine path ends by the shrine
    const n = getRoad('shrine path');
    expect(Math.hypot(n.x[n.len - 1] - SHRINE.x, n.z[n.len - 1] - SHRINE.z)).toBeLessThan(SHRINE.radius + 2);
  });

  it('grows no forest in the village, on the pond or on the paddies', () => {
    expect(forestDensity(0, 60)).toBe(0);
    expect(forestDensity(POND.x, POND.z)).toBe(0);
    expect(forestDensity(PADDY.x, PADDY.z)).toBe(0);
    expect(forestDensity(20, -90)).toBeGreaterThan(0);
  });
});
