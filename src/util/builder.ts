import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

export type V3 = [number, number, number];

const tmp = new Color();
const rgb = (c: string | number | Color): [number, number, number] => {
  tmp.set(c as never);
  return [tmp.r, tmp.g, tmp.b];
};

/**
 * Collects flat-shaded, vertex-coloured triangles, so a whole district becomes one mesh. Colours are linear.
 * Boxes get a soft "ambient occlusion" gradient: their sides are darker at the bottom.
 */
export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  withUv = false;

  get triangles() { return this.pos.length / 9; }

  /** One triangle with a colour per vertex; the normal comes from the winding (counter-clockwise = front). */
  tri(a: V3, b: V3, c: V3, ca: [number, number, number], cb = ca, cc = ca, uvs?: [number, number][]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    this.pos.push(...a, ...b, ...c);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.col.push(...ca, ...cb, ...cc);
    if (uvs) {
      this.withUv = true;
      this.uv.push(uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1]);
    } else this.uv.push(0, 0, 0, 0, 0, 0);
  }

  /** A quad a-b-c-d (counter-clockwise from the front) with one colour per corner. */
  quad(a: V3, b: V3, c: V3, d: V3, ca: [number, number, number], cb = ca, cc = ca, cd = ca, uvs?: [number, number][]) {
    this.tri(a, b, c, ca, cb, cc, uvs && [uvs[0], uvs[1], uvs[2]]);
    this.tri(a, c, d, ca, cc, cd, uvs && [uvs[0], uvs[2], uvs[3]]);
  }

  /** A box. `yaw` turns it about its own centre (degrees). `ao` darkens the bottom of its sides (0 = none). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: string | number | Color, o: { yaw?: number; ao?: number; noBottom?: boolean; noTop?: boolean; shade?: number } = {}) {
    const c = rgb(color);
    const k = o.shade ?? 1;
    const top: [number, number, number] = [c[0] * k, c[1] * k, c[2] * k];
    const ao = 1 - (o.ao ?? 0.18);
    const bot: [number, number, number] = [top[0] * ao, top[1] * ao, top[2] * ao];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const yaw = ((o.yaw ?? 0) * Math.PI) / 180;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (x: number, y: number, z: number): V3 => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const x0 = -hx, x1 = hx, y0 = -hy, y1 = hy, z0 = -hz, z1 = hz;
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), bot, bot, top, top);
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), bot, bot, top, top);
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), bot, bot, top, top);
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), bot, bot, top, top);
    if (!o.noTop) {
      const t: [number, number, number] = [Math.min(1, top[0] * 1.08), Math.min(1, top[1] * 1.08), Math.min(1, top[2] * 1.08)];
      this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), t);
    }
    if (!o.noBottom) this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), bot);
  }

  /** A cone or cylinder along Y (radius `rb` at the bottom, `rt` at the top). */
  frustum(cx: number, cy: number, cz: number, rb: number, rt: number, h: number, seg: number, color: string | number | Color, o: { ao?: number; rotate?: number; cap?: boolean; shade?: number; sx?: number; sz?: number } = {}) {
    const c = rgb(color);
    const k = o.shade ?? 1;
    const top: [number, number, number] = [c[0] * k, c[1] * k, c[2] * k];
    const ao = 1 - (o.ao ?? 0.2);
    const bot: [number, number, number] = [top[0] * ao, top[1] * ao, top[2] * ao];
    const sx = o.sx ?? 1, sz = o.sz ?? 1;
    const ring = (r: number, y: number, i: number): V3 => {
      const a = ((i + (o.rotate ?? 0)) / seg) * Math.PI * 2;
      return [cx + Math.cos(a) * r * sx, y, cz + Math.sin(a) * r * sz];
    };
    for (let i = 0; i < seg; i++) {
      const a = ring(rb, cy, i), b = ring(rb, cy, i + 1), c1 = ring(rt, cy + h, i + 1), d = ring(rt, cy + h, i);
      if (rt < 1e-5) this.tri(a, d, b, bot, top, bot);
      else this.quad(b, a, d, c1, bot, bot, top, top);
      if (o.cap !== false && rt >= 1e-5) this.tri([cx, cy + h, cz], c1, d, top);
    }
  }

  /** A gable roof over a rectangle: the ridge runs along X (or Z when `alongZ`). */
  gable(cx: number, y: number, cz: number, w: number, d: number, h: number, color: string | number | Color, o: { alongZ?: boolean; shade?: number; ao?: number } = {}) {
    const c = rgb(color);
    const k = o.shade ?? 1;
    const hi: [number, number, number] = [c[0] * k, c[1] * k, c[2] * k];
    const lo: [number, number, number] = [hi[0] * 0.8, hi[1] * 0.8, hi[2] * 0.8];
    const hx = w / 2, hz = d / 2;
    if (!o.alongZ) {
      const a: V3 = [cx - hx, y, cz + hz], b: V3 = [cx + hx, y, cz + hz], c1: V3 = [cx + hx, y + h, cz], d1: V3 = [cx - hx, y + h, cz];
      this.quad(a, b, c1, d1, lo, lo, hi, hi);
      const e: V3 = [cx + hx, y, cz - hz], f: V3 = [cx - hx, y, cz - hz];
      this.quad(e, f, d1, c1, lo, lo, hi, hi);
      this.tri([cx + hx, y, cz + hz], [cx + hx, y, cz - hz], [cx + hx, y + h, cz], lo, lo, hi);
      this.tri([cx - hx, y, cz - hz], [cx - hx, y, cz + hz], [cx - hx, y + h, cz], lo, lo, hi);
    } else {
      const a: V3 = [cx + hx, y, cz + hz], b: V3 = [cx + hx, y, cz - hz], c1: V3 = [cx, y + h, cz - hz], d1: V3 = [cx, y + h, cz + hz];
      this.quad(a, b, c1, d1, lo, lo, hi, hi);
      const e: V3 = [cx - hx, y, cz - hz], f: V3 = [cx - hx, y, cz + hz];
      this.quad(e, f, d1, c1, lo, lo, hi, hi);
      this.tri([cx - hx, y, cz + hz], [cx + hx, y, cz + hz], [cx, y + h, cz + hz], lo, lo, hi);
      this.tri([cx + hx, y, cz - hz], [cx - hx, y, cz - hz], [cx, y + h, cz - hz], lo, lo, hi);
    }
  }

  /** A quad whose front is whichever side faces `facing` (so you do not have to think about winding). */
  quadFacing(a: V3, b: V3, c: V3, d: V3, facing: V3, ca: [number, number, number], uvs?: [number, number][]) {
    const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]);
    const ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    if (nx * facing[0] + ny * facing[1] + nz * facing[2] >= 0) this.quad(a, b, c, d, ca, ca, ca, ca, uvs);
    else this.quad(a, d, c, b, ca, ca, ca, ca, uvs && [uvs[0], uvs[3], uvs[2], uvs[1]]);
  }

  /** A flat quad lying on a wall or the ground: corners `a..d` counter-clockwise from the front. */
  flat(a: V3, b: V3, c: V3, d: V3, color: string | number | Color) {
    const col = rgb(color);
    this.quad(a, b, c, d, col);
  }

  /** Append another builder translated by (dx, dy, dz). */
  append(o: GeoBuilder, dx = 0, dy = 0, dz = 0) {
    for (let i = 0; i < o.pos.length; i += 3) this.pos.push(o.pos[i] + dx, o.pos[i + 1] + dy, o.pos[i + 2] + dz);
    this.nor.push(...o.nor);
    this.col.push(...o.col);
    this.uv.push(...o.uv);
    this.withUv ||= o.withUv;
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    if (this.withUv) g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export const toRgb = rgb;
export const shadeOf = (c: [number, number, number], k: number): [number, number, number] => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
