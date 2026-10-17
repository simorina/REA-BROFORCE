import { describe, expect, it } from 'vitest';
import { parseLevel } from '../engine/level';
import { TEST_STATS } from '../engine/testStats';
import { buildBurning, burningJungle } from './burning';

const level = buildBurning();
const parsed = parseLevel(level, TEST_STATS);
const count = (k: string) => parsed.enemies.filter((e) => e.kind === k).length;

describe('mission 2: the burning jungle', () => {
  it('is 220 x 20 with aligned rows', () => {
    expect(level.cols).toBe(220);
    expect(level.rows).toBe(20);
    expect(level.tiles.every((row) => row.length === 220)).toBe(true);
  });

  it('is in jungle earth, with brick huts, barrels to set off and a steel bunker', () => {
    expect(parsed.map.get(parsed.player.c, parsed.player.r - 1)?.kind).toBe('dirt');
    const kinds = new Set<string>();
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) kinds.add(parsed.map.get(c, r)?.kind ?? '');
    expect(kinds).toEqual(new Set(['', 'dirt', 'brick', 'steel', 'barrel']));
    let barrels = 0;
    for (let c = 0; c < level.cols; c++) for (let r = 0; r < level.rows; r++) if (parsed.map.get(c, r)?.kind === 'barrel') barrels++;
    expect(barrels).toBeGreaterThanOrEqual(10);
  });

  it('is a step up from the desert: more of every enemy, the new kinds among them', () => {
    expect(count('mook')).toBe(14);
    expect(count('mook_suicide')).toBe(4);
    expect(count('mook_bazooka')).toBe(3);
    expect(count('mook_scout')).toBe(2);
    expect(count('mook_shield')).toBe(3);
    expect(count('mook_grenadier')).toBe(3);
    expect(count('dog')).toBe(4);
    expect(parsed.cages).toHaveLength(5);
    expect(parsed.doors).toHaveLength(2);
  });

  it('has four checkpoints, spread along the way', () => {
    const cs = parsed.checkpoints.map((c) => c.c).sort((a, b) => a - b);
    expect(cs).toHaveLength(4);
    for (let i = 1; i < cs.length; i++) expect(cs[i] - cs[i - 1]).toBeGreaterThanOrEqual(30);
    expect(cs[3]).toBeLessThan(parsed.flag.c);
  });

  it('has two bottomless gaps to jump, none wider than a running jump', () => {
    const gaps = Array.from({ length: level.cols }, (_, c) => c).filter((c) => !parsed.map.isSolid(c, 0));
    const runs: number[][] = [];
    for (const c of gaps) {
      if (runs.length > 0 && runs.at(-1)!.at(-1) === c - 1) runs.at(-1)!.push(c);
      else runs.push([c]);
    }
    expect(runs).toHaveLength(2);
    for (const r of runs) expect(r.length).toBeLessThanOrEqual(4);
  });

  it('every scout can run to a mook door further on, over flat open ground', () => {
    for (const s of parsed.enemies.filter((e) => e.kind === 'mook_scout')) {
      const door = parsed.doors.find((d) => d.r === s.r && d.c > s.c);
      expect(door).toBeDefined();
      for (let c = s.c; c <= door!.c; c++) expect(parsed.map.isSolid(c, s.r - 1) && !parsed.map.isSolid(c, s.r)).toBe(true);
    }
  });

  it('every enemy and prisoner stands on solid ground, in open air', () => {
    for (const e of [...parsed.enemies, ...parsed.cages]) {
      expect(parsed.map.isSolid(e.c, e.r - 1), `${e.c},${e.r}`).toBe(true);
      expect(parsed.map.isSolid(e.c, e.r), `${e.c},${e.r}`).toBe(false);
    }
  });

  it('spreads the burning jungle and its huts behind the level', () => {
    const doodads = burningJungle();
    expect(level.parallax).toEqual(doodads);
    expect(Math.max(...doodads.map((d) => d.x))).toBeGreaterThan(level.cols * 16);
    expect(new Set(doodads.filter((d) => d.layer === 'near').map((d) => d.variant)).size).toBe(6);
  });
});
