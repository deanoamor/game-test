/**
 * Game mode and dev mode. The game (what players get) starts in World 1, cannot jump between worlds or change the time of
 * day, and only lets the player look in the bag and set the graphics. Dev mode has everything (the worlds, the clock, the
 * places, the test room, the URL options) and is opened with a password. The mode is kept for the browser tab.
 *
 * Note: this is all in the page, so it keeps the curious out; it is not a lock. For a game that must never show dev mode,
 * publish a build without it.
 */

/** The SHA-256 of the password (with this salt), so the password itself is not in the page. */
const PASSWORD_HASH = 'c322c4495f5760c665774dba39bd57df86c9094f891da74215fb42903560ae96';
const SALT = 'hoshi-no-kuni:';
const KEY = 'hoshi.dev';

/** Whether this tab is in dev mode. */
export function isDev(): boolean {
  try { return sessionStorage.getItem(KEY) === PASSWORD_HASH; } catch { return false; }
}

/** SHA-256 as hex: the browser's own where there is one (a secure page), else a small one written here. */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Plain(bytes);
}

function sha256Plain(msg: Uint8Array): string {
  const K = new Uint32Array(64);
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  primes.forEach((p, i) => { K[i] = Math.floor((Math.cbrt(p) % 1) * 2 ** 32); });
  const H = new Uint32Array(8);
  primes.slice(0, 8).forEach((p, i) => { H[i] = Math.floor((Math.sqrt(p) % 1) * 2 ** 32); });
  const l = msg.length, total = (((l + 9 + 63) >> 6) << 6);
  const buf = new Uint8Array(total);
  buf.set(msg); buf[l] = 0x80;
  new DataView(buf.buffer).setUint32(total - 4, l * 8, false);
  new DataView(buf.buffer).setUint32(total - 8, Math.floor((l * 8) / 2 ** 32), false);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    const dv = new DataView(buf.buffer, o, 64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return [...H].map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Try the password: on success this tab is in dev mode (the page reloads into it). */
export async function unlock(password: string): Promise<boolean> {
  if ((await sha256(SALT + password)) !== PASSWORD_HASH) return false;
  try { sessionStorage.setItem(KEY, PASSWORD_HASH); } catch { return false; }
  return true;
}

/** Leave dev mode (back to the game, at the start). */
export function lock() {
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('hoshi.next'); } catch { /* no storage */ }
  // (the address loses its options: the game does not take them)
  location.assign(location.pathname);
}
