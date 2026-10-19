import { describe, expect, it } from 'vitest';
import { HALF, MOUNTAIN, PADDY, PLACES, POND, RAMPS, SHRINE, TERRACES, WATER_Y, forestDensity, getRoad, getRoads, heightAt, inTown, paddyY, placeAt, roadNear } from '../src/world/config';
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

  it('builds the town on terraces that step down the hill, joined by ramps', () => {
    expect(TERRACES[0].y).toBeGreaterThan(TERRACES[1].y);
    expect(TERRACES[1].y).toBeGreaterThan(TERRACES[2].y);
    for (const t of TERRACES) for (const x of [-100, -40, 30, 90]) expect(heightAt(x, (t.z0 + t.z1) / 2)).toBe(t.y);
    // a ramp street climbs smoothly between two terraces
    for (const r of RAMPS) for (let z = r.z0; z < r.z1; z += 0.5) expect(Math.abs(heightAt(0, z + 0.5) - heightAt(0, z))).toBeLessThan(0.15);
    expect(inTown(0, 44)).toBe(true);
    expect(inTown(0, 140)).toBe(false);
  });

  it('steps the paddies down the slope', () => {
    for (let k = 1; k < PADDY.rows; k++) expect(paddyY(k)).toBeLessThan(paddyY(k - 1));
  });

  it('has a tall mountain behind the village, a pond below the water line and a shrine terrace', () => {
    expect(heightAt(MOUNTAIN.x, MOUNTAIN.z)).toBeGreaterThan(120);
    expect(heightAt(POND.x, POND.z)).toBeLessThan(WATER_Y - 1.5);
    expect(heightAt(SHRINE.x, SHRINE.z)).toBeCloseTo(SHRINE.height, 0);
    expect(heightAt(PADDY.x, PADDY.z)).toBeLessThan(TERRACES[2].y);
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
    expect(roads.map((r) => r.name)).toEqual(['main', 'cross', 'back north', 'back south', 'west lane', 'east lane', 'frontage', 'shrine path']);
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
