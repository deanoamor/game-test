import { Box3, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHRINE } from './config';
import { raiseSkyline } from './skyline';

export const SHRINE_SCALE = 0.82;

const url = (f: string) => `${import.meta.env.BASE_URL}places/${f}.glb`;

/** A single-file build can carry the models inside the page (window.__GLB, base64) instead of fetching them. */
const embedded = (): Record<string, string> | undefined => (window as unknown as { __GLB?: Record<string, string> }).__GLB;
const decode = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

/** Colours that should glow at night (lanterns). */
const GLOW = ['#ffe39a', '#ffe58a', '#ffb85a', '#ffcf7a'].map((c) => new Color(c));

/** Merge every mesh of a loaded model into one mesh per colour: hundreds of parts become a few draw calls. */
function mergeStatic(root: Group, glow: MeshStandardMaterial[], skip: string[] = []): Group {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { geos: BufferGeometry[]; color: Color; opacity: number }>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || skip.includes(m.name)) return;
    const mat = m.material as Material & { color?: Color; opacity?: number };
    const color = mat.color ? mat.color.clone() : new Color('#cccccc');
    const key = color.getHexString() + (mat.opacity ?? 1).toFixed(2);
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    let e = groups.get(key);
    if (!e) groups.set(key, (e = { geos: [], color, opacity: mat.opacity ?? 1 }));
    e.geos.push(g);
  });
  const out = new Group();
  for (const [key, e] of groups) {
    const geo = mergeGeometries(e.geos);
    if (!geo) continue;
    const mat = new MeshStandardMaterial({ color: e.color, roughness: 0.85, metalness: 0.02, transparent: e.opacity < 1, opacity: e.opacity });
    if (GLOW.some((c) => Math.abs(c.r - e.color.r) + Math.abs(c.g - e.color.g) + Math.abs(c.b - e.color.b) < 0.04)) {
      mat.emissive = e.color.clone();
      mat.emissiveIntensity = 0;
      glow.push(mat);
    }
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Landmark ${key}`;
    out.add(mesh);
  }
  return out;
}

export interface LoadedLandmarks { group: Group; glow: MeshStandardMaterial[] }

/** The shrine on its mountain terrace (the model from assets/core/places, without its lawn). */
export async function loadLandmarks(progress?: (n: number, total: number, name: string) => void): Promise<LoadedLandmarks> {
  const loader = new GLTFLoader();
  const group = new Group();
  group.name = 'Landmarks';
  const glow: MeshStandardMaterial[] = [];
  const file = 'japanshrine';
  const inline = embedded()?.[file];
  const gltf = inline ? await loader.parseAsync(decode(inline), '') : await loader.loadAsync(url(file));
  const merged = mergeStatic(gltf.scene, glow, ['Ground']);
  merged.name = file;
  const holder = new Group();
  holder.add(merged);
  holder.scale.setScalar(SHRINE_SCALE);
  // the middle of the model (hall to gate) sits on the middle of the terrace, and it faces the village (+Z)
  holder.position.set(SHRINE.x, SHRINE.height - 0.02, SHRINE.z - 12 * SHRINE_SCALE);
  group.add(holder);
  holder.updateMatrixWorld(true);
  const fp = new Box3().setFromObject(holder);
  raiseSkyline(fp.min.x, fp.min.z, fp.max.x, fp.max.z, fp.max.y);
  void Vector3;
  progress?.(1, 1, file);
  return { group, glow };
}
