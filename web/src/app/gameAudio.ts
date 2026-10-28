import type { LevelData, LevelTheme, MusicType } from '../engine/level';
import type { VoiceLine } from '../engine/types';
import type { GameEvent } from '../engine/world';

/** game-data/audio.json: Broforce's own voices and music, read by the extractor from the local install (gameaudio.py). */
export interface GameAudio {
  voices: Partial<Record<string, Partial<Record<VoiceLine, string[]>>>>; // enemy kind -> line -> clip files
  music: Record<MusicType, { low: string; high: string }>;
  boss: { epstein: string; goliath: string; dolph: string; sting: string };
}

/** TestVanDammeAnim's Play*Sound: each line's volume, and the pitch range it is played at. */
export const VOICE_PLAY: Record<VoiceLine, { volume: number; pitch: readonly [number, number] }> = {
  greet: { volume: 0.4, pitch: [1, 1] }, // PlayGreetingSound
  confused: { volume: 0.31, pitch: [1, 1] }, // PlayConfusedSound
  attract: { volume: 0.86, pitch: [0.9, 0.9] }, // PlayAttractedSound
  laugh: { volume: 0.6, pitch: [1, 1] }, // PlayLaughterSound
  panic: { volume: 0.65, pitch: [1, 1.175] }, // PlayPanicSound: Random.Range(1, 1.175)
  death: { volume: 0.4, pitch: [1, 1] }, // PlayDeathSound
  hurt: { volume: 0.4 * 0.37, pitch: [1, 1] }, // PlayHitSound(0.4): hurtSounds at v * 0.37
  charge: { volume: 0.6, pitch: [1, 1] }, // PolymorphicAI's PlaySpecialSound(0.6)
  rise: { volume: 0.3, pitch: [1, 1] }, // PlayResurrectionSound(0.3)
};
const ATTRACTED = 0.7; // ShowQuestionBubble: PlayAttractedSound when Random.value < 0.7, else PlayConfusedSound
// _lastLaughterSoundTime: a laugh at most every 2 s; lastHitSoundTime: a grunt at most every 0.1 s (each mook's own)
const VOICE_GAP: Partial<Record<VoiceLine, number>> = { laugh: 2, hurt: 0.1 };

export interface VoicePlay {
  file: string; // its URL
  volume: number;
  rate: number; // the pitch, as a playback rate
}

/** One of the kind's clips for the line (Sound.PlaySoundEffectAt picks one at random), as Broforce plays it. */
export function pickVoice(audio: GameAudio, kind: string, line: VoiceLine, rng: () => number): VoicePlay | null {
  const lines = audio.voices[kind];
  if (!lines) return null;
  const said: VoiceLine = line === 'attract' && (rng() >= ATTRACTED || !lines.attract?.length) ? 'confused' : line;
  const clips = lines[said];
  if (!clips?.length) return null;
  const play = VOICE_PLAY[said];
  const file = clips[Math.min(clips.length - 1, Math.floor(rng() * clips.length))];
  return { file: `/${file}`, volume: play.volume, rate: play.pitch[0] + (play.pitch[1] - play.pitch[0]) * rng() };
}

/** The mobs' voices as they come out of the world's mookVoice events, each mook's laughs and grunts kept apart. */
export class MookVoices {
  private readonly last = new Map<string, number>();

  constructor(private readonly audio: GameAudio, private readonly rng: () => number = Math.random) {}

  say(e: Extract<GameEvent, { type: 'mookVoice' }>, now: number): VoicePlay | null {
    const gap = VOICE_GAP[e.line];
    if (gap !== undefined) {
      const key = `${e.unit}:${e.line}`;
      const was = this.last.get(key);
      if (was !== undefined && now - was < gap) return null;
      this.last.set(key, now);
    }
    return pickVoice(this.audio, e.kind, e.line, this.rng);
  }
}

// Sound.PlayMusic: a level's MusicType when its map gives none (MusicType.Default), by its theme
const THEME_MUSIC: Record<LevelTheme, MusicType> = {
  jungle: 'BroforceDrums', burning: 'JungleRedSky', forest: 'Factory', hell: 'Hell', desert: 'Desert', city: 'Factory',
};

export function musicFor(level: Pick<LevelData, 'theme' | 'music'>): MusicType {
  return level.music ?? THEME_MUSIC[level.theme ?? 'jungle'];
}

// StatisticsController: a mook's death adds 1 and a vehicle's 4 (NotifyMookDeath, NotifyVehicleDeath), held for their
// brotalityGrace; then it drops 1 a second and by 0.66 of itself a second. The music is high while it is above 0.
export const INTENSITY = { kill: 1, grace: 1.5, vehicle: 4, vehicleGrace: 5, drop: 1, damp: 0.66 };

export class MusicIntensity {
  value = 0;
  private grace = 0;

  kill(): void {
    this.value += INTENSITY.kill;
    this.grace = Math.max(this.grace, INTENSITY.grace);
  }

  vehicle(): void {
    this.value += INTENSITY.vehicle;
    this.grace = Math.max(this.grace, INTENSITY.vehicleGrace);
  }

  step(dt: number): void {
    if (this.grace > 1e-9) {
      this.grace -= dt;
      return;
    }
    this.value = Math.max(0, (this.value - INTENSITY.drop * dt) * (1 - dt * INTENSITY.damp));
  }

  get high(): boolean {
    return this.value > 0;
  }
}
