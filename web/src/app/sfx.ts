import { VIEW_W } from '../engine/camera';
import type { GameEvent } from '../engine/world';

/** Our own synthesized sound effects (WebAudio); no Broforce audio is extracted or played. */
export type SfxName =
  | 'kick' | 'throw' | 'shot' | 'rocket' | 'boom' | 'pop' | 'crumble' | 'splat' | 'grunt' | 'death' | 'alert'
  | 'rescue' | 'checkpoint' | 'whistle' | 'flex' | 'swish' | 'mortar' | 'cannon' | 'clank' | 'bite';

export function sfxFor(e: GameEvent): SfxName | null {
  switch (e.type) {
    case 'shot':
      switch (e.weapon) {
        case 'football':
          return 'kick';
        case 'judo':
          return 'swish';
        case 'marker':
        case 'body':
        case 'jetBomb':
        case 'grenade':
          return 'throw';
        case 'rocket':
        case 'bomb':
          return 'rocket';
        case 'shell':
          return 'mortar';
        case 'bigRocket':
          return 'cannon';
        default:
          return 'shot';
      }
    case 'explosion':
      return e.big ? 'boom' : 'pop';
    case 'block':
      return e.kind === 'barrel' ? null : 'crumble';
    case 'gib':
      return 'splat';
    case 'kill':
      return 'grunt';
    case 'death':
      return 'death';
    case 'alert':
      return 'alert';
    case 'rescue':
      return 'rescue';
    case 'checkpoint':
      return 'checkpoint';
    case 'wave':
      return 'whistle';
    case 'gunSwitch':
      return 'throw';
    case 'flex':
      return 'flex';
    case 'doorCollapse':
      return 'crumble';
    case 'doorBlast':
    case 'bossDown':
      return 'boom';
    case 'bossCall':
      return 'whistle';
    case 'bossFled':
      return 'pop';
    case 'shieldHit':
      return 'clank';
    case 'shieldOff':
      return 'crumble';
    case 'bite':
      return 'bite';
    default:
      return null;
  }
}

/** Stereo position and loudness of a sound at world x heard from the camera at camX. */
export function placement(x: number, camX: number): { pan: number; gain: number } {
  const dx = x - camX;
  const half = VIEW_W / 2;
  const pan = Math.max(-1, Math.min(1, dx / half)) * 0.6;
  const gain = Math.max(0.15, Math.min(1, 1 - (Math.abs(dx) - half) / VIEW_W));
  return { pan, gain };
}

const MIN_GAP = 0.03; // the same sound at most this often, so a chain of blasts doesn't clip
const MASTER = 0.45;

type Ctx = AudioContext;

export class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SfxName, number>();

  constructor(enabled: boolean) {
    if (!enabled || typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
    try {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  /** Suspends the audio while the game is paused. */
  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    void (paused ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined);
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  play(name: SfxName, x: number, camX: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < MIN_GAP) return;
    this.last.set(name, now);
    const { pan, gain } = placement(x, camX);
    const out = ctx.createGain();
    out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.master);
    RECIPES[name](this, out, now);
  }

  /** A pitched tone sweeping from f0 to f1 with an exponential fade. */
  tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx as Ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered white noise with a filter sweep from f0 to f1. */
  hiss(out: AudioNode, t: number, filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx as Ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}

const RECIPES: Record<SfxName, (s: Sfx, out: AudioNode, t: number) => void> = {
  kick: (s, o, t) => {
    s.tone(o, t, 'sine', 170, 55, 0.12, 0.7);
    s.hiss(o, t, 'highpass', 2500, 1200, 0.03, 0.25);
  },
  throw: (s, o, t) => s.tone(o, t, 'sine', 1300, 500, 0.35, 0.12),
  shot: (s, o, t) => {
    s.hiss(o, t, 'highpass', 1800, 900, 0.07, 0.35);
    s.tone(o, t, 'square', 700, 180, 0.06, 0.12);
  },
  rocket: (s, o, t) => {
    s.hiss(o, t, 'bandpass', 400, 1600, 0.3, 0.35);
    s.tone(o, t, 'sawtooth', 120, 60, 0.15, 0.15);
  },
  boom: (s, o, t) => {
    s.hiss(o, t, 'lowpass', 1400, 120, 0.9, 0.9);
    s.tone(o, t, 'sine', 90, 28, 0.6, 0.8);
  },
  pop: (s, o, t) => {
    s.hiss(o, t, 'lowpass', 1800, 200, 0.45, 0.6);
    s.tone(o, t, 'sine', 130, 40, 0.3, 0.5);
  },
  crumble: (s, o, t) => s.hiss(o, t, 'bandpass', 500, 150, 0.12, 0.3),
  splat: (s, o, t) => {
    s.hiss(o, t, 'lowpass', 900, 200, 0.18, 0.5);
    s.tone(o, t, 'sine', 220, 70, 0.1, 0.25);
  },
  grunt: (s, o, t) => s.tone(o, t, 'sawtooth', 240, 110, 0.14, 0.12),
  death: (s, o, t) => {
    s.tone(o, t, 'square', 420, 70, 0.55, 0.16);
    s.tone(o, t + 0.05, 'square', 300, 50, 0.5, 0.1);
  },
  alert: (s, o, t) => {
    s.tone(o, t, 'square', 880, 880, 0.05, 0.08);
    s.tone(o, t + 0.06, 'square', 1320, 1320, 0.06, 0.08);
  },
  rescue: (s, o, t) => [523, 659, 784, 1047].forEach((f, i) => s.tone(o, t + i * 0.07, 'square', f, f, 0.09, 0.1)),
  checkpoint: (s, o, t) => [392, 523, 659, 784].forEach((f, i) => s.tone(o, t + i * 0.09, 'triangle', f, f, 0.14, 0.22)),
  flex: (s, o, t) => {
    s.tone(o, t, 'sawtooth', 150, 210, 0.18, 0.14);
    s.tone(o, t + 0.04, 'square', 300, 420, 0.12, 0.06);
  },
  swish: (s, o, t) => {
    s.hiss(o, t, 'bandpass', 700, 2600, 0.14, 0.4);
    s.tone(o, t, 'triangle', 300, 900, 0.08, 0.06);
  },
  mortar: (s, o, t) => {
    s.tone(o, t, 'sine', 110, 45, 0.25, 0.7);
    s.hiss(o, t, 'lowpass', 900, 200, 0.2, 0.4);
  },
  cannon: (s, o, t) => {
    s.hiss(o, t, 'lowpass', 1600, 150, 0.6, 0.8);
    s.tone(o, t, 'sawtooth', 70, 30, 0.45, 0.5);
  },
  whistle: (s, o, t) => {
    s.tone(o, t, 'sine', 1900, 2600, 0.12, 0.12);
    s.tone(o, t + 0.15, 'sine', 2600, 1700, 0.16, 0.12);
  },
  clank: (s, o, t) => {
    s.tone(o, t, 'square', 1500, 1350, 0.08, 0.1);
    s.tone(o, t, 'triangle', 2300, 2100, 0.12, 0.08);
    s.hiss(o, t, 'highpass', 4000, 2500, 0.03, 0.2);
  },
  bite: (s, o, t) => {
    s.tone(o, t, 'sawtooth', 320, 160, 0.09, 0.14);
    s.hiss(o, t + 0.02, 'bandpass', 1200, 600, 0.06, 0.3);
  },
};
