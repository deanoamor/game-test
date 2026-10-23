import { BAGS, ITEMS, MAX_STACK, bagOf, itemOf } from './items';

/**
 * What she carries: a bag with a number of slots (each holds up to five of the same thing), the wardrobe at home where
 * anything can be kept, and her money. It is kept in the browser, because every world loads on a page of its own.
 */

export interface Stack { id: string; n: number }
interface State { bag: string; slots: (Stack | null)[]; stash: Stack[]; yen: number }

const KEY = 'hoshi.bag';

export class Inventory {
  state: State;
  /** Called after any change. */
  onChange: (() => void) | null = null;

  constructor() {
    let s: State | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* no storage */ }
    if (s && Array.isArray(s.slots) && Array.isArray(s.stash) && BAGS.some((b) => b.id === s!.bag) && s.slots.length === bagOf(s.bag).slots) this.state = s;
    else this.state = { bag: 'school', slots: Array(bagOf('school').slots).fill(null), stash: [], yen: 3000 };
    if (!s) { this.add('keys', 1); this.add('notebook', 1); this.add('onigiri', 2); this.add('coffee', 1); this.save(); }
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* no storage */ }
    this.onChange?.();
  }

  get bag() { return bagOf(this.state.bag); }
  get used() { return this.state.slots.filter(Boolean).length; }
  get free() { return this.state.slots.length - this.used; }

  /** How many of an item would fit in the bag now. */
  room(id: string): number {
    let n = 0;
    for (const s of this.state.slots) n += s ? (s.id === id ? MAX_STACK - s.n : 0) : MAX_STACK;
    return n;
  }

  /** Put items in the bag (into the stacks that have room first); returns how many went in. */
  add(id: string, count = 1): number {
    let left = count;
    for (const s of this.state.slots) if (s && s.id === id && left > 0) { const k = Math.min(left, MAX_STACK - s.n); s.n += k; left -= k; }
    for (let i = 0; i < this.state.slots.length && left > 0; i++) if (!this.state.slots[i]) { const k = Math.min(left, MAX_STACK); this.state.slots[i] = { id, n: k }; left -= k; }
    if (left < count) this.save();
    return count - left;
  }

  /** Use up one of the item in a slot; returns what to tell her (null: it cannot be used). */
  use(slot: number): string | null {
    const s = this.state.slots[slot];
    if (!s) return null;
    const it = itemOf(s.id);
    if (!it.use) return null;
    if (--s.n <= 0) this.state.slots[slot] = null;
    this.save();
    return it.use;
  }

  /** Buy one: money out, item in. Returns why not, or null when it worked. */
  buy(id: string): string | null {
    const it = itemOf(id);
    if (this.state.yen < it.price) return 'Not enough money.';
    if (this.room(id) < 1) return 'Your bag is full.';
    this.state.yen -= it.price;
    this.add(id, 1);
    this.save();
    return null;
  }

  /** Move a whole slot to the wardrobe. */
  store(slot: number) {
    const s = this.state.slots[slot];
    if (!s) return;
    const g = this.state.stash.find((t) => t.id === s.id);
    if (g) g.n += s.n; else this.state.stash.push({ ...s });
    this.state.slots[slot] = null;
    this.save();
  }

  /** Take as much as fits of a stack of the wardrobe into the bag. */
  take(index: number) {
    const t = this.state.stash[index];
    if (!t) return;
    const k = this.add(t.id, Math.min(t.n, MAX_STACK * 99));
    t.n -= k;
    if (t.n <= 0) this.state.stash.splice(index, 1);
    this.save();
  }

  /** Change the bag: what she carries moves over, and whatever does not fit stays in the wardrobe. */
  swapBag(id: string): number {
    if (id === this.state.bag) return 0;
    const all = this.state.slots.filter((s): s is Stack => !!s);
    this.state.bag = id;
    this.state.slots = Array(bagOf(id).slots).fill(null);
    let left = 0;
    for (const s of all) {
      const k = this.add(s.id, s.n);
      if (k < s.n) {
        left += s.n - k;
        const g = this.state.stash.find((t) => t.id === s.id);
        if (g) g.n += s.n - k; else this.state.stash.push({ id: s.id, n: s.n - k });
      }
    }
    this.save();
    return left;
  }

  /** Known item ids (for the shop). */
  static get shopItems() { return ITEMS.filter((i) => i.price > 0); }
}
