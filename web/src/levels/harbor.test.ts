import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildHarbor, harborJungle } from './harbor';

const level = buildHarbor();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 2: the harbor', () => {
  it('is 170 x 18 with aligned rows', () => {
    expect(level.cols).toBe(170);
    expect(level.rows).toBe(18);
    expect(level.tiles.every((row) => row.length === 170)).toBe(true);
  });

  it('has docks, shipping containers, warehouse, and crane', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('dirt');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'dirt', 'brick', 'steel', 'barrel']));
  });

  it('has 27 enemies, including shield mooks, grenadiers, dogs, a Bruiser and two jetpack mooks', () => {
    expect(count('mook_bruiser')).toBe(1);
    expect(count('mook_jetpack')).toBe(1);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(count('mook')).toBe(10);
    expect(count('mook_suicide')).toBe(3);
    expect(count('mook_bazooka')).toBe(3);
    expect(count('mook_scout')).toBe(1);
    expect(count('mook_shield')).toBe(2);
    expect(count('mook_grenadier')).toBe(2);
    expect(count('dog')).toBe(3);
    expect(parsed.cages).toHaveLength(4);
    expect(parsed.doors).toHaveLength(1);
    expect(parsed.checkpoints).toHaveLength(4);
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

  it('spreads the jungle parallax along the harbor', () => {
    const doodads = harborJungle();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
