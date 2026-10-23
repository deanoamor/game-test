import type { Player } from '../player/player';
import type { Sound } from '../audio/sound';
import { BAGS, BASKET_CAP, MAX_STACK, itemOf, shelfOf } from './items';
import type { Basket } from './shop';
import type { Inventory } from './store';

/**
 * The bag, the wardrobe and the shop, as one panel in the middle of the screen. B opens the bag; F at the wardrobe at
 * home opens the wardrobe (change the bag, keep things). In the shop it goes like a real one: F at the stack by the
 * door takes a basket, F at a shelf shows what that shelf has (add things to the basket), F at the register shows the
 * basket and the total, and paying puts the things in the bag. The player stands still while a panel is open. Esc
 * (or the button) closes it.
 */

type Mode = 'bag' | 'wardrobe' | 'shelf' | 'register';
/** A place to press F at: a line segment (a shelf, the counter) or a point, and how near she must be. */
export interface Spot { x0: number; z0: number; x1: number; z1: number; r: number; label: string; kind: 'wardrobe' | 'basket' | 'shelf' | 'register'; shelf?: string }

const segDist = (x: number, z: number, s: Spot) => {
  const dx = s.x1 - s.x0, dz = s.z1 - s.z0, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.min(1, Math.max(0, ((x - s.x0) * dx + (z - s.z0) * dz) / l2)) : 0;
  return Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
};

export class BagUI {
  private box: HTMLElement;
  private prompt: HTMLElement;
  mode: Mode | null = null;
  private shelf = 'snacks';
  private selected = -1;
  private message = '';
  private spots: Spot[] = [];
  private near: Spot | null = null;
  private toastT = 0;
  /** The shop's button to chat with the clerk. */
  onChat: (() => void) | null = null;
  /** True while a talk is going on (F belongs to it). */
  busy: (() => boolean) | null = null;
  /** The basket in her hand changed (how many things in it; null: none). */
  onHeld: ((count: number | null) => void) | null = null;

