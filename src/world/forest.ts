import { BufferGeometry, Color, Euler, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder, toRgb } from '../util/builder';
import { rng, smoothstep } from '../util/rng';
import { HALF, SHRINE, cityDist, forestDensity, heightAt, mountainMask, roadNear, slopeAt } from './config';

export type TreeKind = 'cedar' | 'pine' | 'round' | 'sakura' | 'maple' | 'ginkgo';

/** A lumpy low-poly blob (an icosphere with flat faces) as coloured geometry. */
function blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: string, detail = 1, jitter = 0.12, seed = 1): BufferGeometry {
  const g = new IcosahedronGeometry(1, detail).toNonIndexed();
  g.deleteAttribute('uv');
  const r = rng(seed);
  const p = g.getAttribute('position');
  const cache = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!cache.has(key)) cache.set(key, 1 + (r() - 0.5) * 2 * jitter);
    const k = cache.get(key)!;
    p.setXYZ(i, cx + p.getX(i) * rx * k, cy + p.getY(i) * ry * k, cz + p.getZ(i) * rz * k);
  }
  g.computeVertexNormals();
  const [cr, cg, cb] = toRgb(color);
  const n = p.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // lighter on top, darker underneath: soft baked shading
    const t = 0.78 + 0.34 * smoothstep(cy - ry, cy + ry, p.getY(i));
    col[i * 3] = cr * t; col[i * 3 + 1] = cg * t; col[i * 3 + 2] = cb * t;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

const fromBuilder = (b: GeoBuilder) => b.toGeometry();

function geoFor(kind: TreeKind): BufferGeometry {
  const b = new GeoBuilder();
  const trunk = '#6b4a32';
  switch (kind) {
    case 'cedar': {
      b.frustum(0, 0, 0, 0.42, 0.28, 3.2, 6, trunk);
      b.frustum(0, 1.6, 0, 3.0, 0, 6.2, 8, '#2f6b3a', { rotate: 0.3 });
      b.frustum(0, 4.4, 0, 2.4, 0, 5.4, 8, '#377a42', { rotate: 0.6 });
      b.frustum(0, 7.0, 0, 1.7, 0, 4.8, 8, '#418a4a', { rotate: 0.1 });
      return fromBuilder(b);
    }
    case 'pine': {
      b.frustum(0, 0, 0, 0.3, 0.2, 3.5, 5, trunk);
      for (let i = 0; i < 4; i++) b.frustum(0, 2.0 + i * 2.6, 0, 2.2 - i * 0.4, 0, 4.0 - i * 0.3, 7, ['#2a5f3a', '#316a40', '#3a7848', '#448852'][i], { rotate: i * 0.5 });
      return fromBuilder(b);
    }
    case 'round': {
      b.frustum(0, 0, 0, 0.4, 0.28, 3.4, 6, trunk);
      return mergeGeometries([fromBuilder(b), blob(0, 4.6, 0, 3.0, 2.6, 3.0, '#5ea84a', 1, 0.14, 2), blob(0.9, 5.7, 0.4, 2.0, 1.7, 2.0, '#74bb55', 1, 0.14, 3)])!;
    }
    case 'ginkgo': {
      b.frustum(0, 0, 0, 0.35, 0.25, 3.6, 6, trunk);
      return mergeGeometries([fromBuilder(b), blob(0, 5.4, 0, 2.2, 3.4, 2.2, '#e3b62f', 1, 0.14, 4), blob(0.5, 6.6, 0.2, 1.5, 2.0, 1.5, '#f0cc4a', 1, 0.14, 5)])!;
    }
    case 'sakura': {
      b.frustum(0, 0, 0, 0.42, 0.28, 3.0, 6, '#5a4036');
      b.box(0.8, 3.2, 0, 1.6, 0.25, 0.3, '#5a4036', { yaw: 25 });
      return mergeGeometries([fromBuilder(b), blob(0, 4.7, 0, 3.4, 2.5, 3.4, '#f3a9c2', 1, 0.15, 6), blob(1.6, 4.1, 0.6, 2.2, 1.7, 2.2, '#f7bfd2', 1, 0.15, 7), blob(-1.3, 4.5, -0.5, 2.1, 1.7, 2.1, '#ee9bb8', 1, 0.15, 8)])!;
    }
    case 'maple': {
      b.frustum(0, 0, 0, 0.38, 0.26, 3.0, 6, '#5a4036');
      return mergeGeometries([fromBuilder(b), blob(0, 4.4, 0, 3.0, 2.4, 3.0, '#d44a2c', 1, 0.15, 9), blob(0.8, 5.5, 0.3, 1.9, 1.6, 1.9, '#e8702f', 1, 0.15, 10), blob(-1.0, 4.0, -0.4, 1.8, 1.4, 1.8, '#c23a30', 1, 0.15, 11)])!;
    }
  }
}

