import type { GameStats } from './types';

/** values.json as extracted from the real install (Task 3). */
export const RAW_VALUES: Record<string, Record<string, unknown>> = {
  bro_base: { speed: 110, _jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: 1, canDash: 1, originalSpecialAmmo: 4, hearingRangeX: 300, hearingRangeY: 200 },
  mook: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3, hearingRangeX: 50, hearingRangeY: 0, canHideInGrass: 1, canBeSetOnFire: 1, willPanicWhenOnFire: 1 },
  mook_suicide: { speed: 70, _jumpForce: 200, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3, hearingRangeX: 100, hearingRangeY: 50, canHideInGrass: 1, canBeSetOnFire: 1, willPanicWhenOnFire: 1 },
  mook_bazooka: { speed: 70, _jumpForce: 200, health: 4, fireRate: 0.17, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3, hearingRangeX: 50, hearingRangeY: 0, canHideInGrass: 1, canBeSetOnFire: 1, willPanicWhenOnFire: 1 },
  mook_scout: { speed: 80, _jumpForce: 160, health: 3, fireRate: 0.1, maxFallSpeed: -400, canWallClimb: 0, canDash: 0, originalSpecialAmmo: 3, hearingRangeX: 350, hearingRangeY: 150, canHideInGrass: 0, canBeSetOnFire: 1, willPanicWhenOnFire: 1, runSpeed: 100 },
  ai_mook: { sightRangeX: 300, sightRangeY: 20, attackTime: 0.06, sightDelay: 1.66, delayBetweenFiring: 1.78, patrolBlocksRadius: 2, minIdleWaitDuration: 0.3, maxIdleWaitDuration: 1, hidingLookXRange: 50 },
  ai_mook_suicide: { sightRangeX: 300, sightRangeY: 20, attackTime: 7, sightDelay: 0.55, delayBetweenFiring: 1.25, patrolBlocksRadius: 2, minIdleWaitDuration: 0.3, maxIdleWaitDuration: 1, hidingLookXRange: 50 },
  ai_mook_bazooka: { sightRangeX: 300, sightRangeY: 64, attackTime: 0.3, sightDelay: 1.66, delayBetweenFiring: 1.76, patrolBlocksRadius: 2, minIdleWaitDuration: 0.3, maxIdleWaitDuration: 1, hidingLookXRange: 64 },
  ai_mook_scout: { sightRangeX: 300, sightRangeY: 20, attackTime: 0.06, sightDelay: 0.2, delayBetweenFiring: 1.1, patrolBlocksRadius: 2, minIdleWaitDuration: 0.3, maxIdleWaitDuration: 0.6, hidingLookXRange: 64 },
  path_mook: { agentSize: 9, capabilities: { canJump: 1, canWallClimb: 0, fudge: 0, jumpHeight: 3, maxDropDistance: 4 } },
  path_mook_suicide: { agentSize: 9, capabilities: { canJump: 1, canWallClimb: 0, fudge: 0, jumpHeight: 4, maxDropDistance: 5 } },
  path_mook_bazooka: { agentSize: 9, capabilities: { canJump: 1, canWallClimb: 0, fudge: 0, jumpHeight: 3, maxDropDistance: 4 } },
  path_mook_scout: { agentSize: 9, capabilities: { canJump: 1, canWallClimb: 0, fudge: 0, jumpHeight: 4, maxDropDistance: 3 } },
  mook_door: { spawningRate: 1, maxMookCount: 3, chanceToSpawnSuicideMook: 0.33, maxAlarmedMooksCount: 5, closedAtStart: 0, limitedNumberOfMooks: -1, maxMooksOnCollapse: 8, maxMookCountAfterCollapse: 0, spawnEscapingUnitsOnFire: 1, explodeAtEnd: 1, mooksAlwaysWalkOut: 0, mooksStartSuspicious: 0 },
  bullet: { damage: 1, life: 0.45 },
  rocket_mook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  suicide_blast: { range: 40, blastForce: 20 },
  block_dirt: { health: 5 },
  block_brick: { health: 5 },
  block_steel: { health: 500000 },
  block_barrel: { health: 1, range: 50 },
  grass: { health: 11, width: 4, height: 16 },
};

const ENEMY = { maxFallSpeed: -400, canWallClimb: false, canDash: false, specialAmmo: 3, canHideInGrass: true, canBeSetOnFire: true, panicsOnFire: true };
const PATH = { canJump: true, canWallClimb: false, fudge: false, agentSize: 9 };
const AI = { sightX: 300, patrolRadius: 2, minIdleWait: 0.3, maxIdleWait: 1 };

export const TEST_STATS: GameStats = {
  units: {
    bro: { speed: 110, jumpForce: 260, health: 1, fireRate: 0.27, maxFallSpeed: -400, canWallClimb: true, canDash: true, specialAmmo: 4, hearingX: 300, hearingY: 200, canHideInGrass: false, canBeSetOnFire: false, panicsOnFire: false },
    mook: { ...ENEMY, speed: 70, jumpForce: 200, health: 3, fireRate: 0.17, hearingX: 50, hearingY: 0 },
    mook_suicide: { ...ENEMY, speed: 70, jumpForce: 200, health: 3, fireRate: 0.1, hearingX: 100, hearingY: 50 },
    mook_bazooka: { ...ENEMY, speed: 70, jumpForce: 200, health: 4, fireRate: 0.17, hearingX: 50, hearingY: 0 },
    mook_scout: { ...ENEMY, speed: 80, jumpForce: 160, health: 3, fireRate: 0.1, hearingX: 350, hearingY: 150, canHideInGrass: false },
  },
  ai: {
    mook: { ...AI, sightY: 20, attackTime: 0.06, sightDelay: 1.66, delayBetweenFiring: 1.78, hidingLookX: 50 },
    mook_suicide: { ...AI, sightY: 20, attackTime: 7, sightDelay: 0.55, delayBetweenFiring: 1.25, hidingLookX: 50 },
    mook_bazooka: { ...AI, sightY: 64, attackTime: 0.3, sightDelay: 1.66, delayBetweenFiring: 1.76, hidingLookX: 64 },
    mook_scout: { ...AI, sightY: 20, attackTime: 0.06, sightDelay: 0.2, delayBetweenFiring: 1.1, maxIdleWait: 0.6, hidingLookX: 64 },
  },
  paths: {
    mook: { ...PATH, jumpHeight: 3, maxDropDistance: 4 },
    mook_suicide: { ...PATH, jumpHeight: 4, maxDropDistance: 5 },
    mook_bazooka: { ...PATH, jumpHeight: 3, maxDropDistance: 4 },
    mook_scout: { ...PATH, jumpHeight: 4, maxDropDistance: 3 },
  },
  scoutRunSpeed: 100,
  door: {
    spawningRate: 1, maxMookCount: 3, chanceSuicide: 0.33, maxAlarmed: 5, closedAtStart: false, limited: -1, maxOnCollapse: 8,
    maxAfterCollapse: 0, escapeOnFire: true, explodeAtEnd: true, alwaysWalkOut: false, startSuspicious: false,
  },
  bullet: { damage: 1, life: 0.45 },
  rocketMook: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 3 },
  bomb: { damage: 10, range: 28, blastForce: 20, blastForceExtraY: 300, life: 5 },
  marker: { bounceM: 0.4, frictionM: 0.6 },
  blocks: { dirt: { health: 5 }, brick: { health: 5 }, steel: { health: 500000 }, barrel: { health: 1 } },
  barrelRange: 50,
  suicide: { range: 40, blastForce: 20 },
  grass: { health: 11, width: 4, height: 16 },
};
