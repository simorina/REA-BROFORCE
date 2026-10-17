import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLevel1, jungle } from './level1';

const level = buildLevel1();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe("level 1: Epstein's island", () => {
  it('is 300 x 22 with aligned rows, two and a half times the old level', () => {
    expect(level.cols).toBe(300);
    expect(level.rows).toBe(22);
    expect(level.tiles.every((row) => row.length === 300)).toBe(true);
  });

  it('has 23 mooks, 8 suicide mooks, 5 bazooka mooks, 3 scouts, 3 mook doors and 6 prisoners', () => {
    expect(count('mook')).toBe(23);
    expect(count('mook_suicide')).toBe(8);
    expect(count('mook_bazooka')).toBe(5);
    expect(count('mook_scout')).toBe(3);
    expect(parsed.doors).toHaveLength(3);
    expect(parsed.cages).toHaveLength(6);
  });

  it('starts on a sand beach and climbs into jungle earth, with a temple of white and blue bricks', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('sand');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'sand', 'dirt', 'brick', 'temple', 'steel', 'barrel']));
  });

  it('has bottomless gaps to jump', () => {
    const gaps = Array.from({ length: level.cols }, (_, c) => c).filter((c) => !parsed.map.isSolid(c, 0));
    expect(gaps.length).toBeGreaterThanOrEqual(6);
  });

  it('every scout can run to a mook door further on, over flat open ground', () => {
    for (const s of parsed.enemies.filter((e) => e.kind === 'mook_scout')) {
      const door = parsed.doors.find((d) => d.r === s.r && d.c > s.c);
      expect(door).toBeDefined();
      for (let c = s.c; c <= door!.c; c++) expect(parsed.map.isSolid(c, s.r - 1) && !parsed.map.isSolid(c, s.r)).toBe(true);
    }
  });

  it('has five checkpoints in order between the start and the flag', () => {
    const cs = parsed.checkpoints.map((c) => c.c).sort((a, b) => a - b); // the parser lists them row by row
    expect(cs).toHaveLength(5);
    expect(cs[0]).toBeGreaterThan(parsed.player.c);
    expect(cs[4]).toBeLessThan(parsed.boss!.c);
  });

  it('ends with Epstein under open sky (his guards drop in), the flag behind him', () => {
    const b = parsed.boss!;
    for (let c = b.c - 4; c <= b.c + 4; c++) for (let r = b.r; r < level.rows; r++) expect(parsed.map.get(c, r)).toBeNull();
    expect(parsed.flag.c).toBeGreaterThan(b.c);
  });

  it('puts every entity in open air, standing on something solid', () => {
    const all = [parsed.player, parsed.flag, parsed.boss!, ...parsed.enemies, ...parsed.cages, ...parsed.checkpoints, ...parsed.doors];
    for (const e of all) {
      expect(parsed.map.get(e.c, e.r)).toBeNull();
      expect(parsed.map.isSolid(e.c, e.r - 1)).toBe(true);
    }
  });

  it("spreads the Jungle theme's background along the island, within its art's variants", () => {
    const counts = { near: 3, mid: 2, distant: 3 };
    const bg = jungle();
    expect(bg.every((d) => d.variant < counts[d.layer])).toBe(true);
    expect(Math.max(...bg.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
