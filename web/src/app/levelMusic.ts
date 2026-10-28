import type { AudioLike } from './music';

/**
 * Sound.Update's volumes (ours scaled by `level`, our music volume): the low intensity track at half of it, the high
 * one at 0.6, a boss fight's music and the victory sting at all of it. `fade` is how fast it all goes when the music
 * stops.
 */
export const LEVEL_MUSIC = { level: 0.55, low: 0.55 * 0.5, high: 0.55 * 0.6, boss: 0.55, fade: 2 };

export interface MusicTracks {
  low: string;
  high: string;
  boss: { epstein: string; goliath: string; dolph: string };
  sting: string;
}

export interface MusicState {
  on: boolean; // the level running, music on, not paused
  high: boolean; // the music intensity is up
  boss: keyof MusicTracks['boss'] | null; // the boss fight on
  duck: number; // 0-1: how loud a vehicle's or Django's own music is
  victory: boolean; // the Goliath is down: the victory sting
}

interface Track {
  audio: AudioLike;
  volume: number;
  broken: boolean;
}

/**
 * A level's music, as Broforce's Sound.Update mixes it. The low and high intensity tracks play in step, each started
 * where the other has got to. Going high, the high track jumps to 0.4 of the volume and both cross over at 2 a second;
 * going low, the low one comes back from 0.2 and they cross at 1 a second. A track goes quiet and stops under 0.01. A
 * boss fight's music takes over from both, and the Goliath's fall plays the victory sting once.
 */
export class LevelMusic {
  private readonly tracks = new Map<string, Track>();
  private stung = false;

  constructor(private readonly make: (src: string) => AudioLike | null, private readonly src: MusicTracks) {}

  update(dt: number, s: MusicState): void {
    const low = this.track(this.src.low);
    const high = this.track(this.src.high);
    const boss = s.boss ? this.track(this.src.boss[s.boss]) : null;
    const sting = s.victory && s.on ? this.track(this.src.sting, false) : null;
    const lerp = (t: Track, to: number, rate: number) => {
      t.volume += (to - t.volume) * Math.min(1, dt * rate);
    };
    if (sting && !this.stung) {
      this.stung = true;
      sting.volume = LEVEL_MUSIC.boss;
      this.start(sting, null);
    }
    for (const t of this.tracks.values()) {
      if (t === sting) continue;
      if (!s.on || s.victory || (t !== boss && (boss || (t !== low && t !== high)))) lerp(t, 0, LEVEL_MUSIC.fade);
      else if (t === boss) lerp(t, LEVEL_MUSIC.boss, 2);
    }
    if (s.on && !s.victory && !boss && low && high) {
      if (s.high) {
        high.volume = Math.max(high.volume, 0.4 * LEVEL_MUSIC.level);
        lerp(high, LEVEL_MUSIC.high, 2);
        lerp(low, 0, 2);
      } else {
        low.volume = Math.max(low.volume, 0.2 * LEVEL_MUSIC.level);
        lerp(high, 0, 1);
        lerp(low, LEVEL_MUSIC.low, 1);
      }
    }
    for (const t of this.tracks.values()) {
      t.audio.volume = Math.max(0, Math.min(1, t.volume * (1 - s.duck)));
      if (t === sting) continue;
      if (t.volume < 0.01) {
        if (!t.audio.paused) t.audio.pause();
      } else if (t.audio.paused) {
        this.start(t, t === low ? high : t === high ? low : null);
      }
    }
  }

  /** Stops it at once (a hidden tab pauses the game without frames to fade in). */
  silence(): void {
    for (const t of this.tracks.values()) {
      t.volume = 0;
      t.audio.volume = 0;
      if (!t.audio.paused) t.audio.pause();
    }
  }

  dispose(): void {
    for (const t of this.tracks.values()) t.audio.pause();
  }

  private track(src: string, loop = true): Track | null {
    let t = this.tracks.get(src);
    if (!t) {
      const audio = this.make(src);
      if (!audio) return null;
      audio.loop = loop;
      audio.volume = 0;
      t = { audio, volume: 0, broken: false };
      this.tracks.set(src, t);
    }
    return t;
  }

  /** play(), where its partner has got to (the high track where the low one is, and back); a failed one stays silent. */
  private start(t: Track, partner: Track | null): void {
    if (t.broken) return;
    if (partner && !partner.audio.paused && partner.audio.currentTime !== undefined) t.audio.currentTime = partner.audio.currentTime;
    try {
      const started = t.audio.play();
      if (started) started.catch((e: unknown) => {
        if (!(e instanceof Error && e.name === 'AbortError')) t.broken = true;
      });
    } catch {
      t.broken = true;
    }
  }
}
