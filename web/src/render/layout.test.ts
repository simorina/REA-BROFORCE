import { describe, expect, it } from 'vitest';
import { clampBubbleLeft, fitCanvas } from './layout';

describe('clampBubbleLeft', () => {
  it('centres the bubble on the bro when there is room', () => {
    expect(clampBubbleLeft(600, 300, 1200)).toBe(450);
  });

  it('keeps the bubble inside the canvas at the left and right edges', () => {
    expect(clampBubbleLeft(40, 300, 1200)).toBe(0);
    expect(clampBubbleLeft(1190, 300, 1200)).toBe(900);
  });
});

describe('fitCanvas', () => {
  it('uses 1200 x 675 when the window is large enough', () => {
    expect(fitCanvas(1920, 1000)).toEqual({ width: 1200, height: 675 });
  });

  it('fits a short window by height, keeping 16:9', () => {
    const size = fitCanvas(1366, 650); // a 1366x768 laptop minus the browser's toolbars
    expect(size.height).toBeLessThanOrEqual(650);
    expect(size.width / size.height).toBeCloseTo(16 / 9, 2);
  });

  it('fits a narrow window by width', () => {
    const size = fitCanvas(800, 900);
    expect(size.width).toBe(800);
    expect(size.height).toBe(450);
  });
});
