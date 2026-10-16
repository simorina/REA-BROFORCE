/** The parts of an HTMLAudioElement the music player uses (a fake in tests). */
export interface AudioLike {
  volume: number;
  loop: boolean;
  paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
}

/** The Russian anthem plays while someone is in a tank, the level is running, the game isn't paused and sound is on. */
export function anthemShouldPlay(driving: boolean, state: string, paused: boolean, sound: boolean): boolean {
  return driving && state === 'playing' && !paused && sound;
}

const FADE = 2; // full volume in 0.5 s
const VOLUME = 0.6;

/** One looped track that fades in while `on` and out when not, pausing once silent. A failed play stays silent. */
export class Music {
  private fade = 0;
  private broken = false;

  constructor(private readonly audio: AudioLike | null) {
    if (audio) {
      audio.loop = true;
      audio.volume = 0;
    }
  }

  get level(): number {
    return this.fade;
  }

  update(on: boolean, dt: number): void {
    const a = this.audio;
    if (!a || this.broken) return;
    this.fade = Math.min(1, Math.max(0, this.fade + (on ? FADE : -FADE) * dt));
    a.volume = this.fade * VOLUME;
    if (this.fade > 0 && a.paused) {
      try {
        const started = a.play();
        if (started) started.catch((e: unknown) => this.failed(e));
      } catch {
        this.broken = true;
      }
    } else if (this.fade === 0 && !a.paused) {
      a.pause();
    }
  }

  /** Stops it at once: the game paused without rendering frames (a hidden tab stops requestAnimationFrame). */
  silence(): void {
    this.fade = 0;
    if (this.audio) {
      this.audio.volume = 0;
      if (!this.audio.paused) this.audio.pause();
    }
  }

  /** A play() interrupted by a pause (AbortError) is harmless; anything else (no file, no codec) mutes it for good. */
  private failed(e: unknown): void {
    if (!(e instanceof Error && e.name === 'AbortError')) this.broken = true;
  }

  dispose(): void {
    this.audio?.pause();
  }
}
