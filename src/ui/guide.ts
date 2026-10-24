import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type PerspectiveCamera } from 'three';

/**
 * The guide of the game (not in dev mode): an introduction the first time, and then a short list of things to do that
 * leads her from the crossing to her home (the door at the top of the stairs), to the wardrobe in it, back out and into
 * the Hoshi Mart, where she takes a basket, picks something and pays. Each is shown as an objective on the left, with a
 * golden beam standing at the place in the world and an arrow at the edge of the screen when it is off to the side.
 * How far she has got is kept in the browser (each world is a page of its own).
 */

export interface Target { x: number; y: number; z: number }
export interface GuideCtx {
  /** The world she is in now. */
  world: string;
  /** Where things are (the doors are filled in when the town is built, so they are asked for when needed). */
  homeDoor(): Target;
  konbiniDoor(): Target;
  /** Facts of the game she has reached. */
  wardrobeOpened(): boolean;
  hasBasket(): boolean;
  basketCount(): number;
  paid(): boolean;
}

interface Step { id: string; world: string; text: string; sub: string; target: (c: GuideCtx) => Target; done: (c: GuideCtx) => boolean }

const STEPS: Step[] = [
  { id: 'home', world: 'ekimae', text: 'Go home', sub: 'Your flat is up the iron stairs by the crossing. Walk up to the door and press Enter.', target: (c) => c.homeDoor(), done: (c) => c.world === 'home' },
  { id: 'wardrobe', world: 'home', text: 'Look at your wardrobe', sub: 'Walk to the wardrobe in the bedroom and press F. You can change your bag there.', target: () => ({ x: 3.0, y: 0.2, z: 3.0 }), done: (c) => c.wardrobeOpened() || c.world === 'ekimae' },
  { id: 'leave', world: 'home', text: 'Go back out', sub: 'The fridge is empty! Take the front door and press Enter.', target: () => ({ x: -3.1, y: 0, z: -3.9 }), done: (c) => c.world === 'ekimae' },
  { id: 'konbini', world: 'ekimae', text: 'Go to the Hoshi Mart', sub: 'The blue and white convenience store on the south side of the main street. Press Enter at its glass door.', target: (c) => c.konbiniDoor(), done: (c) => c.world === 'konbini' },
  { id: 'basket', world: 'konbini', text: 'Take a basket', sub: 'The stack of baskets is by the door. Press F.', target: () => ({ x: -4.45, y: 0.6, z: -3.5 }), done: (c) => c.hasBasket() },
  { id: 'shelf', world: 'konbini', text: 'Pick something from a shelf', sub: 'Press F at a shelf, then Add. Each shelf sells different things.', target: () => ({ x: 4.0, y: 0.8, z: 0.2 }), done: (c) => c.basketCount() > 0 },
  { id: 'pay', world: 'konbini', text: 'Pay at the register', sub: 'Take it to the counter, press F and Pay. Then the things are in your bag (B).', target: () => ({ x: 3.0, y: 1.0, z: -1.5 }), done: (c) => c.paid() },
];
const KEY = 'hoshi.guide';

export class Guide {
  readonly group = new Group();
  private step = 0;
  private seen = false;
  private panel: HTMLElement;
  private mark: HTMLElement;
  private intro: HTMLElement | null = null;
  private beam: Mesh;
  private ring: Mesh;
  private t = 0;
  private v = new Vector3();
  /** Called when she has done the whole list. */
  onFinished: (() => void) | null = null;
  /** Called when she finishes a step. */
  onStep: (() => void) | null = null;
  /** Called when the introduction is closed. */
  onStart: (() => void) | null = null;

