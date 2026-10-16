import {
  ACCEL_M, GRAVITY, GROUND_FRICTION_M, HALF_TILE, TANK_BOX, TANK_COUNTDOWN, TANK_DROP_HEIGHT, TANK_EMPTY_LIMIT,
  TANK_RUN_FRAME_RATE, TILE, TURRET_FRAME_RATE,
} from './constants';
import type { Blast } from './explosions';
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
  // projectiles ignore the side walls, so the grenade can be off the map: probe and drop inside it (ours)
  const snapped = Math.min(Math.max(Math.round(x / TILE) * TILE, 2 * TILE), (map.cols - 3) * TILE);
  const inside = (dx: number) => Math.min(Math.max(dx, cellLeft(0) + TANK_BOX.halfWidth), cellLeft(map.cols) - TANK_BOX.halfWidth);
  const tops = [-2, -1, 0, 1, 2].map((i) => ({ x: snapped + i * TILE, y: columnTop(map, getColumn(snapped + i * TILE)) }));
  let low = tops[2].y;
  let lowX = snapped;
  for (let j = 0; j < tops.length - 1; j++) {
    if (tops[j].y === tops[j + 1].y && tops[j].y <= low) {
      low = tops[j].y;
      lowX = tops[j].x;
    }
  }
  if (low > screenMaxY - 16) return { x: inside(screenMinX), y: y + 48, fallback: true };
  return { x: inside(lowX + 8), y: screenMaxY + TANK_DROP_HEIGHT, fallback: false };
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

export type TurretShot = 'shell' | 'cannon' | null;

/** TankBroTankTurret.FireWeapon: start firing, or queue another shot once the current one is past its fire frame. */
export function pressFire(tu: Turret): void {
  if (!tu.firing) {
    tu.firing = true;
    tu.counter = 0;
    tu.frame = 0;
  } else if (tu.gun === 0) {
    if (tu.frame >= 8) {
      tu.counter = 0;
      tu.frame = 0;
    } else if (tu.frame >= 6) {
      tu.queued = true;
    }
  } else if (tu.frame >= 9) {
    tu.counter = 0;
    tu.frame = 0;
  } else if (tu.frame >= 7) {
    tu.queued = true;
  }
}

/** TankBroTank.PressSpecial -> TankBroTankTurret.SwitchGun: the other gun, with the transform animation. */
export function switchGun(tu: Turret): void {
  tu.gun = tu.gun === 0 ? 1 : 0;
  tu.switching = true;
  tu.firing = false;
}

/**
 * TankBroTankTurret.Update for one fixed step (at most one turret frame per step, as in the original). The mortar
 * holds an extra frame after frame 4 and two after frame 5, and fires on frame 6. The cannon holds 2, 3, 4 and 5
 * extra frames after frames 3-6, and fires on frame 7. Returns the shot fired this step.
 */
export function stepTurret(tu: Turret, t: number): TurretShot {
  const rate = TURRET_FRAME_RATE;
  if (tu.switching) {
    tu.counter += t;
    if (tu.counter >= rate) {
      tu.counter -= rate;
      tu.switchFrame += tu.gun === 1 ? 1 : -1;
      if (tu.switchFrame >= 20 || tu.switchFrame <= 0) {
        tu.switchFrame = tu.gun === 1 ? 20 : 0;
        tu.switching = false;
      }
    }
    return null;
  }
  if (!tu.firing) return null;
  tu.counter += t;
  if (tu.counter < rate) return null;
  tu.counter -= rate;
  tu.frame++;
  let shot: TurretShot = null;
  if (tu.gun === 0) {
    if (tu.frame === 4) tu.counter -= rate;
    else if (tu.frame === 5) tu.counter -= rate * 2;
    else if (tu.frame === 6) shot = 'shell';
    else if (tu.frame === 9 && tu.queued) {
      tu.frame = 1;
      tu.queued = false;
    } else if (tu.frame === 10) {
      tu.frame = 0;
      if (tu.queued) tu.queued = false;
      else tu.firing = false;
    }
  } else {
    if (tu.frame >= 3 && tu.frame <= 6) tu.counter -= rate * (tu.frame - 1);
    else if (tu.frame === 7) shot = 'cannon';
    else if (tu.frame === 10 && tu.queued) {
      tu.frame = 1;
      tu.queued = false;
    } else if (tu.frame === 11) {
      tu.frame = 0;
      if (tu.queued) tu.queued = false;
      else tu.firing = false;
    }
  }
  return shot;
}

/**
 * MookArmouredGuy.Damage / TankBroTank.Damage: hits add up. Past maxDamageBeforeExploding a driven tank starts its
 * death countdown. True when the tank must gib at once: an empty one past 60.
 */
export function damageTank(k: Tank, amount: number, s: TankStats): boolean {
  k.damage += amount;
  if (k.driven && k.damage > s.maxDamage && k.countdown < 0) k.countdown = 0;
  return !k.driven && !k.exploded && k.damage > TANK_EMPTY_LIMIT;
}

/** MookArmouredGuy.Update (deathCount > 2): a tick every 0.2667 s after the first 0.4667, speeding up to 5x. */
export function stepCountdown(k: Tank, s: TankStats, t: number): boolean {
  if (k.countdown < 0) return false;
  k.countdownCounter += t * (1 + Math.min(TANK_COUNTDOWN.speedup, Math.max(0, (k.countdown / s.countdownThreshold) * TANK_COUNTDOWN.speedup)));
  if (k.countdownCounter >= TANK_COUNTDOWN.first) {
    k.countdownCounter -= TANK_COUNTDOWN.step;
    k.countdown += 1;
  }
  return k.countdown >= s.countdownThreshold;
}

const HIT_MARGIN = 2;

/** The first standing tank whose box holds (x, y): enemy shots stop on it. */
export function tankAt(tanks: readonly Tank[], x: number, y: number): Tank | null {
  for (const k of tanks) {
    if (k.exploded) continue;
    if (Math.abs(x - k.x) <= TANK_BOX.halfWidth + HIT_MARGIN && y >= k.y - HIT_MARGIN && y <= k.y + TANK_BOX.height + HIT_MARGIN) return k;
  }
  return null;
}

/** Map.ExplodeUnits reaching the tank: its box within the blast's unit range. */
export function tankInBlast(k: Tank, b: Blast): boolean {
  return Math.abs(k.x - b.x) < b.unitRange + TANK_BOX.halfWidth
    && Math.abs(k.y + TANK_BOX.height / 2 - b.y) < b.unitRange + TANK_BOX.height / 2;
}
