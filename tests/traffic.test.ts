import { describe, expect, it } from 'vitest';
import { Signals } from '../src/world/signals';
import { Traffic } from '../src/world/traffic';

interface SimCar { lane: { path: { L: number }; group?: string; stop?: number; box?: [number, number] }; s: number; v: number; len: number }

describe('the traffic', () => {
  const signals = new Signals();
  const traffic = new Traffic(signals);
  const cars = (traffic as unknown as { cars: SimCar[] }).cars;
  const inBox = (c: SimCar) => !!c.lane.box && c.s + c.len / 2 > c.lane.box[0] && c.s - c.len / 2 < c.lane.box[1];

  it('never lets a car run into the one ahead, stops on red and keeps the junction to one street at a time', () => {
    const dt = 1 / 30;
    let stoppedAtRed = 0, minGap = Infinity;
    const front = new Map<SimCar, number>();
    for (let f = 0; f < 30 * 600; f++) {
      for (const c of cars) front.set(c, c.s + c.len / 2);
      signals.step(dt);
      traffic.step(dt);
      for (const c of cars) {
        for (const o of cars) {
          if (o === c || o.lane !== c.lane) continue;
          const L = c.lane.path.L;
          const ahead = (((o.s - c.s) % L) + L) % L;
          minGap = Math.min(minGap, ahead - (c.len + o.len) / 2);
        }
        // nobody crosses the stop line on red
        const l = c.lane;
        if (l.group && l.stop !== undefined && signals.light(l.group as 'main' | 'cross') === 'red') {
          const before = front.get(c)!, after = c.s + c.len / 2;
          if (before < l.stop - 0.05 && after > l.stop + 0.05 && after - before < 5) throw new Error(`ran a red light at frame ${f}`);
          if (c.v < 0.01 && Math.abs(l.stop - after) < 1.5) stoppedAtRed++;
        }
      }
      const main = cars.some((c) => c.lane.group === 'main' && inBox(c)), cross = cars.some((c) => c.lane.group === 'cross' && inBox(c));
      expect(main && cross, `both streets in the junction at frame ${f}`).toBe(false);
    }
    expect(minGap).toBeGreaterThan(0.3);
    expect(stoppedAtRed).toBeGreaterThan(0);
    // and the traffic still flows
    expect(cars.filter((c) => c.v > 0.5).length).toBeGreaterThan(cars.length / 3);
  });
});
