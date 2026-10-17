import { describe, expect, it } from 'vitest';
import { blobPoints } from './worldmap';

describe('the world map', () => {
  it("draws land as a closed wobbly outline, the same every time, within a quarter of its radii", () => {
    const a = blobPoints(100, 80, 40, 20, 1.7);
    expect(blobPoints(100, 80, 40, 20, 1.7)).toEqual(a);
    expect(a).toHaveLength(48);
    for (const p of a) {
      const r = Math.hypot((p.x - 100) / 40, (p.y - 80) / 20);
      expect(r).toBeGreaterThanOrEqual(0.75);
      expect(r).toBeLessThanOrEqual(1.25);
    }
  });
});
