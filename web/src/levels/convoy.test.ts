import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildConvoy, city } from './convoy';

const level = buildConvoy();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;
const foes = (k: string) => parsed.foes.filter((f) => f.kind === k).length;

describe('mission 7: the convoy', () => {
  it('is 420 x 20 with aligned rows, in the city', () => {
    expect(level.cols).toBe(420);
    expect(level.rows).toBe(20);
    expect(level.tiles.every((row) => row.length === 420)).toBe(true);
    expect(level.theme).toBe('city');
  });

  it('has the whole convoy: a troop truck, two motorbikes, the artillery truck, the APC, a nuclear motorbike and the Mookopter', () => {
    expect(foes('truck')).toBe(1);
    expect(foes('bike')).toBe(2);
    expect(foes('artillery')).toBe(1);
    expect(foes('apc')).toBe(1);
    expect(foes('nukebike')).toBe(1);
    expect(foes('kopter')).toBe(1);
  });

  it('has 67 enemies: mortar mooks on the rooftops, elite Bruisers, and the universal soldier at its head', () => {
    expect(count('mook_mortar')).toBe(4);
    expect(count('mook_bruiser_elite')).toBe(2);
    expect(count('mook_dolph')).toBe(1);
    expect(count('mook')).toBe(29);
    expect(count('mook_bruiser')).toBe(1);
    expect(count('mook_ninja')).toBe(2);
    expect(count('mook_alarmist')).toBe(2);
    expect(count('mook_jetpack')).toBe(2);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(parsed.enemies).toHaveLength(67);
    expect(parsed.signs).toHaveLength(3);
    expect(parsed.cages).toHaveLength(4);
    expect(parsed.doors).toHaveLength(2);
    expect(parsed.checkpoints).toHaveLength(5);
  });

  it('the universal soldier stands between the bro and the flag', () => {
    const d = parsed.enemies.find((e) => e.kind === 'mook_dolph')!;
    expect(d.c).toBeLessThan(parsed.flag.c);
    expect(d.c).toBeGreaterThan(Math.max(...parsed.checkpoints.map((c) => c.c)));
  });

  it('every scout can run to a mook door further on, over flat open ground', () => {
    for (const s of parsed.enemies.filter((e) => e.kind === 'mook_scout')) {
      const door = parsed.doors.find((d) => d.r === s.r && d.c > s.c);
      expect(door).toBeDefined();
      for (let c = s.c; c <= door!.c; c++) expect(parsed.map.isSolid(c, s.r - 1) && !parsed.map.isSolid(c, s.r)).toBe(true);
    }
  });

  it('every entity and vehicle on the road stands on solid ground in open air; the Mookopter hangs over it', () => {
    for (const e of [...parsed.enemies, ...parsed.cages, parsed.player, parsed.flag, ...parsed.foes.filter((f) => f.kind !== 'kopter')]) {
      expect(parsed.map.isSolid(e.c, e.r - 1), `${e.c},${e.r}`).toBe(true);
      expect(parsed.map.isSolid(e.c, e.r), `${e.c},${e.r}`).toBe(false);
    }
    const k = parsed.foes.find((f) => f.kind === 'kopter')!;
    expect(parsed.map.isSolid(k.c, k.r - 1)).toBe(false);
  });

  it('spreads the city behind the road', () => {
    const doodads = city();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
