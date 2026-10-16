import { describe, expect, it } from 'vitest';
import { BROLUSCONI, BROS, PUTIN, rosterStartingWith } from '../bros';
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

  it('Putin throws mooks with judo and opens a matryoshka, in Russian', () => {
    expect(PUTIN).toEqual({
      id: 'putin', name: 'Vladimir Putin', sheet: 'putin', base: 'bro_lee', weapon: 'judo', special: 'matryoshka',
      voiceLine: 'Если драка неизбежна, бей первым!', voiceLang: 'ru-RU',
    });
  });

  it('rosterStartingWith puts the chosen bro first and keeps the cycle order', () => {
    expect(BROS).toEqual([BROLUSCONI, PUTIN]);
    expect(rosterStartingWith('putin')).toEqual([PUTIN, BROLUSCONI]);
    expect(rosterStartingWith('brolusconi')).toEqual([BROLUSCONI, PUTIN]);
  });

  it('rosterStartingWith falls back to the first bro for an unknown id', () => {
    expect(rosterStartingWith('ghost')).toEqual([BROLUSCONI, PUTIN]);
  });

  it('rejects unknown weapons and specials', () => {
    expect(() => parseBro({ ...valid, weapon: 'laser' })).toThrow("unknown weapon 'laser'");
    expect(() => parseBro({ ...valid, special: 'nuke' })).toThrow("unknown special 'nuke'");
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
