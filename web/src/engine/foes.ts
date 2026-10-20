import { FOE, GRAVITY, TILE } from './constants';
import type { Blast } from './explosions';
import { getColumn, getRow, type TileMap } from './map';
import type { FoeStats, Unit } from './types';

/** Broforce's enemy vehicles (Tank subclasses driven by a PolymorphicAI). */
export type FoeKind = 'truck' | 'apc' | 'bike' | 'nukebike' | 'artillery';

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
  alerted: boolean; // MentalState.Alerted
  xMin: number; // MookTruckPolyAI.xMin: where its road ends
  think: number; // time to its next idle look (or a bike's BecomeAlert delay)
  fireDelay: number; // MookTruck.fireDelay
  spawned: number; // MookTruck.mookSpawnCount
  open: boolean; // MookAPC: the back panel down, its suicide mooks coming out
  passenger: boolean; // MookMotorBike: its suicide mook (or nuclear bomb) still aboard
  hidden: boolean; // MookMotorBike inside an APC, disabled until released
  carrier: number; // the APC it rides in (its id), -1 if none
  immune: number; // a bike let out of a blown-up APC is clear of its blast (ours)
  unfold: number; // MookArtilleryTruck.unfoldFrame: its cannon raised at 59
  firing: boolean; // MookArtilleryTruck.firing: a volley under way
  fireFrame: number; // MookArtilleryTruck.firingFrame
  fireCount: number; // MookArtilleryTruck.fireCount: shots in this volley
  fired: boolean; // MookArtilleryTruckPolyAI.hasAlreadyFired
  aim: number; // the wait (sightDelay) before the volley starts, -1 when none
  target: { x: number; y: number } | null; // MookArtilleryTruck.targetPosition
  frame: number;
  frameCounter: number;
}

/** What a foe needs of the world as it steps. */
export interface FoeContext {
  map: TileMap;
  player: Unit | null;
  visible: (x: number, y: number, bufferX: number, bufferY: number) => boolean; // SortOfFollow.IsItSortOfVisible
  spawnMook: (kind: 'mook' | 'mook_suicide', x: number, y: number, xI: number, yI: number, alerted: boolean) => void;
  releaseBike: (apc: Foe) => boolean; // MookAPC.ReleaseMotorBike: false when none is left
  hurtPlayer: (damage: number) => void;
  nuke: (f: Foe) => void; // MookMotorBike.ExplodeNuclearBomb
  fireShell: (x: number, y: number, xI: number, yI: number) => void; // a HeavyShell "Shell Heavy"
  rng: () => number;
}

/** The boxes the bro's shots and blasts find them by (their colliders, from the sprites). */
export const FOE_BOX: Record<FoeKind, { halfWidth: number; height: number }> = {
  truck: { halfWidth: 30, height: 40 },
  apc: { halfWidth: 40, height: 44 },
  bike: { halfWidth: 14, height: 20 },
  nukebike: { halfWidth: 14, height: 20 },
  artillery: { halfWidth: 26, height: 40 },
};

const isBike = (k: FoeKind): boolean => k === 'bike' || k === 'nukebike';

/**
 * MookTruckPolyAI.CheckNearbyBlocks: facing left, its road ends two blocks short of the first column 3 to 16 ahead
 * (counted from collumnLookAhead) with no ground at its level, a block in the way, or one over the cab; 240 at most.
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
    lastHit: -1, mental: 'idle', alerted: false, xMin: roadEnd(map, x, y, kind === 'apc' ? FOE.apc.lookAhead : 0), think: 0,
    fireDelay: FOE.truck.fireDelay, spawned: 0, open: false, passenger: isBike(kind), hidden: false, carrier: -1, immune: 0, unfold: 0, firing: false,
    fireFrame: 0, fireCount: 0, fired: false, aim: -1, target: null, frame: 0,
    frameCounter: 0,
  };
}

const HIT_MARGIN = 2;

/** The first standing foe whose box holds (x, y). */
export function foeAt(foes: readonly Foe[], x: number, y: number): Foe | null {
  for (const f of foes) {
    if (f.dead || f.hidden) continue;
    const b = FOE_BOX[f.kind];
    if (Math.abs(x - f.x) <= b.halfWidth + HIT_MARGIN && y >= f.y - HIT_MARGIN && y <= f.y + b.height + HIT_MARGIN) return f;
  }
  return null;
}

