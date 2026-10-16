import { ACCEL_M, GRAVITY, GROUND_FRICTION_M, HALF_TILE, TANK_BOX, TANK_DROP_HEIGHT, TANK_RUN_FRAME_RATE, TILE } from './constants';
import { cellBottom, cellLeft, getColumn, getRow, type TileMap } from './map';
import type { TankStats } from './types';

/** TankBroTankTurret: which gun (0 mortar, 1 cannon) and where its firing or gun-switch animation is. */
export interface Turret {
  gun: 0 | 1;
  firing: boolean;
  frame: number;
  counter: number;
  queued: boolean; // queuedFire
  switching: boolean; // gunSwitching
  switchFrame: number; // gunSwitchingFrame, 0 (mortar) to 20 (cannon)
}

export interface TankDrive {
  dir: -1 | 0 | 1;
  jump: boolean;
}

export const NO_DRIVE: TankDrive = { dir: 0, jump: false };

/** TankBroTank: a vehicle beside the units. `y` is its feet, like a unit's. */
export interface Tank {
  id: number;
  x: number;
  y: number;
  xI: number;
  yI: number;
  facing: 1 | -1;
  onGround: boolean;
  animTime: number;
  bob: number; // TankBroTank.tankBobFrame
  bobCounter: number;
  driven: boolean;
  drive: TankDrive; // the driver's controls this step
  damage: number; // MookArmouredGuy.shieldDamage + fireAmount
  countdown: number; // deathCountdown ticks, -1 until the death countdown starts
  countdownCounter: number;
  turret: Turret;
  exploded: boolean;
}

export function makeTank(id: number, x: number, y: number, facing: 1 | -1): Tank {
  return {
    id, x, y, xI: 0, yI: 0, facing, onGround: false, animTime: 0, bob: 0, bobCounter: 0, driven: false, drive: NO_DRIVE,
    damage: 0, countdown: -1, countdownCounter: 0,
    turret: { gun: 0, firing: false, frame: 0, counter: 0, queued: false, switching: false, switchFrame: 0 },
    exploded: false,
  };
}

export interface TankDrop {
  x: number;
  y: number;
  fallback: boolean;
}

/** Where a ray cast down from above column c lands: its highest block's top, or 0 (Unity's empty hit point). */
function columnTop(map: TileMap, c: number): number {
  for (let r = map.rows - 1; r >= 0; r--) if (map.get(c, r)) return r * TILE + HALF_TILE;
  return 0;
}

/**
 * GrenadeAirstrike.SpawnTank: probe the five columns around the grenade (snapped to the grid) and take the lowest
 * pair of equal heights; the last pair found wins a tie. The tank falls in from 200 above the screen, over the middle
 * of that pair. With the ground near the top of the screen it drops at the screen's left edge instead.
 */
export function tankDrop(map: TileMap, x: number, y: number, screenMaxY: number, screenMinX: number): TankDrop {
  const snapped = Math.round(x / TILE) * TILE;
  const tops = [-2, -1, 0, 1, 2].map((i) => ({ x: snapped + i * TILE, y: columnTop(map, getColumn(snapped + i * TILE)) }));
  let low = tops[2].y;
  let lowX = snapped;
  for (let j = 0; j < tops.length - 1; j++) {
    if (tops[j].y === tops[j + 1].y && tops[j].y <= low) {
      low = tops[j].y;
      lowX = tops[j].x;
    }
  }
  if (low > screenMaxY - 16) return { x: screenMinX, y: y + 48, fallback: true };
  return { x: lowX + 8, y: screenMaxY + TANK_DROP_HEIGHT, fallback: false };
}

const EPS = 0.001;

function boxHits(map: TileMap, x: number, y: number): boolean {
  return map.boxHitsSolid(x - TANK_BOX.halfWidth, y, x + TANK_BOX.halfWidth, y + TANK_BOX.height);
}

/**
 * One fixed step of the tank's movement: TestVanDammeAnim's run, jump and gravity with the tank's values and box.
 * Returns how many crush ticks the treads made (TankBroTank.AnimateRunning: a running frame every 0.0334 s, and
 * CrushGroundWhileMoving on every other pair of them while a direction is held on the ground).
 */
export function stepTankBody(k: Tank, drive: TankDrive, map: TileMap, s: TankStats, t: number): number {
  k.animTime += t;
  k.onGround = k.yI <= 0 && boxHits(map, k.x, k.y - 0.5);
  if (drive.dir !== 0) {
    k.facing = drive.dir;
    k.xI += drive.dir * s.speed * ACCEL_M * t; // TestVanDammeAnim.AddSpeedLeft/Right
    if (k.xI * drive.dir > s.speed) k.xI = drive.dir * s.speed;
  } else if (k.onGround) {
    k.xI *= 1 - Math.min(1, t * GROUND_FRICTION_M);
  }
  if (drive.jump && k.onGround) {
    k.yI = s.jumpForce;
    k.onGround = false;
  }
  if (k.onGround) {
    if (k.yI < 0) k.yI = 0;
  } else {
    k.yI -= GRAVITY * t;
  }
  if (k.yI < s.maxFallSpeed) k.yI = s.maxFallSpeed;
  const nx = k.x + k.xI * t;
  if (boxHits(map, nx, k.y)) {
    if (k.xI > 0) k.x = cellLeft(getColumn(nx + TANK_BOX.halfWidth)) - TANK_BOX.halfWidth - EPS;
    else if (k.xI < 0) k.x = cellLeft(getColumn(nx - TANK_BOX.halfWidth)) + TILE + TANK_BOX.halfWidth + EPS;
    k.xI = 0;
  } else {
    k.x = nx;
  }
  const ny = k.y + k.yI * t;
  if (boxHits(map, k.x, ny)) {
    if (k.yI <= 0) {
      k.y = cellBottom(getRow(ny)) + TILE;
      k.onGround = true;
    } else {
      k.y = cellBottom(getRow(ny + TANK_BOX.height)) - TANK_BOX.height - EPS;
    }
    k.yI = 0;
  } else {
    k.y = ny;
  }
  let crushes = 0;
  if (k.onGround && drive.dir !== 0) {
    k.bobCounter += t;
    while (k.bobCounter >= TANK_RUN_FRAME_RATE) {
      k.bobCounter -= TANK_RUN_FRAME_RATE;
      k.bob++;
      if (Math.floor(k.bob / 2) % 2 !== 0) crushes++;
    }
  }
  return crushes;
}
