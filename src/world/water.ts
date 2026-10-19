import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { smoothstep } from '../util/rng';
import { POND, WATER_Y, heightAt } from './config';

export interface Water {
  mesh: Mesh;
  uniforms: { uTime: { value: number } };
}

/** The koi pond: a flat-shaded sheet whose colour deepens with the depth of the ground below it. */
export function buildWater(): Water {
  const R = POND.radius + 12;
  const step = 0.8;
  const pos: number[] = [];
  const col: number[] = [];
  const shallow = new Color('#9fe0d6');
  const mid = new Color('#4fb9c6');
  const deep = new Color('#25799c');
  const c = new Color();
  const depthAt = (x: number, z: number) => WATER_Y - heightAt(x, z);
  for (let z = POND.z - R; z < POND.z + R; z += step) {
    for (let x = POND.x - R; x < POND.x + R; x += step) {
      if (depthAt(x, z) < 0 && depthAt(x + step, z) < 0 && depthAt(x, z + step) < 0 && depthAt(x + step, z + step) < 0) continue;
      const d = depthAt(x + step / 2, z + step / 2);
      c.copy(shallow).lerp(mid, smoothstep(0, 1.2, d)).lerp(deep, smoothstep(1.2, 3.2, d));
      for (const p of [[x, z], [x, z + step], [x + step, z], [x + step, z], [x, z + step], [x + step, z + step]]) {
        pos.push(p[0], WATER_Y, p[1]);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const uniforms = { uTime: { value: 0 } };
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.9, flatShading: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = uniforms.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += sin(position.x * 0.9 + uTime * 1.3) * 0.025 + sin(position.z * 0.8 - uTime * 1.1) * 0.02;`);
  };
  const mesh = new Mesh(g, mat);
  mesh.name = 'Water';
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}
