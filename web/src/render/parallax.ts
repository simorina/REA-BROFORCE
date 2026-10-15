import type { ParallaxDoodad } from '../engine/level';
import type { BackgroundData, BgSprite } from './fxdata';

export interface BgInstance {
  sprite: BgSprite;
  x: number; // the transform's world position
  y: number;
}

/**
 * Map.SetupLevel's sky (at 0, 600) and cloud scatter, plus the level's parallax doodads, ordered back to
 * front by the sprites' z offset.
 */
export function placeBackground(bg: BackgroundData, doodads: readonly ParallaxDoodad[], rng: () => number = Math.random): BgInstance[] {
  const out: BgInstance[] = [{ sprite: bg.sky, x: 0, y: 600 }];
  if (bg.cloudScatter === 'BlueSky') {
    for (let i = 0; i < 5; i++) {
      bg.clouds.forEach((sprite, j) => {
        const n = j + 1;
        out.push({ sprite, x: -1024 + i * 1024 + rng() * 768, y: 230 + n * n * 20 + n * 60 + rng() * (34 + n * 100) });
      });
    }
  } else if (bg.clouds.length > 0) {
    for (let k = 0; k < 32; k++) {
      const v = rng();
      const sprite = bg.clouds[Math.min(bg.clouds.length - 1, Math.floor(v * bg.clouds.length))];
      out.push({ sprite, x: -1024 + k * 256 + rng() * 256, y: -32 + (v * 2 + rng()) * 768 * 0.5 });
    }
  }
  for (const d of doodads) {
    const list = bg[d.layer];
    if (list.length > 0) out.push({ sprite: list[d.variant % list.length], x: d.x, y: d.y });
  }
  return out.map((b, i) => ({ b, i })).sort((p, q) => q.b.sprite.offset[2] - p.b.sprite.offset[2] || p.i - q.i).map((p) => p.b);
}

/** ParallaxFollow.LateUpdate: the layer moves by parallaxXM/YM of the camera's motion, so it shows its own
 * position when the camera is on it. Returns the sprite's centre (the transform plus the SpriteSM offset). */
export function parallaxCentre(b: BgInstance, cam: { x: number; y: number }): { x: number; y: number } {
  const [kx, ky] = b.sprite.parallax;
  return {
    x: b.x + (cam.x - b.x) * kx + b.sprite.offset[0],
    y: b.y + (cam.y - b.y) * ky + b.sprite.offset[1],
  };
}
