import { Box3, BufferGeometry, Color, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, SHRINE, BLOCK_USE, blockAt } from './config';
import { raiseSkyline } from './skyline';

export const SHRINE_SCALE = 1.8;

export interface Landmark {
  /** names of parts to leave out */
  skip?: string[];
  file: string;
  /** where to put it: the middle of a city block (fitted to it) or an exact spot (origin of the model) */
  block?: [number, number];
  at?: [number, number, number];
  fit?: number; // the longest side it may have
  scale?: number;
  yaw?: number;
}

const url = (f: string) => `${import.meta.env.BASE_URL}places/${f}.glb`;

/** A single-file build can carry the models inside the page (window.__GLB, base64) instead of fetching them. */
const embedded = (): Record<string, string> | undefined => (window as unknown as { __GLB?: Record<string, string> }).__GLB;
const decode = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const G = CITY.height + 0.18;

export const LANDMARKS: Landmark[] = [
  { file: 'danchi', block: BLOCK_USE.danchi, fit: 50 },
  { file: 'japanschool', block: BLOCK_USE.school, fit: 51 },
  { file: 'japanalley', block: BLOCK_USE.alley, fit: 46 },
  { file: 'catstall', block: BLOCK_USE.park, scale: 1.7 },
  { file: 'japanshrine', at: [SHRINE.x, SHRINE.height - 0.02, SHRINE.z - 12 * SHRINE_SCALE], scale: SHRINE_SCALE, skip: ['Ground'] },
];

/** Colours that should glow at night (lit windows, lanterns). */
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

export async function loadLandmarks(progress?: (n: number, total: number, name: string) => void): Promise<LoadedLandmarks> {
  const loader = new GLTFLoader();
  const group = new Group();
  group.name = 'Landmarks';
  const glow: MeshStandardMaterial[] = [];
  let n = 0;
  await Promise.all(LANDMARKS.map(async (l) => {
    const inline = embedded()?.[l.file];
    const gltf = inline ? await loader.parseAsync(decode(inline), '') : await loader.loadAsync(url(l.file));
    const merged = mergeStatic(gltf.scene, glow, l.skip);
    merged.name = l.file;
    const box = new Box3().setFromObject(merged);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    let s = l.scale ?? 1;
    if (l.fit) s = Math.min(1.3, l.fit / Math.max(size.x, size.z));
    const holder = new Group();
    holder.add(merged);
    if (l.block) {
      const [bx, bz] = blockAt(...l.block);
      // centre the model on the block and stand it on the sidewalk plate
      merged.position.set(-centre.x, -box.min.y, -centre.z);
      holder.scale.setScalar(s);
      holder.position.set(bx, G, bz);
    } else if (l.at) {
      holder.scale.setScalar(s);
      holder.position.set(l.at[0], l.at[1], l.at[2]);
    }
    if (l.yaw) holder.rotation.y = (l.yaw * Math.PI) / 180;
    group.add(holder);
    holder.updateMatrixWorld(true);
    const fp = new Box3().setFromObject(holder);
    raiseSkyline(fp.min.x, fp.min.z, fp.max.x, fp.max.z, fp.max.y);
    progress?.(++n, LANDMARKS.length, l.file);
  }));
  void Matrix4;
  return { group, glow };
}
