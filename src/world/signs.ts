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
    const W = 2048, H = 1536;
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

    // ---- the second half of the texture: more shops, the convenience store, road signs ----
    const X = 1024;
    const tall2: [string, string, string, string, string][] = [
      ['izakaya', '居酒屋', '#5a3a24', '#f4e6c8', '#2e1c10'],
      ['yakitori', '焼鳥', '#d8322e', '#ffffff', '#7a1010'],
      ['kissa', '喫茶', '#2f6f5a', '#ffffff', '#123a2c'],
      ['sushiV', 'すし', '#f4ece0', '#c8322e', '#d8c8b0'],
      ['udon', 'うどん', '#f4f4ee', '#1f4f8a', '#c8c8c0'],
      ['gyoza', '餃子', '#f2c230', '#c8322e', '#b8862a'],
      ['beer', '生ビール', '#f2d23a', '#2a2a2a', '#b89a1a'],
      ['karaoke', 'カラオケ', '#7a2db8', '#ffffff', '#3a1060'],
    ];
    tall2.forEach(([key, t, bg, fg, edge], i) => {
      const x = X + i * 128, y = 0, w = 128, h = 384;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, bg);
      grd.addColorStop(1, edge);
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
      g.strokeStyle = fg;
      g.lineWidth = 5;
      g.strokeRect(x + 10, y + 10, w - 20, h - 20);
      text(t, x, y, w, h, fg, 80, true);
      reg(key, x, y, w, h);
      this.tallNames.push(key);
    });
    const wide2: [string, string, string, string, string?][] = [
      ['konbini', 'HOSHI MART', '#2a8fd8', '#ffffff'],
      ['super', 'スーパー ほし', '#d8322e', '#ffffff'],
      ['sushiBoard', '寿司 日本で寿司', '#f6f2e8', '#c8322e'],
      ['cafeBoard', 'カフェ 554-25-088', '#2b2a28', '#f4e6c8'],
      ['izakayaBoard', '居酒屋 たぬき', '#5a3a24', '#f4e6c8'],
      ['clinic', 'ほし医院 内科', '#ffffff', '#2f8f5a'],
      ['books', '本屋 ほしの', '#1f4f8a', '#ffffff'],
      ['barber', '理容 カット', '#f4f4ee', '#1f4f8a'],
    ];
    wide2.forEach(([key, t, bg, fg], i) => {
      const x = X + (i % 2) * 512, y = 384 + Math.floor(i / 2) * 128, w = 512, h = 128;
      g.fillStyle = bg;
      g.fillRect(x, y, w, h);
      if (key === 'konbini') {
        g.fillStyle = '#ffffff';
        g.fillRect(x, y + 92, w, 14);
        g.fillStyle = '#8fd0f4';
        g.fillRect(x, y + 106, w, 22);
      }
      if (key === 'barber') {
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#c8322e' : '#1f4f8a'; g.fillRect(x + 12 + k * 10, y + 14, 8, 100); }
      }
      g.strokeStyle = fg;
      g.lineWidth = 4;
      g.strokeRect(x + 6, y + 6, w - 12, h - 12);
      text(t, x, y - (key === 'konbini' ? 14 : 0), w, h, fg, 70);
      reg(key, x, y, w, h);
      this.wideNames.push(key);
    });
    // small round and square road signs, notices
    const sy = 896;
    {
      // pedestrian crossing: a blue square, a white triangle, two black figures
      const x = X;
      g.fillStyle = '#1f5ea8'; g.fillRect(x + 4, sy + 4, 120, 120);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 64, sy + 14); g.lineTo(x + 116, sy + 112); g.lineTo(x + 12, sy + 112); g.closePath(); g.fill();
      g.fillStyle = '#1a1a1a';
      g.beginPath(); g.arc(x + 54, sy + 46, 7, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 48, sy + 54, 12, 26); g.fillRect(x + 46, sy + 80, 5, 22); g.fillRect(x + 57, sy + 80, 5, 22);
      g.beginPath(); g.arc(x + 76, sy + 62, 5, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 72, sy + 68, 8, 18); g.fillRect(x + 71, sy + 86, 4, 16); g.fillRect(x + 77, sy + 86, 4, 16);
      g.fillRect(x + 20, sy + 102, 88, 4);
      reg('pedCross', x, sy, 128, 128);
    }
    {
      const x = X + 128;
      g.fillStyle = '#c8322e'; g.beginPath(); g.arc(x + 64, sy + 64, 60, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x + 20, sy + 54, 88, 20);
      reg('noEntry', x, sy, 128, 128);
    }
    {
      const x = X + 256;
      g.fillStyle = '#1f5ea8'; g.beginPath(); g.arc(x + 64, sy + 64, 60, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 64, sy + 22); g.lineTo(x + 98, sy + 64); g.lineTo(x + 74, sy + 64); g.lineTo(x + 74, sy + 104); g.lineTo(x + 54, sy + 104); g.lineTo(x + 54, sy + 64); g.lineTo(x + 30, sy + 64); g.closePath(); g.fill();
      reg('blueArrow', x, sy, 128, 128);
    }
    {
      const x = X + 384;
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 64, sy + 64, 60, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c8322e'; g.lineWidth = 10; g.beginPath(); g.arc(x + 64, sy + 64, 54, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#f08a6a'; g.beginPath(); g.ellipse(x + 64, sy + 50, 30, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f2ea'; g.fillRect(x + 36, sy + 56, 56, 14);
      text('寿司', x, sy + 64, 128, 50, '#c8322e', 30);
      reg('sushiRound', x, sy, 128, 128);
    }
    {
      const x = X + 512;
      g.fillStyle = '#ffffff'; g.fillRect(x + 4, sy + 10, 120, 108);
      g.fillStyle = '#c8322e'; g.fillRect(x + 4, sy + 10, 120, 34);
      text('警告!', x, sy + 10, 128, 34, '#ffffff', 26);
      text('ここに駐車', x, sy + 46, 128, 30, '#1a1a1a', 18);
      text('しないで', x, sy + 74, 128, 30, '#1a1a1a', 18);
      reg('warning', x, sy, 128, 128);
    }
    {
      const x = X + 640;
      g.fillStyle = '#1f5ea8'; g.fillRect(x + 4, sy + 4, 120, 120);
      text('P', x, sy, 128, 128, '#ffffff', 96);
      reg('parkingP', x, sy, 128, 128);
    }
    {
      // a menu board for the café
      const x = X + 768;
      g.fillStyle = '#2b2d2b'; g.fillRect(x, sy, 128, 128);
      text('CAFE', x, sy + 6, 128, 34, '#ffffff', 26);
      text('ブレンド 400', x, sy + 42, 128, 28, '#ffe08a', 18);
      text('ケーキ 450', x, sy + 72, 128, 28, '#ffe08a', 18);
      reg('cafeMenu', x, sy, 128, 128);
    }
    {
      // a poster with a big sale
      const x = X + 896;
      g.fillStyle = '#ffe36a'; g.fillRect(x + 6, sy + 6, 116, 116);
      text('特売', x, sy + 10, 128, 60, '#c8322e', 48);
      text('セール中', x, sy + 70, 128, 40, '#1a1a1a', 24);
      reg('sale', x, sy, 128, 128);
    }
    // the stalls, coin parking, parks and bicycle parking: a third band
    {
      const tall2: [string, string, string, string, string][] = [
        ['takoyaki', 'たこ焼き', '#e8862a', '#ffffff', '#9a4a10'],
        ['yakisoba', '焼きそば', '#c8322e', '#ffe36a', '#7a1010'],
        ['oden', 'おでん', '#f4ecd8', '#3a2a1a', '#d8c8a8'],
        ['taiyaki', 'たい焼き', '#3a6ab8', '#ffffff', '#1a3a7a'],
        ['kakigori', '氷', '#ffffff', '#d8322e', '#e8f4ff'],
      ];
      tall2.forEach(([key, t, bg, fg, edge], i) => {
        const x = i * 128, y = 1024, w = 128, h = 384;
        const grd = g.createLinearGradient(x, y, x, y + h);
        grd.addColorStop(0, bg);
        grd.addColorStop(1, edge);
        g.fillStyle = grd;
        g.fillRect(x, y, w, h);
        if (key === 'kakigori') {
          g.fillStyle = '#2a7ad8';
          for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 30 + k * 34, y + h - 40, 20, Math.PI, 0); g.fill(); }
          text(t, x, y - 30, w, h, fg, 110, true);
        } else {
          g.strokeStyle = fg;
          g.lineWidth = 6;
          g.strokeRect(x + 10, y + 10, w - 20, h - 20);
          text(t, x, y, w, h, fg, 84, true);
        }
        reg(key, x, y, w, h);
      });
      const wide2: [string, string, string, string, number, number][] = [
        ['coinPark', 'コインパーキング', '#f2c230', '#1a1a1a', 640, 1024],
        ['parkName', '星ヶ丘公園', '#2f7a46', '#ffffff', 1152, 1024],
        ['bikePark', '駐輪場', '#1f5ea8', '#ffffff', 640, 1152],
        ['yataiSign', '屋台 ほし', '#7a2418', '#ffe8b0', 1152, 1152],
      ];
      for (const [key, t, bg, fg, x, y] of wide2) {
        g.fillStyle = bg;
        g.fillRect(x, y, 512, 128);
        g.strokeStyle = fg;
        g.lineWidth = 5;
        g.strokeRect(x + 8, y + 8, 496, 112);
        text(t, x, y, 512, 128, fg, 72);
        reg(key, x, y, 512, 128);
      }
      {
        const x = 640, y = 1280;
        g.fillStyle = '#f2c230'; g.fillRect(x, y, 128, 128);
        text('24H', x, y + 4, 128, 40, '#c8322e', 32);
        text('20分', x, y + 44, 128, 36, '#1a1a1a', 26);
        text('¥100', x, y + 80, 128, 40, '#1a1a1a', 32);
        reg('parkPrice', x, y, 128, 128);
      }
      {
        const x = 768, y = 1280;
        g.fillStyle = '#16305a'; g.fillRect(x, y, 128, 128);
        g.fillStyle = '#7fd0ff'; g.fillRect(x + 14, y + 14, 100, 48);
        text('精算機', x, y + 70, 128, 44, '#ffffff', 28);
        reg('payScreen', x, y, 128, 128);
      }
      {
        const x = 896, y = 1280;
        g.fillStyle = '#2f9a4a'; g.fillRect(x, y, 128, 128);
        g.fillStyle = '#ffffff'; g.fillRect(x + 14, y + 14, 100, 100);
        text('公衆', x, y + 18, 128, 46, '#2f9a4a', 34);
        text('電話', x, y + 62, 128, 46, '#2f9a4a', 34);
        reg('phone', x, y, 128, 128);
      }
    }
    // the expressway: green direction boards, the IC exit, the toll gate, ETC and general lanes, the route shield
    {
      const green = (key: string, x: number, y: number, w: number, h: number, lines: [string, number, number][]) => {
        g.fillStyle = '#1c7a4a'; g.fillRect(x, y, w, h);
        g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(x + 7, y + 7, w - 14, h - 14);
        for (const [t, yy, size] of lines) text(t, x, y + yy, w, size + 6, '#ffffff', size);
        reg(key, x, y, w, h);
      };
      green('hwExit', 0, 1408, 512, 128, [['星の町 IC 出口', 10, 54], ['Hoshinomachi  EXIT 1km', 76, 30]]);
      green('hwDir', 512, 1408, 512, 128, [['東京 120 km', 10, 54], ['Tokyo   名古屋 Nagoya', 76, 30]]);
      green('tollGate', 1024, 1408, 512, 128, [['星の町 料金所', 10, 58], ['TOLL GATE', 78, 30]]);
      {
        const x = 1536, y = 1408;
        g.fillStyle = '#7a2db8'; g.fillRect(x, y, 128, 128);
        text('ETC', x, y + 10, 128, 70, '#ffffff', 52);
        text('専用', x, y + 76, 128, 40, '#ffffff', 28);
        reg('etc', x, y, 128, 128);
      }
      {
        const x = 1664, y = 1408;
        g.fillStyle = '#1c7a4a'; g.fillRect(x, y, 128, 128);
        text('一般', x, y + 10, 128, 70, '#ffffff', 52);
        text('ETC/一般', x, y + 76, 128, 40, '#ffffff', 22);
        reg('ippan', x, y, 128, 128);
      }
      {
        const x = 1792, y = 1408;
        g.fillStyle = '#ffffff';
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + 64 + Math.cos(a) * 60, y + 64 + Math.sin(a) * 60); }
        g.closePath(); g.fill();
        g.fillStyle = '#1c7a4a';
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + 64 + Math.cos(a) * 52, y + 64 + Math.sin(a) * 52); }
        g.closePath(); g.fill();
        text('E1', x, y, 128, 128, '#ffffff', 56);
        reg('e1', x, y, 128, 128);
      }
      green('hwSpeed', 1664, 1024, 384, 128, [['80', 14, 70], ['km/h', 86, 26]]);
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
