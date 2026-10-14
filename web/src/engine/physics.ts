import {
  ACCEL_M, DASH_ACCEL_M, DASH_SPEED_M, GRAVITY, GROUND_FRICTION_M, JUMP_GRACE, LOW_SPEED_ACCEL_M,
  LOW_SPEED_THRESHOLD, MIN_START_SPEED, TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT, WALL_CLIMB_BOOST,
  WALL_CLIMB_CYCLE, WALL_CLIMB_GRAVITY_M,
} from './constants';
import { TileMap, cellBottom, cellLeft, getColumn, getRow } from './map';
import type { Unit } from './types';

export interface MoveIntent {
  dir: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dash: boolean;
}

export const NO_INTENT: MoveIntent = { dir: 0, jumpPressed: false, jumpHeld: false, dash: false };

const EPS = 0.001;

export function unitHitsSolid(map: TileMap, x: number, y: number): boolean {
  return map.boxHitsSolid(x - UNIT_HALF_WIDTH, y, x + UNIT_HALF_WIDTH, y + UNIT_HEIGHT);
}

export function touchesWall(u: Unit, dir: -1 | 1, map: TileMap): boolean {
  return unitHitsSolid(map, u.x + dir, u.y + 1);
}

/** TestVanDammeAnim.AddSpeedLeft/Right, plus ground friction when there's no input. */
function runHorizontal(u: Unit, dir: -1 | 0 | 1, t: number): void {
  if (dir === 0) {
    if (u.onGround) u.xI *= 1 - Math.min(1, t * GROUND_FRICTION_M);
    return;
  }
  u.facing = dir;
  const max = u.stats.speed * (u.dashing ? DASH_SPEED_M : 1);
  if (u.xI * dir < MIN_START_SPEED) u.xI = dir * MIN_START_SPEED;
  u.xI += dir * u.stats.speed * (u.dashing ? DASH_ACCEL_M : ACCEL_M) * t;
  if (u.xI * dir > max) u.xI = dir * max;
  else if (u.xI * dir < LOW_SPEED_THRESHOLD) u.xI += dir * u.stats.speed * LOW_SPEED_ACCEL_M * t;
}

function moveAndCollide(u: Unit, map: TileMap, t: number, now: number): void {
  const nx = u.x + u.xI * t;
  if (unitHitsSolid(map, nx, u.y)) {
    if (u.xI > 0) u.x = cellLeft(getColumn(nx + UNIT_HALF_WIDTH)) - UNIT_HALF_WIDTH - EPS;
    else if (u.xI < 0) u.x = cellLeft(getColumn(nx - UNIT_HALF_WIDTH)) + TILE + UNIT_HALF_WIDTH + EPS;
    u.xI = 0;
  } else {
    u.x = nx;
  }
  const ny = u.y + u.yI * t;
  if (unitHitsSolid(map, u.x, ny)) {
    if (u.yI <= 0) {
      u.y = cellBottom(getRow(ny)) + TILE;
      u.onGround = true;
      u.lastGroundedTime = now;
    } else {
      u.y = cellBottom(getRow(ny + UNIT_HEIGHT)) - UNIT_HEIGHT - EPS;
    }
    u.yI = 0;
  } else {
    u.y = ny;
  }
}

/**
 * One fixed step of TestVanDammeAnim-style movement. Simplified: no water, quicksand, ladders,
 * ziplines, parachutes, air dash or wall drag (see docs/findings.md).
 */
export function stepUnit(u: Unit, intent: MoveIntent, map: TileMap, t: number, now: number): void {
  u.animTime += t;
  u.onGround = u.yI <= 0 && unitHitsSolid(map, u.x, u.y - 0.5);
  if (u.onGround) {
    u.lastGroundedTime = now;
    if (u.yI < 0) u.yI = 0;
    u.dashing = intent.dash && u.stats.canDash && intent.dir !== 0;
  }
  runHorizontal(u, intent.dir, t);
  if (intent.jumpPressed && u.yI <= 0 && (u.onGround || now - u.lastGroundedTime < JUMP_GRACE)) {
    u.yI = u.stats.jumpForce;
    u.onGround = false;
    u.lastGroundedTime = -Infinity;
  }
  const climbing = !u.onGround && u.stats.canWallClimb && intent.dir !== 0 && intent.jumpHeld
    && touchesWall(u, intent.dir, map);
  if (climbing) {
    if (!u.wallClimbing) {
      u.wallClimbing = true;
      u.climbTimer = 0;
      if (u.yI < 5) u.yI = 5;
    }
    u.climbTimer -= t;
    if (u.climbTimer <= 0) {
      u.yI = Math.max(u.yI, WALL_CLIMB_BOOST);
      u.climbTimer += WALL_CLIMB_CYCLE;
    }
    u.yI -= GRAVITY * WALL_CLIMB_GRAVITY_M * t;
  } else {
    u.wallClimbing = false;
    if (!u.onGround) u.yI -= GRAVITY * t;
  }
  if (u.yI < u.stats.maxFallSpeed) u.yI = u.stats.maxFallSpeed;
  moveAndCollide(u, map, t, now);
}
