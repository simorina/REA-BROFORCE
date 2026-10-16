import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import {
  NO_DRIVE, damageTank, makeTank, pressFire, stepCountdown, stepTankBody, stepTurret, switchGun, tankDrop,
} from './tank';
import { TEST_STATS } from './testStats';

/** Floor on row 0 (top at y 8); `heights` raises columns to that many extra blocks. */
function ground(cols = 40, heights: Record<number, number> = {}): TileMap {
  const m = new TileMap(cols, 20);
  for (let c = 0; c < cols; c++) for (let r = 0; r <= (heights[c] ?? 0); r++) m.set(c, r, makeBlock('dirt', TEST_STATS));
  return m;
}

describe('tankDrop (GrenadeAirstrike.SpawnTank)', () => {
  it('over flat ground the last equal pair wins: one and a half columns right of the grenade', () => {
    expect(tankDrop(ground(), 160, 20, 200, 0)).toEqual({ x: 160 + 16 + 8, y: 400, fallback: false });
  });

  it('takes the lowest flat pair', () => {
    // columns 8,9 low (top 8); 10 at 24; 11 at 40; 12 at 56: the grenade at column 10
    const map = ground(40, { 10: 1, 11: 2, 12: 3 });
    expect(tankDrop(map, 160, 30, 200, 0).x).toBe(128 + 8);
  });

  it('rolls in from the left edge when the ground is near the top of the screen', () => {
    expect(tankDrop(ground(), 160, 20, 20, -40)).toEqual({ x: -40, y: 68, fallback: true });
  });
});

describe('the tank body', () => {
  it('falls in and lands on the ground, no faster than maxFallSpeed', () => {
    const k = makeTank(1, 160, 200, 1);
    let minYI = 0;
    for (let i = 0; i < 120; i++) {
      stepTankBody(k, NO_DRIVE, ground(), TEST_STATS.tank, FIXED_DT);
      minYI = Math.min(minYI, k.yI);
    }
    expect(k.onGround).toBe(true);
    expect(k.y).toBeCloseTo(8, 3);
    expect(minYI).toBeGreaterThanOrEqual(-600);
  });

  it('drives at up to its speed of 60, faces the way it drives, and jumps at 290', () => {
    const k = makeTank(1, 160, 8, 1);
    let maxSpeed = 0;
    for (let i = 0; i < 60; i++) {
      stepTankBody(k, { dir: -1, jump: false }, ground(), TEST_STATS.tank, FIXED_DT);
      maxSpeed = Math.max(maxSpeed, Math.abs(k.xI));
    }
    expect(k.facing).toBe(-1);
    expect(maxSpeed).toBeCloseTo(60, 5);
    expect(k.x).toBeLessThan(130);
    stepTankBody(k, { dir: 0, jump: true }, ground(), TEST_STATS.tank, FIXED_DT);
    expect(k.yI).toBeGreaterThan(270); // 290 less one step of gravity
  });

  it('crushes on every other pair of running frames while driving on the ground', () => {
    const k = makeTank(1, 160, 8, 1);
    let crushes = 0;
    for (let i = 0; i < 60; i++) crushes += stepTankBody(k, { dir: 1, jump: false }, ground(), TEST_STATS.tank, FIXED_DT);
    expect(crushes).toBeGreaterThanOrEqual(14); // 1 s = 29.9 running frames, half of them crush
    expect(crushes).toBeLessThanOrEqual(16);
  });
});

/** Steps the turret until it fires (at most `max` steps); returns [the step it fired on, the shot]. */
function fireAfterPress(gun: 0 | 1, max = 80): [number, string | null] {
  const k = makeTank(1, 0, 0, 1);
  k.turret.gun = gun;
  pressFire(k.turret);
  for (let i = 1; i <= max; i++) {
    const shot = stepTurret(k.turret, FIXED_DT);
    if (shot) return [i, shot];
  }
  return [-1, null];
}

describe('the turret (TankBroTankTurret.FireWeapon / Update)', () => {
  it('the mortar fires on frame 6: 9 turret frames of 0.0334 s after the press', () => {
    const [step, shot] = fireAfterPress(0);
    expect(shot).toBe('shell');
    expect(step).toBeGreaterThanOrEqual(18);
    expect(step).toBeLessThanOrEqual(20);
  });

  it('the cannon winds up longer and fires on frame 7: 21 turret frames', () => {
    const [step, shot] = fireAfterPress(1);
    expect(shot).toBe('cannon');
    expect(step).toBeGreaterThanOrEqual(41);
    expect(step).toBeLessThanOrEqual(44);
  });

  it('a press from frame 6 on queues the next shot', () => {
    const k = makeTank(1, 0, 0, 1);
    pressFire(k.turret);
    let shots = 0;
    for (let i = 0; i < 70; i++) {
      if (k.turret.frame === 7 && shots === 1 && !k.turret.queued) pressFire(k.turret);
      if (stepTurret(k.turret, FIXED_DT)) shots++;
    }
    expect(shots).toBe(2);
  });

  it('switching gun plays the 20-frame transform and fires nothing meanwhile', () => {
    const k = makeTank(1, 0, 0, 1);
    switchGun(k.turret);
    expect(k.turret.gun).toBe(1);
    let shots = 0;
    for (let i = 0; i < 30; i++) if (stepTurret(k.turret, FIXED_DT)) shots++;
    expect(k.turret.switching).toBe(true);
    for (let i = 0; i < 20; i++) stepTurret(k.turret, FIXED_DT);
    expect(k.turret.switching).toBe(false);
    expect(k.turret.switchFrame).toBe(20);
    expect(shots).toBe(0);
  });
});

describe('tank damage (MookArmouredGuy.Damage / Update / TankBroTank.Damage)', () => {
  it('a driven tank past 25 starts its death countdown; an empty one gibs past 60', () => {
    const k = makeTank(1, 0, 0, 1);
    k.driven = true;
    expect(damageTank(k, 25, TEST_STATS.tank)).toBe(false);
    expect(k.countdown).toBe(-1);
    expect(damageTank(k, 1, TEST_STATS.tank)).toBe(false);
    expect(k.countdown).toBe(0);
    const empty = makeTank(2, 0, 0, 1);
    expect(damageTank(empty, 60, TEST_STATS.tank)).toBe(false);
    expect(damageTank(empty, 1, TEST_STATS.tank)).toBe(true);
  });

  it('the countdown ticks faster as it goes and ends at 45 ticks, about 5 s in', () => {
    const k = makeTank(1, 0, 0, 1);
    k.countdown = 0;
    let time = 0;
    while (!stepCountdown(k, TEST_STATS.tank, FIXED_DT) && time < 20) time += FIXED_DT;
    expect(k.countdown).toBe(45);
    expect(time).toBeGreaterThan(4);
    expect(time).toBeLessThan(7);
  });
});
