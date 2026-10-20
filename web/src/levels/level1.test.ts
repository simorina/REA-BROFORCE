import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLevel1, jungle } from './level1';

const level = buildLevel1();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe("level 1: Epstein's island", () => {
  it('is 480 x 22 with aligned rows, four times the old level', () => {
    expect(level.cols).toBe(480);
    expect(level.rows).toBe(22);
    expect(level.tiles.every((row) => row.length === 480)).toBe(true);
  });

  it('has 28 mooks, 10 suicide mooks, 8 bazooka mooks, 4 scouts, 4 mook doors and 8 prisoners', () => {
    expect(count('mook')).toBe(28);
    expect(count('mook_suicide')).toBe(10);
    expect(count('mook_bazooka')).toBe(8);
    expect(count('mook_scout')).toBe(4);
    expect(parsed.doors).toHaveLength(4);
    expect(parsed.cages).toHaveLength(8);
  });

  it('has the new enemies too: 4 riot shield mooks, 4 grenadiers and 5 dogs', () => {
    expect(count('mook_shield')).toBe(4);
    expect(count('mook_grenadier')).toBe(4);
    expect(count('dog')).toBe(5);
  });

  it('and the newest: a Bruiser, two ninjas, an alarmist, two jetpack mooks and a minefield', () => {
    expect(count('mook_bruiser')).toBe(1);
    expect(count('mook_ninja')).toBe(2);
    expect(count('mook_alarmist')).toBe(1);
    expect(count('mook_jetpack')).toBe(1);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(parsed.signs).toHaveLength(2);
  });

  it('is the jungle-themed final mission', () => {
    expect(level.theme).toBe('jungle');
  });

  it('starts on a sand beach and climbs into jungle earth, with a temple of white and blue bricks', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('sand');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'sand', 'dirt', 'brick', 'temple', 'steel', 'barrel']));
  });

  it("the guardhouse's ground floor opens on both sides, so the tank can drive through", () => {
    for (const c of [163, 177]) for (const r of [8, 9]) expect(parsed.map.get(c, r)).toBeNull();
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

  it('has seven checkpoints: before Epstein, between his two fights and before his Goliath', () => {
    const cs = parsed.checkpoints.map((c) => c.c).sort((a, b) => a - b); // the parser lists them row by row
    expect(cs).toHaveLength(7);
    expect(cs[0]).toBeGreaterThan(parsed.player.c);
    expect(cs.some((c) => c > parsed.boss!.c && c < parsed.mech!.c)).toBe(true);
    expect(cs[6]).toBeLessThan(parsed.mech!.c);
  });

  it('meets Epstein at his temple under open sky (his guards drop in)', () => {
    const b = parsed.boss!;
    for (let c = b.c - 4; c <= b.c + 4; c++) for (let r = b.r; r < level.rows; r++) expect(parsed.map.get(c, r)).toBeNull();
  });

  it('ends with his Goliath on a steel pad under open sky, the flag behind it', () => {
    const m = parsed.mech!;
    expect(m.c).toBeGreaterThan(parsed.boss!.c);
    for (let c = m.c - 6; c <= m.c + 6; c++) {
      expect(parsed.map.get(c, m.r - 1)?.kind).toBe('steel');
      for (let r = m.r; r < level.rows; r++) expect(parsed.map.get(c, r)).toBeNull();
    }
    expect(parsed.flag.c).toBeGreaterThan(m.c);
  });

  it("the secret base's ground floor runs through from side to side", () => {
    for (const c of [334, 384]) for (const r of [4, 5]) expect(parsed.map.get(c, r)).toBeNull();
  });

  it('puts every entity in open air, standing on something solid', () => {
    const all = [parsed.player, parsed.flag, parsed.boss!, parsed.mech!, ...parsed.enemies, ...parsed.cages, ...parsed.checkpoints, ...parsed.doors];
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
