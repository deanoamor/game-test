import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { clamp } from '../util/rng';
import { HALF, heightAt, type Place } from '../world/config';
import { skylineSmooth } from '../world/skyline';

/**
 * The drone: a camera that floats above a point on the ground. Drag to slide the map, right-drag to turn and tilt,
 * wheel to go up and down, WASD / arrows to fly, Q/E to turn, R/F to tilt, Shift to go faster.
 */
/** The most the camera backs off to clear a roof. */
const MAX_STRETCH = 1.45;

export class Drone {
  camera: PerspectiveCamera;
  /** the point on the ground the drone looks at (smoothed) */
  target = new Vector3(0, 3, 56);
  private goal = new Vector3(0, 3, 56);
  yaw = (20 * Math.PI) / 180;
  pitch = (48 * Math.PI) / 180;
  dist = 210;
  private yawGoal = this.yaw;
  private pitchGoal = this.pitch;
  private distGoal = this.dist;
  private keys = new Set<string>();
  private drag: { mode: 'pan' | 'orbit'; x: number; y: number } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  /** set while a fly-to is running so the player can still interrupt it */
  private flying = false;

  constructor(private dom: HTMLElement) {
    this.camera = new PerspectiveCamera(40, 1, 0.3, 4000);
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distGoal = clamp(this.distGoal * Math.exp(e.deltaY * 0.0011), this.minDist, this.maxDist);
      this.flying = false;
    }, { passive: false });
    this.update(0);
  }

  private down(e: PointerEvent) {
    this.dom.setPointerCapture?.(e.pointerId);
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch') {
      if (this.touches.size === 2) this.pinch = this.pinchDistance();
      this.drag = { mode: this.following ? 'orbit' : 'pan', x: e.clientX, y: e.clientY };
    } else {
      this.drag = { mode: this.following || e.button === 2 || e.button === 1 || e.shiftKey ? 'orbit' : 'pan', x: e.clientX, y: e.clientY };
    }
    this.flying = false;
  }

  private pinchDistance() {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private move(e: PointerEvent) {
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!this.drag) return;
    if (this.touches.size === 2) {
      const d = this.pinchDistance();
      if (this.pinch > 0 && d > 0) this.distGoal = clamp(this.distGoal * (this.pinch / d), this.minDist, this.maxDist);
      this.pinch = d;
      return;
    }
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    if (this.drag.mode === 'orbit') {
      this.yawGoal -= dx * 0.005;
      // (following her, the tilt is fixed: turning the view never tips it)
      if (!this.following) this.pitchGoal = clamp(this.pitchGoal + dy * 0.004, 0.14, 1.5);
    } else {
      // grab the ground: the map follows the pointer
      const scale = (this.dist * 2 * Math.tan(MathUtils.degToRad(this.camera.fov / 2))) / this.dom.clientHeight;
      const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw);
      const rx = dx * scale, rz = (dy * scale) / Math.max(0.35, Math.sin(this.pitch));
      // the screen right is (cos, -sin) and the screen "down" is (sin, cos) on the ground
      this.goal.x -= rx * cs + rz * sn;
      this.goal.z -= -rx * sn + rz * cs;
      this.clampGoal();
    }
  }

  private up(e: PointerEvent) {
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinch = 0;
    if (this.touches.size === 0) this.drag = null;
  }

  /** The invisible barrier: where the point the drone looks at may go (the whole map unless a zone sets it). */
  bounds = { x0: -HALF + 20, z0: -HALF + 20, x1: HALF - 20, z1: HALF - 20 };
  /** Following the player: the keys move her, not the drone, and a plain drag turns the view. */
  following = false;
  /** Keep clear of the roofs (tests turn it off for close-ups at street level). */
  clearance = true;
  /** How close the drone may come and how far it may pull back (the same: a fixed zoom). */
  minDist = 10;
  maxDist = 520;
  /** Pressing against the barrier, for the exits: the point the drone would have gone to. */
  pushed = { x: 0, z: 0, t: 0 };
  /** How much further than its distance the drone stands to clear the roofs (1: not at all; eased). */
  private stretch = 1;

  private clampGoal() {
    const b = this.bounds;
    const x = this.goal.x, z = this.goal.z;
    this.goal.x = clamp(x, b.x0, b.x1);
    this.goal.z = clamp(z, b.z0, b.z1);
    if (x !== this.goal.x || z !== this.goal.z) this.pushed = { x, z, t: performance.now() };
  }

  /** Fly to a named place (smooth), or jump there at once. */
  flyTo(p: Place, instant = false) {
    this.goal.set(p.x, 0, p.z);
    this.clampGoal();
    this.yawGoal = MathUtils.degToRad(p.yaw);
    this.pitchGoal = MathUtils.degToRad(p.pitch);
    this.distGoal = clamp(p.dist, this.minDist, this.maxDist);
    this.flying = true;
    if (instant) {
      this.target.set(p.x, heightAt(p.x, p.z), p.z);
      this.yaw = this.yawGoal;
      this.pitch = this.pitchGoal;
      this.dist = this.distGoal;
      this.flying = false;
    }
    this.update(0);
  }

  /** Keep the view on a point (the player), smoothly. */
  follow(x: number, z: number, y?: number) {
    this.goal.set(x, 0, z);
    this.followY = y ?? null;
    this.flying = false;
  }
  /** The height to look at while following (she may stand on stairs above the ground). */
  private followY: number | null = null;

  setView(x: number, z: number, yawDeg: number, pitchDeg: number, dist: number) {
    this.goal.set(x, 0, z);
    this.target.set(x, heightAt(x, z), z);
    this.yaw = this.yawGoal = MathUtils.degToRad(yawDeg);
    this.pitch = this.pitchGoal = MathUtils.degToRad(pitchDeg);
    this.dist = this.distGoal = dist;
    this.update(0);
  }

  update(dt: number) {
    const k = this.keys;
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.6 : 1;
    const speed = this.dist * 0.75 * fast;
    let mx = 0, mz = 0;
    if (!this.following) {
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    }
    if (mx || mz) {
      this.flying = false;
      const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw);
      const l = Math.hypot(mx, mz);
      this.goal.x += ((mx * cs + mz * sn) / l) * speed * dt;
      this.goal.z += ((-mx * sn + mz * cs) / l) * speed * dt;
      this.clampGoal();
    }
    if (k.has('KeyQ')) this.yawGoal += 1.4 * dt;
    if (k.has('KeyE')) this.yawGoal -= 1.4 * dt;
    if (k.has('KeyR') && !this.following) this.pitchGoal = clamp(this.pitchGoal + 0.8 * dt, 0.14, 1.5);
    if (k.has('KeyF') && !this.following) this.pitchGoal = clamp(this.pitchGoal - 0.8 * dt, 0.14, 1.5);
    if (k.has('Equal') || k.has('NumpadAdd')) this.distGoal = clamp(this.distGoal * Math.exp(-1.2 * dt), this.minDist, this.maxDist);
    if (k.has('Minus') || k.has('NumpadSubtract')) this.distGoal = clamp(this.distGoal * Math.exp(1.2 * dt), this.minDist, this.maxDist);

    const a = 1 - Math.exp(-dt * (this.flying ? 2.6 : 9));
    this.yaw += (this.yawGoal - this.yaw) * a;
    this.pitch += (this.pitchGoal - this.pitch) * a;
    this.dist += (this.distGoal - this.dist) * a;
    this.target.x += (this.goal.x - this.target.x) * a;
    this.target.z += (this.goal.z - this.target.z) * a;
    // the ground under the target, averaged over a few metres so the terrace steps and walls do not jerk the view
    const tx = this.target.x, tz = this.target.z, R = 4;
    const gy = this.following && this.followY !== null ? this.followY : (heightAt(tx, tz) * 2 + heightAt(tx + R, tz) + heightAt(tx - R, tz) + heightAt(tx, tz + R) + heightAt(tx, tz - R)) / 6;
    this.target.y += (gy - this.target.y) * (1 - Math.exp(-dt * 3));
    if (dt === 0) this.target.y = gy;

    const cp = Math.cos(this.pitch);
    const pos = new Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(this.target);
    // stay above the ground, the roofs and the mountains, but rise and settle smoothly: the roofs below change in
    // steps as the drone moves, and following them at once made the view jolt up and down
    const px = pos.x, pz = pos.z, G = 6;
    const land = (heightAt(px, pz) * 2 + heightAt(px + G, pz) + heightAt(px - G, pz) + heightAt(px, pz + G) + heightAt(px, pz - G)) / 6;
    const ground = Math.max(land, skylineSmooth(px, pz));
    // to clear a roof the camera backs off along its own line of sight (the same tilt, a little further away) rather
    // than just going up, which tilted the picture down as it turned past a building
    const up = pos.y - this.target.y;
    const want = this.clearance && up > 0.5 ? Math.min(MAX_STRETCH, Math.max(1, (ground + 1.5 - this.target.y) / up)) : 1;
    this.stretch += (want - this.stretch) * (dt > 0 ? 1 - Math.exp(-dt * 2.5) : 1);
    pos.sub(this.target).multiplyScalar(this.stretch).add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
    // thin layers on a surface (floor tiles, road paint, kerbs) flicker when the depth buffer cannot tell them apart; the
    // nearer the near plane, the worse that is, and nothing stands within a quarter of the distance of this camera
    const near = Math.min(6, Math.max(0.3, this.dist * 0.2));
    if (Math.abs(near - this.camera.near) > 0.05) { this.camera.near = near; this.camera.updateProjectionMatrix(); }
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
