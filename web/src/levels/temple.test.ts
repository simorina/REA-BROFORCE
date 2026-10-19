import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildTemple, templeJungle } from './temple';

const level = buildTemple();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 6: the underground temple', () => {
  it('is 390 x 20 with aligned rows', () => {
    expect(level.cols).toBe(390);
    expect(level.rows).toBe(20);
    expect(level.tiles.every((row) => row.length === 390)).toBe(true);
  });

  it('is burning-themed with temple blocks, chasms, and sanctum', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('temple');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'temple', 'steel', 'barrel']));
  });

  it('has 59 enemies, 6 prisoners, 2 mook doors, and 6 checkpoints', () => {
    expect(count('mook')).toBe(28);
    expect(count('mook_suicide')).toBe(9);
    expect(count('mook_bazooka')).toBe(6);
    expect(count('mook_scout')).toBe(2);
    expect(count('mook_shield')).toBe(5);
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

  it('spreads the burning jungle parallax along the temple', () => {
    const doodads = templeJungle();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
