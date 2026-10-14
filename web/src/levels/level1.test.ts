import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLevel1 } from './level1';

const level = buildLevel1();
const parsed = parseLevel(level, TEST_STATS);

describe('level 1', () => {
  it('is 120 x 18 with aligned rows', () => {
    expect(level.cols).toBe(120);
    expect(level.rows).toBe(18);
    expect(level.tiles.every((row) => row.length === 120)).toBe(true);
  });

  it('has 8 mooks, 2 suicide mooks, 2 bazooka mooks and 3 prisoners', () => {
    const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;
    expect(count('mook')).toBe(8);
    expect(count('mook_suicide')).toBe(2);
    expect(count('mook_bazooka')).toBe(2);
    expect(parsed.cages).toHaveLength(3);
  });

  it('puts every entity in open air, standing on something solid', () => {
    for (const e of [parsed.player, parsed.flag, ...parsed.enemies, ...parsed.cages]) {
      expect(parsed.map.get(e.c, e.r)).toBeNull();
      expect(parsed.map.isSolid(e.c, e.r - 1)).toBe(true);
    }
  });

  it('places the flag after the start', () => {
    expect(parsed.flag.c).toBeGreaterThan(parsed.player.c);
  });
});
