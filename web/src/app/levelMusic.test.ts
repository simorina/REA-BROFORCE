import { describe, expect, it } from 'vitest';
import { LEVEL_MUSIC, LevelMusic, type MusicState, type MusicTracks } from './levelMusic';
import type { AudioLike } from './music';

type Fake = AudioLike & { plays: number; src: string; currentTime: number };
const TRACKS: MusicTracks = { low: 'low.ogg', high: 'high.ogg', boss: { epstein: 'e.ogg', goliath: 'g.ogg', dolph: 'd.ogg' }, sting: 's.ogg' };

function setup() {
  const made: Fake[] = [];
  const make = (src: string): AudioLike => {
    const a: Fake = {
      volume: 0, loop: false, paused: true, src, currentTime: 0, plays: 0,
      play() { this.plays++; this.paused = false; },
      pause() { this.paused = true; },
    };
    made.push(a);
    return a;
  };
  const m = new LevelMusic(make, TRACKS);
  const track = (src: string) => made.find((a) => a.src === src);
  const run = (seconds: number, s: Partial<MusicState> = {}) => {
    const state: MusicState = { on: true, high: false, boss: null, duck: 0, victory: false, ...s };
    for (let t = 0; t < seconds; t += 0.05) m.update(0.05, state);
  };
  return { m, track, run };
}

describe("the level's music (Sound.Update's low and high intensity tracks)", () => {
  it('plays the low intensity track, looped, rising to its volume; the high one waits', () => {
    const { track, run } = setup();
    run(4);
    expect(track('low.ogg')).toMatchObject({ paused: false, loop: true });
    expect(track('low.ogg')!.volume).toBeCloseTo(LEVEL_MUSIC.low, 2);
    expect(track('high.ogg')?.paused ?? true).toBe(true);
  });

  it('high intensity brings the high track in where the low one has got to, and the low one fades away', () => {
    const { track, run } = setup();
    run(2);
    track('low.ogg')!.currentTime = 12.3;
    run(0.05, { high: true });
    expect(track('high.ogg')).toMatchObject({ paused: false, currentTime: 12.3 });
    expect(track('high.ogg')!.volume).toBeGreaterThanOrEqual(0.4 * LEVEL_MUSIC.level - 1e-9); // it starts at once
    run(4, { high: true });
    expect(track('high.ogg')!.volume).toBeCloseTo(LEVEL_MUSIC.high, 2);
    expect(track('low.ogg')!.paused).toBe(true);
  });

  it('calm again, the low track comes back where the high one is', () => {
    const { track, run } = setup();
    run(1, { high: true });
    track('high.ogg')!.currentTime = 30;
    run(0.05);
    expect(track('low.ogg')).toMatchObject({ paused: false, currentTime: 30 });
    run(8);
    expect(track('high.ogg')!.paused).toBe(true);
  });

  it("a boss fight plays its own music instead, and the Goliath's fall its victory sting, once", () => {
    const { track, run } = setup();
    run(2);
    run(4, { boss: 'goliath' });
    expect(track('g.ogg')).toMatchObject({ paused: false, loop: true });
    expect(track('g.ogg')!.volume).toBeCloseTo(LEVEL_MUSIC.boss, 2);
    expect(track('low.ogg')!.paused).toBe(true);
    run(1, { victory: true });
    expect(track('s.ogg')).toMatchObject({ paused: false, loop: false, plays: 1 });
    run(4, { victory: true });
    expect(track('s.ogg')!.plays).toBe(1);
    expect(track('g.ogg')!.paused).toBe(true);
  });

  it("ducks under a vehicle's or Django's music, and stops when it is off", () => {
    const { m, track, run } = setup();
    run(4, { duck: 1 });
    expect(track('low.ogg')?.volume ?? 0).toBe(0);
    run(4);
    expect(track('low.ogg')!.volume).toBeGreaterThan(0);
    run(4, { on: false });
    expect(track('low.ogg')!.paused).toBe(true);
    run(1);
    m.silence();
    expect(track('low.ogg')!.paused).toBe(true);
  });
});
