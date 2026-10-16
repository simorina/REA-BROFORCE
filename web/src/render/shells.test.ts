import { describe, expect, it } from 'vitest';
import { SHELL_LIFE, openShells, stepShells } from './shells';

describe('matryoshka shells', () => {
  it('two halves fly apart, fall and fade out', () => {
    let shells = openShells(100, 50);
    expect(shells.map((s) => [s.side, Math.sign(s.xI)])).toEqual([[-1, -1], [1, 1]]);
    shells = stepShells(shells, 0.1);
    expect(shells[0].x).toBeLessThan(100);
    expect(shells[1].x).toBeGreaterThan(100);
    shells = stepShells(shells, SHELL_LIFE);
    expect(shells).toEqual([]);
  });
});
