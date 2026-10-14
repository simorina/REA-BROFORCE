import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W, followCamera } from './camera';

const map = { cols: 120, rows: 18 };

describe('followCamera (SortOfFollow)', () => {
  it('snaps to the target with a large dt and keeps the view inside the map', () => {
    const cam = { x: 0, y: 0 };
    followCamera(cam, { x: 0, y: 0 }, map, 1);
    expect(cam.x).toBe(-8 + VIEW_W / 2);
    expect(cam.y).toBe(-8 + VIEW_H / 2);
  });

  it('eases towards the target', () => {
    const cam = { x: 500, y: 150 };
    followCamera(cam, { x: 600, y: 110 }, map, 1 / 60);
    expect(cam.x).toBeGreaterThan(500);
    expect(cam.x).toBeLessThan(600);
  });

  it('stops at the right edge', () => {
    const cam = { x: 0, y: 0 };
    followCamera(cam, { x: 5000, y: 100 }, map, 1);
    expect(cam.x).toBe(120 * 16 - 8 - VIEW_W / 2);
  });
});