  constructor(private ctx: () => GuideCtx, host: HTMLElement) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      this.step = Math.min(STEPS.length, Math.max(0, Number(s.step) || 0));
      this.seen = !!s.seen;
    } catch { /* no storage */ }
    this.group.name = 'Guide';
    const mat = new MeshBasicMaterial({ color: '#ffd96a', transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.beam = new Mesh(new CylinderGeometry(0.38, 0.38, 7, 16, 1, true).translate(0, 3.5, 0), mat);
    this.ring = new Mesh(new RingGeometry(0.55, 0.85, 32).rotateX(-Math.PI / 2), mat.clone());
    this.ring.position.y = 0.05;
    this.group.add(this.beam, this.ring);
    this.group.visible = false;
    this.panel = document.createElement('div');
    this.panel.id = 'quest';
    this.panel.className = 'panel';
    host.appendChild(this.panel);
    this.mark = document.createElement('div');
    this.mark.id = 'guideMark';
    this.mark.innerHTML = '<i>▼</i><span></span>';
    host.appendChild(this.mark);
  }

  get finished() { return this.step >= STEPS.length; }
  /** The introduction has not been seen yet. */
  get needsIntro() { return !this.seen; }
  /** The id of the step she is on (for tests). */
  get current() { return STEPS[this.step]?.id ?? 'done'; }

  private save() { try { localStorage.setItem(KEY, JSON.stringify({ step: this.step, seen: this.seen })); } catch { /* no storage */ } }

  /** The introduction: who she is, what to do, and the keys. */
  showIntro(host: HTMLElement, onClose: () => void) {
    const box = (this.intro = document.createElement('div'));
    box.id = 'intro';
    box.innerHTML = `<div class="card">
      <div class="jp">星の町へようこそ</div>
      <h2>Welcome to Hoshi Town</h2>
      <p>You have just moved into a small flat above the shops by the Ekimae crossing. It is a quiet morning, and your fridge is empty.</p>
      <p><b>First, find your way home.</b> Then pay a visit to the Hoshi Mart on the main street for something to eat. A golden beam will show you the way.</p>
      <div class="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span><span><kbd>Shift</kbd> run</span><span><kbd>Drag</kbd> / <kbd>Q</kbd><kbd>E</kbd> turn the view</span><span><kbd>Enter</kbd> doors</span><span><kbd>F</kbd> talk · use</span><span><kbd>B</kbd> bag</span><span><kbd>M</kbd> sound</span></div>
      <button id="introGo">Start</button>
    </div>`;
    host.appendChild(box);
    const go = () => {
      if (!this.intro) return;
      this.intro.remove(); this.intro = null;
      this.seen = true; this.save();
      window.removeEventListener('keydown', key, true);
      onClose();
      this.onStart?.();
    };
    const key = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); go(); } };
    window.addEventListener('keydown', key, true);
    (box.querySelector('#introGo') as HTMLElement).onclick = go;
  }

  /** Give up the list (it is not shown any more). */
  skip() { this.step = STEPS.length; this.save(); }

  /** Every frame. */
  update(dt: number, player: Vector3 | null, camera: PerspectiveCamera, width: number, height: number) {
    const c = this.ctx();
    // the steps she has done (several may be done at once, e.g. she went into the shop by herself)
    while (this.step < STEPS.length && this.seen && STEPS[this.step].done(c)) {
      this.step++;
      this.save();
      if (this.step >= STEPS.length) this.onFinished?.(); else this.onStep?.();
    }
    // (the basket is gone, e.g. the page was reloaded in the shop: back to taking one)
    if (this.seen && (STEPS[this.step]?.id === 'shelf' || STEPS[this.step]?.id === 'pay') && c.world === 'konbini' && !c.hasBasket()) { this.step = STEPS.findIndex((x) => x.id === 'basket'); this.save(); }
    const s = STEPS[this.step];
    if (!s || !this.seen || !player) {
      this.panel.classList.remove('on'); this.mark.classList.remove('on'); this.group.visible = false;
      return;
    }
    // where she is told to go: at the step's place, or (in another world) the way to it
    let text = s.text, sub = s.sub, target: Target;
    if (c.world === s.world) target = s.target(c);
    else if (c.world === 'ekimae') {
      target = s.world === 'konbini' ? c.konbiniDoor() : c.homeDoor();
      text = s.world === 'konbini' ? 'Go to the Hoshi Mart' : 'Go home';
      sub = s.world === 'konbini' ? 'Press Enter at the glass door of the Hoshi Mart.' : 'Up the iron stairs, to the door at the top. Press Enter.';
    } else {
      // in a place that is not the one she is to go to: out of the door first
      target = c.world === 'home' ? { x: -3.1, y: 0, z: -3.9 } : { x: -3, y: 0, z: -3.6 };
      text = 'Go back outside';
      sub = `Take the ${c.world === 'home' ? 'front door' : 'automatic door'} and press Enter.`;
    }
    this.panel.innerHTML = `<div class="q"><span class="n">${Math.min(this.step + 1, STEPS.length)}/${STEPS.length}</span><b>${text}</b><button class="skip" title="Hide the guide">✕</button></div><p>${sub}</p><div class="dist"></div>`;
    (this.panel.querySelector('.skip') as HTMLElement).onclick = () => { this.skip(); };
    this.panel.classList.add('on');
    const dist = Math.round(Math.hypot(target.x - player.x, target.z - player.z));
    (this.panel.querySelector('.dist') as HTMLElement).textContent = dist > 2 ? `${dist} m` : 'You are here';
    // the beam in the world
    this.t += dt;
    this.group.visible = true;
    this.group.position.set(target.x, target.y, target.z);
    const k = 0.5 + 0.5 * Math.sin(this.t * 3);
    (this.beam.material as MeshBasicMaterial).opacity = 0.3 + 0.2 * k;
    this.ring.scale.setScalar(1 + 0.25 * k);
    (this.ring.material as MeshBasicMaterial).opacity = 0.55 - 0.3 * k;
    // the mark on the screen: over the place, or at the edge in its direction
    this.v.set(target.x, target.y + 2.2, target.z).project(camera);
    let x = this.v.x, y = this.v.y;
    const behind = this.v.z > 1;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.9 || Math.abs(y) > 0.86;
    if (off) { const m = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.86) || 1; x /= m; y /= m; }
    this.mark.style.left = `${((x + 1) / 2) * width}px`;
    this.mark.style.top = `${((1 - y) / 2) * height}px`;
    this.mark.classList.toggle('edge', off);
    this.mark.classList.add('on');
    const arrow = this.mark.querySelector('i') as HTMLElement;
    arrow.style.transform = off ? `rotate(${Math.atan2(x, y) * (180 / Math.PI) + 180}deg)` : 'none';
    (this.mark.querySelector('span') as HTMLElement).textContent = dist > 2 ? `${dist} m` : '';
  }
}
