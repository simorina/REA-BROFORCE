import { describe, expect, it } from 'vitest';
import { parallaxCentre, placeBackground } from './parallax';
import { TEST_BACKGROUND } from './testFx';

describe('background (ThemeHolder Desert, ParallaxFollow)', () => {
  it('puts the sky first, then 5 rows of BlueSky clouds, then the hills back to front', () => {
    const placed = placeBackground(TEST_BACKGROUND, [
      { layer: 'near', variant: 0, x: 100, y: 30 },
      { layer: 'distant', variant: 1, x: 300, y: 60 },
      { layer: 'mid', variant: 2, x: 200, y: 40 },
    ], () => 0.5);
    expect(placed[0].sprite.name).toBe('Desert Sky');
    expect(placed.filter((b) => b.sprite.name.startsWith('ParaCloud'))).toHaveLength(5 * 3);
    expect(placed.slice(-3).map((b) => b.sprite.name)).toEqual(['Parallax Distant 2', 'Parallax Mid 3', 'Parallax Near 1']);
    const zs = placed.map((b) => b.sprite.offset[2]);
    expect([...zs].sort((a, b) => b - a)).toEqual(zs);
  });

  it('places BlueSky clouds by Map.SetupLevel: row n at 230 + 20n² + 60n plus up to 34 + 100n', () => {
    const placed = placeBackground(TEST_BACKGROUND, [], () => 0);
    const cloud3 = placed.filter((b) => b.sprite.name === 'ParaCloud3');
    expect(cloud3.map((b) => [b.x, b.y])).toEqual([[-1024, 310], [0, 310], [1024, 310], [2048, 310], [3072, 310]]);
  });

  it('the sky follows the camera and a hill drifts by 1 - parallaxXM of the camera motion', () => {
    const [sky] = placeBackground(TEST_BACKGROUND, []);
    expect(parallaxCentre(sky, { x: 500, y: 120 })).toEqual({ x: 500, y: 120 });
    const near = placeBackground(TEST_BACKGROUND, [{ layer: 'near', variant: 0, x: 400, y: 50 }]).at(-1)!;
    expect(parallaxCentre(near, { x: 400, y: 50 })).toEqual({ x: 400, y: 50 });
    const moved = parallaxCentre(near, { x: 500, y: 50 });
    expect(moved.x - 500).toBeCloseTo(-(1 - 0.3) * 100); // on screen it slides back 70 of the camera's 100
  });
});
