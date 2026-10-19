import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { airstripHills, buildAirstrip } from './airstrip';

const level = buildAirstrip();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 5: the airstrip', () => {
  it('is 330 x 18 with aligned rows', () => {
    expect(level.cols).toBe(330);
    expect(level.rows).toBe(18);
    expect(level.tiles.every((row) => row.length === 330)).toBe(true);
  });

  it('is desert-themed on sand with hangars and tower', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('sand');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'sand', 'brick', 'steel', 'barrel']));
  });

  it('has 49 enemies, 6 prisoners, 2 mook doors, and 6 checkpoints', () => {
    expect(count('mook')).toBe(23);
    expect(count('mook_suicide')).toBe(6);
    expect(count('mook_bazooka')).toBe(5);
    expect(count('mook_scout')).toBe(2);
    expect(count('mook_shield')).toBe(4);
    expect(count('mook_grenadier')).toBe(4);
    expect(count('dog')).toBe(5);
    expect(parsed.cages).toHaveLength(6);
    expect(parsed.doors).toHaveLength(2);
    expect(parsed.checkpoints).toHaveLength(6);
  });

  it('every scout can run to a mook door further on, over flat open ground', () => {
    for (const s of parsed.enemies.filter((e) => e.kind === 'mook_scout')) {
      const door = parsed.doors.find((d) => d.r === s.r && d.c > s.c);
      expect(door).toBeDefined();
      for (let c = s.c; c <= door!.c; c++) expect(parsed.map.isSolid(c, s.r - 1) && !parsed.map.isSolid(c, s.r)).toBe(true);
    }
  });

  it('every entity stands on solid ground in open air', () => {
    for (const e of [...parsed.enemies, ...parsed.cages, parsed.player, parsed.flag]) {
      expect(parsed.map.isSolid(e.c, e.r - 1), `${e.c},${e.r}`).toBe(true);
      expect(parsed.map.isSolid(e.c, e.r), `${e.c},${e.r}`).toBe(false);
    }
  });

  it('spreads the desert parallax hills along the airstrip', () => {
    const doodads = airstripHills();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
