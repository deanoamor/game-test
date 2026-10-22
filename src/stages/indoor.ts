import type { Scene } from 'three';
import type { WorldDef } from '../worlds/types';
import type { Stage } from './stage';

/** A world made of rooms: furnished, no town round it. */
export async function buildIndoor(o: { scene: Scene; world: WorldDef; progress: (f: number, msg: string) => void; nextFrame: () => Promise<void> }): Promise<Stage> {
  o.progress(0.3, 'Furnishing the home…');
  await o.nextFrame();
  const home = await o.world.interior!();
  o.scene.add(home.group);
  return {
    obstacles: { solids: home.solids },
    floor: home.floor,
    setNight: (night, hour) => home.update(night, hour),
    step: (dt, _night, _target, cameraYaw) => home.frame(dt, cameraYaw),
    fogScale: 0.2,
    shadowHalf: home.shadowHalf,
    trees: 0,
    npcs: home.npcs ?? [],
    extra: { home },
  };
}
