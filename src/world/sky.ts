import { BufferGeometry, Color, DoubleSide, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, ShaderMaterial, SphereGeometry, Vector3, type Camera } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../util/rng';
import { HALF } from './config';

export interface SkyState {
  top: Color;
  horizon: Color;
  sunColor: Color;
  sunDir: Vector3;
  night: number; // 0 day .. 1 night
}

/** The sky dome: a gradient, a sun disc with a glow and stars at night. It follows the camera. */
export class SkyDome {
  mesh: Mesh;
  private mat: ShaderMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      side: DoubleSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color('#3b86d8') },
        uHorizon: { value: new Color('#cfe8f6') },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color('#fff2d0') },
        uNight: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          float t = pow(max(h, 0.0), 0.55);
          vec3 col = mix(uHorizon, uTop, t);
          col = mix(col, uHorizon, smoothstep(0.0, -0.2, d.y) * 0.9);
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.45 + pow(sd, 6.0) * 0.18);
          vec3 sg = normalize(vec3(d.x, 0.0, d.z) + 0.0001);
          float sunAz = max(dot(sg, normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 0.0001)), 0.0);
          col += uSunColor * pow(sunAz, 6.0) * (1.0 - t) * 0.25 * (1.0 - uNight);
          // stars
          float s = hash(floor(d * 140.0));
          float star = step(0.9965, s) * smoothstep(0.05, 0.35, d.y) * uNight;
          col += vec3(star) * (0.6 + 0.4 * hash(floor(d * 90.0)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(1, 48, 24), this.mat);
    this.mesh.scale.setScalar(2200);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'SkyDome';
  }

  update(camera: Camera, s: SkyState) {
    this.mesh.position.copy(camera.position);
    this.mat.uniforms.uTop.value.copy(s.top);
    this.mat.uniforms.uHorizon.value.copy(s.horizon);
    this.mat.uniforms.uSunDir.value.copy(s.sunDir);
    this.mat.uniforms.uSunColor.value.copy(s.sunColor);
    this.mat.uniforms.uNight.value = s.night;
  }
}

/** Low-poly clouds: a few flattened icospheres merged, instanced many times, drifting with the wind. */
export class Clouds {
  mesh: InstancedMesh;
  private data: { x: number; y: number; z: number; s: number; v: number }[] = [];
  private m = new Matrix4();

  constructor(count = 34) {
    const r = rng(77);
    const blobs: BufferGeometry[] = [];
    const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const g = new IcosahedronGeometry(1, 1).toNonIndexed();
      g.deleteAttribute('uv');
      g.applyMatrix4(new Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z));
      blobs.push(g);
    };
    place(0, 0, 0, 38, 15, 26);
    place(30, -2, 4, 28, 12, 20);
    place(-32, -3, -3, 26, 11, 19);
    place(10, 8, -6, 24, 13, 18);
    place(-8, 5, 12, 20, 10, 15);
    const geo = mergeGeometries(blobs)!;
    const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, flatShading: true, emissive: '#8fa6c4', emissiveIntensity: 0.12 });
    this.mesh = new InstancedMesh(geo, mat, count);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'Clouds';
    for (let i = 0; i < count; i++) {
      this.data.push({ x: (r() * 2 - 1) * HALF * 1.6, y: 330 + r() * 140, z: (r() * 2 - 1) * HALF * 1.5, s: 0.7 + r() * 1.1, v: 2 + r() * 2.5 });
    }
    this.step(0);
  }

  step(dt: number) {
    const lim = HALF * 1.7;
    this.data.forEach((c, i) => {
      c.x += c.v * dt;
      if (c.x > lim) c.x = -lim;
      this.m.makeScale(c.s, c.s, c.s).setPosition(c.x, c.y, c.z);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  tint(sky: Color, night: number) {
    const m = this.mesh.material as MeshStandardMaterial;
    m.color.set('#ffffff').lerp(new Color('#2a3350'), night * 0.8);
    m.emissive.copy(sky).multiplyScalar(0.5);
    m.emissiveIntensity = 0.2 + night * 0.1;
  }
}
