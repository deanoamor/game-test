import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type PerspectiveCamera } from 'three';
import { Gait, type Gesture } from '../characters/gait';
import { blobTexture, loadCharacter } from '../characters/model';

/**
 * A character of the town that is not the player: she stands about, walks a route if she has one, notices the player
 * and waves, turns to face her and talks (a few lines, one after the other).
 *
 * She is built from the same model and the same gait as the player (src/characters/), so she walks and stands the same
 * way; what is her own is what she does: the little state machine in `update`.
 *
 *   idle  stands where she is (breathing, a glance about)        walk  goes to the next point of her route
 *   wait  stands a while at a point of the route                 talk  faces the player and speaks
 * and over any of them a wave when the player first comes near.
 */

export interface NpcDef {
  id: string;
  name: string;
  jp: string;
  /** What she does: shown under her name. */
  role: string;
  /** The model: assets/core/characters/<model>.glb */
  model: string;
  /** Where she is at first, and the way she faces (0 = +z, 90 = +x). */
  at: { x: number; z: number; yaw: number };
  /** A route to walk, round and round (she waits `wait` seconds at each point); none: she stays where she is. */
  route?: { x: number; z: number; wait?: number }[];
  /** How fast she walks (m/s). */
  speed?: number;
  /** What she says when talked to, line by line. */
  lines: string[];
  /** After the last line, the shop opens (the clerk). */
  shop?: boolean;
  /** What she says over her head when she sees the player (and waves). */
  greet?: string;
}

export type NpcState = 'idle' | 'walk' | 'wait' | 'talk';

/** How near the player must be to talk, to be waved at, and to be noticed. */
export const TALK_RANGE = 2.4, GREET_RANGE = 5.5, NOTICE_RANGE = 3.2;
const RADIUS = 0.32;

