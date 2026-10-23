import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * The bag she wears, built from a few boxes (in the model's units: metres, she faces +z, her left is +x). Each bag
 * has its own place on her: the school bag and the backpack on the back, the shoulder bag at the hip on a strap across
 * the chest, the tote bag in her left hand.
 */
const mat = (c: string) => new MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.02 });
const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => {
  const m = new Mesh(new BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  // (no shadow from the sun: its shadow map is drawn only now and then, so a bag that moves would leave a stale one; she has her blob shadow)
  m.castShadow = false;
  return m;
};

export function buildBagModel(id: string): Group {
  const g = new Group();
  g.name = `Bag ${id}`;
  if (id === 'school') {
    // a hard black school bag on the back, with a flap, a buckle and two straps over the shoulders
    g.add(box(0.34, 0.36, 0.14, '#2c2c34', 0, 0.8, -0.25));
    g.add(box(0.34, 0.14, 0.15, '#3a3a45', 0, 0.9, -0.25));
    g.add(box(0.06, 0.07, 0.02, '#d8b04a', 0, 0.86, -0.33));
    for (const s of [-1, 1]) {
      g.add(box(0.045, 0.36, 0.02, '#1c1c22', s * 0.1, 0.88, -0.16));
      g.add(box(0.045, 0.02, 0.2, '#1c1c22', s * 0.1, 1.04, -0.08));
    }
  } else if (id === 'backpack') {
    // a big blue hiking pack: main body, lid, side pockets, a rolled mat underneath
    g.add(box(0.36, 0.52, 0.2, '#2f6fb8', 0, 0.82, -0.28));
    g.add(box(0.38, 0.12, 0.22, '#245a98', 0, 1.1, -0.28));
    for (const s of [-1, 1]) g.add(box(0.07, 0.24, 0.14, '#245a98', s * 0.21, 0.7, -0.28));
    g.add(box(0.3, 0.07, 0.07, '#e8a030', 0, 0.54, -0.28));
    for (const s of [-1, 1]) {
      g.add(box(0.05, 0.4, 0.02, '#1c3a62', s * 0.1, 0.9, -0.16));
      g.add(box(0.05, 0.02, 0.22, '#1c3a62', s * 0.1, 1.07, -0.07));
    }
  } else if (id === 'shoulder') {
    // a small red bag at the right hip, on a strap that crosses the chest
    g.add(box(0.3, 0.2, 0.1, '#c8483a', -0.2, 0.58, 0.02));
    g.add(box(0.3, 0.07, 0.11, '#a83a2e', -0.2, 0.66, 0.02));
    const strap = box(0.03, 0.62, 0.015, '#8a2e24', -0.08, 0.86, 0.17);
    strap.rotation.z = -0.5;
    g.add(strap);
    const back = box(0.03, 0.62, 0.015, '#8a2e24', -0.08, 0.86, -0.17);
    back.rotation.z = -0.5;
    g.add(back);
  } else {
    // a cream tote bag in her left hand, with two handles
    g.add(box(0.26, 0.28, 0.1, '#e6dcc0', 0.3, 0.4, 0.06));
    g.add(box(0.26, 0.05, 0.11, '#c9b88a', 0.3, 0.54, 0.06));
    const h = new Mesh(new CylinderGeometry(0.1, 0.1, 0.02, 12, 1, true, 0, Math.PI), mat('#8a6a3a'));
    h.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    h.position.set(0.3, 0.56, 0.06);
    g.add(h);
  }
  return g;
}

/** The shop's basket in her right hand: a red plastic basket with a handle, and what is in it showing over the rim. */
export function buildBasketModel(count: number): Group {
  const g = new Group();
  g.name = 'Basket';
  const red = '#d8402a', redD = '#a8301e';
  g.add(box(0.3, 0.03, 0.2, redD, -0.3, 0.38, 0.12));
  g.add(box(0.3, 0.14, 0.02, red, -0.3, 0.45, 0.21));
  g.add(box(0.3, 0.14, 0.02, red, -0.3, 0.45, 0.03));
  g.add(box(0.02, 0.14, 0.2, red, -0.45, 0.45, 0.12));
  g.add(box(0.02, 0.14, 0.2, red, -0.15, 0.45, 0.12));
  g.add(box(0.26, 0.02, 0.02, '#e8e8e8', -0.3, 0.6, 0.12)); // the handle
  g.add(box(0.02, 0.1, 0.02, '#e8e8e8', -0.42, 0.55, 0.12));
  g.add(box(0.02, 0.1, 0.02, '#e8e8e8', -0.18, 0.55, 0.12));
  const goods = ['#f2c230', '#3a9a5a', '#4aa8e0', '#f08aac', '#e8862a', '#f4f4ee'];
  for (let i = 0; i < Math.min(count, 6); i++) g.add(box(0.07, 0.1 + (i % 3) * 0.03, 0.07, goods[i % goods.length], -0.4 + (i % 3) * 0.1, 0.46 + (i % 3) * 0.015, 0.07 + Math.floor(i / 3) * 0.1));
  return g;
}
