import { Group, Mesh, MeshBasicMaterial } from 'three';
import { GeoBuilder } from '../util/builder';

/**
 * The traffic signals at the crossing. The main street and the cross street take turns: green, yellow, then a moment
 * of all-red before the other street's green. The town draws every lamp dark; the lit faces of the lamps are gathered
 * here as the traffic lights are built, and shown or hidden by the cycle. The walk signal on each pole goes with its
 * street's green and blinks while that turns yellow.
 */

export type SignalGroup = 'main' | 'cross';
export type Light = 'green' | 'yellow' | 'red';
export type LampKind = 'green' | 'yellow' | 'red' | 'walkGreen' | 'walkRed';

/** The lit lamp faces, by street and lamp (filled by the town's trafficLight()). */
export const SIGNAL_LAMPS = new Map<string, GeoBuilder>();
export function lampFaces(group: SignalGroup, kind: LampKind): GeoBuilder {
  const key = `${group}:${kind}`;
  let b = SIGNAL_LAMPS.get(key);
  if (!b) SIGNAL_LAMPS.set(key, (b = new GeoBuilder()));
  return b;
}

// the cycle, in seconds
const GREEN: Record<SignalGroup, number> = { main: 16, cross: 10 };
const YELLOW = 3, ALL_RED = 2;
const TOTAL = GREEN.main + YELLOW + ALL_RED + GREEN.cross + YELLOW + ALL_RED;

export class Signals {
  group = new Group();
  private t = 0;
  private lamps: { group: SignalGroup; kind: LampKind; mesh: Mesh }[] = [];

  constructor() {
    this.group.name = 'Signals';
    const mat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (const [key, b] of SIGNAL_LAMPS) {
      const [group, kind] = key.split(':') as [SignalGroup, LampKind];
      const mesh = new Mesh(b.toGeometry(), mat);
      mesh.name = `Signal ${key}`;
      this.group.add(mesh);
      this.lamps.push({ group, kind, mesh });
    }
    this.step(0);
  }

  /** What a street's signal shows now. */
  light(g: SignalGroup): Light {
    const t = this.t % TOTAL;
    const start = g === 'main' ? 0 : GREEN.main + YELLOW + ALL_RED;
    const u = t - start;
    if (u >= 0 && u < GREEN[g]) return 'green';
    if (u >= GREEN[g] && u < GREEN[g] + YELLOW) return 'yellow';
    return 'red';
  }

  step(dt: number) {
    this.t += dt;
    const blink = Math.floor(this.t * 3) % 2 === 0;
    for (const l of this.lamps) {
      const s = this.light(l.group);
      l.mesh.visible =
        l.kind === 'walkGreen' ? s === 'green' || (s === 'yellow' && blink)
        : l.kind === 'walkRed' ? s === 'red'
        : l.kind === s;
    }
  }
}
