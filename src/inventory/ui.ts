import type { Player } from '../player/player';
import type { Sound } from '../audio/sound';
import { BAGS, MAX_STACK, itemOf } from './items';
import { Inventory } from './store';

/**
 * The bag, the wardrobe and the shop, as one panel in the middle of the screen. B opens the bag; F at the wardrobe at
 * home opens the wardrobe (change the bag, keep things); the shop opens when she has talked to the clerk. The player
 * stands still while a panel is open. Esc (or the button) closes it.
 */

type Mode = 'bag' | 'wardrobe' | 'shop';
export interface Spot { x: number; z: number; r: number; label: string; kind: 'wardrobe' }

export class BagUI {
  private box: HTMLElement;
  private prompt: HTMLElement;
  mode: Mode | null = null;
  private selected = -1;
  private message = '';
  private spots: Spot[] = [];
  private near: Spot | null = null;

  constructor(private inv: Inventory, private player: Player | null, host: HTMLElement, private sound?: Sound) {
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
      else if (e.code === 'KeyF' && !e.repeat && !this.mode && this.near) this.open('wardrobe');
    });
    this.box.addEventListener('click', (e) => this.click(e.target as HTMLElement));
    inv.onChange = () => this.mode && this.render();
  }

  setSpots(s: Spot[]) { this.spots = s; }

  open(mode: Mode) {
    if (this.mode && this.mode !== mode) return;
    this.mode = mode;
    this.selected = -1;
    this.message = mode === 'wardrobe' ? 'Pick a bag, or move things between the bag and the wardrobe.' : mode === 'shop' ? 'Irasshaimase! What would you like?' : '';
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

  /** Every frame: near the wardrobe, say so. */
  update(x: number, z: number) {
    if (this.mode) return;
    this.near = this.spots.find((s) => Math.hypot(x - s.x, z - s.z) < s.r) ?? null;
    if (this.near) { this.prompt.innerHTML = `<b>F</b> · ${this.near.label}`; this.prompt.classList.add('on'); } else this.prompt.classList.remove('on');
  }

  // ---------------------------------------------------------------------------------------------------------------
  private slotHtml(i: number, attr: string) {
    const s = this.inv.state.slots[i];
    if (!s) return `<button class="slot empty" ${attr}="${i}"></button>`;
    return `<button class="slot${i === this.selected ? ' sel' : ''}" ${attr}="${i}" title="${itemOf(s.id).name}">${itemOf(s.id).icon}${s.n > 1 ? `<i>${s.n}</i>` : ''}</button>`;
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
    } else {
      const rows = Inventory.shopItems.map((i) => `<div class="row"><span>${i.icon}</span><div><b>${i.name}</b> <small>${i.jp}</small><br><small>${i.note}</small></div><i>¥${i.price}</i><button data-buy="${i.id}">Buy</button></div>`).join('');
      html = `${head}<div class="rows">${rows}</div><div class="msg">${this.message}</div><div class="hint">Esc: close</div>`;
    }
    this.box.innerHTML = html;
  }

  private click(t: HTMLElement) {
    const el = t.closest('button');
    if (!el) return;
    const d = el.dataset;
    if ('close' in d) return this.close();
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
    if (d.buy !== undefined) {
      const why = this.inv.buy(d.buy);
      this.message = why ?? `Thank you very much! (${itemOf(d.buy).name})`;
      if (!why) this.sound?.cue('buy');
      return this.render();
    }
  }
}
export { MAX_STACK };