/** Map.ExplodeUnits reaching a foe: its box within the blast's unit range. */
export function foeInBlast(f: Foe, b: Blast): boolean {
  if (f.hidden) return false;
  const box = FOE_BOX[f.kind];
  return Math.abs(f.x - b.x) < b.unitRange + box.halfWidth && Math.abs(f.y + box.height / 2 - b.y) < b.unitRange + box.height / 2;
}

/**
 * Tank.Damage: it flashes; a second hit within 0.096 s of the last does at most 1. At 0 it dies (Death: MookTruck's
 * and MookMotorBike's BounceOnDeath throw it up 250). True when this hit killed it.
 */
export function damageFoe(f: Foe, amount: number, now: number): boolean {
  if (f.dead || f.hidden || f.immune > 0 || amount <= 0) return false;
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
  f.open = false;
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

/**
 * MookMotorBike.ExplodeNuclearBomb (at the bomb, 10 under it): DamageGround(100, 128); ExplodeUnits(12, Explosion, 144, 96,
 * .., 360, 200) and ExplodeUnits(32, Crush, 96, 96, .., 360, 200), fired as playerNum -25: everyone.
 */
export function nukeBlasts(f: Foe): Blast[] {
  const n = FOE.nuke;
  const base = { x: f.x, y: f.y + n.y, team: 'neutral' as const, big: true, noise: n.noise, source: 'nuke' as const, doodadDamage: n.ground, doodadRange: n.groundRange };
  return [
    { ...base, groundDamage: n.ground, groundRange: n.groundRange, unitDamage: n.damage, unitRange: n.range, killRange: n.kill, force: n.force, extraY: n.extraY },
    { ...base, groundDamage: 0, groundRange: 0, unitDamage: n.crush, unitRange: n.kill, killRange: n.kill, force: n.force, extraY: n.extraY, noise: 0 },
  ];
}

/** HeroController.IsPlayerNearby(x, y, direction, rangeX, rangeY): a living bro that way, within range. */
const playerAhead = (p: Unit | null, x: number, y: number, dir: number, rx: number, ry: number): boolean =>
  p !== null && !p.dead && Math.sign(p.x - x) === dir && Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;
const playerNear = (p: Unit | null, x: number, y: number, rx: number, ry: number): boolean =>
  p !== null && !p.dead && Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;

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
      // MookMotorBike.Land: a bike bounces off a hard landing
      if (isBike(f.kind) && f.yI < FOE.bike.bounceBelow && !f.dead) {
        f.yI *= -0.5;
        f.y = ground + 4;
      } else {
        f.y = ground;
        f.yI = 0;
        f.onGround = true;
      }
    }
  }
}

function animate(f: Foe, t: number): void {
  if (f.kind !== 'artillery' && f.xI !== 0 && (f.frameCounter += t) > FOE.frameRate) { // MookTruck / MookMotorBike.AnimateRolling
    f.frameCounter -= FOE.frameRate;
    f.frame++;
  }
}

/**
 * MookTruck (and MookAPC) with MookTruckPolyAI: idle, it looks every 0.8 s; once on screen it drives left to the end of
 * its road. A bro in front of it within its sight stops it at once (StopForNearbyPlayer) and alerts it. The truck
 * unloads its mooks (automaticallyFire) at the end of its road; the APC waits for the bro, then lets its motorbike out
 * (0.8 s) and its suicide mooks out of the front (0.5 s each), its panel down.
 */
