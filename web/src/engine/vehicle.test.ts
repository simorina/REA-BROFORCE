import { describe, expect, it } from 'vitest';
import { makeTank } from './tank';
import { vehicleAt, type Vehicle } from './vehicle';

describe('vehicles share hits, with a box per kind', () => {
  it('a jet is hit within its own wider, taller box: its landing gear and fuselage', () => {
    const jet: Vehicle = { ...makeTank(1, 100, 50, 1), kind: 'jet' };
    expect(vehicleAt([jet], 122, 60)).toBe(jet); // the jet's half-width is 24 (the tank's 15)
    expect(vehicleAt([jet], 100, 84)).toBe(jet); // and its height 34, up to its fuselage's top (the tank's 28)
    expect(vehicleAt([jet], 100, 90)).toBeNull();
    const tank = makeTank(2, 100, 50, 1);
    expect(vehicleAt([tank], 122, 60)).toBeNull();
    expect(vehicleAt([tank], 100, 84)).toBeNull();
  });
});
