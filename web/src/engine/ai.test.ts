import { describe, expect, it } from 'vitest';
import { canSee, thinkMook } from './ai';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { stepUnit } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { UnitKind } from './types';

function scene(kind: UnitKind = 'mook') {
  const map = new TileMap(40, 10);
  for (let c = 0; c < 40; c++) map.set(c, 0, makeBlock('dirt', TEST_STATS));
  const mook = makeUnit(2, kind, 'enemy', 200, 8, TEST_STATS.units[kind]); // faces left (-1)
  const bro = makeUnit(1, 'bro', 'player', 120, 8, TEST_STATS.units.bro);
  return { map, mook, bro };
}
function shotTimes(kind: UnitKind, seconds: number): number[] {
  const { map, mook, bro } = scene(kind);
  const shots: number[] = [];
  let time = 0;
  for (let i = 0; i < seconds * 60; i++) {
    time += FIXED_DT;
    if (thinkMook(mook, { map, player: bro, rng: () => 0.5 }, FIXED_DT).fire) shots.push(time);
  }
  return shots;
}

describe('canSee (EnemyAI.sightRangeX/Y)', () => {
  it('sees a player in range, in front, with a clear line', () => {
    const { map, mook, bro } = scene();
    expect(canSee(mook, bro, map)).toBe(true);
  });

  it('is blocked by a wall', () => {
    const { map, mook, bro } = scene();
    map.set(10, 1, makeBlock('dirt', TEST_STATS));
    expect(canSee(mook, bro, map)).toBe(false);
  });

  it('ignores players beyond 300 across or 20 up', () => {
    const { map, mook, bro } = scene();
    bro.x = 200 - 301;
    expect(canSee(mook, bro, map)).toBe(false);
    bro.x = 120;
    bro.y = 8 + 21;
    expect(canSee(mook, bro, map)).toBe(false);
  });

  it("doesn't see behind its back", () => {
    const { map, mook, bro } = scene();
    mook.facing = 1;
    expect(canSee(mook, bro, map)).toBe(false);
  });
});

describe('thinkMook', () => {
  it('a trooper reacts, then fires bursts of 3 at its fireRate, then pauses', () => {
    const shots = shotTimes('mook', 3);
    expect(shots[0]).toBeGreaterThanOrEqual(0.4);
    expect(shots[1] - shots[0]).toBeCloseTo(0.17, 1);
    expect(shots[2] - shots[1]).toBeCloseTo(0.17, 1);
    expect(shots[3] - shots[2]).toBeGreaterThan(0.99);
  });

  it('a bazooka mook fires once every 1.4 s', () => {
    const shots = shotTimes('mook_bazooka', 3);
    expect(shots[1] - shots[0]).toBeCloseTo(1.4, 1);
  });

  it('idle mooks turn around every few seconds', () => {
    const { map, mook } = scene();
    for (let i = 0; i < 126; i++) thinkMook(mook, { map, player: null, rng: () => 0.5 }, FIXED_DT);
    expect(mook.facing).toBe(1);
  });

  it('a suicide mook charges and explodes after its fuse once next to the player', () => {
    const { map, mook, bro } = scene('mook_suicide');
    let now = 0;
    let exploded = false;
    for (let i = 0; i < 240 && !exploded; i++) {
      now += FIXED_DT;
      const action = thinkMook(mook, { map, player: bro, rng: () => 0.5 }, FIXED_DT);
      exploded = action.explode;
      stepUnit(mook, action.intent, map, FIXED_DT, now);
    }
    expect(exploded).toBe(true);
    expect(Math.abs(mook.x - bro.x)).toBeLessThan(20);
  });
});
