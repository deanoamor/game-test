import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { smoothstep } from '../util/rng';
import { HALF, WATER_Y, heightAt } from './config';

export interface Water {
  mesh: Mesh;
  uniforms: { uTime: { value: number } };
}

/** The lake and the sea: one flat-shaded sheet whose colour deepens with the depth of the ground below it. */
export function buildWater(): Water {
  const seg = 200;
  const step = (HALF * 2) / seg;
  const pos: number[] = [];
  const col: number[] = [];
  const shallow = new Color('#86dcd6');
  const mid = new Color('#3fb0cc');
  const deep = new Color('#1f6e9c');
  const c = new Color();
  const depthAt = (x: number, z: number) => WATER_Y - heightAt(x, z);
  const colorAt = (x: number, z: number) => {
    const d = depthAt(x, z);
    c.copy(shallow).lerp(mid, smoothstep(0, 3, d)).lerp(deep, smoothstep(3, 10, d));
    return c;
  };
  // only the cells that actually have water under them
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const x0 = -HALF + i * step, z0 = -HALF + j * step, x1 = x0 + step, z1 = z0 + step;
      if (depthAt(x0, z0) < -2 && depthAt(x1, z0) < -2 && depthAt(x0, z1) < -2 && depthAt(x1, z1) < -2) continue;
      const cc = colorAt((x0 + x1) / 2, (z0 + z1) / 2);
      for (const p of [[x0, z0], [x0, z1], [x1, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        pos.push(p[0], WATER_Y, p[1]);
        col.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const uniforms = { uTime: { value: 0 } };
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.88, flatShading: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uniforms.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += sin(position.x * 0.31 + uTime * 1.3) * 0.12 + sin(position.z * 0.27 - uTime * 1.1) * 0.1 + sin((position.x + position.z) * 0.13 + uTime * 0.7) * 0.18;`);
  };
  const mesh = new Mesh(g, mat);
  mesh.name = 'Water';
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}