/** Collects tree positions by kind and turns them into instanced meshes (a few draw calls for thousands of trees). */
export class TreeField {
  private list = new Map<TreeKind, { m: Matrix4; c: Color }[]>();
  count = 0;
  private r = rng(4242);

  add(kind: TreeKind, x: number, z: number, scale = 1, y?: number) {
    const q = new Quaternion().setFromEuler(new Euler(0, this.r() * Math.PI * 2, 0));
    const m = new Matrix4().compose(new Vector3(x, y ?? heightAt(x, z) - 0.25, z), q, new Vector3(scale * (0.92 + this.r() * 0.16), scale, scale * (0.92 + this.r() * 0.16)));
    const k = 0.86 + this.r() * 0.26;
    const c = new Color(k * (0.97 + this.r() * 0.06), k, k * (0.96 + this.r() * 0.08));
    let a = this.list.get(kind);
    if (!a) this.list.set(kind, (a = []));
    a.push({ m, c });
    this.count++;
  }

  build(windUniform: { value: number }): Group {
    const g = new Group();
    g.name = 'Trees';
    for (const [kind, items] of this.list) {
      const geo = geoFor(kind);
      const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
      mat.onBeforeCompile = (s) => {
        s.uniforms.uWind = windUniform;
        s.vertexShader = s.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
              float sway = sin(uWind * 1.4 + instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05) * 0.14 * pow(max(position.y, 0.0) / 9.0, 2.0);
              transformed.x += sway; transformed.z += sway * 0.6;
            #endif`);
      };
      const mesh = new InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.name = `Trees ${kind}`;
      g.add(mesh);
    }
    return g;
  }
}

/** Scatter trees over the whole map by forest density, and rocks on the steep mountain sides. */
export function growForest(field: TreeField): { rocks: Group } {
  const r = rng(1337);
  const step = 6.5;
  for (let gz = -HALF + 10; gz < HALF - 10; gz += step) {
    for (let gx = -HALF + 10; gx < HALF - 10; gx += step) {
      const x = gx + (r() - 0.5) * step * 0.9;
      const z = gz + (r() - 0.5) * step * 0.9;
      const h = heightAt(x, z);
      const d = forestDensity(x, z, h);
      if (d <= 0.02 || r() > d * 0.9) continue;
      if (slopeAt(x, z, 2) > 1.25) continue;
      const rn = roadNear(x, z);
      if (rn.d < rn.width * 0.5 + 6) continue;
      const mt = mountainMask(x, z);
      const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z);
      const t = r();
      let kind: TreeKind;
      if (h > 120) kind = t < 0.85 ? 'pine' : 'cedar';
      else if (ds < 160) kind = t < 0.42 ? 'cedar' : t < 0.62 ? 'maple' : t < 0.78 ? 'ginkgo' : t < 0.9 ? 'round' : 'sakura';
      else if (mt > 0.3) kind = t < 0.6 ? 'cedar' : t < 0.78 ? 'pine' : 'round';
      else kind = t < 0.42 ? 'cedar' : t < 0.7 ? 'round' : t < 0.82 ? 'sakura' : t < 0.92 ? 'ginkgo' : 'pine';
      const scale = (kind === 'pine' || kind === 'cedar' ? 0.9 + r() * 0.7 : 0.8 + r() * 0.55) * (1 + mt * 0.15);
      field.add(kind, x, z, scale, h - 0.3);
    }
  }
  // rocks on steep ground
  const rockGeo = new IcosahedronGeometry(1, 0).toNonIndexed();
  rockGeo.deleteAttribute('uv');
  rockGeo.computeVertexNormals();
  const rocks: Matrix4[] = [];
  const colors: Color[] = [];
  for (let i = 0; i < 9000 && rocks.length < 900; i++) {
    const x = (r() * 2 - 1) * (HALF - 20);
    const z = (r() * 2 - 1) * (HALF - 20) - 60;
    if (z > 380 || cityDist(x, z) < 10) continue;
    const h = heightAt(x, z);
    if (h < 8 || slopeAt(x, z, 3) < 0.5) continue;
    const s = 1 + r() * 4.5;
    rocks.push(new Matrix4().compose(new Vector3(x, h + s * 0.15, z), new Quaternion().setFromEuler(new Euler(r() * 3, r() * 6, r() * 3)), new Vector3(s * (0.8 + r() * 0.6), s * (0.6 + r() * 0.5), s * (0.8 + r() * 0.6))));
    const k = 0.7 + r() * 0.35;
    colors.push(new Color(k, k * 0.97, k * 0.92));
  }
  const rockMesh = new InstancedMesh(rockGeo, new MeshStandardMaterial({ color: '#9a948a', roughness: 1, flatShading: true }), rocks.length);
  rocks.forEach((m, i) => { rockMesh.setMatrixAt(i, m); rockMesh.setColorAt(i, colors[i]); });
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  rockMesh.name = 'Rocks';
  const g = new Group();
  g.add(rockMesh);
  return { rocks: g };
}
