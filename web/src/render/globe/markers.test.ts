import { describe, expect, it } from 'vitest';
import { ARROW_BORDER, UI_HALF_HEIGHT, bounceIcon, placeIcon, popIcon, stepIcon } from './markers';

const ASPECT = 16 / 9;
const RIGHT_EDGE = UI_HALF_HEIGHT * ASPECT - ARROW_BORDER;
const TOP_EDGE = UI_HALF_HEIGHT - ARROW_BORDER;

describe("a territory's icon on the world map (WMIcon)", () => {
  it('hangs over the territory, in the UI camera\'s units (96 to the screen\'s height)', () => {
    expect(placeIcon({ x: 0, y: 0 }, true, ASPECT, 30)).toMatchObject({ x: 0, y: 0, front: true });
    const p = placeIcon({ x: 0.5, y: -0.5 }, true, ASPECT, 30);
    expect(p.x).toBeCloseTo(0.5 * UI_HALF_HEIGHT * ASPECT);
    expect(p.y).toBeCloseTo(-24);
  });

  it('stays on screen, a border in from the edges', () => {
    expect(placeIcon({ x: 1.2, y: -3 }, true, ASPECT, 30)).toMatchObject({ x: RIGHT_EDGE, y: -TOP_EDGE });
  });

  it('turns into an arrow round the globe when the territory is on the far side, pointing back at it', () => {
    const p = placeIcon({ x: 0.2, y: 0 }, false, ASPECT, 30);
    expect(p.front).toBe(false);
    expect(p.x).toBeCloseTo(UI_HALF_HEIGHT * 1.3); // ArrowDistanceFactor 1.3 at ZoomOut
    expect(p.y).toBeCloseTo(0);
    expect(p.angle).toBeCloseTo(90); // Unity's z: the arrow's tip turned a quarter anticlockwise, toward the globe
    const up = placeIcon({ x: 0, y: 0.1 }, false, ASPECT, 30);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(TOP_EDGE);
    expect(up.angle).toBeCloseTo(180);
  });

  it('pushes the arrows out to the edges as the view zooms in, and as it widens past ZoomOut', () => {
    expect(placeIcon({ x: 0.2, y: 0 }, false, ASPECT, 18).x).toBeCloseTo(RIGHT_EDGE); // 3.2 units of 48 would leave the screen
    expect(placeIcon({ x: 0.2, y: 0 }, false, ASPECT, 42).x).toBeCloseTo(RIGHT_EDGE); // (fov / -12 + 2.5)² climbs back to 1
    expect(placeIcon({ x: -0.2, y: 0 }, false, ASPECT, 27).x).toBeCloseTo(-UI_HALF_HEIGHT * (1.3 + (3.2 - 1.3) * 0.0625));
  });

  it('pops up from a tenth of its size with a springy overshoot, then settles', () => {
    let s = popIcon();
    expect(s.scale).toBeCloseTo(0.1);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      s = stepIcon(s, 1 / 60);
      peak = Math.max(peak, s.scale);
    }
    expect(peak).toBeGreaterThan(1.05);
    expect(s.scale).toBeCloseTo(1, 2);
  });

  it('bounces when its territory is selected', () => {
    let s = { scale: 1, vel: 0 };
    s = bounceIcon(s);
    expect(s.scale).toBeCloseTo(0.8);
    s = stepIcon(s, 1 / 60);
    expect(s.scale).toBeGreaterThan(0.8);
  });

  it('steps no further than a thirtieth of a second at a time', () => {
    expect(stepIcon(popIcon(), 1)).toEqual(stepIcon(popIcon(), 0.0334));
  });
});
