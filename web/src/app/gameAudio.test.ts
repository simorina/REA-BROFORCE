import { describe, expect, it } from 'vitest';
import type { MusicType } from '../engine/level';
import { MISSIONS } from '../levels';
import { INTENSITY, MookVoices, MusicIntensity, VOICE_PLAY, musicFor, pickVoice, type GameAudio } from './gameAudio';

const TYPES: MusicType[] = ['BroforceDrums', 'JungleBlueSky', 'JungleRedSky', 'Factory', 'Alien', 'Hell', 'Desert'];
const AUDIO: GameAudio = {
  voices: {
    mook: {
      greet: ['audio/voices/hah1.wav', 'audio/voices/hah2.wav'], confused: ['audio/voices/huh.wav'], attract: ['audio/voices/q.wav'],
      laugh: ['audio/voices/ha.wav'], panic: ['audio/voices/aaa.wav'], hurt: ['audio/voices/ow.wav'],
    },
  },
  music: Object.fromEntries(TYPES.map((t) => [t, { low: `audio/music/${t}_low.ogg`, high: `audio/music/${t}_high.ogg` }])) as GameAudio['music'],
  boss: { epstein: 'audio/music/e.ogg', goliath: 'audio/music/g.ogg', dolph: 'audio/music/d.ogg', sting: 'audio/music/s.ogg' },
};
const voice = (unit: number, line: 'laugh' | 'hurt' | 'greet') => ({ type: 'mookVoice' as const, x: 0, y: 0, kind: 'mook' as const, line, unit });

describe("the mobs' voices", () => {
  it('a mook says one of his clips for the line, at the volume Broforce plays it', () => {
    expect(pickVoice(AUDIO, 'mook', 'greet', () => 0.6)).toEqual({ file: '/audio/voices/hah2.wav', volume: VOICE_PLAY.greet.volume, rate: 1 });
    expect(VOICE_PLAY.greet.volume).toBe(0.4); // PlayGreetingSound
    expect(VOICE_PLAY.laugh.volume).toBe(0.6); // PlayLaughterSound
  });

  it('a mook drawn in by the flex asks with his attracted line seven times in ten, else with his confused one', () => {
    expect(pickVoice(AUDIO, 'mook', 'attract', () => 0.5)?.file).toBe('/audio/voices/q.wav');
    expect(pickVoice(AUDIO, 'mook', 'attract', () => 0.8)?.file).toBe('/audio/voices/huh.wav');
  });

  it('his panic scream is pitched up at random, 1 to 1.175 (PlayPanicSound)', () => {
    expect(pickVoice(AUDIO, 'mook', 'panic', () => 0)?.rate).toBe(1);
    expect(pickVoice(AUDIO, 'mook', 'panic', () => 0.999)?.rate).toBeCloseTo(1.175, 2);
  });

  it('nothing for a line or a kind without clips', () => {
    expect(pickVoice(AUDIO, 'mook', 'death', () => 0.5)).toBeNull();
    expect(pickVoice(AUDIO, 'dog', 'greet', () => 0.5)).toBeNull();
  });

  it('a mook laughs at most every 2 s (_lastLaughterSoundTime) and grunts at most every 0.1 s (lastHitSoundTime)', () => {
    const v = new MookVoices(AUDIO, () => 0.5);
    expect(v.say(voice(1, 'laugh'), 0)).not.toBeNull();
    expect(v.say(voice(1, 'laugh'), 1)).toBeNull();
    expect(v.say(voice(2, 'laugh'), 1)).not.toBeNull(); // another mook
    expect(v.say(voice(1, 'laugh'), 2.1)).not.toBeNull();
    expect(v.say(voice(1, 'hurt'), 3)).not.toBeNull();
    expect(v.say(voice(1, 'hurt'), 3.05)).toBeNull();
    expect(v.say(voice(1, 'greet'), 3.05)).not.toBeNull();
  });
});

describe('the level music', () => {
  it("plays the theme's MusicType unless the level names its own (Sound.PlayMusic)", () => {
    expect(musicFor({ theme: 'jungle' })).toBe('BroforceDrums');
    expect(musicFor({ theme: 'burning' })).toBe('JungleRedSky');
    expect(musicFor({ theme: 'forest' })).toBe('Factory');
    expect(musicFor({ theme: 'hell' })).toBe('Hell');
    expect(musicFor({ theme: 'desert' })).toBe('Desert');
    expect(musicFor({ theme: 'city' })).toBe('Factory');
    expect(musicFor({ theme: 'jungle', music: 'Alien' })).toBe('Alien');
  });

  it('gives each mission its track: the harbour Blue Sky, the skyscraper ExpendaBros, the lab the aliens', () => {
    expect(MISSIONS.map((m) => musicFor(m.build()))).toEqual([
      'Desert', 'JungleBlueSky', 'JungleRedSky', 'Factory', 'Desert', 'JungleRedSky', 'Factory', 'Alien', 'Hell', 'BroforceDrums',
    ]);
  });

  it('a kill sends it to high intensity, held for the grace, then it calms down (StatisticsController.musicIntensity)', () => {
    const i = new MusicIntensity();
    expect(i.high).toBe(false);
    i.kill();
    expect(i.high).toBe(true);
    i.step(INTENSITY.grace - 0.1);
    expect(i.value).toBe(1);
    let t = 0;
    while (i.high && t < 10) {
      i.step(0.05);
      t += 0.05;
    }
    expect(t).toBeGreaterThan(0.1);
    expect(t).toBeLessThan(2);
  });

  it('a vehicle blown up counts four kills and holds longer', () => {
    const i = new MusicIntensity();
    i.vehicle();
    expect(i.value).toBe(4);
    i.step(INTENSITY.vehicleGrace - 0.1);
    expect(i.value).toBe(4);
  });
});
