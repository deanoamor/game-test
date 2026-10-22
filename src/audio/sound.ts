/**
 * The sound of the game, all of it made here with the Web Audio API (no sound files): the ambience of the place (the
 * traffic, the wind and the birds by day, the crickets at night, the walk signal's "pi-yo" at the crossing; the hum of
 * the lights and the fridge in the shop; the clock in the home), the player's footsteps (each surface has its own),
 * and the NPCs' voices (a short chirp for every letter they say, pitched for each character).
 *
 * A browser only lets a page make sound after the player has pressed a key or clicked, so the audio starts then.
 * M mutes. The volume and the mute are kept for the next visit.
 */

export type Scene = 'town' | 'home' | 'shop';
export type Surface = 'road' | 'pavement' | 'stairs' | 'grass' | 'floor' | 'wood' | 'tile' | 'tatami';

/** What the game tells the sound every frame. */
export interface Hearing {
  /** 0 by day, 1 in the dark. */
  night: number;
  /** Where the player (the listener) is. */
  x: number;
  z: number;
  /** How loud the traffic is where she stands (0: none, about 1: next to the road). */
  traffic: number;
  /** The walk signal is green at the crossing (the spot is at `signalAt`). */
  walk: boolean;
}

interface Voice { base: number; range: number; wave: OscillatorType; rate: number }
const VOICES: Record<string, Voice> = {
  nurse: { base: 640, range: 160, wave: 'triangle', rate: 0.052 },
  clerk: { base: 230, range: 80, wave: 'square', rate: 0.048 },
  default: { base: 420, range: 120, wave: 'triangle', rate: 0.05 },
};

/** How each surface sounds underfoot: the filter, how long, how loud, plus a ring for metal and a thump for wood. */
const STEPS: Record<Surface, { f: number; q: number; dur: number; vol: number; ring?: number; thump?: number }> = {
  road: { f: 1500, q: 0.8, dur: 0.07, vol: 0.12 },
  pavement: { f: 2600, q: 1.1, dur: 0.05, vol: 0.1 },
  stairs: { f: 2200, q: 1.5, dur: 0.06, vol: 0.1, ring: 760 },
  grass: { f: 900, q: 0.6, dur: 0.1, vol: 0.07 },
  floor: { f: 1800, q: 1, dur: 0.06, vol: 0.09 },
  wood: { f: 600, q: 2, dur: 0.08, vol: 0.1, thump: 150 },
  tile: { f: 3200, q: 2, dur: 0.045, vol: 0.09 },
  tatami: { f: 320, q: 0.7, dur: 0.1, vol: 0.06 },
};

