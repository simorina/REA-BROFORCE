import { FOE, GRAVITY, TILE } from './constants';
import type { Blast } from './explosions';
import { getColumn, getRow, type TileMap } from './map';
import type { FoeStats, Unit } from './types';

/** Broforce's enemy vehicles (Tank subclasses driven by a PolymorphicAI): the troop truck first. */
export type FoeKind = 'truck';

export interface Foe {
  kind: FoeKind;
  id: number;
  x: number;
  y: number; // its bottom, on the ground
  xI: number;
  yI: number;
  facing: 1 | -1;
  health: number;
  onGround: boolean;
  dead: boolean;
  deadTime: number;
  hurt: number; // Tank.hurtCounter: the hurt material's flash
  lastHit: number; // Tank.lastDamageTime
  mental: 'idle' | 'driving' | 'firing';
  alerted: boolean; // MentalState.Alerted: the bro was in front of it
  xMin: number; // MookTruckPolyAI.xMin: where its road ends
  think: number; // time to its next idle look
  fireDelay: number; // MookTruck.fireDelay
  spawned: number; // MookTruck.mookSpawnCount
  frame: number;
  frameCounter: number;
}

/** What a foe needs of the world as it steps. */
export interface FoeContext {
  map: TileMap;
  player: Unit | null;
  visible: (x: number, y: number, bufferX: number, bufferY: number) => boolean; // SortOfFollow.IsItSortOfVisible
  spawnMook: (x: number, y: number, xI: number, yI: number, alerted: boolean) => void;
}

/** The boxes the bro's shots and blasts find them by (their colliders, from the sprites). */
export const FOE_BOX: Record<FoeKind, { halfWidth: number; height: number }> = {
  truck: { halfWidth: 30, height: 40 },
};

/**
 * MookTruckPolyAI.CheckNearbyBlocks: facing left, its road ends two blocks short of the first column 3 to 16 ahead
 * with no ground at its level, a block in the way, or one over the cab; 240 at most.
 */
export function roadEnd(map: TileMap, x: number, y: number, lookAhead = 0): number {
  const c = getColumn(x) + lookAhead;
  const r = getRow(y + 4);
  for (let k = 3; k <= 16; k++) {
    if (!map.isSolid(c - k, r - 1) || map.isSolid(c - k, r) || map.isSolid(c - k - 1, r + 2)) return x - TILE * (k - 2);
  }
  return x - FOE.roadMax;
}

export function makeFoe(id: number, kind: FoeKind, x: number, y: number, s: FoeStats, map: TileMap): Foe {
  return {
    kind, id, x, y, xI: 0, yI: 0, facing: -1, health: s.health, onGround: true, dead: false, deadTime: 0, hurt: 0,
    lastHit: -1, mental: 'idle', alerted: false, xMin: roadEnd(map, x, y), think: 0, fireDelay: FOE.truck.fireDelay,
    spawned: 0, frame: 0, frameCounter: 0,
  };
}

const HIT_MARGIN = 2;

/** The first standing foe whose box holds (x, y). */
export function foeAt(foes: readonly Foe[], x: number, y: number): Foe | null {
  for (const f of foes) {
    if (f.dead) continue;
    const b = FOE_BOX[f.kind];
    if (Math.abs(x - f.x) <= b.halfWidth + HIT_MARGIN && y >= f.y - HIT_MARGIN && y <= f.y + b.height + HIT_MARGIN) return f;
  }
  return null;
}

/** Map.ExplodeUnits reaching a foe: its box within the blast's unit range. */
export function foeInBlast(f: Foe, b: Blast): boolean {
  const box = FOE_BOX[f.kind];
  return Math.abs(f.x - b.x) < b.unitRange + box.halfWidth && Math.abs(f.y + box.height / 2 - b.y) < b.unitRange + box.height / 2;
}

/**
 * Tank.Damage: it flashes; a second hit within 0.096 s of the last does at most 1. At 0 it dies (Death: MookTruck's
 * BounceOnDeath throws it up 250). True when this hit killed it.
 */
export function damageFoe(f: Foe, amount: number, now: number): boolean {
  if (f.dead || amount <= 0) return false;
  f.hurt = FOE.hurt;
  if (now - f.lastHit < FOE.hitWindow && amount > 1) amount = 1;
  if (now - f.lastHit > FOE.hitWindow) f.lastHit = now;
  f.health -= amount;
  if (f.health > 0) return false;
  f.health = 0;
  f.dead = true;
  f.deadTime = 0;
  f.yI = FOE.bounce;
  f.y += 4;
  f.xI = 0;
  f.onGround = false;
  return true;
}

