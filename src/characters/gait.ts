import type { Bone } from 'three';
import type { BoneName } from './model';

/**
 * How a character moves, bone by bone: an idle sway, a walk and a run blended by speed, with the stride timed to the
 * ground covered so the feet do not slide; and gestures (a wave, talking with the hands) laid over the top.
 * Used by the player and the NPCs. The poses are written as "forward is positive" and turned round for this rig.
 */

export type Gesture = 'wave' | 'talk' | 'bow' | 'think';

const smooth = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/** A soft bump of height 1 centred on `c`, `s` wide (angles in radians, the difference wrapped round the circle). */
const bump = (x: number, c: number, s: number) => {
  const d = Math.atan2(Math.sin(x - c), Math.cos(x - c)) / s;
  return Math.exp(-d * d);
};
/** The height of the heel and of the toes above the ankle's height-line, for a foot tilted `tilt` (toes up positive). */
const heelY = (tilt: number) => -0.05 * Math.sin(tilt) - 0.13 * Math.cos(tilt);
const toeY = (tilt: number) => 0.12 * Math.sin(tilt) - 0.1 * Math.cos(tilt);

export class Gait {
  phase = 0;
  walkW = 0;
  runW = 0;
  t = 0;
  private hipLift = 0;
  /** The gesture being made and how far into it (0..1, eased). */
  private gesture: Gesture | null = null;
  private gesturing = 0;
  private gestureT = 0;

  constructor(readonly bones: Map<BoneName, Bone>, private hipsY: number, readonly speeds = { walk: 1.4, run: 3.9 }) {}

  /** Advance one frame: `speed` is the ground speed (m/s) and `moved` the distance covered (m). */
  step(dt: number, speed: number, moved: number) {
    this.t += dt;
    const { walk, run } = this.speeds;
    this.walkW += (Math.min(1, speed / walk) - this.walkW) * smooth(10, dt);
    this.runW += (Math.min(1, Math.max(0, (speed - walk) / (run - walk))) - this.runW) * smooth(6, dt);
    const stride = 1.1 + this.runW * 0.8; // metres per full cycle (two steps)
    this.phase = (this.phase + (moved / stride) * Math.PI * 2) % (Math.PI * 2);
    this.pose(dt);
  }

  /** Start a gesture (or end it with null): it eases in and out, and plays over the walk or the idle. */
  gesturePlay(g: Gesture | null) {
    if (g && g !== this.gesture) { this.gesture = g; this.gestureT = 0; }
    this.wanted = g;
  }
  private wanted: Gesture | null = null;
  get gestureNow(): Gesture | null { return this.gesturing > 0.02 ? this.gesture : null; }

  /** Pose the bones for this moment. */
  pose(dt = 0) {
    const w = this.walkW, r = this.runW, idle = 1 - w;
    const φ = this.phase, t = this.t;
    const bone = (n: BoneName) => this.bones.get(n);
    // the poses are written for the limbs as "forward is positive" (a hip that swings the thigh forward, a shoulder
    // that swings the arm forward, a knee that bends back); on this rig that is a negative turn about x
    const fwd = (name: BoneName, x: number, y = 0, z = 0) => bone(name)?.rotation.set(-x, y, z);
    const mix = (a: number, b: number) => a + (b - a) * r; // walk -> run

    const angles: Record<'Left' | 'Right', { hip: number; knee: number; foot: number }> = { Left: { hip: 0, knee: 0, foot: 0 }, Right: { hip: 0, knee: 0, foot: 0 } };
    for (const [side, off] of [['Left', 0], ['Right', Math.PI]] as const) {
      const a = φ + off;
      const aw = Math.atan2(Math.sin(a), Math.cos(a)); // -π..π: 0 is the thigh passing the other leg moving forward, ±π/2 the extremes
      // the thigh: forward at heel strike (aw = π/2), back at toe-off (aw = -π/2)
      const hip = mix(0.05 + 0.48 * Math.sin(a), 0.2 + 0.8 * Math.sin(a));
      // the knee: a small bend as the weight comes on, straight at mid stance, and a big bend to carry the foot through
      const knee = mix(0.12, 0.5) * bump(aw, 2.0, 0.5) + mix(0.9, 1.55) * bump(aw, mix(-0.5, -0.4), mix(0.8, 0.9));
      // the foot's own tilt in the world (toes up is positive): toes up at heel strike, flat in stance, rolling onto the
      // toes at push-off, hanging toes-down while it swings through
      const foot = mix(0.22, -0.1) * bump(aw, 1.45, 0.5) - mix(0.45, 0.55) * bump(aw, -1.7, 0.6) - mix(0.15, 0.45) * bump(aw, -0.3, 0.8);
      angles[side] = { hip: w * hip, knee: w * knee, foot: w * foot };
      // the joints that turn: the ankle makes up the difference so the foot has the tilt above whatever the leg does
      fwd(`Hip ${side}`, w * hip);
      fwd(`Knee ${side}`, -w * knee);
      fwd(`Ankle ${side}`, w * foot - w * hip + w * knee);
      // the arms swing against the legs, the elbows bent, more the faster she goes; at rest they hang with a slight sway
      const swing = Math.sin(a);
      const arm = -swing * w * mix(0.5, 0.95) + w * mix(0.0, 0.2) + idle * 0.03 * Math.sin(t * 1.3 + off);
      const out = (side === 'Left' ? 1 : -1) * (0.07 + idle * 0.02 - r * 0.02);
      fwd(`Shoulder ${side}`, arm, 0, out);
      const forwardArm = Math.max(0, -swing);
      fwd(`Elbow ${side}`, 0.1 + w * (mix(0.25, 1.5) + mix(0.25, 0.25) * forwardArm), 0, 0);
      fwd(`Wrist ${side}`, w * 0.05, 0, 0);
    }

    // the hips rise and fall so that the lower foot is always on the ground: the leg's reach follows from its angles
    // (thigh and shin 0.20 and 0.23 m, the foot 0.13 m below the ankle), the height of the pelvis from the longer reach
    let lowest = Infinity;
    for (const side of ['Left', 'Right'] as const) {
      const { hip, knee, foot } = angles[side];
      const th = hip, sh = hip - knee;
      const reach = 0.2 * Math.cos(th) + 0.23 * Math.cos(sh);
      // the sole's lowest point (heel 0.05 behind and 0.13 under the ankle, toes 0.12 ahead and 0.10 under)
      const lowY = Math.min(heelY(foot), toeY(foot));
      lowest = Math.min(lowest, -reach + lowY);
    }
    const rest = -(0.2 + 0.23) - 0.13;
    const hips = bone('Hips')!;
    // (in the run a little spring on top: higher while the legs are spread, in the air)
    // (the height follows whichever foot is lower, which hands over from one leg to the other: eased so it does not jolt)
    const target = w * (rest - lowest) + w * r * 0.035 * (0.5 - 0.5 * Math.cos(2 * φ));
    this.hipLift += (target - this.hipLift) * (dt > 0 ? smooth(40, dt) : 1);
    hips.position.y = this.hipsY + this.hipLift + idle * 0.004 * Math.sin(t * 1.8);

    // the body: the pelvis turns with the leg that is forward, the shoulders against it, a lean into the run, breathing at rest
    const twist = mix(0.1, 0.22) * w, lean = mix(0.05, 0.27) * w;
    hips.rotation.set(0, -twist * Math.sin(φ), 0);
    fwd('Spine', -lean * 0.4, 0.9 * twist * Math.sin(φ), 0);
    fwd('Chest', -lean * 0.4, 0.8 * twist * Math.sin(φ), 0);
    fwd('Neck', lean * 0.1, 0, 0);
    // the head stays up, looking ahead, and turns idly at rest
    fwd('Head', lean * 0.55 + idle * 0.03 * Math.sin(t * 0.7), idle * 0.12 * Math.sin(t * 0.35), 0);
    bone('Spine')!.rotation.x += idle * 0.015 * Math.sin(t * 1.8);

    this.overlay(dt);
  }

