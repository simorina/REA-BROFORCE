import { describe, expect, it } from 'vitest';
import { Sfx, placement, sfxFor } from './sfx';

describe('sfx', () => {
  it('maps game events to sounds', () => {
    expect(sfxFor({ type: 'shot', weapon: 'football', x: 0, y: 0, facing: 1 })).toBe('kick');
    expect(sfxFor({ type: 'shot', weapon: 'rocket', x: 0, y: 0, facing: 1 })).toBe('rocket');
    expect(sfxFor({ type: 'explosion', x: 0, y: 0, big: true, source: 'rocket', range: 28 })).toBe('boom');
    expect(sfxFor({ type: 'explosion', x: 0, y: 0, big: false, source: 'rocket', range: 28 })).toBe('pop');
    expect(sfxFor({ type: 'block', x: 0, y: 0, kind: 'barrel', damage: 1 })).toBeNull();
    expect(sfxFor({ type: 'voice', text: 'x' })).toBeNull();
    expect(sfxFor({ type: 'respawn', x: 0, y: 0 })).toBeNull();
  });

  it('pans with the position and fades sounds far off screen', () => {
    expect(placement(100, 100)).toEqual({ pan: 0, gain: 1 });
    expect(placement(400, 100).pan).toBeCloseTo(0.6);
    expect(placement(-200, 100).pan).toBeCloseTo(-0.6);
    expect(placement(100 + 200 + 200, 100).gain).toBeCloseTo(0.5);
    expect(placement(5000, 100).gain).toBe(0.15);
  });

  it('is silent without WebAudio (tests, old browsers)', () => {
    const sfx = new Sfx(true);
    expect(() => sfx.play('boom', 0, 0)).not.toThrow();
    sfx.dispose();
  });
});
