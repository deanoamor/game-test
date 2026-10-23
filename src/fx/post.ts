import { HalfFloatType, Scene, ShaderMaterial, Vector2, WebGLRenderTarget, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

export type Quality = 'low' | 'medium' | 'high';

const BLUR = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new Vector2(1, 0) }, uRes: { value: new Vector2(1, 1) }, uFocus: { value: 0.5 }, uBand: { value: 0.12 }, uAmount: { value: 2.4 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; uniform float uFocus; uniform float uBand; uniform float uAmount;
    varying vec2 vUv;
    void main(){
      float k = smoothstep(uBand, uBand + 0.42, abs(vUv.y - uFocus));
      vec2 step = uDir * uAmount * k / uRes;
      vec4 c = texture2D(tDiffuse, vUv) * 0.227027;
      c += texture2D(tDiffuse, vUv + step * 1.384615) * 0.316216;
      c += texture2D(tDiffuse, vUv - step * 1.384615) * 0.316216;
      c += texture2D(tDiffuse, vUv + step * 3.230769) * 0.070270;
      c += texture2D(tDiffuse, vUv - step * 3.230769) * 0.070270;
      gl_FragColor = c;
    }`,
};

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.14 }, uContrast: { value: 1.06 }, uVignette: { value: 0.28 }, uTint: { value: [1, 1, 1] } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat; uniform float uContrast; uniform float uVignette; uniform vec3 uTint;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat) * uTint;
      c.rgb = (c.rgb - 0.18) * uContrast + 0.18;
      vec2 q = vUv - 0.5;
      float v = 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.9)));
      c.rgb *= v;
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a);
    }`,
};

/** The picture pipeline: soft bloom for lights, a tilt-shift blur that makes the city look like a model, colour grading. */
export class Post {
  composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private blurH: ShaderPass;
  private blurV: ShaderPass;
  private grade: ShaderPass;
  private ao: GTAOPass;
  private smaa: SMAAPass;
  quality: Quality = 'medium';

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, w: number, h: number) {
    // no multisampling: SMAA smooths the edges at a fraction of the cost (MSAA x4 on a HiDPI screen is very heavy)
    const target = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new GTAOPass(scene, camera, w, h);
    this.ao.output = GTAOPass.OUTPUT.Default;
    this.ao.blendIntensity = 0.85;
    this.ao.updateGtaoMaterial({ radius: 3.5, distanceExponent: 1.4, thickness: 3, scale: 1.0, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new Vector2(w, h), 0.35, 0.35, 1.4);
    this.composer.addPass(this.bloom);
    this.blurH = new ShaderPass(new ShaderMaterial({ ...BLUR, uniforms: { ...BLUR.uniforms, uDir: { value: new Vector2(1, 0) }, uRes: { value: new Vector2(w, h) } } }));
    this.blurV = new ShaderPass(new ShaderMaterial({ ...BLUR, uniforms: { ...BLUR.uniforms, uDir: { value: new Vector2(0, 1) }, uRes: { value: new Vector2(w, h) } } }));
    this.composer.addPass(this.blurH);
    this.composer.addPass(this.blurV);
    this.grade = new ShaderPass(new ShaderMaterial({ ...GRADE, uniforms: { ...GRADE.uniforms } }));
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
    this.setQuality('medium');
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.ao.enabled = q === 'high';
    this.bloom.enabled = q !== 'low';
    this.blurH.enabled = this.blurV.enabled = q !== 'low';
    this.grade.enabled = q !== 'low';
    this.smaa.enabled = q !== 'low';
  }

  get usesComposer() {
    return this.quality !== 'low';
  }

  /** Bloom reacts to the time of day: a small glow in daylight, strong glow from windows and signs at night. */
  setLook(night: number, bloomStrength: number) {
    this.bloom.strength = bloomStrength;
    this.bloom.threshold = 2.2 - night * 0.85;
    // a cool, clear daylight (the light is a touch blue, not yellow); at night bluer still
    const day = 1 - night;
    this.grade.uniforms.uTint.value = [1 - day * 0.045 - night * 0.04, 1 - day * 0.005, 1 + day * 0.04 + night * 0.08];
    this.grade.uniforms.uSat.value = 1.2 + night * 0.02;
  }

  setTiltShift(focus: number, amount: number) {
    for (const p of [this.blurH, this.blurV]) {
      p.uniforms.uFocus.value = focus;
      p.uniforms.uAmount.value = amount;
    }
  }

  resize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.ao.setSize(w, h);
    for (const p of [this.blurH, this.blurV]) p.uniforms.uRes.value.set(w, h);
  }

  render(dt: number) {
    this.composer.render(dt);
  }
}
