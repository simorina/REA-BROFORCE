import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildDesert, hills } from './desert';

const level = buildDesert();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 1: the desert', () => {
  it('is the first level, 120 x 18 with aligned rows', () => {
    expect(level.cols).toBe(120);
    expect(level.rows).toBe(18);
    expect(level.tiles.every((row) => row.length === 120)).toBe(true);
  });

  it('stands on sand, with a brick bunker and tower and a steel core in the hill', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('sand');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'sand', 'brick', 'steel', 'barrel']));
  });

  it('keeps it easy: a handful of each enemy, one of each new kind but two dogs', () => {
    expect(count('mook')).toBe(8);
    expect(count('mook_suicide')).toBe(2);
    expect(count('mook_bazooka')).toBe(2);
    expect(count('mook_scout')).toBe(1);
    expect(count('mook_shield')).toBe(1);
    expect(count('mook_grenadier')).toBe(1);
    expect(count('dog')).toBe(2);
    expect(count('mook_jetpack')).toBe(1); // and a first taste of what is coming: a jetpack mook and a minefield
    expect(parsed.signs).toHaveLength(2);
    expect(parsed.cages).toHaveLength(4);
    expect(parsed.checkpoints).toHaveLength(3);
    expect(parsed.doors).toHaveLength(1);
  });

  it('has one pit to jump, steel at its bottom', () => {
    const gaps = Array.from({ length: level.cols }, (_, c) => c).filter((c) => !parsed.map.isSolid(c, 1));
    expect(gaps).toEqual([37, 38, 39, 40]);
  });

  it('spreads the Desert parallax hills along the level', () => {
    const h = hills();
    expect(new Set(h.map((d) => d.layer))).toEqual(new Set(['near', 'mid', 'distant']));
    expect(Math.max(...h.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
    expect(level.parallax).toEqual(h);
  });
});
