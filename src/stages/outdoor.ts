import { Box3, Group, type Mesh, type Scene } from 'three';
import { POND, SHRINE } from '../world/config';
import { TreeField, growForest } from '../world/forest';
import { loadLandmarks } from '../world/landmarks';
import { NightGlow } from '../world/nightglow';
import { buildRoads } from '../world/roads';
import { Signals } from '../world/signals';
import { SignAtlas } from '../world/signs';
import { buildTerrain } from '../world/terrain';
import { Traffic } from '../world/traffic';
import { buildVillage } from '../world/village';
import { buildWater } from '../world/water';
import { WORLDS, inRect } from '../worlds';
import type { Rect, WorldDef } from '../worlds/types';
import type { Stage } from './stage';

/**
 * The town: the land, the forests, the village and its streets, the traffic and its signals, the landmarks. A zone
 * (a world with a `keep` area) draws only that area and a ring of scenery round it in detail.
 */
export async function buildOutdoor(o: { scene: Scene; world: WorldDef; keep: Rect | null; progress: (f: number, msg: string) => void; nextFrame: () => Promise<void> }): Promise<Stage> {
  const { scene, keep, progress, nextFrame } = o;
  progress(0.04, 'Shaping the land…');
  await nextFrame();
  const terrain = buildTerrain();
  scene.add(terrain);
  const water = buildWater();
  scene.add(water.mesh);

  progress(0.22, 'Planting forests…');
  await nextFrame();
  const trees = new TreeField();
  const { rocks } = growForest(trees);
  scene.add(rocks);

  progress(0.4, 'Building the village…');
  await nextFrame();
  const atlas = new SignAtlas();
  // every world's own details go into the town (the full map shows them too)
  const details = WORLDS.flatMap((w) => (w.details ? [w.details] : []));
  const village = await buildVillage(trees, atlas, (f, msg) => progress(0.4 + f * 0.2, msg), details);
  // a zone draws only its own area and the scenery ring in detail: the buildings and props beyond are left out
  // (the town's ground is kept everywhere, so there are no holes); trees reach a little further, the land is all there
  if (keep) {
    const box = new Box3();
    for (const m of [...village.group.children] as Mesh[]) {
      if (m.name.startsWith('Town ground')) continue;
      box.copy(m.geometry.boundingBox!);
      if (box.max.x < keep.x0 || box.min.x > keep.x1 || box.max.z < keep.z0 || box.min.z > keep.z1) {
        village.group.remove(m);
        m.geometry.dispose();
      }
    }
    water.mesh.visible = inRect(keep, POND.x, POND.z, POND.radius + 30);
  }
  scene.add(village.group);
  // the lights of the town at night: pools of light, and real lights near the camera
  const glow = new NightGlow(keep ? village.glows.filter((g) => inRect(keep, g.x, g.z, 10)) : village.glows);
  scene.add(glow.group);
  scene.add(buildRoads());
  const windU = { value: 0 };
  scene.add(trees.build(windU, keep ? (x, z) => inRect(keep, x, z, 90) : undefined));
  // the signals at the crossing, and the traffic that keeps to them
  const signals = new Signals();
  scene.add(signals.group);
  const traffic = new Traffic(signals);
  scene.add(traffic.group);

  progress(0.62, 'Placing landmarks…');
  const marks = !keep || inRect(keep, SHRINE.x, SHRINE.z, 40)
    ? await loadLandmarks((n, total, name) => progress(0.62 + (n / total) * 0.28, `Landmark: ${name}`))
    : { group: new Group(), glow: [] as { emissiveIntensity: number }[] };
  scene.add(marks.group);

  let settled = false; // (the first time of day sets the whole road; after that cars come and go out of sight)
  return {
    obstacles: village.obstacles,
    setNight(night, hour) {
      village.update(night);
      traffic.setHour(hour, !settled);
      settled = true;
      marks.glow.forEach((m) => { m.emissiveIntensity = night * 1.4; });
    },
    step(dt, night, target, _yaw, frozen) {
      traffic.focus = { x: target.x, z: target.z };
      glow.update(dt, night, target);
      windU.value += dt;
      water.uniforms.uTime.value += dt;
      if (!frozen) signals.step(dt);
      traffic.setNight(night);
      traffic.step(frozen ? 0 : dt);
    },
    fogScale: keep ? 1.7 : 1,
    trees: trees.count,
    npcs: [],
    extra: { signals, traffic, terrain },
  };
}
