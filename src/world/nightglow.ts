import { AdditiveBlending, CanvasTexture, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, PointLight, Quaternion, Vector3 } from 'three';
import type { Glow } from './village/frame';

/**
 * The town's lights at night. Every lamp, lit shop front, konbini and vending machine throws a soft pool of light on
 * the ground (additive patches, one instanced mesh), and the few sources nearest the camera are real point lights, so
 * the walls, awnings and cars around them catch the light too. All of it fades in with the dark.
 */

const LIGHTS = 6;

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export class NightGlow {
  group = new Group();
  private pools: InstancedMesh | null = null;
  private mat: MeshBasicMaterial | null = null;
  private lights: PointLight[] = [];
  private glows: Glow[];
  private clock = 0;
  private night = 0;

  constructor(glows: Glow[]) {
    this.glows = glows;
    this.group.name = 'Night lights';
    if (typeof document !== 'undefined' && glows.length) {
      this.mat = new MeshBasicMaterial({ map: poolTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0 });
      const geo = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
      const mesh = new InstancedMesh(geo, this.mat, glows.length);
      mesh.name = 'Light pools';
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      const m = new Matrix4(), q = new Quaternion(), col = new Color();
      glows.forEach((g, i) => {
        m.compose(new Vector3(g.x, g.y + 0.04, g.z), q, new Vector3(g.r, 1, g.r));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, col.set(g.color).multiplyScalar(0.22 * g.k));
      });
      this.pools = mesh;
      this.group.add(mesh);
    }
    for (let i = 0; i < LIGHTS; i++) {
      const l = new PointLight('#ffd9a0', 0, 9, 1.6);
      l.castShadow = false;
      this.lights.push(l);
      this.group.add(l);
    }
  }

  /** Fade with the night; every so often move the real lights to the sources nearest the camera's target. */
  update(dt: number, night: number, target: Vector3) {
    this.night = night;
    if (this.mat) {
      this.mat.opacity = night;
      this.pools!.visible = night > 0.02;
    }
    this.clock -= dt;
    if (this.clock <= 0 && night > 0.02) {
      this.clock = 0.4;
      const near = this.glows
        .map((g) => ({ g, d: (g.x - target.x) ** 2 + (g.z - target.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, LIGHTS);
      this.lights.forEach((l, i) => {
        const n = near[i];
        // (the lights are never hidden: that would change the shaders' light count and recompile them)
        if (!n) { l.userData.k = 0; return; }
        l.position.set(n.g.x, n.g.y + n.g.h, n.g.z);
        l.color.set(n.g.color);
        l.distance = Math.min(8, n.g.r * 1.6);
        l.userData.k = n.g.k;
      });
    }
    for (const l of this.lights) l.intensity = this.night * 2 * ((l.userData.k as number) ?? 1);
  }
}