const smooth = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Npc {
  readonly group = new Group();
  readonly pos = new Vector3();
  /** The shadow to add to the scene beside her. */
  readonly shadow: Mesh;
  /** What the player cannot walk through (kept at her position). */
  readonly blocker = { x: 0, z: 0, r: RADIUS };
  state: NpcState = 'idle';
  /** The line she is on while talking (-1: not talking). */
  line = -1;
  /** What she says over her head right now (a greeting), if anything. */
  bubble: string | null = null;
  readonly label: HTMLElement;
  private gait!: Gait;
  private facing = 0;
  private speed = 0;
  private stop = 0; // the point of the route she is going to
  private waiting = 0;
  private greeted = 0; // seconds since she last greeted (a big number: not yet)
  private waving = 0; // seconds of waving left
  private lookT = 0;
  private baseFacing = 0; // the way she faced when she began to wait

  private constructor(readonly def: NpcDef, private ground: (x: number, z: number) => number) {
    this.group.name = `NPC ${def.id}`;
    this.shadow = new Mesh(new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.shadow.renderOrder = 1;
    this.label = document.createElement('div');
    this.label.className = 'npcTag';
    this.label.innerHTML = `<div class="say"></div><b>${def.name}</b><small>${def.jp} · ${def.role}</small>`;
    this.greeted = 1e9;
  }

  /** `ground`: the height of the ground under a point (flat by default). */
  static async create(def: NpcDef, ground: (x: number, z: number) => number = () => 0) {
    const n = new Npc(def, ground);
    const ch = await loadCharacter(def.model, def.name);
    n.group.add(ch.root);
    n.gait = new Gait(ch.bones, ch.hipsY, { walk: 1.4, run: 3.9 });
    n.pos.set(def.at.x, ground(def.at.x, def.at.z), def.at.z);
    n.facing = (def.at.yaw * Math.PI) / 180;
    n.stop = 0;
    n.apply();
    return n;
  }

  /** Whether the player is near enough to talk to her. */
  canTalk(p: { x: number; z: number }) {
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z) <= TALK_RANGE;
  }

  /** Start talking (she faces the player and says her first line). */
  startTalk() {
    this.state = 'talk';
    this.line = 0;
    this.bubble = null;
    this.waving = 0;
  }

  /** Go on to her next line; null (and she is free again) after the last. */
  nextLine(): string | null {
    if (this.state !== 'talk') return null;
    this.line++;
    if (this.line >= this.def.lines.length) { this.endTalk(); return null; }
    return this.def.lines[this.line];
  }

  endTalk() {
    this.line = -1;
    this.state = this.def.route ? 'walk' : 'idle';
    this.greeted = 0; // (she has just spoken: no wave for a while)
  }

  get currentLine(): string | null {
    return this.state === 'talk' && this.line >= 0 ? this.def.lines[this.line] : null;
  }

  /** Every frame: decide what she does, move, pose. `player`: where the player stands, if there is one. */
  update(dt: number, player?: { x: number; z: number }) {
    const toP = player ? Math.hypot(player.x - this.pos.x, player.z - this.pos.z) : Infinity;
    const aimAt = (x: number, z: number) => Math.atan2(x - this.pos.x, z - this.pos.z);
    this.greeted += dt;
    let want = 0; // the speed she wants

    if (this.state === 'talk') {
      // face the player, hands moving as she speaks
      if (player) this.turn(aimAt(player.x, player.z), dt, 7);
      this.gait.gesturePlay('talk');
    } else {
      // a wave when the player first comes near (and not again for a while)
      if (player && toP < GREET_RANGE && this.greeted > 25 && this.waving <= 0) {
        this.waving = 2.6;
        this.greeted = 0;
        this.bubble = this.def.greet ?? null;
      }
      if (this.waving > 0) {
        this.waving -= dt;
        if (player) this.turn(aimAt(player.x, player.z), dt, 5);
        this.gait.gesturePlay('wave');
        if (this.waving <= 0) { this.bubble = null; this.gait.gesturePlay(null); }
      } else {
        this.gait.gesturePlay(null);
        const route = this.def.route;
        if (this.state === 'walk' && route?.length) {
          const p = route[this.stop % route.length];
          const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.12) {
            this.waiting = p.wait ?? 2 + (this.stop % 3);
            this.baseFacing = this.facing;
            this.stop = (this.stop + 1) % route.length;
            this.state = 'wait';
          } else {
            this.turn(Math.atan2(dx, dz), dt, 8);
            // slow down into the point, and do not walk while she is still turning round
            const ahead = Math.cos(wrap(Math.atan2(dx, dz) - this.facing));
            want = Math.min(this.def.speed ?? 1.1, 0.4 + d * 1.2) * Math.max(0, ahead);
          }
        } else if (this.state === 'wait') {
          this.waiting -= dt;
          // she notices the player nearby, and turns to look; else glances about now and then
          if (player && toP < NOTICE_RANGE) this.turn(aimAt(player.x, player.z), dt, 3);
          else { this.lookT += dt; this.turn(this.baseFacing + 0.7 * Math.sin(this.lookT * 0.6), dt, 2); }
          if (this.waiting <= 0) this.state = 'walk';
        } else if (this.state === 'idle') {
          // she turns to look at the player nearby, and back to the way she stands when the player has gone
          if (player && toP < NOTICE_RANGE) this.turn(aimAt(player.x, player.z), dt, 3);
          else this.turn((this.def.at.yaw * Math.PI) / 180, dt, 1.5);
          if (this.def.route?.length) this.state = 'walk';
        }
      }
    }

    // speed up and slow down smoothly; step along her heading
    this.speed += (want - this.speed) * smooth(want > this.speed ? 4 : 7, dt);
    const move = this.speed * dt;
    this.pos.x += Math.sin(this.facing) * move;
    this.pos.z += Math.cos(this.facing) * move;
    this.pos.y += (this.ground(this.pos.x, this.pos.z) - this.pos.y) * (dt > 0 ? smooth(14, dt) : 1);
    this.gait.step(dt, this.speed, move);
    this.apply();
  }

  private turn(aim: number, dt: number, k: number) {
    this.facing += wrap(aim - this.facing) * (dt > 0 ? smooth(k, dt) : 0);
  }

  private apply() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
    this.blocker.x = this.pos.x;
    this.blocker.z = this.pos.z;
  }

  /** Put the name tag (and the greeting over her head) at her place on the screen. */
  project(camera: PerspectiveCamera, width: number, height: number) {
    const v = new Vector3(this.pos.x, this.pos.y + 1.75, this.pos.z).project(camera);
    const far = this.pos.distanceTo(camera.position) > 60;
    const on = v.z < 1 && !far && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    this.label.style.display = on ? 'block' : 'none';
    if (!on) return;
    this.label.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`;
    const say = this.label.firstElementChild as HTMLElement;
    say.textContent = this.bubble ?? '';
    say.style.display = this.bubble ? 'block' : 'none';
  }

  /** The gesture being made, for tests and for the dialogue. */
  get gesture(): Gesture | null {
    return this.gait.gestureNow;
  }
  /** (for tests) */
  get gaitState() {
    return this.gait;
  }
  get heading() {
    return this.facing;
  }
}
