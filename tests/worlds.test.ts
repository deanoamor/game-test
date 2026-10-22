import { describe, expect, it } from 'vitest';
import { WORLDS } from '../src/worlds';
import { HOME, buildHome } from '../src/worlds/home/interior';

describe('the worlds', () => {
  it('have their own keys, and every exit that leads on leads to a world that exists', () => {
    const keys = WORLDS.map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const w of WORLDS) for (const e of w.exits) if (e.to) expect(keys).toContain(e.to);
  });

  it('give the way in and the way out of the home: a door each', () => {
    const ekimae = WORLDS.find((w) => w.key === 'ekimae')!, home = WORLDS.find((w) => w.key === 'home')!;
    expect(ekimae.exits.some((e) => e.to === 'home' && e.door)).toBe(true);
    expect(home.exits.some((e) => e.to === 'ekimae' && e.door)).toBe(true);
    // she comes out of the door onto the stairs, and arrives in the home in its entrance
    expect(ekimae.spawns?.home).toBeDefined();
    expect(home.player!.x).toBeLessThan(-2.2);
    expect(home.player!.z).toBeLessThan(-2.7);
  });
});

describe('the home', () => {
  const h = buildHome();
  const box = (s: (typeof h.solids)[number]) => (s.t === 'box' ? s : null);

  it('has walls all round, and nothing of the furniture stands in the entrance doorway or the way in', () => {
    const w = (x: number, z: number) => h.solids.some((s) => { const b = box(s); return b && Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd; });
    // the four outer walls
    for (const [x, z] of [[0, HOME.Z0 - 0.1], [0, HOME.Z1 + 0.1], [HOME.X0 - 0.1, 0], [HOME.X1 + 0.1, 0]]) expect(w(x, z)).toBe(true);
    // where she arrives, and the way from there into the hall
    for (const [x, z] of [[-3.1, -3], [-3.1, -2.2], [-3.1, -1.5]]) expect(w(x, z)).toBe(false);
  });

  it('has the entrance a step lower than the rooms', () => {
    expect(h.floor(-3.1, -3.6)).toBe(0);
    expect(h.floor(0, 0)).toBeCloseTo(HOME.FLOOR);
    expect(Math.abs(h.floor(0, 0) - h.floor(-3.1, -3.6))).toBeLessThan(0.32); // a step she can take
  });
});