function stepCarrier(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  const apc = f.kind === 'apc';
  if (f.mental === 'idle' && (f.think -= t) <= 0) {
    f.think += FOE.truck.lookEvery;
    if (ctx.visible(f.x, f.y + 16, FOE.truck.lookX, FOE.truck.lookY)) {
      f.mental = getColumn(f.x) !== getColumn(f.xMin) ? 'driving' : apc ? 'idle' : 'firing';
      if (apc && f.mental === 'idle' && playerAhead(ctx.player, f.x, f.y, f.facing, s.sightX, s.sightY)) {
        f.alerted = true;
        f.mental = 'firing';
      }
    }
  }
  if (f.mental === 'driving') {
    if (playerAhead(ctx.player, f.x, f.y, f.facing, s.sightX, s.sightY)) {
      f.alerted = true;
      f.mental = 'firing';
    } else if (getColumn(f.x) === getColumn(f.xMin)) {
      f.mental = apc ? 'idle' : 'firing';
      f.think = 0;
    }
  }
  f.xI = f.mental === 'driving' && f.onGround ? f.facing * s.speed : 0;
  if (f.mental === 'firing' && f.spawned < s.mooks && (f.fireDelay -= t) < 0) {
    if (!apc) {
      f.fireDelay = FOE.truck.fireDelay; // MookTruck.FireWeapon
      f.spawned++;
      const tr = FOE.truck;
      ctx.spawnMook('mook', f.x + tr.spawnX, f.y + tr.spawnY, tr.spawnXI + (f.spawned % 4) * tr.spawnXIStep, tr.spawnYI, f.alerted);
    } else if (ctx.releaseBike(f)) {
      f.fireDelay = FOE.apc.bikeDelay; // MookAPC.FireWeapon
    } else {
      f.fireDelay = FOE.apc.mookDelay;
      f.open = true;
      f.spawned++;
      ctx.spawnMook('mook_suicide', f.x + FOE.apc.spawnX, f.y + FOE.apc.spawnY, FOE.apc.spawnXI, 0, true);
    }
  }
}

/**
 * MookMotorBike with MookMotorBikePolyAI: once on screen (48, 12) it becomes alert after 0.3 s and rides left at its
 * speed for good; close to the bro (attackXRange of X - 16, 32 up or down) its suicide mook leaps off at him (or the
 * nuclear bomb goes up). Riding faster than 80 it runs over what it meets (HitUnits: 20 crush).
 */
function stepBike(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  if (f.mental === 'idle') {
    if (f.alerted) {
      if ((f.think -= t) <= 0) f.mental = 'driving';
    } else if ((f.think -= t) <= 0) {
      f.think += FOE.truck.lookEvery;
      if (ctx.visible(f.x, f.y + 16, FOE.bike.lookX, FOE.bike.lookY)) {
        f.alerted = true;
        f.think = FOE.bike.alertDelay;
      }
    }
  }
  if (f.mental === 'driving') {
    f.facing = -1;
    if (f.onGround) f.xI = -s.speed;
    if (f.passenger && playerNear(ctx.player, f.x - FOE.bike.attackOffset, f.y, s.attackX ?? 0, FOE.bike.attackY)) {
      f.passenger = false; // MookMotorBike.FireWeapon
      if (f.kind === 'nukebike') ctx.nuke(f);
      else ctx.spawnMook('mook_suicide', f.x - f.facing * FOE.bike.riderBack, f.y + FOE.bike.riderY, f.facing * FOE.bike.leapXI, s.jumpForce ?? 0, true);
    }
  }
  if (!f.dead && Math.abs(f.xI) > FOE.bike.crushSpeed && playerNear(ctx.player, f.x, f.y, FOE.bike.crushX, FOE.bike.crushY)) {
    ctx.hurtPlayer(FOE.bike.crush); // MookMotorBike.Update: HitUnits
  }
}

/**
 * MookArtilleryTruck.AnimateIdle while firing: the cannon unfolds (59 frames, the first 30 two at a time), then each shot
 * is 12 frames of 0.0334 s, the shell leaving on the sixth from (X + dir*9, Y + 68) at (dir*150, 150) * num, num aiming at
 * the bro (0.2 + |dx| / 180 + dy / 300, at least 0.5), with 0.85-1.15 of its push; three shots a volley.
 */
