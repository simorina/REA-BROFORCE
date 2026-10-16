import { describe, expect, it } from 'vitest';
import { BROLUSCONI, BROS, PUTIN, TRUMP, rosterStartingWith } from '../bros';
import { parseBro } from './bro';

const valid = {
  id: 'x', name: 'X', sheet: 'brolusconi', base: 'bro_base', weapon: 'football', special: 'airstrike',
  voiceLine: 'Ciao', voiceLang: 'it-IT',
};

describe('bro definitions', () => {
  it('Brolusconi kicks footballs and calls the airstrike with his line', () => {
    expect(BROLUSCONI).toEqual({
      id: 'brolusconi', name: 'Silvio Brolusconi', sheet: 'brolusconi', base: 'bro_base', weapon: 'football',
      special: 'airstrike', voiceLine: 'Siete solo dei poveri comunisti!', voiceLang: 'it-IT',
    });
  });

  it('Putin throws mooks with judo and calls in a tank, in Russian', () => {
    expect(PUTIN).toEqual({
      id: 'putin', name: 'Vladimir Putin', sheet: 'putin', base: 'bro_lee', weapon: 'judo', special: 'tank',
      voiceLine: 'Если драка неизбежна, бей первым!', voiceLang: 'ru-RU',
    });
  });

  it('Trump fires a rifle and calls in a jet, in English', () => {
    expect(TRUMP).toEqual({
      id: 'trump', name: 'Donald Trump', sheet: 'trump', base: 'bro_soldier', weapon: 'rifle', special: 'jet',
      voiceLine: 'Make America Great Again!', voiceLang: 'en-US',
    });
  });

  it('rosterStartingWith puts the chosen bro first and keeps the cycle order', () => {
    expect(BROS).toEqual([BROLUSCONI, PUTIN, TRUMP]);
    expect(rosterStartingWith('putin')).toEqual([PUTIN, TRUMP, BROLUSCONI]);
    expect(rosterStartingWith('brolusconi')).toEqual([BROLUSCONI, PUTIN, TRUMP]);
  });

  it('rosterStartingWith falls back to the first bro for an unknown id', () => {
    expect(rosterStartingWith('ghost')).toEqual([BROLUSCONI, PUTIN, TRUMP]);
  });

  it('rejects unknown weapons and specials', () => {
    expect(() => parseBro({ ...valid, weapon: 'laser' })).toThrow("unknown weapon 'laser'");
    expect(() => parseBro({ ...valid, special: 'nuke' })).toThrow("unknown special 'nuke'");
    expect(() => parseBro({ ...valid, special: 'matryoshka' })).toThrow("unknown special 'matryoshka'");
  });

  it('rejects an unknown base prefab and a missing voice language', () => {
    expect(() => parseBro({ ...valid, base: 'rambro' })).toThrow("unknown base 'rambro'");
    expect(() => parseBro({ ...valid, voiceLang: '' })).toThrow('voiceLang');
  });

  it('rejects missing or empty text fields', () => {
    expect(() => parseBro({ ...valid, voiceLine: '' })).toThrow('voiceLine');
    expect(() => parseBro(null)).toThrow('not an object');
  });
});
