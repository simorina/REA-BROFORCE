import { describe, expect, it } from 'vitest';
import { makeTank } from './tank';
import { vehicleAt, type Vehicle } from './vehicle';

describe('vehicles share hits, with a box per kind', () => {
  it('a jet is hit within its own wider, lower box', () => {
    const jet: Vehicle = { ...makeTank(1, 100, 50, 1), kind: 'jet' };
    expect(vehicleAt([jet], 122, 60)).toBe(jet); // the jet's half-width is 24 (the tank's 15)
    expect(vehicleAt([jet], 100, 75)).toBeNull(); // and its height 20 (the tank's 28)
    const tank = makeTank(2, 100, 50, 1);
    expect(vehicleAt([tank], 122, 60)).toBeNull();
    expect(vehicleAt([tank], 100, 75)).toBe(tank);
  });
});
