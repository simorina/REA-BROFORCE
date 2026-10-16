import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import { NO_DRIVE, makeTank, stepTankBody, tankDrop } from './tank';
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
});
