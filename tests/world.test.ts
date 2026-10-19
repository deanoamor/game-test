import { describe, expect, it } from 'vitest';
import { CITY, FUJI, HALF, LAKE, PLACES, SEA_Z, SHRINE, VILLAGE, WATER_Y, blockAt, cityDist, forestDensity, getRoads, heightAt, placeAt, roadNear } from '../src/world/config';
import { fbm, noise2 } from '../src/util/noise';
import { rng } from '../src/util/rng';

describe('the shape of the world', () => {
  it('is deterministic: the same point always has the same height', () => {
    for (const [x, z] of [[0, 0], [123.4, -88.8], [-400, 300], [250, -230]]) expect(heightAt(x, z)).toBe(heightAt(x, z));
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

  it('has a flat city at its own level', () => {
    for (let i = 0; i < 40; i++) {
      const x = CITY.cx + (Math.sin(i * 12.9) * 0.5) * (CITY.extent - 80);
      const z = CITY.cz + (Math.cos(i * 7.3) * 0.5) * (CITY.extent - 80);
      expect(cityDist(x, z)).toBeLessThan(0);
      expect(Math.abs(heightAt(x, z) - CITY.height)).toBeLessThan(0.25);
    }
  });

  it('has a tall mountain, a lake below the water line and a sea in the south', () => {
    expect(heightAt(FUJI.x, FUJI.z)).toBeGreaterThan(300);
    expect(heightAt(LAKE.x, LAKE.z)).toBeLessThan(WATER_Y - 4);
    expect(heightAt(0, SEA_Z + 80)).toBeLessThan(WATER_Y - 4);
    expect(heightAt(SHRINE.x, SHRINE.z)).toBeCloseTo(SHRINE.height, 0);
    expect(Math.abs(heightAt(VILLAGE.x, VILLAGE.z) - VILLAGE.height)).toBeLessThan(0.5);
  });

  it('keeps everything the player can reach inside the map', () => {
    for (const p of PLACES) {
      expect(Math.abs(p.x)).toBeLessThan(HALF);
      expect(Math.abs(p.z)).toBeLessThan(HALF);
      expect(placeAt(p.x, p.z).key).toBe(p.key);
    }
  });

  it('carves the roads into the ground and joins them to the city', () => {
    const roads = getRoads();
    expect(roads.map((r) => r.name)).toEqual(['mountain', 'coast', 'promenade', 'west', 'east']);
    for (const r of roads) {
      for (let i = 0; i < r.len; i += 7) {
        const near = roadNear(r.x[i], r.z[i]);
        expect(near.d).toBeLessThan(0.01);
        expect(Math.abs(heightAt(r.x[i], r.z[i]) - (r.y[i] - 0.15))).toBeLessThan(0.5);
      }
      // no sudden jumps along a road
      for (let i = 1; i < r.len; i++) expect(Math.abs(r.y[i] - r.y[i - 1])).toBeLessThan(2.2);
    }
    // the mountain road starts in the city and ends by the shrine
    const m = roads[0];
    expect(cityDist(m.x[0], m.z[0])).toBeLessThan(2);
    expect(Math.hypot(m.x[m.len - 1] - SHRINE.x, m.z[m.len - 1] - SHRINE.z)).toBeLessThan(45);
  });

  it('lays out a grid of blocks that fits the city', () => {
    const [ax, az] = blockAt(0, 0);
    const [bx, bz] = blockAt(CITY.blocks - 1, CITY.blocks - 1);
    expect(Math.abs(ax - CITY.cx) + Math.abs(az - CITY.cz)).toBeGreaterThan(0);
    expect(bx - ax).toBeCloseTo((CITY.blocks - 1) * CITY.pitch, 5);
    expect(bz - az).toBeCloseTo((CITY.blocks - 1) * CITY.pitch, 5);
    expect(CITY.extent).toBe(CITY.blocks * CITY.pitch + CITY.street);
  });

  it('grows no forest in the city, the lake or the sea', () => {
    expect(forestDensity(CITY.cx, CITY.cz)).toBe(0);
    expect(forestDensity(LAKE.x, LAKE.z)).toBe(0);
    expect(forestDensity(0, SEA_Z + 60)).toBe(0);
  });
});
