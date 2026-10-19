import { describe, expect, it } from 'vitest';
import { restingAttitude, stepAttitude, type Attitude } from './attitude';
import { dot, type Vec3 } from './orbit';

const UP: Vec3 = [0, 1, 0];
const NORTH: Vec3 = [0, 0, -1];
const EAST: Vec3 = [1, 0, 0]; // to the right of a helicopter facing north, seen from above
const SIDE_SPEED = 5; // Helicopter3D.bankingSideSpeed in the scene

function run(a: Attitude, move: Vec3 | null, seconds: number, up: Vec3 = UP): Attitude {
  let s = a;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepAttitude(s, up, move, 1 / 60, SIDE_SPEED);
  return s;
}

describe("the world map helicopter's attitude (Helicopter3D.RunInput, DoBanking)", () => {
  it('turns toward where it flies, a little at a time, banking into the turn', () => {
    const a = stepAttitude(restingAttitude(NORTH), UP, EAST, 1 / 60, SIDE_SPEED);
    expect(dot(a.facing, NORTH)).toBeGreaterThan(0.99); // RotateTowards: at most dt × (2 + ...) radians a frame
    expect(dot(a.facing, EAST)).toBeGreaterThan(0);
    expect(a.bank).toBeGreaterThan(0); // positive: the right side dips
    const left = stepAttitude(restingAttitude(NORTH), UP, [-1, 0, 0], 1 / 60, SIDE_SPEED);
    expect(left.bank).toBeLessThan(0);
  });

  it('levels out once it faces its way, nose down while it keeps flying', () => {
    const a = run(restingAttitude(NORTH), EAST, 4);
    expect(dot(a.facing, EAST)).toBeGreaterThan(0.999);
    expect(Math.abs(a.bank)).toBeLessThan(0.01);
    expect(a.forward).toBeGreaterThan(0.99);
  });

  it('turns all the way round when sent back the way it came', () => {
    const a = run(restingAttitude(NORTH), [0, 0, 1], 4);
    expect(dot(a.facing, [0, 0, 1])).toBeGreaterThan(0.999);
  });

  it('settles level and nose up when it stops', () => {
    const a = run(run(restingAttitude(NORTH), EAST, 1), null, 3);
    expect(Math.abs(a.bank)).toBeLessThan(0.01);
    expect(a.forward).toBeLessThan(0.01);
  });

  it('keeps facing along the globe as it moves round it', () => {
    const up: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2];
    const a = stepAttitude(restingAttitude(NORTH), up, null, 1 / 60, SIDE_SPEED);
    expect(Math.abs(dot(a.facing, up))).toBeLessThan(1e-9);
    expect(Math.hypot(...a.facing)).toBeCloseTo(1);
  });
});
