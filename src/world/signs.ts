import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface Cell { u0: number; v0: number; u1: number; v1: number; aspect: number }

const FONT = "'Noto Sans JP','Yu Gothic','Hiragino Sans','Meiryo','IPAGothic','IPAPGothic',sans-serif";

/** The neon sign texture: tall shop signs (cells 0..7) and wide billboards (cells 8..15), all drawn at start-up. */
export class SignAtlas {
  texture: CanvasTexture;
  tall: Cell[] = [];
  wide: Cell[] = [];

  constructor() {
    const W = 1024, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#222';
    g.fillRect(0, 0, W, H);
    const cell = (x: number, y: number, w: number, h: number): Cell => ({ u0: x / W, v0: 1 - (y + h) / H, u1: (x + w) / W, v1: 1 - y / H, aspect: w / h });

    // tall vertical signs: 8 across, 512 high each
    const tall: [string, string, string, string][] = [
      ['ラーメン', '#d8322e', '#ffffff', '#ffd23a'],
      ['居酒屋', '#1b4fa8', '#ffffff', '#7fd4ff'],
      ['カラオケ', '#c2288f', '#ffffff', '#ff9bdc'],
      ['薬局', '#1f9a5b', '#ffffff', '#b8ffd8'],
      ['焼肉', '#f08a1c', '#2a1608', '#fff0c0'],
      ['寿司', '#2b2d3a', '#ffd23a', '#ff6a5a'],
      ['ホテル', '#6a3fb5', '#ffffff', '#e6c9ff'],
      ['麻雀', '#12908e', '#ffffff', '#b6fff6'],
    ];
    tall.forEach(([text, bg, fg, edge], i) => {
      const x = i * 128, y = 0, w = 128, h = 512;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, bg);
      grd.addColorStop(1, shade(bg, 0.72));
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
      g.strokeStyle = edge;
      g.lineWidth = 8;
      g.strokeRect(x + 8, y + 8, w - 16, h - 16);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const chars = [...text];
      const size = Math.min(92, (h - 70) / chars.length);
      g.font = `bold ${size}px ${FONT}`;
      chars.forEach((ch, k) => g.fillText(ch, x + w / 2, y + 40 + (k + 0.5) * ((h - 80) / chars.length)));
      this.tall.push(cell(x, y, w, h));
    });

    // wide billboards: 2 across, 4 down, 512 x 128 each
    const wide: [string, string, string, string][] = [
      ['ラーメン横丁', '#c92a2a', '#ffffff', '#ffd23a'],
      ['居酒屋 さくら', '#2b2d3a', '#ff9bdc', '#ff5fb5'],
      ['SAKURA HOTEL', '#1b3d8f', '#ffffff', '#6fd6ff'],
      ['カラオケ 24H', '#7a2db8', '#ffffff', '#ff9bff'],
      ['桜デパート', '#f0f0e8', '#d8322e', '#d8322e'],
      ['ネオン寿司', '#12908e', '#ffffff', '#ffe36a'],
      ['新宿マート', '#f08a1c', '#ffffff', '#fff0c0'],
      ['電気 ・ 家電', '#1f9a5b', '#ffffff', '#c0ffd8'],
    ];
    wide.forEach(([text, bg, fg, edge], i) => {
      const x = (i % 2) * 512, y = 512 + Math.floor(i / 2) * 128, w = 512, h = 128;
      const grd = g.createLinearGradient(x, y, x + w, y);
      grd.addColorStop(0, bg);
      grd.addColorStop(1, shade(bg, 0.78));
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
      g.strokeStyle = edge;
      g.lineWidth = 6;
      g.strokeRect(x + 6, y + 6, w - 12, h - 12);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 76;
      g.font = `bold ${size}px ${FONT}`;
      while (g.measureText(text).width > w - 50 && size > 20) {
        size -= 4;
        g.font = `bold ${size}px ${FONT}`;
      }
      g.fillText(text, x + w / 2, y + h / 2 + 4);
      this.wide.push(cell(x, y, w, h));
    });

    this.texture = new CanvasTexture(cv);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
  }
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), gg = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${gg},${b})`;
}
