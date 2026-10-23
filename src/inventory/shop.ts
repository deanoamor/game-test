import { BASKET_CAP, itemOf } from './items';
import type { Stack } from './store';

/** The shopping basket: taken from the stack at the door, filled at the shelves, paid for at the register. */
export class Basket {
  /** She has one in her hand. */
  has = false;
  items: Stack[] = [];
  onChange: (() => void) | null = null;

  get count() { return this.items.reduce((n, s) => n + s.n, 0); }
  get total() { return this.items.reduce((n, s) => n + itemOf(s.id).price * s.n, 0); }

  take() { this.has = true; this.onChange?.(); }
  /** Put it all back on the shelves and return the basket. */
  giveBack() { this.has = false; this.items = []; this.onChange?.(); }

  add(id: string): boolean {
    if (!this.has || this.count >= BASKET_CAP) return false;
    const s = this.items.find((t) => t.id === id);
    if (s) s.n++; else this.items.push({ id, n: 1 });
    this.onChange?.();
    return true;
  }
  removeOne(id: string) {
    const s = this.items.find((t) => t.id === id);
    if (!s) return;
    if (--s.n <= 0) this.items = this.items.filter((t) => t !== s);
    this.onChange?.();
  }
}
