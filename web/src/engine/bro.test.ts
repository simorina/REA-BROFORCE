import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { parseBro } from './bro';

const valid = { id: 'x', name: 'X', sheet: 'brolusconi', weapon: 'football', special: 'airstrike', voiceLine: 'Ciao' };

describe('bro definitions', () => {
  it('Brolusconi kicks footballs and calls the airstrike with his line', () => {
    expect(BROLUSCONI).toEqual({
      id: 'brolusconi', name: 'Silvio Brolusconi', sheet: 'brolusconi', weapon: 'football', special: 'airstrike',
      voiceLine: 'Siete solo dei poveri comunisti!',
    });
  });

  it('rejects unknown weapons and specials', () => {
    expect(() => parseBro({ ...valid, weapon: 'laser' })).toThrow("unknown weapon 'laser'");
    expect(() => parseBro({ ...valid, special: 'nuke' })).toThrow("unknown special 'nuke'");
  });

  it('rejects missing or empty text fields', () => {
    expect(() => parseBro({ ...valid, voiceLine: '' })).toThrow('voiceLine');
    expect(() => parseBro(null)).toThrow('not an object');
  });
});
