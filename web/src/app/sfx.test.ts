import { describe, expect, it } from 'vitest';
import { Sfx, placement, sfxFor } from './sfx';

describe('sfx', () => {
  it('maps game events to sounds', () => {
    expect(sfxFor({ type: 'shot', weapon: 'football', x: 0, y: 0, facing: 1 })).toBe('kick');
    expect(sfxFor({ type: 'shot', weapon: 'rocket', x: 0, y: 0, facing: 1 })).toBe('rocket');
    expect(sfxFor({ type: 'bossCall', x: 0, y: 0 })).toBe('whistle');
    expect(sfxFor({ type: 'bossDown', x: 0, y: 0 })).toBe('boom');
    expect(sfxFor({ type: 'bossFled', x: 0, y: 0 })).toBe('pop');
    expect(sfxFor({ type: 'shot', weapon: 'shell', x: 0, y: 0, facing: 1 })).toBe('mortar');
    expect(sfxFor({ type: 'shot', weapon: 'bigRocket', x: 0, y: 0, facing: 1 })).toBe('cannon');
    expect(sfxFor({ type: 'gunSwitch', x: 0, y: 0 })).toBe('throw');
    expect(sfxFor({ type: 'shot', weapon: 'judo', x: 0, y: 0, facing: 1 })).toBe('swish');
    expect(sfxFor({ type: 'shot', weapon: 'body', x: 0, y: 0, facing: 1 })).toBe('throw');
    expect(sfxFor({ type: 'explosion', x: 0, y: 0, big: true, source: 'rocket', range: 28 })).toBe('boom');
    expect(sfxFor({ type: 'explosion', x: 0, y: 0, big: false, source: 'rocket', range: 28 })).toBe('pop');
    expect(sfxFor({ type: 'block', x: 0, y: 0, kind: 'barrel', damage: 1 })).toBeNull();
    expect(sfxFor({ type: 'voice', text: 'x', lang: 'it-IT' })).toBeNull();
    expect(sfxFor({ type: 'respawn', x: 0, y: 0 })).toBeNull();
  });

  it('gives the new enemies their sounds: a clank on the shield, a bite, a lobbed grenade', () => {
    expect(sfxFor({ type: 'shieldHit', x: 0, y: 0 })).toBe('clank');
    expect(sfxFor({ type: 'shieldOff', x: 0, y: 0, xI: 0 })).toBe('crumble');
    expect(sfxFor({ type: 'bite', x: 0, y: 0 })).toBe('bite');
    expect(sfxFor({ type: 'django', x: 0, y: 0 })).toBe('whistle'); // Samuel becomes Django
    expect(sfxFor({ type: 'molotovBurst', x: 0, y: 0 })).toBe('pop'); // Che's Molotov
    expect(sfxFor({ type: 'shot', weapon: 'molotov', x: 0, y: 0, facing: 1 })).toBe('throw');
    expect(sfxFor({ type: 'shot', weapon: 'grenade', x: 0, y: 0, facing: 1 })).toBe('throw');
  });

  it('gives the alarm a siren', () => {
    expect(sfxFor({ type: 'siren', x: 0, y: 0 })).toBe('siren');
    expect(sfxFor({ type: 'alarmWarning', x: 0, y: 0 })).toBeNull();
  });

  it("gives Meloni's flamethrower its whoosh and her flame wall a roar", () => {
    expect(sfxFor({ type: 'shot', weapon: 'flamethrower', x: 0, y: 0, facing: 1 })).toBe('flame');
    expect(sfxFor({ type: 'shot', weapon: 'flameWall', x: 0, y: 0, facing: 1 })).toBe('roar');
  });

  it("gives Musk's laser its charge, its blast, its hum, its power-down and its overheat alarm; his arcs crackle", () => {
    const laser = (phase: 'charge' | 'on' | 'hum' | 'stop' | 'overheat') => sfxFor({ type: 'laser', phase, x: 0, y: 0 });
    expect((['charge', 'on', 'hum', 'stop', 'overheat'] as const).map(laser)).toEqual(['laserCharge', 'laserBlast', 'laserHum', 'laserStop', 'overheat']);
    expect(sfxFor({ type: 'zapHit', x: 0, y: 0, unit: true })).toBe('zap');
    expect(sfxFor({ type: 'laserHit', x: 0, y: 0, dir: 1 })).toBeNull();
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