/** Tank.MakeEffectsDeath: ExplodeUnits(12, Explosion, 48, 32, .., 200, 120) fired as playerNum 10 (everyone). */
export function foeBlast(f: Foe): Blast {
  return {
    x: f.x, y: f.y, groundDamage: 0, groundRange: 0, unitDamage: FOE.death.damage, unitRange: FOE.death.range,
    killRange: FOE.death.kill, force: FOE.death.force, extraY: FOE.death.extraY, team: 'neutral', big: true, noise: FOE.death.noise,
    source: 'vehicle', doodadDamage: 0, doodadRange: 0,
  };
}

/** HeroController.IsPlayerNearby(x, y, direction, rangeX, rangeY): a living bro that way, within range. */
const playerAhead = (p: Unit | null, x: number, y: number, dir: number, rx: number, ry: number): boolean =>
  p !== null && !p.dead && Math.sign(p.x - x) === dir && Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;

/** The highest ground under its wheels, at most 6 over its bottom (Tank.GetGroundHeight's rays). */
function groundUnder(map: TileMap, f: Foe): number {
  const half = FOE_BOX[f.kind].halfWidth * 0.6;
  let best = -Infinity;
  for (const x of [f.x - half, f.x, f.x + half]) {
    const c = getColumn(x);
    for (let r = getRow(f.y + 6); r >= 0; r--) {
      if (map.get(c, r)) {
        best = Math.max(best, r * TILE + TILE / 2);
        break;
      }
    }
  }
  return best;
}

/** Tank.RunMovement: it rolls at xI until a wall, falls when the ground goes, and settles on it. */
function move(f: Foe, map: TileMap, t: number): void {
  if (f.xI !== 0) {
    const b = FOE_BOX[f.kind];
    const nx = f.x + f.xI * t;
    const front = nx + Math.sign(f.xI) * b.halfWidth;
    if (map.boxHitsSolid(front - 1, f.y + 2, front + 1, f.y + b.height * 0.75)) f.xI = 0;
    else f.x = nx;
  }
  const ground = groundUnder(map, f);
  if (f.onGround && f.y - ground > 1) f.onGround = false;
  if (!f.onGround) {
    f.yI -= GRAVITY * t;
    f.y += f.yI * t;
    if (f.yI <= 0 && f.y <= ground) {
      f.y = ground;
      f.yI = 0;
      f.onGround = true;
    }
  }
}

/**
 * MookTruck with MookTruckPolyAI: idle, it looks every 0.8 s; once on screen it drives left to the end of its road and
 * unloads its mooks out of the back, one every 0.6 s (automaticallyFire). A bro in front of it within its sight stops
 * it at once (StopForNearbyPlayer) and the mooks come out alerted.
 */
export function stepFoe(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  if (f.hurt > 0) f.hurt -= t;
  if (f.dead) {
    f.deadTime += t;
    move(f, ctx.map, t);
    return;
  }
  if (f.mental === 'idle') {
    f.think -= t;
    if (f.think <= 0) {
      f.think += FOE.truck.lookEvery;
      if (ctx.visible(f.x, f.y + 16, FOE.truck.lookX, FOE.truck.lookY)) f.mental = getColumn(f.x) !== getColumn(f.xMin) ? 'driving' : 'firing';
    }
  }
  if (f.mental === 'driving') {
    if (playerAhead(ctx.player, f.x, f.y, f.facing, s.sightX, s.sightY)) {
      f.alerted = true;
      f.mental = 'firing';
    } else if (getColumn(f.x) === getColumn(f.xMin)) {
      f.mental = 'firing';
    }
  }
  f.xI = f.mental === 'driving' && f.onGround ? f.facing * s.speed : 0;
  if (f.mental === 'firing' && f.spawned < s.mooks && (f.fireDelay -= t) < 0) {
    f.fireDelay = FOE.truck.fireDelay;
    f.spawned++;
    ctx.spawnMook(f.x + FOE.truck.spawnX, f.y + FOE.truck.spawnY, FOE.truck.spawnXI + (f.spawned % 4) * FOE.truck.spawnXIStep, FOE.truck.spawnYI, f.alerted);
  }
  if (f.xI !== 0 && (f.frameCounter += t) > FOE.frameRate) { // MookTruck.AnimateRolling
    f.frameCounter -= FOE.frameRate;
    f.frame++;
  }
  move(f, ctx.map, t);
}
