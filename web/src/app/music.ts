/** The parts of an HTMLAudioElement the music player uses (a fake in tests). */
export interface AudioLike {
  volume: number;
  loop: boolean;
  paused: boolean;
  src?: string;
  onerror?: ((ev: Event | string) => unknown) | null;
  play(): Promise<void> | void;
  pause(): void;
}

/** A vehicle's music plays while someone is in it, the level is running, the game isn't paused and sound is on. */
export function anthemShouldPlay(driving: boolean, state: string, paused: boolean, sound: boolean): boolean {
  return driving && state === 'playing' && !paused && sound;
}

const FADE = 2; // full volume in 0.5 s
const VOLUME = 0.6;

/**
 * One looped track that fades in while `on` and out when not, pausing once silent. Given several sources it moves to
 * the next when the element can't load one. A failed play stays silent.
 */
export class Music {
  private fade = 0;
  private broken = false;
  private source = 0;

  constructor(private readonly audio: AudioLike | null, private readonly sources: readonly string[] = []) {
    if (audio) {
      audio.loop = true;
      audio.volume = 0;
      if (sources.length > 0) {
        audio.src = sources[0];
        audio.onerror = () => this.nextSource();
      }
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
      this.start(a);
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

  /** The element couldn't load this source: try the next one, or stay silent after the last. */
  private nextSource(): void {
    const a = this.audio;
    if (!a) return;
    this.source++;
    if (this.source >= this.sources.length) {
      this.broken = true;
      return;
    }
    a.src = this.sources[this.source];
    if (this.fade > 0) this.start(a);
  }

  /** play(); a rejection counts only for the source it was called on. */
  private start(a: AudioLike): void {
    const source = this.source;
    try {
      const started = a.play();
      if (started) started.catch((e: unknown) => this.failed(e, source));
    } catch {
      this.broken = true;
    }
  }

  /**
   * A play() interrupted by a pause (AbortError) is harmless, and so is one for a source already left (the element's
   * error event fires before the play promise is rejected); anything else (no file, no codec) mutes it for good.
   */
  private failed(e: unknown, source: number): void {
    if (source !== this.source) return;
    if (!(e instanceof Error && e.name === 'AbortError')) this.broken = true;
  }

  dispose(): void {
    this.audio?.pause();
  }
}
