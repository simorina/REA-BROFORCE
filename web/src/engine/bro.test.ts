import { describe, expect, it } from 'vitest';
import { BROLUSCONI, BROS, CHE, KIM, MELONI, PUTIN, SAMUEL, TRUMP, WILL_SMITH, rosterStartingWith } from '../bros';
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

  it('Kim Jong-un fires an RPG and calls an ICBM nuke strike, in Korean', () => {
    expect(KIM).toEqual({
      id: 'kim', name: 'Kim Jong-un', sheet: 'kim', base: 'bro_soldier', weapon: 'rpg', special: 'nuke',
      voiceLine: '미사일을 발사하라!', voiceLang: 'ko-KR',
    });
  });

  it('Will Smith uses Noisy Cricket and calls in the Neuralyzer as Bro In Black', () => {
    expect(WILL_SMITH).toEqual({ // Broforce's Bro In Black (Brononymous): his own sheet and prefab
      id: 'willsmith', name: 'Bro In Black', sheet: 'bro_in_black', base: 'bro_in_black', weapon: 'cricket', special: 'neuralyzer',
      voiceLine: 'I make this look good!', voiceLang: 'en-US',
    });
  });

  it('Samuel L. Jackson slashes with a katana and, as his special, becomes Django', () => {
    expect(SAMUEL).toEqual({
      id: 'samuel', name: 'Samuel L. Jackson', sheet: 'samuel', base: 'bro_lee', weapon: 'blade', special: 'django',
      voiceLine: 'Some motherf***ers are always trying to ice-skate uphill!', voiceLang: 'en-US',
    });
  });

  it('Che Guevara plays as Rambro: his M60 and, for a special, a Molotov', () => {
    expect(CHE).toEqual({
      id: 'che', name: 'Che Guevara', sheet: 'che', base: 'bro_rambro', weapon: 'm60', special: 'molotov',
      voiceLine: '¡Hasta la victoria siempre!', voiceLang: 'es-ES',
    });
  });

  it("Giorgia Meloni plays as Ellen Ripbro: B.A. Broracus's flamethrower and, for a special, Ellen's flame wall", () => {
    expect(MELONI).toEqual({
      id: 'meloni', name: 'Giorgia Meloni', sheet: 'meloni', base: 'bro_ellen', weapon: 'flamethrower', special: 'flamewall',
      voiceLine: 'Io sono Giorgia!', voiceLang: 'it-IT',
    });
  });

  it('rosterStartingWith puts the chosen bro first and keeps the cycle order', () => {
    expect(BROS).toEqual([BROLUSCONI, PUTIN, TRUMP, KIM, WILL_SMITH, SAMUEL, CHE, MELONI]);
    expect(rosterStartingWith('putin')).toEqual([PUTIN, TRUMP, KIM, WILL_SMITH, SAMUEL, CHE, MELONI, BROLUSCONI]);
    expect(rosterStartingWith('brolusconi')).toEqual([BROLUSCONI, PUTIN, TRUMP, KIM, WILL_SMITH, SAMUEL, CHE, MELONI]);
    expect(rosterStartingWith('kim')).toEqual([KIM, WILL_SMITH, SAMUEL, CHE, MELONI, BROLUSCONI, PUTIN, TRUMP]);
  });

  it('rosterStartingWith falls back to the first bro for an unknown id', () => {
    expect(rosterStartingWith('ghost')).toEqual([BROLUSCONI, PUTIN, TRUMP, KIM, WILL_SMITH, SAMUEL, CHE, MELONI]);
  });

  it('rejects unknown weapons and specials', () => {
    expect(() => parseBro({ ...valid, weapon: 'laser' })).toThrow("unknown weapon 'laser'");
    expect(() => parseBro({ ...valid, special: 'orbital_cannon' })).toThrow("unknown special 'orbital_cannon'");
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

  it('all weapon and special kits are implemented for each bro', async () => {
    const { WEAPON_KITS, SPECIAL_KITS } = await import('./kits');
    for (const b of BROS) {
      expect(WEAPON_KITS[b.weapon], `${b.id} weapon ${b.weapon}`).toBeDefined();
      expect(SPECIAL_KITS[b.special], `${b.id} special ${b.special}`).toBeDefined();
    }
  });
});
