import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { GeoBuilder } from '../../util/builder';
import { Npc } from '../../npc/npc';
import { NURSE, STREET_FOLK } from '../../npc/people';
import type { Solid } from '../../world/village/frame';
import type { InteriorBuild } from '../types';

/**
 * A small test plaza for the NPCs: tiled ground, a few benches, lamps and trees, a notice board; no town round it and no
 * walls. The NPCs are tried here (what they do, how they talk) before any is put in a world of the game.
 */

export const PLAZA = { x0: -11, x1: 11, z0: -9, z1: 9 };

export async function buildPlaza(): Promise<InteriorBuild> {
  const group = new Group();
  group.name = 'NPC test plaza';
  const solids: Solid[] = [];
  const S = (x: number, z: number, hw: number, hd: number, a = 0) => { solids.push({ t: 'box', x, z, hw, hd, a }); };
  const body = new GeoBuilder(), lamp = new GeoBuilder();
  const bx = (b: GeoBuilder, x: number, y0: number, z: number, w: number, h: number, d: number, color: string, ao = 0.08) => b.box(x, y0 + h / 2, z, w, h, d, color, { ao });

  // the ground: tiles with joints every 2 m, and a low curb round the edge
  const { x0, x1, z0, z1 } = PLAZA;
  bx(body, (x0 + x1) / 2, -0.3, (z0 + z1) / 2, x1 - x0 + 0.4, 0.3, z1 - z0 + 0.4, '#bdb6a6', 0.02);
  for (let x = x0; x <= x1; x += 2) bx(body, x, 0, (z0 + z1) / 2, 0.04, 0.006, z1 - z0, '#a8a091', 0);
  for (let z = z0; z <= z1; z += 2) bx(body, (x0 + x1) / 2, 0, z, x1 - x0, 0.006, 0.04, '#a8a091', 0);
  for (const [x, z, w, d] of [[(x0 + x1) / 2, z0 - 0.1, x1 - x0 + 0.6, 0.2], [(x0 + x1) / 2, z1 + 0.1, x1 - x0 + 0.6, 0.2], [x0 - 0.1, (z0 + z1) / 2, 0.2, z1 - z0], [x1 + 0.1, (z0 + z1) / 2, 0.2, z1 - z0]] as const) bx(body, x, 0, z, w, 0.15, d, '#e4dfd2', 0.05);
  // a path of warmer stone through the middle
  for (let z = z0 + 1; z < z1; z += 2) bx(body, 0, 0, z, 2, 0.01, 1.9, '#d6c9ae', 0);

  const bench = (x: number, z: number, yaw: number) => {
    const t = new GeoBuilder();
    bx(t, 0, 0.42, 0, 1.6, 0.06, 0.45, '#8a5a3a');
    bx(t, 0, 0.62, -0.2, 1.6, 0.4, 0.05, '#8a5a3a');
    for (const s of [-0.7, 0.7]) bx(t, s, 0, 0, 0.08, 0.42, 0.42, '#4a4e54');
    body.appendTransformed(t, x, 0, z, yaw);
    S(x, z, Math.abs(Math.cos((yaw * Math.PI) / 180)) > 0.5 ? 0.82 : 0.26, Math.abs(Math.cos((yaw * Math.PI) / 180)) > 0.5 ? 0.26 : 0.82);
  };
  bench(5, 0.5, 90); // (the nurse stops here)
  bench(-6, -4, 0);
  bench(-6, 4, 180);
  bench(8.5, -6, 0);

  const lamppost = (x: number, z: number) => {
    bx(body, x, 0, z, 0.26, 0.3, 0.26, '#2a2c30', 0.1);
    bx(body, x, 0.3, z, 0.12, 3.7, 0.12, '#2a2c30', 0.1);
    bx(body, x, 4.0, z, 0.36, 0.05, 0.36, '#2a2c30', 0);
    bx(lamp, x, 4.05, z, 0.32, 0.42, 0.32, '#fff4dc', 0);
    body.frustum(x, 4.47, z, 0.3, 0.06, 0.2, 4, '#2a2c30', { rotate: 0.5 });
    S(x, z, 0.14, 0.14);
  };
  lamppost(-3, -6);
  lamppost(3, 6.5);
  lamppost(9, 2);

  const tree = (x: number, z: number, s: number, c1: string, c2: string, seed: number) => {
    body.frustum(x, 0, z, 0.25 * s, 0.18 * s, 2.3 * s, 7, '#6a4a32', { ao: 0.1 });
    body.blob(x, 2.8 * s, z, 1.5 * s, 1.5 * s, 1.5 * s, c1, { seed });
    body.blob(x + 0.5 * s, 3.7 * s, z, 1.1 * s, 1.1 * s, 1.1 * s, c2, { seed: seed + 1 });
    S(x, z, 0.3, 0.3);
  };
  tree(9.3, 6.8, 1, '#e8a0b4', '#f2b8c8', 3);
  tree(-8.5, 7, 1.1, '#4f9a45', '#5aa845', 7);
  tree(-9, -7, 1, '#e8a0b4', '#f2b8c8', 11);
  tree(5, -7.5, 1.2, '#4f9a45', '#5aa845', 15);
  // flower beds
  for (const [x, z] of [[-3, 8], [2, -8.4], [-10, 0]] as const) {
    bx(body, x, 0, z, 2.4, 0.25, 0.7, '#9a8a74');
    for (let k = 0; k < 5; k++) body.blob(x - 0.9 + k * 0.45, 0.4, z, 0.2, 0.18, 0.2, ['#e86a92', '#f2c230', '#f4f4ee', '#e86a92', '#b08ad8'][k], { detail: 0, seed: k + 20 });
    S(x, z, 1.2, 0.35);
  }

  const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
  const lampMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const m1 = new Mesh(body.toGeometry(), bodyMat);
  m1.castShadow = true;
  m1.receiveShadow = true;
  const m2 = new Mesh(lamp.toGeometry(), lampMat);
  group.add(m1, m2);
  const yard = new Mesh(new PlaneGeometry(260, 260).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: '#7f8f6c', roughness: 1 }));
  yard.position.y = -0.31;
  yard.receiveShadow = true;
  group.add(yard);

  // a notice board: "NPC test room"
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b3a55'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#f4ecd8'; g.lineWidth = 8; g.strokeRect(12, 12, 488, 232);
  g.fillStyle = '#f4ecd8'; g.textAlign = 'center';
  g.font = 'bold 64px sans-serif'; g.fillText('NPC TEST ROOM', 256, 120);
  g.font = '40px sans-serif'; g.fillText('NPC テストルーム', 256, 190);
  const board = new Mesh(new PlaneGeometry(2.4, 1.2), new MeshBasicMaterial({ map: new CanvasTexture(c), side: DoubleSide, toneMapped: false }));
  board.position.set(0, 1.7, -8.4);
  group.add(board);
  const mb = new GeoBuilder();
  for (const s of [-1, 1]) bx(mb, s * 1.0, 0, -8.45, 0.1, 1.2, 0.1, '#5a4a3a');
  const posts = new Mesh(mb.toGeometry(), bodyMat);
  posts.castShadow = true;
  group.add(posts);
  S(0, -8.45, 1.1, 0.1);

  // the NPC
  const nurse = await Npc.create(NURSE);
  group.add(nurse.group, nurse.shadow);
  // the ten people of the streets
  const folk = await Promise.all(STREET_FOLK.map((d) => Npc.create(d)));
  for (const n of folk) group.add(n.group, n.shadow);

  return {
    group,
    solids,
    floor: () => 0,
    update(night) { lampMat.color.setScalar(0.8 + night * 0.6); },
    frame() {},
    shadowHalf: 22,
    npcs: [nurse, ...folk],
  };
}
