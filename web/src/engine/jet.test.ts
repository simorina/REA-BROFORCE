import { describe, expect, it } from 'vitest';
import { FIXED_DT, JET_BOX } from './constants';
import { NO_FLY, jetDrop, makeJet, stepJetBody } from './jet';
import { TileMap, makeBlock } from './map';
import { TEST_STATS } from './testStats';

function ground(cols = 40, rows = 20): TileMap {
  const m = new TileMap(cols, rows);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('dirt', TEST_STATS)); // floor top at y 8
  return m;
}

describe('the jet', () => {
  it('drops in above the screen over the grenade, inside the map', () => {
    expect(jetDrop(ground(), 160, 200)).toEqual({ x: 160, y: 232 });
    expect(jetDrop(ground(), -50, 200).x).toBe(-8 + 24);
    expect(jetDrop(ground(), 9999, 200).x).toBe(40 * 16 - 8 - 24);
  });

  it('comes down fast, then the last 48 px at 40 u/s, and lands (HarrierJet.Start / Update)', () => {
    const j = makeJet(1, 160, 200, 1);
    stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    expect(j.yI).toBe(-160);
    while (j.y > 8 + 48) stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    expect(j.yI).toBe(-40);
    for (let i = 0; i < 120; i++) stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    expect(j.state).toBe('landed');
    expect(j.y).toBe(8);
  });

  it('flies at up to 110 across and 80 up, with no gravity, spending fuel only in the air', () => {
    const j = Object.assign(makeJet(1, 160, 8, 1), { state: 'flying' as const, driven: true, onGround: true });
    const fuel = j.fuel;
    stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    expect(j.fuel).toBe(fuel); // on the ground
    for (let i = 0; i < 60; i++) stepJetBody(j, { dx: 1, dy: 1 }, ground(), FIXED_DT, 300);
    expect(j.xI).toBeCloseTo(110, 5);
    expect(j.yI).toBeCloseTo(80, 5);
    expect(j.fuel).toBeLessThan(fuel);
    const y = j.y;
    stepJetBody(j, NO_FLY, ground(), FIXED_DT, 300);
    expect(j.y).toBeGreaterThan(y); // still coasting up, no gravity pulling it down
  });

  it("it can't fly above the map's top row or out of its sides", () => {
    const j = Object.assign(makeJet(1, 160, 250, 1), { state: 'flying' as const, driven: true });
    for (let i = 0; i < 300; i++) stepJetBody(j, { dx: -1, dy: 1 }, ground(40, 20), FIXED_DT, 300);
    expect(j.y + JET_BOX.height).toBeLessThanOrEqual(20 * 16 - 8);
    expect(j.x - 24).toBeGreaterThanOrEqual(-8);
  });

  it('a landed jet whose ground is blown away comes down again', () => {
    const map = ground();
    const j = Object.assign(makeJet(1, 160, 8, 1), { state: 'landed' as const, onGround: true });
    for (let c = 8; c <= 12; c++) map.set(c, 0, null); // the blocks under its box
    stepJetBody(j, NO_FLY, map, FIXED_DT, 300);
    stepJetBody(j, NO_FLY, map, FIXED_DT, 300);
    expect(j.state).toBe('descending');
    expect(j.y).toBeLessThan(8);
  });

  it('leaving, it rises off the top of the screen and is gone', () => {
    const j = Object.assign(makeJet(1, 160, 8, 1), { state: 'leaving' as const });
    for (let i = 0; i < 400 && !j.exploded; i++) stepJetBody(j, NO_FLY, ground(), FIXED_DT, 200);
    expect(j.exploded).toBe(true);
  });
});
