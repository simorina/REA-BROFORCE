import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../engine/constants';
import { advance } from './loop';

function count(frameTime: number, acc = 0) {
  let steps = 0;
  const left = advance(acc, frameTime, () => steps++);
  return { steps, left };
}

describe('advance (fixed timestep)', () => {
  it('runs one step per 1/60 s and keeps the remainder', () => {
    expect(count(1 / 30).steps).toBe(2);
    const r = count(FIXED_DT * 1.5);
    expect(r.steps).toBe(1);
    expect(r.left).toBeCloseTo(FIXED_DT * 0.5, 9);
  });

  it('advance clamps long frames (a backgrounded tab) to 0.25 s', () => {
    const { steps } = count(5);
    expect(steps).toBeGreaterThanOrEqual(14);
    expect(steps).toBeLessThanOrEqual(15);
  });

  it('ignores negative frame times', () => {
    expect(count(-1).steps).toBe(0);
  });
});