  /** The gesture laid over the pose just made (arms, head, back), by how far into it the character is. */
  private overlay(dt: number) {
    const want = this.wanted ? 1 : 0;
    this.gesturing += (want - this.gesturing) * (dt > 0 ? smooth(7, dt) : want);
    if (this.gesturing < 0.01) return;
    this.gestureT += dt;
    const g = this.gesturing, t = this.gestureT;
    const b = (n: BoneName, x: number, y: number, z: number, k = 1) => {
      const bone = this.bones.get(n);
      if (!bone) return;
      const w = g * k;
      // (forward is positive here, as in the pose: a negative turn about x on this rig)
      bone.rotation.x += (-x - bone.rotation.x) * w;
      bone.rotation.y += (y - bone.rotation.y) * w;
      bone.rotation.z += (z - bone.rotation.z) * w;
    };
    const standing = 1 - this.walkW * 0.8; // a wave on the move keeps the legs going; the hand gestures ease off
    switch (this.gesture) {
      case 'wave': {
        // the right arm up and out, the forearm waving to and fro, a little lean of the head
        b('Shoulder Right', 0.25, 0, -2.45);
        b('Elbow Right', 0.15, 0, -0.35 + 0.5 * Math.sin(t * 9));
        b('Wrist Right', 0, 0, 0.3 * Math.sin(t * 9 + 1));
        b('Head', 0, 0.12, 0.1);
        break;
      }
      case 'talk': {
        // both hands in front, moving as she speaks, the head nodding a little
        const a = Math.sin(t * 3.1), c = Math.sin(t * 2.3 + 1.2);
        b('Shoulder Right', 0.55 + 0.12 * a, -0.15, -0.25, standing);
        b('Elbow Right', 1.15 + 0.25 * c, 0, 0, standing);
        b('Shoulder Left', 0.4 + 0.1 * c, 0.1, 0.2, standing);
        b('Elbow Left', 1.0 + 0.2 * a, 0, 0, standing);
        b('Head', 0.05 + 0.05 * Math.sin(t * 3.7), 0.1 * Math.sin(t * 1.1), 0);
        break;
      }
      case 'bow': {
        // from the waist, the head down, the hands to the front of the thighs
        b('Spine', 0.45, 0, 0);
        b('Chest', 0.3, 0, 0);
        b('Head', 0.25, 0, 0);
        b('Shoulder Left', 0.1, 0, 0.1);
        b('Shoulder Right', 0.1, 0, -0.1);
        break;
      }
      case 'think': {
        // a hand to the chin, the head tipped
        b('Shoulder Right', 0.9, 0, -0.1);
        b('Elbow Right', 2.0, 0, 0);
        b('Head', 0.08, 0.15, 0.12);
        break;
      }
    }
  }
}
