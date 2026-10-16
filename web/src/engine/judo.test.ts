import { describe, expect, it } from 'vitest';
import { judoTarget } from './judo';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';

const putin = (x = 100) => makeUnit(1, 'bro', 'player', x, 8, TEST_STATS.bros.bro_lee);
const mookAt = (x: number) => makeUnit(2, 'mook', 'enemy', x, 8, TEST_STATS.units.mook);

describe('judoTarget (BroLee.RunFiring: Map.HitUnits, range 13 at X + dir * 7, Y + 7)', () => {
  it('reaches up to 28 px ahead and a little behind', () => {
    expect(judoTarget([mookAt(127)], putin())).not.toBeNull(); // |127 - 107| - 13 = 7 < width 8
    expect(judoTarget([mookAt(128)], putin())).toBeNull();
    expect(judoTarget([mookAt(87)], putin())).not.toBeNull();
    const p = putin();
    p.facing = -1;
    expect(judoTarget([mookAt(73)], p)).not.toBeNull();
    expect(judoTarget([mookAt(127)], p)).toBeNull();
  });

  it('skips corpses and invulnerable mooks, and takes the first live one', () => {
    const dead = Object.assign(mookAt(110), { dead: true });
    const shielded = Object.assign(mookAt(112), { invulnerable: 0.3 });
    const live = mookAt(114);
    expect(judoTarget([dead, shielded, live], putin())).toBe(live);
  });
});
