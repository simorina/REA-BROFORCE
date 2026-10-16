import { describe, expect, it } from 'vitest';
import { Music, anthemShouldPlay, type AudioLike } from './music';

function fakeAudio(fail = false) {
  const a = {
    volume: 1, loop: false, paused: true, plays: 0, pauses: 0,
    play() { this.plays++; this.paused = false; return fail ? Promise.reject(new Error('no file')) : Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; },
  };
  return a as AudioLike & { plays: number; pauses: number };
}

describe('the anthem', () => {
  it('plays only with someone in a tank, while playing, unpaused, with sound on', () => {
    expect(anthemShouldPlay(true, 'playing', false, true)).toBe(true);
    expect(anthemShouldPlay(false, 'playing', false, true)).toBe(false);
    expect(anthemShouldPlay(true, 'playing', true, true)).toBe(false);
    expect(anthemShouldPlay(true, 'playing', false, false)).toBe(false);
    expect(anthemShouldPlay(true, 'extracting', false, true)).toBe(false);
  });

  it('fades in over 0.5 s, loops, and fades out over 0.5 s before pausing', () => {
    const a = fakeAudio();
    const m = new Music(a);
    expect(a.loop).toBe(true);
    m.update(true, 0.25);
    expect(m.level).toBeCloseTo(0.5);
    expect(a.plays).toBe(1);
    m.update(true, 0.5);
    expect(m.level).toBe(1);
    m.update(false, 0.25);
    expect(a.pauses).toBe(0);
    m.update(false, 0.5);
    expect(m.level).toBe(0);
    expect(a.pauses).toBe(1);
  });

  it('a failed play stays silent and never throws; no audio at all is fine too', async () => {
    const a = fakeAudio(true);
    const m = new Music(a);
    m.update(true, 0.1);
    await Promise.resolve();
    expect(() => m.update(true, 0.1)).not.toThrow();
    expect(a.plays).toBe(1);
    expect(() => new Music(null).update(true, 1)).not.toThrow();
  });
});

describe('the anthem when the game is paused or interrupted', () => {
  it('silence() stops it at once (a hidden tab pauses the game without rendering frames)', () => {
    const a = fakeAudio();
    const m = new Music(a);
    m.update(true, 1);
    m.silence();
    expect(m.level).toBe(0);
    expect(a.paused).toBe(true);
  });

  it('a play() aborted by a quick pause does not mute it for the rest of the game', async () => {
    const a = fakeAudio();
    let abort = true;
    a.play = function play() {
      this.paused = false;
      return abort ? Promise.reject(Object.assign(new Error('interrupted'), { name: 'AbortError' })) : Promise.resolve();
    };
    const m = new Music(a);
    m.update(true, 0.1);
    m.silence();
    await Promise.resolve();
    abort = false;
    m.update(true, 0.1);
    expect(a.paused).toBe(false);
    expect(m.level).toBeGreaterThan(0);
  });
});