const KEY = 'hoshi.sound';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  muted = false;
  volume = 0.7;
  private lay: Record<string, GainNode> = {};
  private filt: Record<string, BiquadFilterNode> = {};
  private timers = { bird: 3, crow: 20, tick: 0, signal: 0, chime: 0, rustle: 6 };
  private signalHigh = false;
  private speakBus: GainNode | null = null;
  private tickN = 0;
  onChange: (() => void) | null = null;

  constructor(private scene: Scene, enabled = true) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (typeof s.muted === 'boolean') this.muted = s.muted;
      if (typeof s.volume === 'number') this.volume = Math.min(1, Math.max(0, s.volume));
    } catch { /* no storage */ }
    if (!enabled) return;
    const go = () => { this.start(); };
    for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, go, { once: false, passive: true });
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.code === 'KeyM' && !e.repeat) this.setMuted(!this.muted);
    });
    document.addEventListener('visibilitychange', () => { if (this.ctx) document.hidden ? this.ctx.suspend() : this.ctx.resume(); });
  }

  setMuted(m: boolean) { this.muted = m; this.apply(); this.save(); this.onChange?.(); }
  setVolume(v: number) { this.volume = Math.min(1, Math.max(0, v)); this.apply(); this.save(); this.onChange?.(); }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* no storage */ } }
  private apply() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * this.volume * 2.4, this.ctx.currentTime, 0.05); }

  /** Make the audio (after the first key or click). */
  private start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // a little compressor so a loud moment does not crackle
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const n = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.noise.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
    this.build();
    this.apply();
  }

  private loop(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.loopStart = 0; s.start(0, Math.random() * 2);
    return s;
  }
  /** A looping layer: noise through a filter into its own gain (kept in `lay`/`filt` to be driven every frame). */
  private layer(name: string, brown: boolean, type: BiquadFilterType, f: number, q: number, gain: number) {
    const ctx = this.ctx!;
    const src = this.loop(brown ? this.brown! : this.noise!);
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(fl).connect(g).connect(this.master!);
    this.lay[name] = g; this.filt[name] = fl;
  }
  private tone(name: string, f: number, wave: OscillatorType, gain: number, lowpass = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave; o.frequency.value = f; o.start();
    const g = ctx.createGain(); g.gain.value = gain;
    if (lowpass) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lowpass; o.connect(fl).connect(g); } else o.connect(g);
    g.connect(this.master!);
    this.lay[name] = g;
  }

  private build() {
    const ctx = this.ctx!;
    if (this.scene === 'town') {
      this.layer('traffic', true, 'lowpass', 300, 0.7, 0);
      this.layer('wind', false, 'bandpass', 520, 0.45, 0.012);
      this.layer('city', false, 'bandpass', 1500, 0.35, 0.004);
      // the crickets: two pulsing high notes
      for (const [i, f, rate] of [[0, 4700, 13], [1, 5200, 11]] as const) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.start();
        const g = ctx.createGain(); g.gain.value = 0.5;
        const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = rate; lfo.start();
        const lg = ctx.createGain(); lg.gain.value = 0.5;
        lfo.connect(lg).connect(g.gain);
        const out = ctx.createGain(); out.gain.value = 0;
        o.connect(g).connect(out).connect(this.master!);
        this.lay[`cricket${i}`] = out;
      }
    } else if (this.scene === 'home') {
      this.layer('room', true, 'lowpass', 140, 0.7, 0.05);
      this.layer('outside', true, 'lowpass', 220, 0.7, 0.03);
      this.tone('fridge', 58, 'sawtooth', 0, 160);
    } else {
      this.layer('room', true, 'lowpass', 240, 0.7, 0.05);
      this.layer('air', false, 'lowpass', 900, 0.5, 0.006);
      this.tone('fridge', 60, 'sawtooth', 0.02, 180);
      this.tone('buzz', 120, 'sine', 0.012);
      this.tone('buzz2', 360, 'sine', 0.004);
    }
  }

  /** Every frame. */
  update(dt: number, h: Hearing) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const set = (n: string, v: number) => this.lay[n]?.gain.setTargetAtTime(v, t, 0.3);
    const T = this.timers;
    for (const k of Object.keys(T) as (keyof typeof T)[]) T[k] -= dt;
    if (this.scene === 'town') {
      const tr = Math.min(1, h.traffic);
      set('traffic', 0.02 + 0.22 * tr);
      this.filt.traffic?.frequency.setTargetAtTime(220 + 520 * tr, t, 0.3);
      set('wind', 0.008 + 0.01 * (0.5 + 0.5 * Math.sin(t * 0.35)));
      set('city', 0.004 + 0.004 * (1 - h.night));
      set('cricket0', 0.008 * h.night); set('cricket1', 0.006 * h.night);
      if (T.bird <= 0) { T.bird = rnd(3, 9); if (h.night < 0.4) this.bird(rnd(0.012, 0.025)); }
      if (T.crow <= 0) { T.crow = rnd(25, 60); if (h.night < 0.3) this.crow(); }
      if (h.walk && T.signal <= 0) {
        // "pi-yo, pi-yo": the walk signal, heard from the crossing and not far beyond it
        const d = Math.hypot(h.x - 0, h.z - 44);
        const near = Math.max(0, 1 - d / 38);
        T.signal = 0.55;
        this.signalHigh = !this.signalHigh;
        if (near > 0.02) this.beep(this.signalHigh ? 1100 : 840, 0.2, 0.1 * near * near);
      }
      // the door of the shop: the chime
      const dd = Math.hypot(h.x - this.chimeAt.x, h.z - this.chimeAt.z);
      if (dd < 3 && T.chime <= 0) { T.chime = 7; this.chime(); }
    } else if (this.scene === 'home') {
      set('room', 0.05 + 0.02 * h.night);
      const dk = Math.hypot(h.x + 1.7, h.z + 4.1);
      set('fridge', 0.012 * Math.max(0.15, 1 - dk / 6));
      if (T.tick <= 0) { T.tick = 1; this.tickN++; this.click(this.tickN % 2 ? 2400 : 2000, 0.02); }
    } else {
      // the automatic door and the bell as she nears it
      const dd = Math.hypot(h.x - -3, h.z - -4);
      if (dd < 2.2 && T.chime <= 0) { T.chime = 7; this.chime(); }
      if (T.rustle <= 0) { T.rustle = rnd(5, 14); this.rustle(); }
    }
  }
  /** Where the shop's door is in the town (the chime plays near it). */
  chimeAt = { x: 1e9, z: 1e9 };

  // ---------------------------------------------------------------------------------------------------------------
  // one-shot sounds
  // ---------------------------------------------------------------------------------------------------------------
  private ok() { return !!(this.ctx && this.master && this.ctx.state === 'running' && !this.muted); }
  private env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private beep(f: number, dur: number, vol: number, wave: OscillatorType = 'sine', when = 0) {
    if (!this.ok()) return;
    const ctx = this.ctx!, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = f;
    this.env(g, t, vol, 0.008, dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private click(f: number, vol: number) {
    if (!this.ok()) return;
    const ctx = this.ctx!, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise!;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 3;
    const g = ctx.createGain(); this.env(g, t, vol, 0.001, 0.025);
    s.connect(fl).connect(g).connect(this.master!);
    s.start(t, Math.random() * 2, 0.05);
  }
  private bird(vol: number) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const base = rnd(2600, 4200), n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.13;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * rnd(1.15, 1.5), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.1);
      this.env(g, t, vol, 0.01, 0.11);
      o.connect(g).connect(this.master!);
      o.start(t); o.stop(t + 0.15);
    }
  }
  private crow() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.42;
      const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(310, t + 0.3);
      fl.type = 'lowpass'; fl.frequency.value = 1100;
      this.env(g, t, 0.018, 0.03, 0.32);
      o.connect(fl).connect(g).connect(this.master!);
      o.start(t); o.stop(t + 0.4);
    }
  }
  /** The shop's door chime: three soft notes, going down. */
  chime() {
    [784, 659, 523].forEach((f, i) => { this.beep(f, 0.7, 0.05, 'sine', i * 0.28); this.beep(f * 2, 0.4, 0.012, 'sine', i * 0.28); });
  }
  /** A rustle of a bag or a shelf now and then in the shop. */
  private rustle() {
    if (!this.ok()) return;
    const ctx = this.ctx!, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise!;
    const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 2800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 6; i++) g.gain.linearRampToValueAtTime(rnd(0.004, 0.012), t + i * 0.07 + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    s.connect(fl).connect(g).connect(this.master!);
    s.start(t, Math.random() * 2, 0.6);
  }

  /** A footstep on a surface (`run`: louder and brisker). */
  step(surface: Surface, run: boolean) {
    if (!this.ok()) return;
    const ctx = this.ctx!, t = ctx.currentTime, p = STEPS[surface];
    const k = run ? 1.35 : 1;
    const s = ctx.createBufferSource(); s.buffer = this.noise!;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = p.f * rnd(0.88, 1.12) * (run ? 1.1 : 1); fl.Q.value = p.q;
    const g = ctx.createGain(); this.env(g, t, p.vol * k * rnd(0.85, 1.1), 0.003, p.dur);
    s.connect(fl).connect(g).connect(this.master!);
    s.start(t, Math.random() * 2, p.dur + 0.05);
    if (p.ring) this.beep(p.ring * rnd(0.95, 1.05), 0.16, 0.03 * k, 'triangle');
    if (p.thump) this.beep(p.thump * rnd(0.95, 1.05), 0.09, 0.07 * k, 'sine');
  }

  /** An NPC speaks: a chirp for every letter, in the character's voice, as long as the line takes to read. */
  speak(id: string, text: string) {
    this.stopSpeak();
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const v = VOICES[id] ?? VOICES.default;
    const bus = (this.speakBus = ctx.createGain());
    bus.gain.value = 1;
    bus.connect(this.master!);
    let t = ctx.currentTime + 0.03;
    let pitch = v.base;
    const chars = [...text].slice(0, 170);
    for (const ch of chars) {
      if (ch === ' ') { t += v.rate * 0.7; continue; }
      if (/[.!?]/.test(ch)) { t += v.rate * 4; pitch = v.base; continue; }
      if (ch === ',') { t += v.rate * 2.2; continue; }
      // the pitch wanders with the letters, like a mumble, and rises a little at a question
      const code = ch.toLowerCase().charCodeAt(0);
      pitch = v.base + ((code * 37) % 100) / 100 * v.range - v.range / 2 + (Math.random() - 0.5) * 12;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = v.wave;
      o.frequency.setValueAtTime(pitch, t);
      o.frequency.linearRampToValueAtTime(pitch * 1.06, t + v.rate);
      const vol = v.wave === 'square' ? 0.028 : 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.linearRampToValueAtTime(0.0001, t + v.rate * 0.95);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + v.rate);
      t += v.rate;
    }
  }
  stopSpeak() {
    const b = this.speakBus;
    if (!b || !this.ctx) return;
    b.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    setTimeout(() => b.disconnect(), 300);
    this.speakBus = null;
  }
  /** What an NPC calls out as the player comes near (the bubble over its head): two quick chirps. */
  greet(id: string) {
    const v = VOICES[id] ?? VOICES.default;
    this.beep(v.base * 1.1, 0.07, 0.05, v.wave);
    this.beep(v.base * 1.35, 0.1, 0.05, v.wave, 0.09);
    if (id === 'clerk') this.chime();
  }
}
