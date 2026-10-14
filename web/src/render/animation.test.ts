import { describe, expect, it } from 'vitest';
import { TEST_STATS } from '../engine/testStats';
import { makeUnit } from '../engine/units';
import { loopFrame, stripFrame, unitFrame } from './animation';

const bro = (patch: Partial<ReturnType<typeof makeUnit>>) =>
  Object.assign(makeUnit(1, 'bro', 'player', 0, 8, TEST_STATS.units.bro), { onGround: true }, patch);

describe('unitFrame (TestVanDammeAnim.Animate*)', () => {
  it('idles on row 0, column 0', () => {
    expect(unitFrame(bro({}))).toEqual({ col: 0, row: 0 });
  });

  it('runs on row 1 at runningFrameRate 0.025, and dashes on row 3', () => {
    expect(unitFrame(bro({ xI: 110, animTime: 0.06 }))).toEqual({ col: 2, row: 1 });
    expect(unitFrame(bro({ xI: 110, animTime: 0.06, dashing: true }))).toEqual({ col: 2, row: 3 });
  });

  it('uses the new jumping frames on row 2', () => {
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 100 }))).toEqual({ col: 0, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 0 }))).toEqual({ col: 6, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 100 }))).toEqual({ col: 3, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 0 }))).toEqual({ col: 9, row: 2 });
  });

  it('climbs on row 2, columns 12-16', () => {
    expect(unitFrame(bro({ onGround: false, wallClimbing: true, animTime: 0.07 }))).toEqual({ col: 14, row: 2 });
  });

  it('lies dead on column 5, or column 4 while falling', () => {
    expect(unitFrame(bro({ dead: true }))).toEqual({ col: 5, row: 0 });
    expect(unitFrame(bro({ dead: true, onGround: false }))).toEqual({ col: 4, row: 0 });
  });
});

describe('frame helpers', () => {
  it('stripFrame walks an effect strip once and stops on the last frame', () => {
    expect(stripFrame(0.25, 0.5, 16)).toBe(8);
    expect(stripFrame(0.6, 0.5, 16)).toBe(15);
  });

  it('loopFrame cycles', () => {
    expect(loopFrame(0.07, 0.03, 21)).toBe(2);
    expect(loopFrame(0.67, 0.03, 21)).toBe(1);
  });
});