function runVolley(f: Foe, ctx: FoeContext, t: number): void {
  const a = FOE.artillery;
  f.frameCounter += t;
  if (f.frameCounter <= FOE.frameRate) return;
  if (f.unfold < a.unfolded) {
    f.frameCounter -= a.unfoldRate;
    if (f.unfold < a.unfoldFast) {
      f.frameCounter -= a.unfoldRate;
      f.unfold++;
    }
    f.unfold++;
    return;
  }
  f.frameCounter -= FOE.frameRate;
  f.fireFrame++;
  if (f.fireFrame === a.shotFrame) {
    let num = a.blindM + ctx.rng() * a.blindRand;
    if (f.target) num = Math.max(a.minNum, a.num + Math.abs(f.target.x - f.x) / a.numX + (f.target.y - f.y) / a.numY);
    ctx.fireShell(f.x + f.facing * a.shellX, f.y + a.shellY, f.facing * a.push * num * (a.spread + ctx.rng() * a.spreadRand), a.push * num);
  }
  if (f.fireFrame >= a.frames) {
    f.fireFrame = 0;
    if (++f.fireCount > 2) {
      f.firing = false;
      f.fireCount = 0;
    }
  }
}

/**
 * MookArtilleryTruck with MookArtilleryTruckPolyAI: it becomes alert with a bro ahead (256 by 128 from 32 up) or at the
 * end of its road; until then, once on screen (48, 12), it drives there. Alert, it turns to the bro, waits sightDelay
 * and fires a volley (attackTime), then waits 3 s; with no bro to shoot, half a second.
 */
function stepArtillery(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  const p = ctx.player && !ctx.player.dead ? ctx.player : null;
  if (!f.alerted && (playerAhead(p, f.x, f.y + FOE.artillery.eyeY, f.facing, s.sightX, s.sightY) || f.x <= f.xMin + 6)) {
    f.alerted = true;
    f.think = 0;
  }
  if (!f.alerted) {
    if (f.mental === 'idle' && (f.think -= t) <= 0) {
      f.think += FOE.truck.lookEvery;
      if (ctx.visible(f.x, f.y + 16, FOE.bike.lookX, FOE.bike.lookY)) f.mental = 'driving';
    }
    if (f.mental === 'driving' && getColumn(f.x) === getColumn(f.xMin)) f.mental = 'idle';
    f.xI = f.mental === 'driving' && f.onGround ? f.facing * s.speed : 0;
  } else {
    f.xI = 0;
    if ((f.think -= t) <= 0) {
      const inSight = p !== null && Math.abs(p.x - f.x) < s.sightX * 1.5 && Math.abs(p.y - (f.y + FOE.artillery.eyeY)) < s.sightY * 2;
      if (p && inSight && (f.fired || ctx.visible(f.x, f.y, -4, 32))) {
        f.fired = true;
        f.target = { x: p.x, y: p.y };
        f.facing = p.x < f.x ? -1 : 1; // FacePoint
        f.aim = s.sightDelay ?? 0;
        f.think = (s.sightDelay ?? 0) + (s.attackTime ?? 0) + FOE.artillery.rest;
      } else {
        f.think = FOE.artillery.retry;
      }
    }
    if (f.aim >= 0 && (f.aim -= t) < 0) f.firing = true; // MookArtilleryTruck.FireWeapon
  }
  if (f.firing) runVolley(f, ctx, t);
}

/** One step of a foe: its own AI, then the Tank's movement and rolling frames. */
export function stepFoe(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  if (f.hidden) return;
  if (f.hurt > 0) f.hurt -= t;
  if (f.immune > 0) f.immune -= t;
  if (f.dead) {
    f.deadTime += t;
    move(f, ctx.map, t);
    return;
  }
  if (isBike(f.kind)) stepBike(f, s, ctx, t);
  else if (f.kind === 'artillery') stepArtillery(f, s, ctx, t);
  else stepCarrier(f, s, ctx, t);
  animate(f, t);
  move(f, ctx.map, t);
}
