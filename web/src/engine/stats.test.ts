import { describe, expect, it } from 'vitest';
import { parseValues } from './stats';
import { RAW_VALUES, TEST_STATS } from './testStats';

describe('parseValues', () => {
  it('maps values.json onto GameStats', () => {
    expect(parseValues(RAW_VALUES)).toEqual(TEST_STATS);
  });

  it('reads Double Bro Seven and BroLee as bros: no grass hiding, no fire panic', () => {
    const s = parseValues(RAW_VALUES);
    expect(s.bros.bro_lee).toMatchObject({ speed: 120, fireRate: 0.2, specialAmmo: 2, canWallClimb: true });
    expect(s.bros.bro_lee).toMatchObject({ canHideInGrass: false, canBeSetOnFire: false, panicsOnFire: false });
    expect(s.bros.bro_base.specialAmmo).toBe(4);
  });

  it('names bro_lee when it is missing (game-data extracted before Putin)', () => {
    const old: Record<string, Record<string, unknown>> = { ...RAW_VALUES };
    delete old.bro_lee;
    expect(() => parseValues(old)).toThrow('bro_lee.speed');
  });

  it('names the missing field', () => {
    const raw = { ...RAW_VALUES, bomb: { damage: 10 } };
    expect(() => parseValues(raw)).toThrow('bomb.range');
  });

  it('rejects non-numeric values', () => {
    const raw = { ...RAW_VALUES, bullet: { damage: 'x', life: 0.45 } };
    expect(() => parseValues(raw)).toThrow('bullet.damage');
  });

  it('reads each mook AI component', () => {
    expect(parseValues(RAW_VALUES).ai.mook.sightDelay).toBe(1.66);
    const raw = { ...RAW_VALUES, ai_mook_bazooka: { ...RAW_VALUES.ai_mook_bazooka, sightRangeY: undefined } };
    expect(() => parseValues(raw)).toThrow('ai_mook_bazooka.sightRangeY');
  });
});

