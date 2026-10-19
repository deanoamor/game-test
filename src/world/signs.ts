import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export interface Cell { u0: number; v0: number; u1: number; v1: number; aspect: number }

const FONT = "'Noto Sans JP','Yu Gothic','Hiragino Sans','Meiryo','IPAGothic','IPAPGothic',sans-serif";

/**
 * Every picture on the signs, drawn once into one texture: vertical banners, shop signs, a speed limit, a stop sign, the
 * words painted on the road, vending machine fronts and menu boards. Cells are looked up by name.
 */
export class SignAtlas {
  texture: CanvasTexture;
  private cells = new Map<string, Cell>();
  readonly tallNames: string[] = [];
  readonly wideNames: string[] = [];

  constructor() {
    const W = 1024, H = 1024;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    const reg = (name: string, x: number, y: number, w: number, h: number) => {
      this.cells.set(name, { u0: x / W, v0: 1 - (y + h) / H, u1: (x + w) / W, v1: 1 - y / H, aspect: w / h });
    };
    const text = (t: string, x: number, y: number, w: number, h: number, fg: string, max = 90, vertical = false) => {
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (vertical) {
        const chars = [...t];
        const size = Math.min(max, (h - 50) / chars.length);
        g.font = `bold ${size}px ${FONT}`;
        chars.forEach((ch, k) => g.fillText(ch, x + w / 2, y + 30 + (k + 0.5) * ((h - 60) / chars.length)));
      } else {
        let size = max;
        g.font = `bold ${size}px ${FONT}`;
        while (g.measureText(t).width > w - 40 && size > 14) { size -= 4; g.font = `bold ${size}px ${FONT}`; }
        g.fillText(t, x + w / 2, y + h / 2 + 3);
      }
    };

    // tall banners: 8 across
    const tall: [string, string, string, string, string][] = [
      ['sukiyaki', 'すき焼き', '#c8322e', '#ffd23a', '#7a1010'],
      ['ramenBanner', 'ラーメン', '#d8322e', '#ffffff', '#7a1010'],
      ['sake', '酒処', '#1b4fa8', '#ffffff', '#0c2a6a'],
      ['sushi', '寿司', '#2b2d3a', '#ffd23a', '#ffd23a'],
      ['dango', '団子', '#e68ab0', '#ffffff', '#a8486f'],
      ['shokudo', '食堂', '#2f8f5a', '#ffffff', '#145a34'],
      ['ryokan', '旅館', '#6a3fb5', '#ffffff', '#3a1f7a'],
      ['pharmacy', '薬', '#1f9a5b', '#ffffff', '#0d5a32'],
    ];
    tall.forEach(([key, t, bg, fg, edge], i) => {
      const x = i * 128, y = 0, w = 128, h = 384;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, bg);
      grd.addColorStop(1, edge);
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
      g.strokeStyle = fg;
      g.lineWidth = 6;
      g.strokeRect(x + 10, y + 10, w - 20, h - 20);
      text(t, x, y, w, h, fg, 84, true);
      reg(key, x, y, w, h);
      this.tallNames.push(key);
    });

    // wide shop signs: 2 across, 4 down, 512 x 128
    const wide: [string, string, string, string][] = [
      ['ramenAwning', 'ラーメン', '#17a39a', '#ffffff'],
      ['yaoya', '八百屋', '#3b9a3a', '#fff6c8'],
      ['kome', '米・酒', '#8a5a2a', '#ffffff'],
      ['shoten', '商店', '#c8322e', '#ffffff'],
      ['denki', '電器店', '#1f5ea8', '#ffffff'],
      ['laundry', 'コインランドリー', '#2a9bd6', '#ffffff'],
      ['parking', '月極駐車場', '#f2c230', '#2a2a2a'],
      ['inn', '民宿 さくら', '#6a3fb5', '#ffffff'],
    ];
    wide.forEach(([key, t, bg, fg], i) => {
      const x = (i % 2) * 512, y = 384 + Math.floor(i / 2) * 128, w = 512, h = 128;
      g.fillStyle = bg;
      g.fillRect(x, y, w, h);
      g.strokeStyle = fg;
      g.lineWidth = 5;
      g.strokeRect(x + 6, y + 6, w - 12, h - 12);
      text(t, x, y, w, h, fg, 78);
      reg(key, x, y, w, h);
      this.wideNames.push(key);
    });

