import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildLab, forest } from './lab';

const level = buildLab();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 8: the lab', () => {
  it('is 440 x 20 with aligned rows, in the forest', () => {
    expect(level.cols).toBe(440);
    expect(level.rows).toBe(20);
    expect(level.tiles.every((row) => row.length === 440)).toBe(true);
    expect(level.theme).toBe('forest');
  });

  it('has every alien out of its cage: xenomorphs, brain-box xenomorphs, facehuggers, snakes, melters, brutes and mosquitoes', () => {
    expect(count('alien_xeno')).toBe(6);
    expect(count('alien_xeno_brain')).toBe(3);
    expect(count('alien_hugger')).toBe(6);
    expect(count('alien_snake')).toBe(4);
    expect(count('alien_melter')).toBe(4);
    expect(count('alien_brute')).toBe(2);
    expect(count('alien_mosquito')).toBe(5);
  });

  it('has 78 enemies: the aliens among the lab guards', () => {
    expect(count('mook')).toBe(22);
    expect(count('mook_shield')).toBe(3);
    expect(count('mook_grenadier')).toBe(4);
    expect(count('dog')).toBe(4);
    expect(count('mook_bazooka')).toBe(3);
    expect(count('mook_suicide')).toBe(3);
    expect(count('mook_scout')).toBe(1);
    expect(count('mook_alarmist')).toBe(1);
    expect(count('mook_jetpack')).toBe(1);
    expect(count('mook_jetpack_bazooka')).toBe(1);
    expect(count('mook_bruiser')).toBe(1);
    expect(count('mook_ninja')).toBe(2);
    expect(count('mook_mortar')).toBe(1);
    expect(count('mook_bruiser_elite')).toBe(1);
    expect(parsed.enemies).toHaveLength(78);
    expect(parsed.signs).toHaveLength(2);
    expect(parsed.cages).toHaveLength(6);
    expect(parsed.doors).toHaveLength(1);
    expect(parsed.checkpoints).toHaveLength(5);
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

  it('every mosquito has open air over it to take off (64 up)', () => {
    for (const m of parsed.enemies.filter((e) => e.kind === 'alien_mosquito')) {
      for (let r = m.r; r <= m.r + 4; r++) expect(parsed.map.isSolid(m.c, r), `mosquito ${m.c}: row ${r}`).toBe(false);
    }
  });

  it('each brute has a wall to smash through or to stun itself on between it and the bro', () => {
    for (const b of parsed.enemies.filter((e) => e.kind === 'alien_brute')) {
      let wall = false;
      for (let c = b.c - 1; c > b.c - 12; c--) wall = wall || parsed.map.isSolid(c, b.r);
      expect(wall, `brute ${b.c}`).toBe(true);
    }
  });

  it('spreads the forest behind the lab', () => {
    const doodads = forest();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
  });
});
