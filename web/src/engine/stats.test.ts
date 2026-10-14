import { describe, expect, it } from 'vitest';
import { parseValues } from './stats';
import { RAW_VALUES, TEST_STATS } from './testStats';

describe('parseValues', () => {
  it('maps values.json onto GameStats', () => {
    expect(parseValues(RAW_VALUES)).toEqual(TEST_STATS);
  });

  it('names the missing field', () => {
    const raw = { ...RAW_VALUES, bomb: { damage: 10 } };
    expect(() => parseValues(raw)).toThrow('bomb.range');
  });

  it('rejects non-numeric values', () => {
    const raw = { ...RAW_VALUES, bullet: { damage: 'x', life: 0.45 } };
    expect(() => parseValues(raw)).toThrow('bullet.damage');
  });
});
