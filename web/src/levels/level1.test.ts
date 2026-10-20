import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLevel1, jungle } from './level1';

const level = buildLevel1();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe("level 1: Epstein's island", () => {
  it('is 580 x 22 with aligned rows, the longest mission', () => {
    expect(level.cols).toBe(580);
    expect(level.rows).toBe(22);
    expect(level.tiles.every((row) => row.length === 580)).toBe(true);
  });

  it('has 37 mooks, 13 suicide mooks, 9 bazooka mooks, 4 scouts, 4 mook doors and 9 prisoners', () => {
    expect(count('mook')).toBe(37);
    expect(count('mook_suicide')).toBe(13);
    expect(count('mook_bazooka')).toBe(9);
    expect(count('mook_scout')).toBe(4);
    expect(parsed.doors).toHaveLength(4);
    expect(parsed.cages).toHaveLength(9);
  });

  it('has the new enemies too: 5 riot shield mooks, 6 grenadiers and 6 dogs', () => {
    expect(count('mook_shield')).toBe(5);
    expect(count('mook_grenadier')).toBe(6);
    expect(count('dog')).toBe(6);
  });

  it('and the newest: two Bruisers, three ninjas, an alarmist, three jetpack mooks and a minefield', () => {
    expect(count('mook_bruiser')).toBe(2);
    expect(count('mook_ninja')).toBe(3);
    expect(count('mook_alarmist')).toBe(1);
    expect(count('mook_jetpack')).toBe(2);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(parsed.signs).toHaveLength(2);
  });

  it("Epstein's last garrison, before his Goliath: mortar mooks on a bunker, an elite Bruiser, a troop truck and two motorbikes, and aliens out of his lab", () => {
    expect(count('mook_mortar')).toBe(2);
    expect(count('mook_bruiser_elite')).toBe(1);
    expect(parsed.foes.map((f) => f.kind).sort()).toEqual(['bike', 'bike', 'truck']);
    for (const k of ['alien_xeno', 'alien_xeno_brain', 'alien_hugger', 'alien_snake', 'alien_melter', 'alien_mosquito']) expect(count(k), k).toBeGreaterThan(0);
    expect(parsed.enemies).toHaveLength(99);
    const garrison = parsed.enemies.filter((e) => e.c > 395 && e.c < parsed.mech!.c);
    expect(garrison).toHaveLength(30);
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

  it('has eight checkpoints: before Epstein, between his two fights and before his Goliath', () => {
    const cs = parsed.checkpoints.map((c) => c.c).sort((a, b) => a - b); // the parser lists them row by row
    expect(cs).toHaveLength(8);
    expect(cs[0]).toBeGreaterThan(parsed.player.c);
    expect(cs.some((c) => c > parsed.boss!.c && c < parsed.mech!.c)).toBe(true);
    expect(cs[7]).toBeLessThan(parsed.mech!.c);
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
