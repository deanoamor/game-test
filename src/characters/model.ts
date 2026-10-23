import {
  BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, MeshStandardMaterial, SkinnedMesh,
  type Bone, type BufferAttribute, type Material, type Mesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The characters of the game: models from assets/core/characters/<key>.glb, all on the same rig (the same bones, at the
 * same rest pose), loaded, tidied and ready to be animated bone by bone (see ./gait.ts). The player and the NPCs are
 * built from this.
 *
 * The rig: every bone starts unrotated and lined up with the world, the model faces +z (its left is +x).
 */

export type BoneName = 'Hips' | 'Spine' | 'Chest' | 'Neck' | 'Head' | 'Shoulder Left' | 'Elbow Left' | 'Wrist Left' | 'Shoulder Right' | 'Elbow Right' | 'Wrist Right' | 'Hip Left' | 'Knee Left' | 'Ankle Left' | 'Hip Right' | 'Knee Right' | 'Ankle Right';
export const BONES: BoneName[] = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Shoulder Left', 'Elbow Left', 'Wrist Left', 'Shoulder Right', 'Elbow Right', 'Wrist Right', 'Hip Left', 'Knee Left', 'Ankle Left', 'Hip Right', 'Knee Right', 'Ankle Right'];

export interface Character {
  /** The model, to add to the scene (its feet on y = 0, facing +z). */
  root: Group;
  bones: Map<BoneName, Bone>;
  /** The pelvis's height at rest. */
  hipsY: number;
}

/** A single-file build carries the models inside the page (window.__GLB, base64) instead of fetching them. */
async function loadModel(key: string): Promise<Group> {
  const loader = new GLTFLoader();
  const inline = (window as unknown as { __GLB?: Record<string, string> }).__GLB?.[key];
  if (inline) {
    const bin = atob(inline), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // (a single-file build carries them gzipped: the models are mostly repeated floats and shrink to a seventh)
    const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes.buffer;
    return (await loader.parseAsync(raw, '')).scene;
  }
  return (await loader.loadAsync(`${import.meta.env.BASE_URL}characters/${key}.glb`)).scene;
}

/** Load a character: its parts merged into one mesh, its skinning tidied, its bones found. */
export async function loadCharacter(key: string, name = key): Promise<Character> {
  const root = await loadModel(key);
  mergeSkinned(root, name);
  const bones = new Map<BoneName, Bone>();
  root.traverse((o) => {
    // (the loader writes the names with underscores for spaces)
    const b = o.name.replace(/_/g, ' ') as BoneName;
    if ((o as Bone).isBone && BONES.includes(b)) bones.set(b, o as Bone);
    if ((o as Mesh).isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; }
  });
  if (bones.size !== BONES.length) console.warn(`${key}: missing bones`, BONES.filter((b) => !bones.has(b)));
  return { root, bones, hipsY: bones.get('Hips')!.position.y };
}

const ARM = /^(Shoulder|Elbow|Wrist|Fingers) /;
const SHIN = /^(Knee|Ankle|Toe) /;
const THIGH = /^Hip (Left|Right)$/;

/**
 * The model was skinned by distance, so a piece of clothing that hangs near a hand or a knee (the skirt by the hands)
 * picked up some of that bone and was dragged along when the arm swung. Each separate piece (a connected shell of
 * triangles) is checked: a piece that mostly follows the body lets go of the arm bones and the shins altogether, and
 * a piece that hangs from the hips without reaching the shins (the skirt) lets go of the thighs too, so the skirt, the
 * blouse and the collar move with the hips and the chest only; the sleeves, hands and legs keep their bones. Some
 * skirt pleats were bound to an elbow outright, so below the waist nothing but skin (the hands) may follow an arm.
 */
function untangle(g: BufferGeometry, names: string[], color: Color) {
  const pos = g.getAttribute('position') as BufferAttribute, si = g.getAttribute('skinIndex') as BufferAttribute, sw = g.getAttribute('skinWeight') as BufferAttribute;
  if (!si || !sw) return;
  const n = pos.count;
  // weld the corners by position, then join each triangle's corners: the shells fall out as the joined sets
  const id = new Int32Array(n), keys = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let v = keys.get(k);
    if (v === undefined) keys.set(k, (v = keys.size));
    id[i] = v;
  }
  const up = Int32Array.from({ length: keys.size }, (_, i) => i);
  const find = (a: number): number => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
  for (let t = 0; t + 2 < n; t += 3) for (const o of [1, 2]) { const a = find(id[t]), b = find(id[t + o]); if (a !== b) up[a] = b; }
  const WAIST = 0.72; // metres, in the model's rest pose
  // skin is light and warm: some green (red cloth has almost none) but less blue (white cloth has as much): only skin, the
  // hands, may follow an arm below the waist
  const skin = color.r > 0.45 && color.g > color.r * 0.5 && color.b < color.g * 0.85;
  const ysum = new Map<number, number>(), cnt = new Map<number, number>();
  const arm = new Map<number, number>(), shin = new Map<number, number>(), hip = new Map<number, number>(), all = new Map<number, number>();
  const add = (m: Map<number, number>, k: number, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (let i = 0; i < n; i++) {
    const c = find(id[i]);
    add(ysum, c, pos.getY(i));
    add(cnt, c, 1);
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j), name = names[si.getComponent(i, j)] ?? '';
      add(all, c, w);
      if (ARM.test(name)) add(arm, c, w);
      if (SHIN.test(name)) add(shin, c, w);
      if (name === 'Hips') add(hip, c, w);
    }
  }
  const hips = names.indexOf('Hips');
  for (let i = 0; i < n; i++) {
    const c = find(id[i]), total = all.get(c) || 1;
    const shinShare = (shin.get(c) ?? 0) / total;
    const low = (ysum.get(c) ?? 0) / (cnt.get(c) || 1) < WAIST;
    const dropArm = (arm.get(c) ?? 0) / total < 0.5 || (low && !skin), dropShin = shinShare < 0.5;
    const dropThigh = shinShare < 0.15 && (hip.get(c) ?? 0) / total > 0.15;
    let left = 0;
    const w = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      const name = names[si.getComponent(i, j)] ?? '';
      w[j] = (dropArm && ARM.test(name)) || (dropShin && SHIN.test(name)) || (dropThigh && THIGH.test(name)) ? 0 : sw.getComponent(i, j);
      left += w[j];
    }
    if (left < 1e-5) { si.setXYZW(i, Math.max(0, hips), 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); continue; }
    sw.setXYZW(i, w[0] / left, w[1] / left, w[2] / left, w[3] / left);
  }
  si.needsUpdate = sw.needsUpdate = true;
}

/** The model has one skinned part per colour (44 of them): merge them into one, the colours baked into the vertices. */
export function mergeSkinned(root: Group, name = 'Character'): SkinnedMesh {
  const parts: SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) parts.push(o as SkinnedMesh); });
  const geos: BufferGeometry[] = parts.map((m) => {
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    const mat = m.material as Material & { color?: Color };
    const c = mat.color ?? new Color(1, 1, 1);
    const n = g.getAttribute('position').count;
    const col = g.getAttribute('color') as BufferAttribute | undefined;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = col ? col.getX(i) : 1, gg = col ? col.getY(i) : 1, b = col ? col.getZ(i) : 1;
      out[i * 3] = r * c.r; out[i * 3 + 1] = gg * c.g; out[i * 3 + 2] = b * c.b;
    }
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
    untangle(g, m.skeleton.bones.map((b) => b.name.replace(/_/g, ' ')), c);
    g.setAttribute('color', new Float32BufferAttribute(out, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  const mesh = new SkinnedMesh(merged, new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02 }));
  mesh.name = name;
  const first = parts[0];
  mesh.bind(first.skeleton, first.bindMatrix);
  first.parent!.add(mesh);
  for (const p of parts) p.removeFromParent();
  return mesh;
}

export function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

