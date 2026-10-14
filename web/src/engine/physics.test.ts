import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { Unit } from './types';

function floorMap(cols = 30, rows = 12): TileMap {
  const m = new TileMap(cols, rows);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('dirt', TEST_STATS)); // floor top at y = 8
  return m;
}
const bro = (x = 80, y = 8): Unit => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.units.bro);
function run(u: Unit, map: TileMap, intent: MoveIntent, frames: number, start = 0): number {
  let now = start;
  for (let i = 0; i < frames; i++) {
    now += FIXED_DT;
    stepUnit(u, intent, map, FIXED_DT, now);
  }
  return now;
}

describe('stepUnit (TestVanDammeAnim movement)', () => {
  it('stands still on the floor', () => {
    const u = bro();
    run(u, floorMap(), NO_INTENT, 60);
    expect(u.y).toBe(8);
    expect(u.onGround).toBe(true);
  });

  it('lands with its feet on top of the block below', () => {
    const u = bro(80, 40);
    run(u, floorMap(), NO_INTENT, 60);
    expect(u.y).toBeCloseTo(8, 6);
    expect(u.onGround).toBe(true);
  });

  it('jumps about jumpForce² / (2·gravity) high', () => {
    const u = bro();
    const map = floorMap();
    let now = run(u, map, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, 1);
    let apex = u.y;
    for (let i = 0; i < 60; i++) {
      now = run(u, map, NO_INTENT, 1, now);
      apex = Math.max(apex, u.y);
    }
    // analytic 260² / 2200 = 30.7; explicit Euler at 60 Hz peaks a little lower
    expect(apex - 8).toBeGreaterThan(27);
    expect(apex - 8).toBeLessThan(31.5);
  });

  it('caps the fall speed at maxFallSpeed', () => {
    const u = bro(80, 150);
    run(u, new TileMap(30, 12), NO_INTENT, 120);
    expect(u.yI).toBe(-400);
  });

  it('accelerates to its run speed and no further', () => {
    const u = bro();
    run(u, floorMap(60), { ...NO_INTENT, dir: 1 }, 60);
    expect(u.xI).toBe(110);
  });

  it('runs 1.33x faster while dashing', () => {
    const u = bro();
    run(u, floorMap(60), { ...NO_INTENT, dir: 1, dash: true }, 60);
    expect(u.xI).toBeCloseTo(146.3, 5);
  });

  it('ground friction stops it within half a second', () => {
    const u = bro();
    u.xI = 110;
    run(u, floorMap(60), NO_INTENT, 30);
    expect(Math.abs(u.xI)).toBeLessThan(1);
  });

  it('stops at a wall', () => {
    const map = floorMap();
    for (let r = 1; r <= 5; r++) map.set(8, r, makeBlock('dirt', TEST_STATS)); // wall face at x = 120
    const u = bro();
    run(u, map, { ...NO_INTENT, dir: 1 }, 60);
    expect(u.x).toBeCloseTo(114, 2);
    expect(u.xI).toBe(0);
  });

  it('cannot leave the map through its side edges', () => {
    const u = bro(10);
    run(u, floorMap(), { ...NO_INTENT, dir: -1 }, 60);
    expect(u.x).toBeGreaterThanOrEqual(-2.01); // left edge of column 0 is x = -8; half width 6
  });

  it('allows a jump within 0.1 s of leaving the ground', () => {
    const u = bro(80, 30);
    u.lastGroundedTime = 0.95;
    stepUnit(u, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, new TileMap(30, 12), FIXED_DT, 1.0);
    expect(u.yI).toBeGreaterThan(200);
  });

  it('refuses a late jump', () => {
    const u = bro(80, 30);
    u.lastGroundedTime = 0.8;
    stepUnit(u, { ...NO_INTENT, jumpPressed: true, jumpHeld: true }, new TileMap(30, 12), FIXED_DT, 1.0);
    expect(u.yI).toBeLessThan(0);
  });

  it('climbs a wall while holding jump against it', () => {
    const map = floorMap();
    for (let r = 1; r <= 11; r++) map.set(8, r, makeBlock('dirt', TEST_STATS));
    const u = bro(113.9, 40);
    run(u, map, { dir: 1, jumpPressed: false, jumpHeld: true, dash: false }, 60);
    expect(u.y).toBeGreaterThan(40 + 32); // ~4 boosts of 190 in 1 s climb about 90 units
  });

  it('mooks cannot wall-climb', () => {
    const map = floorMap();
    for (let r = 1; r <= 11; r++) map.set(8, r, makeBlock('dirt', TEST_STATS));
    const m = makeUnit(2, 'mook', 'enemy', 113.9, 40, TEST_STATS.units.mook);
    run(m, map, { dir: 1, jumpPressed: false, jumpHeld: true, dash: false }, 60);
    expect(m.y).toBeCloseTo(8, 6);
  });
});