    // a round 30 km/h limit
    {
      const x = 0, y = 896, s = 128;
      g.fillStyle = '#c8322e';
      g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2 - 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2 - 16, 0, Math.PI * 2); g.fill();
      text('30', x, y, s, s, '#1a1a1a', 58);
      reg('speed30', x, y, s, s);
    }
    // an inverted triangle stop sign
    {
      const x = 128, y = 896, s = 128;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(x + 4, y + 14); g.lineTo(x + s - 4, y + 14); g.lineTo(x + s / 2, y + s - 6); g.closePath(); g.fill();
      g.fillStyle = '#c8322e';
      g.beginPath(); g.moveTo(x + 18, y + 24); g.lineTo(x + s - 18, y + 24); g.lineTo(x + s / 2, y + s - 28); g.closePath(); g.fill();
      text('止まれ', x + 26, y + 20, 76, 40, '#ffffff', 22);
      reg('stopSign', x, y, s, s);
    }
    // the words painted on the road
    {
      const x = 256, y = 896, w = 256, h = 128;
      text('止まれ', x, y, w, h, '#f4f1e6', 100);
      reg('roadStop', x, y, w, h);
    }
    // vending machine fronts: rows of bottles
    const vend = (name: string, x: number, body: string, labels: string[]) => {
      const y = 896, w = 96, h = 128;
      g.fillStyle = body;
      g.fillRect(x, y, w, h);
      g.fillStyle = '#e8f4f8';
      g.fillRect(x + 6, y + 8, w - 12, 70);
      labels.forEach((c, i) => {
        const bx = x + 10 + (i % 4) * 19, by = y + 14 + Math.floor(i / 4) * 30;
        g.fillStyle = c;
        g.fillRect(bx, by, 14, 22);
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.fillRect(bx + 2, by + 2, 4, 18);
      });
      g.fillStyle = '#1b1b1b';
      g.fillRect(x + 6, y + 86, w - 12, 18);
      g.fillStyle = '#ffe36a';
      g.fillRect(x + 12, y + 110, w - 24, 6);
      reg(name, x, y, w, h);
    };
    vend('vendRed', 512, '#c8322e', ['#e8402a', '#4aa8e0', '#f2c230', '#3a9a5a', '#9a6a3a', '#e8402a', '#2a2a2a', '#f08aac']);
    vend('vendBlue', 608, '#1f5ea8', ['#f2c230', '#e8402a', '#4aa8e0', '#9a6a3a', '#3a9a5a', '#f08aac', '#e8402a', '#2a2a2a']);
    // a menu board
    {
      const x = 704, y = 896, s = 128;
      g.fillStyle = '#2b2d2b';
      g.fillRect(x, y, s, s);
      g.strokeStyle = '#8a5a2a';
      g.lineWidth = 6;
      g.strokeRect(x + 3, y + 3, s - 6, s - 6);
      text('本日の', x, y + 4, s, 40, '#ffffff', 26);
      text('醤油 800円', x, y + 40, s, 34, '#ffd23a', 22);
      text('味噌 850円', x, y + 72, s, 34, '#ffd23a', 22);
      reg('menu', x, y, s, s);
    }
    // a bus stop sign
    {
      const x = 832, y = 896, s = 128;
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, s, s);
      g.fillStyle = '#1f5ea8';
      g.fillRect(x, y, s, 44);
      text('バス停', x, y, s, 44, '#ffffff', 30);
      text('星の村', x, y + 48, s, 40, '#1a1a1a', 28);
      text('駅前 ←', x, y + 88, s, 34, '#c8322e', 24);
      reg('busStop', x, y, s, s);
    }
    this.texture = new CanvasTexture(cv);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
  }

  get(name: string): Cell {
    const c = this.cells.get(name);
    if (!c) throw new Error(`no sign called ${name}`);
    return c;
  }
}