  constructor(private inv: Inventory, readonly basket: Basket, private player: Player | null, host: HTMLElement, private sound?: Sound) {
    this.box = document.createElement('div');
    this.box.id = 'bag';
    this.box.className = 'panel';
    host.appendChild(this.box);
    this.prompt = document.createElement('div');
    this.prompt.id = 'act';
    this.prompt.className = 'panel';
    host.appendChild(this.prompt);
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (e.code === 'KeyB' && !e.repeat) { this.mode === 'bag' ? this.close() : !this.mode && this.open('bag'); }
      else if (e.code === 'Escape' && this.mode) this.close();
      else if (e.code === 'KeyF' && !e.repeat && !this.mode && this.near && !this.busy?.()) this.act(this.near);
    });
    this.box.addEventListener('click', (e) => this.click(e.target as HTMLElement));
    inv.onChange = () => this.mode && this.render();
    basket.onChange = () => { this.onHeld?.(basket.has ? basket.count : null); if (this.mode) this.render(); };
  }

  setSpots(s: Spot[]) { this.spots = s; }

  /** A short notice where the prompt is. */
  toast(text: string) {
    this.prompt.textContent = text;
    this.prompt.classList.add('on');
    this.toastT = 3;
  }

  open(mode: Mode, shelf?: string) {
    if (this.mode && this.mode !== mode) return;
    this.mode = mode;
    if (shelf) this.shelf = shelf;
    this.selected = -1;
    this.message = mode === 'wardrobe' ? 'Pick a bag, or move things between the bag and the wardrobe.'
      : mode === 'register' ? (this.basket.has && this.basket.count ? 'Irasshaimase! Is this everything?' : 'Irasshaimase! Your basket is empty. Take one by the door and pick things from the shelves.')
      : mode === 'shelf' ? 'Add what you want to the basket, then pay at the register.' : '';
    if (this.player) this.player.frozen = true;
    this.prompt.classList.remove('on');
    this.render();
    this.box.classList.add('on');
  }

  close() {
    if (!this.mode) return;
    this.mode = null;
    this.box.classList.remove('on');
    if (this.player) this.player.frozen = false;
  }

  /** What she must settle before she leaves the shop (null: nothing). */
  leaveGuard(): string | null {
    if (this.basket.has && this.basket.count > 0) return 'Pay for the things in your basket first (at the register), or put them back.';
    if (this.basket.has) this.basket.giveBack();
    return null;
  }

  /** Every frame: near a place to press F at, say so. */
  update(x: number, z: number, dt = 0) {
    if (this.mode) return;
    if (this.busy?.()) { this.near = null; this.toastT = 0; this.prompt.classList.remove('on'); return; }
    let best: Spot | null = null, bd = Infinity;
    for (const s of this.spots) { const d = segDist(x, z, s); if (d < s.r && d < bd) { best = s; bd = d; } }
    // (a notice stays for a few seconds, unless she walks to another place)
    if (best !== this.near) this.toastT = 0;
    this.near = best;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT > 0) return; }
    if (best) {
      let label = best.label;
      if (best.kind === 'basket') label = this.basket.has ? 'Put the basket back' : 'Take a basket';
      else if (best.kind === 'shelf') label = this.basket.has ? `${shelfOf(best.shelf!).name}: pick things` : `${shelfOf(best.shelf!).name} (take a basket first, by the door)`;
      this.prompt.innerHTML = `<b>F</b> · ${label}`;
      this.prompt.classList.add('on');
    } else this.prompt.classList.remove('on');
  }

  private act(s: Spot) {
    if (s.kind === 'wardrobe') this.open('wardrobe');
    else if (s.kind === 'register') this.open('register');
    else if (s.kind === 'basket') {
      if (this.basket.has) { const had = this.basket.count; this.basket.giveBack(); this.toast(had ? 'You put everything back and returned the basket.' : 'You returned the basket.'); }
      else { this.basket.take(); this.toast('You took a basket. Pick things from the shelves, then pay at the register.'); }
      this.sound?.cue('swap');
    } else if (s.kind === 'shelf') {
      if (!this.basket.has) this.toast('Take a basket first: the stack is by the door.');
      else this.open('shelf', s.shelf);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  private slotHtml(i: number, attr: string) {
    const s = this.inv.state.slots[i];
    if (!s) return `<button class="slot empty" ${attr}="${i}"></button>`;
    return `<button class="slot${i === this.selected ? ' sel' : ''}" ${attr}="${i}" title="${itemOf(s.id).name}">${itemOf(s.id).icon}${s.n > 1 ? `<i>${s.n}</i>` : ''}</button>`;
  }

  private basketHtml() {
    const b = this.basket;
    const chips = b.items.length ? b.items.map((s) => `<button class="chip" data-drop="${s.id}" title="Put one back">${itemOf(s.id).icon}<i>×${s.n}</i></button>`).join('') : '<em>Empty</em>';
    return `<div class="basket"><b>🧺 Basket</b> <span>${b.count}/${BASKET_CAP}</span><div class="chips">${chips}</div><span class="tot">¥${b.total}</span></div>`;
  }

  private render() {
    const inv = this.inv, st = inv.state, bag = inv.bag;
    const head = `<div class="bh"><b>${bag.icon} ${bag.name}</b><span>${inv.used}/${st.slots.length} slots</span><span class="yen">¥${st.yen}</span><button data-close>✕</button></div>`;
    const grid = `<div class="grid">${st.slots.map((_, i) => this.slotHtml(i, this.mode === 'wardrobe' ? 'data-store' : 'data-slot')).join('')}</div>`;
    let html = '';
    if (this.mode === 'bag') {
      const s = st.slots[this.selected];
      const it = s ? itemOf(s.id) : null;
      html = `${head}${grid}<div class="info">${it ? `<b>${it.icon} ${it.name}</b> <small>${it.jp}</small><br>${it.note}${it.use ? ` <button data-use="${this.selected}">Use</button>` : ''}` : 'Pick something to see it.'}</div><div class="msg">${this.message}</div><div class="hint">B or Esc: close</div>`;
    } else if (this.mode === 'wardrobe') {
      const bags = BAGS.map((b) => `<button class="bagcard${b.id === st.bag ? ' on' : ''}" data-bag="${b.id}"><span>${b.icon}</span><b>${b.name}</b><small>${b.slots} slots</small></button>`).join('');
      const stash = st.stash.length ? st.stash.map((t, i) => `<button class="slot" data-take="${i}" title="${itemOf(t.id).name}">${itemOf(t.id).icon}<i>${t.n}</i></button>`).join('') : '<em>Empty</em>';
      html = `${head}<h5>Bags</h5><div class="bags">${bags}</div><h5>In your bag <small>(click to put away)</small></h5>${grid}<h5>In the wardrobe <small>(click to take)</small></h5><div class="grid stash">${stash}</div><div class="msg">${this.message}</div><div class="hint">Esc: close</div>`;
    } else if (this.mode === 'shelf') {
      const sh = shelfOf(this.shelf);
      const full = this.basket.count >= BASKET_CAP;
      const rows = sh.items.map((id) => { const i = itemOf(id); return `<div class="row"><span>${i.icon}</span><div><b>${i.name}</b> <small>${i.jp}</small><br><small>${i.note}</small></div><i>¥${i.price}</i><button data-add="${id}"${full ? ' disabled' : ''}>${full ? 'Full' : 'Add'}</button></div>`; }).join('');
      html = `<div class="bh"><b>${sh.icon} ${sh.name}</b><span>${sh.jp}</span><span class="yen">¥${st.yen}</span><button data-close>✕</button></div><div class="rows">${rows}</div>${this.basketHtml()}<div class="msg">${this.message}</div><div class="hint">Esc: close · pay at the register</div>`;
    } else if (this.mode === 'register') {
      const b = this.basket;
      const rows = b.items.map((s) => { const i = itemOf(s.id); return `<div class="row"><span>${i.icon}</span><div><b>${i.name}</b> <small>${i.jp}</small></div><i>×${s.n} · ¥${i.price * s.n}</i><button data-drop="${s.id}">−</button></div>`; }).join('');
      html = `<div class="bh"><b>🧾 Register</b><span>Hoshi Mart</span><span class="yen">¥${st.yen}</span><button data-close>✕</button></div>${rows ? `<div class="rows">${rows}</div>` : '<div class="info">Nothing in the basket.</div>'}<div class="basket"><b>Total</b><span class="tot">¥${b.total}</span></div><div class="msg">${this.message}</div><button class="pay" data-pay${b.count ? '' : ' disabled'}>Pay ¥${b.total}</button> ${this.onChat ? '<button class="chat" data-chat>💬 Talk to the clerk</button>' : ''}<div class="hint">Esc: close</div>`;
    }
    this.box.innerHTML = html;
  }

  private click(t: HTMLElement) {
    const el = t.closest('button');
    if (!el || el.disabled) return;
    const d = el.dataset;
    if ('close' in d) return this.close();
    if ('chat' in d) { this.close(); this.onChat?.(); return; }
    if (d.slot !== undefined) { this.selected = Number(d.slot); this.message = ''; return this.render(); }
    if (d.use !== undefined) {
      const msg = this.inv.use(Number(d.use));
      if (msg) { this.message = msg; this.sound?.cue('use'); }
      if (!this.inv.state.slots[this.selected]) this.selected = -1;
      return this.render();
    }
    if (d.store !== undefined) { this.inv.store(Number(d.store)); this.sound?.cue('swap'); return; }
    if (d.take !== undefined) {
      const before = this.inv.free;
      this.inv.take(Number(d.take));
      if (this.inv.free === before && this.inv.state.stash[Number(d.take)]) this.message = 'Your bag is full.';
      this.sound?.cue('swap');
      return this.render();
    }
    if (d.bag !== undefined) {
      const left = this.inv.swapBag(d.bag);
      this.message = left > 0 ? `Changed the bag. ${left} things did not fit and stay in the wardrobe.` : 'Changed the bag.';
      this.sound?.cue('swap');
      return this.render();
    }
    if (d.add !== undefined) {
      if (this.basket.add(d.add)) { this.message = `${itemOf(d.add).name} is in the basket.`; this.sound?.cue('swap'); }
      else this.message = 'The basket is full.';
      return this.render();
    }
    if (d.drop !== undefined) { this.basket.removeOne(d.drop); this.message = `You put back the ${itemOf(d.drop).name}.`; this.sound?.cue('swap'); return this.render(); }
    if ('pay' in d) {
      const b = this.basket;
      const why = this.inv.pay(b.items, b.total);
      if (why) this.message = why;
      else {
        b.giveBack();
        this.message = 'Thank you very much! (The things are in your bag.)';
        this.sound?.cue('buy');
        this.sound?.speak('clerk', 'Arigatou gozaimashita! Mata okoshi kudasai!');
      }
      return this.render();
    }
  }
}
export { MAX_STACK };
