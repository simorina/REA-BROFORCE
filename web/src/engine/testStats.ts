import type { GameStats } from './types';

/** values.json as extracted from the real install (Task 3). */
export const RAW_VALUES: Record<string, Record<string, unknown>> = {
  bro_base: { speed: 110, _jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: 1, canDash: 1, originalSpecialAmmo: 4 },
  mook: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  mook_suicide: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  mook_bazooka: { speed: 70, _jumpForce: 200, health: 4, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3 },
  bullet: { damage: 1, life: 0.45 },
  rocket_mook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  suicide_blast: { range: 40, blastForce: 20 },
  block_dirt: { health: 5 },
  block_brick: { health: 5 },
  block_steel: { health: 500000 },
  block_barrel: { health: 1, range: 50 },
};

export const TEST_STATS: GameStats = {
  units: {
    bro: { speed: 110, jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: true, canDash: true, specialAmmo: 4 },
    mook: { speed: 70, jumpForce: 200, health: 3, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
    mook_suicide: { speed: 70, jumpForce: 200, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
    mook_bazooka: { speed: 70, jumpForce: 200, health: 4, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3 },
  },
  bullet: { damage: 1, life: 0.45 },
  rocketMook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  blocks: { dirt: { health: 5 }, brick: { health: 5 }, steel: { health: 500000 }, barrel: { health: 1 } },
  barrelRange: 50,
  suicide: { range: 40, blastForce: 20 },
};
