import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildInferno, hellscape } from './inferno';

const level = buildInferno();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 9: hell', () => {
  it('is 470 x 20 with aligned rows, in hell', () => {
    expect(level.cols).toBe(470);
    expect(level.rows).toBe(20);
    expect(level.tiles.every((row) => row.length === 470)).toBe(true);
    expect(level.theme).toBe('hell');
  });

  it("has all of hell's mobs: undead (ten lying dead), undead suicide mooks, skinless mooks, hell dogs, lost souls, Boomers, Soul Catchers, hell Bruisers, armoured ones, warlocks and Satan", () => {
    expect(count('undead')).toBe(17);
    expect(parsed.enemies.filter((e) => e.startDead)).toHaveLength(10);
    expect(count('undead_suicide')).toBe(4);
    expect(count('skinless')).toBe(4);
    expect(count('hell_dog')).toBe(5);
    expect(count('hell_lostsoul')).toBe(5);
    expect(count('hell_boomer')).toBe(3);
    expect(count('hell_soulcatcher')).toBe(2);
    expect(count('hell_bigguy')).toBe(3);
    expect(count('hell_armoured')).toBe(3);
    expect(count('warlock')).toBe(3);
    expect(count('satan')).toBe(4);
  });

  it('has 91 enemies, hell among the last of the guards', () => {
    expect(count('mook')).toBe(23);
    expect(count('mook_shield')).toBe(3);
    expect(count('mook_grenadier')).toBe(3);
    expect(count('dog')).toBe(2);
    expect(count('mook_bruiser')).toBe(1);
    expect(count('mook_jetpack')).toBe(1);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(count('mook_ninja')).toBe(1);
    expect(count('mook_alarmist')).toBe(1);
    expect(count('mook_bazooka')).toBe(1);
    expect(count('mook_suicide')).toBe(1);
    expect(parsed.enemies).toHaveLength(91);
    expect(parsed.signs).toHaveLength(2);
    expect(parsed.cages).toHaveLength(5);
    expect(parsed.checkpoints).toHaveLength(5);
  });

  it('every entity stands on solid ground in open air', () => {
    for (const e of [...parsed.enemies, ...parsed.cages, parsed.player, parsed.flag, ...parsed.checkpoints]) {
      expect(parsed.map.isSolid(e.c, e.r - 1), `${e.c},${e.r}`).toBe(true);
      expect(parsed.map.isSolid(e.c, e.r), `${e.c},${e.r}`).toBe(false);
    }
  });

  it('has bottomless gaps to jump on the bridge, two columns wide', () => {
    const gaps = Array.from({ length: level.cols }, (_, c) => c).filter((c) => !parsed.map.isSolid(c, 0));
    expect(gaps).toEqual([158, 159, 176, 177, 194, 195]);
  });

  it('every lost soul and warlock has open air over it (the souls take off; the warlocks look down on the bro)', () => {
    for (const e of parsed.enemies.filter((m) => m.kind === 'hell_lostsoul' || m.kind === 'warlock')) {
      for (let r = e.r; r <= e.r + 4; r++) expect(parsed.map.isSolid(e.c, r), `${e.kind} ${e.c}: row ${r}`).toBe(false);
    }
  });

  it('spreads hell behind it', () => {
    const doodads = hellscape();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
