import { FOE, GRAVITY, TILE } from './constants';
import type { Blast } from './explosions';
import { getColumn, getRow, type TileMap } from './map';
import type { FoeStats, Unit } from './types';

/** Broforce's enemy vehicles (Tank subclasses driven by a PolymorphicAI). */
export type FoeKind = 'truck' | 'apc' | 'bike' | 'nukebike' | 'artillery' | 'kopter';

/** MookopterPolyAI's queue: PolymorphicAI actions as the kopter runs them. */
export type KopterAction = { type: 'wait'; t: number } | { type: 'move'; x: number; y: number } | { type: 'face'; x: number } | { type: 'fire' };

/** The Mookopter: its flight setpoint, its arena (CheckKopterExtents), its pattern, its bombs and its chaingun. */
export interface KopterState {
  tx: number; // kopterTargetX: the point it flies at, moved by its input
  ty: number;
  ground: number; // groundHeight at its start
  xMin: number;
  xMax: number;
  xMinDesc: number; // xMinDescending
  xMaxDesc: number;
  minL: number; // xMinMinHeight / xMinMaxHeight
  maxL: number;
  minR: number; // xMaxMinHeight / xMaxMaxHeight
  maxR: number;
  pattern: number; // KopterPattern: Hovering, MovingLeft, DescendingLeft, AscendingLeft, MovingRight, DescendingRight, AscendingRight, Restart
  queue: KopterAction[];
  look: number; // idle: time to its next look
  greet: number; // FullyAlert's sightDelay wait
  bombDelay: number;
  bombCounter: number; // Mookopter.specialCounter
  bombs: number; // bombDropCount
  missiles: number; // its missile rack's frame
  gun: { firing: boolean; frame: number; counter: number; rate: number; shots: number; windDown: number; delay: number };
  crashed: boolean;
  held: { x: number; y: number }; // last step's input along and up/down (-1, 0, 1): released, the setpoint stops (RunAI)
}

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
  kopter: KopterState | null;
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
  fireHuge: (x: number, y: number, xI: number, yI: number) => void; // the kopter chaingun's Bullet Huge
  warn: (x: number, y: number) => void; // CreateRedWarningDiamondHuge
}

/** The boxes the bro's shots and blasts find them by (their colliders, from the sprites). */
export const FOE_BOX: Record<FoeKind, { halfWidth: number; height: number; yOff?: number }> = {
  truck: { halfWidth: 30, height: 40 },
  apc: { halfWidth: 40, height: 44 },
  bike: { halfWidth: 14, height: 20 },
  nukebike: { halfWidth: 14, height: 20 },
  artillery: { halfWidth: 26, height: 40 },
  kopter: { halfWidth: 36, height: 36, yOff: -8 },
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

/** The top of the ground under (x, y) within `depth` (Physics.Raycast down), or null. */
function groundBelow(map: TileMap, x: number, y: number, depth: number): number | null {
  const c = getColumn(x);
  for (let r = getRow(y); r >= getRow(y - depth); r--) if (map.get(c, r)) return r * TILE + TILE / 2;
  return null;
}

/** The first wall left or right of x at height y within 224 (Physics.Raycast sideways), or null. */
function wallSide(map: TileMap, x: number, y: number, dir: -1 | 1): number | null {
  for (let d = 0; d <= FOE.kopter.wallReach; d += 4) {
    const px = x + dir * d;
    if (map.blockAt(px, y)) return dir < 0 ? Math.floor((px + TILE / 2) / TILE) * TILE + TILE / 2 : Math.floor((px + TILE / 2) / TILE) * TILE - TILE / 2;
  }
  return null;
}

/**
 * MookopterPolyAI.CheckKopterExtents / CheckGroundHeight / CheckHeight: 160 either side of its start, kept 64 off any
 * wall at 42-112 over the ground; the lowest it comes at each end is 28 over the ground there, the highest at least
 * 128 over its own.
 */
function makeKopter(map: TileMap, x: number, y: number): KopterState {
  const k = FOE.kopter;
  let ground = y;
  for (const dx of [0, -16, 16]) {
    const g = groundBelow(map, x + dx, y + 16, 64);
    if (g !== null && (dx === 0 || g > ground)) ground = dx === 0 ? g : Math.max(ground, g);
  }
  let xMin = x - k.half;
  let xMax = x + k.half;
  for (const h of k.wallHeights) {
    const l = wallSide(map, x, ground + h, -1);
    if (l !== null && l + k.wallMargin > xMin) xMin = l + k.wallMargin;
    const r = wallSide(map, x, ground + h, 1);
    if (r !== null && r - k.wallMargin < xMax) xMax = r - k.wallMargin;
  }
  if (xMin > xMax) xMin = xMax = x;
  const lowest = (ex: number): number => {
    let m = ground - 48;
    for (const dx of k.heightProbes) {
      const g = groundBelow(map, ex + dx, ground + 64, 90);
      if (g !== null) m = Math.max(m, g + 28);
    }
    return m;
  };
  const minL = lowest(xMin);
  const minR = lowest(xMax);
  return {
    tx: x, ty: y, ground, xMin, xMax, xMinDesc: x - 192, xMaxDesc: x + 128, minL, minR,
    maxL: Math.max(minL + 32, minR + 16, ground + 128), maxR: Math.max(minR + 32, minL + 16, ground + 128),
    pattern: 0, queue: [], look: 0, greet: -1, bombDelay: 0, bombCounter: 0, bombs: 0, missiles: 0,
    gun: { firing: false, frame: 0, counter: 0, rate: k.gunStartRate, shots: 0, windDown: 0, delay: 0 }, crashed: false, held: { x: 0, y: 0 },
  };
}

export function makeFoe(id: number, kind: FoeKind, x: number, y: number, s: FoeStats, map: TileMap): Foe {
  return {
    kind, id, x, y, xI: 0, yI: 0, facing: -1, health: s.health, onGround: true, dead: false, deadTime: 0, hurt: 0,
    lastHit: -1, mental: 'idle', alerted: false, xMin: roadEnd(map, x, y, kind === 'apc' ? FOE.apc.lookAhead : 0), think: 0,
    fireDelay: FOE.truck.fireDelay, spawned: 0, open: false, passenger: isBike(kind), hidden: false, carrier: -1, immune: 0, unfold: 0, firing: false,
    fireFrame: 0, fireCount: 0, fired: false, aim: -1, target: null, kopter: kind === 'kopter' ? makeKopter(map, x, y) : null, frame: 0,
    frameCounter: 0,
  };
}

const HIT_MARGIN = 2;

/** The first standing foe whose box holds (x, y). */
export function foeAt(foes: readonly Foe[], x: number, y: number): Foe | null {
  for (const f of foes) {
    if (f.dead || f.hidden) continue;
    const b = FOE_BOX[f.kind];
    const bottom = f.y + (b.yOff ?? 0);
    if (Math.abs(x - f.x) <= b.halfWidth + HIT_MARGIN && y >= bottom - HIT_MARGIN && y <= bottom + b.height + HIT_MARGIN) return f;
  }
  return null;
}

/** Map.ExplodeUnits reaching a foe: its box within the blast's unit range. */
export function foeInBlast(f: Foe, b: Blast): boolean {
  if (f.hidden) return false;
  const box = FOE_BOX[f.kind];
  return Math.abs(f.x - b.x) < b.unitRange + box.halfWidth && Math.abs(f.y + (box.yOff ?? 0) + box.height / 2 - b.y) < b.unitRange + box.height / 2;
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

/** MookopterPolyAI.DoAlertedThink: the next pattern's actions, at the bro's height (clamped) at either end. */
function kopterThink(f: Foe, k: KopterState, p: Unit | null): void {
  k.pattern++;
  const px = p ? p.x : f.x;
  const py = p ? p.y : f.y;
  const rowY = (y: number): number => getRow(y) * TILE + 12; // PolymorphicAI.GetTargetY
  const colX = (x: number): number => getColumn(x) * TILE;
  const q = k.queue;
  const clampL = Math.max(k.minL, Math.min(k.maxL, py));
  const clampR = Math.max(k.minR, Math.min(k.maxR, py));
  switch (k.pattern) {
    case 0: // Hovering
      q.push({ type: 'wait', t: 0.5 + Math.random() });
      k.pattern = 1;
      break;
    case 1: // MovingLeft
      k.bombDelay = FOE.kopter.bombDelay;
      q.push({ type: 'move', x: colX(k.xMin), y: rowY(f.y) }, { type: 'wait', t: 0.2 });
      break;
    case 2: // DescendingLeft
      if (px < k.xMaxDesc) {
        q.push({ type: 'move', x: colX(k.xMin), y: rowY(clampL) }, { type: 'face', x: px }, { type: 'wait', t: 0.6 }, { type: 'fire' }, { type: 'wait', t: 1.3 });
      } else {
        k.pattern--;
        q.push({ type: 'wait', t: 1 });
      }
      break;
    case 3: // AscendingLeft
      q.push({ type: 'move', x: colX(k.xMin), y: rowY(clampL) }, { type: 'face', x: px }, { type: 'wait', t: 0.6 }, { type: 'fire' }, { type: 'wait', t: 1.3 },
        { type: 'move', x: colX(k.xMin), y: rowY(k.maxL * 0.75) }, { type: 'wait', t: 1 });
      break;
    case 4: // MovingRight
      k.bombDelay = FOE.kopter.bombDelay;
      q.push({ type: 'move', x: colX(k.xMax), y: rowY(k.maxR * 0.75) }, { type: 'wait', t: 0.2 });
      break;
    case 5: // DescendingRight
      if (px > k.xMinDesc) {
        q.push({ type: 'move', x: colX(k.xMax), y: rowY(clampR) }, { type: 'face', x: px }, { type: 'wait', t: 0.6 }, { type: 'fire' }, { type: 'wait', t: 1.3 });
      } else {
        k.pattern--;
        q.push({ type: 'wait', t: 1 });
      }
      break;
    case 6: // AscendingRight
      q.push({ type: 'move', x: colX(k.xMax), y: rowY(clampR) }, { type: 'face', x: px }, { type: 'wait', t: 0.6 }, { type: 'fire' }, { type: 'wait', t: 1.3 },
        { type: 'move', x: colX(k.xMax), y: rowY(k.maxR * 0.75) }, { type: 'wait', t: 1 });
      break;
    default: // Restart
      k.pattern = 0;
  }
}

/**
 * TankChaingun.RunFiring / ChangeChaingunFrame: wind up five spins (each frame quicker, 0.065 s down to 0.015, a red
 * warning every fifth), then a Bullet Huge on every fourth frame (0.0175 s) at dir*450, 15 up or down, six in all, each
 * pushing the kopter back 20; wind down as long; then 1.1 s before it can fire again.
 */
function runChaingun(f: Foe, k: KopterState, ctx: FoeContext, t: number): void {
  const g = k.gun;
  const c = FOE.kopter;
  if (g.delay > 0) g.delay -= t;
  if (!g.firing || g.delay > 0) return;
  g.counter += t;
  while (g.firing && g.counter >= g.rate) {
    g.counter -= g.rate;
    g.frame++;
    const spin = c.gunFrames * c.gunSpins;
    if (g.frame < spin) {
      if (g.frame % 5 === 1) ctx.warn(f.x + f.facing * c.gunX, f.y + c.gunY + 3);
      g.rate = c.gunFast + ((spin - g.frame) / spin) * c.gunSlow;
    } else if (g.shots < c.gunShots) {
      g.rate = c.gunFireRate;
      if (g.frame % c.gunFrames === 0) {
        f.xI -= f.facing * c.gunPush;
        ctx.fireHuge(f.x + f.facing * c.gunX, f.y + c.gunY, f.facing * c.bulletSpeed, -c.bulletSpread / 2 + ctx.rng() * c.bulletSpread);
        g.shots++;
      }
    } else if (g.windDown < spin) {
      g.rate = c.gunFast + (1 - (spin - g.windDown) / spin) * c.gunSlow;
      g.windDown++;
    } else {
      Object.assign(g, { firing: false, delay: c.gunDelay, shots: 0, frame: 0, windDown: 0 });
    }
  }
}

/**
 * Mookopter.UseSpecial while it crosses its arena: every 0.4 s a bomb (Shell Medium) from one of its four racks (-27,
 * 25, -16, 14 along it, 3 under it) at dir*60, then a 0.2 s reload.
 */
function runBombs(f: Foe, k: KopterState, ctx: FoeContext, t: number): void {
  k.bombCounter += t;
  if (k.bombCounter <= FOE.kopter.bombEvery) return;
  k.bombCounter -= FOE.kopter.bombEvery;
  const n = ++k.bombs % 5;
  if (n > 0) {
    const ox = FOE.kopter.racks[n - 1];
    ctx.fireShell(f.x + ox * f.facing, f.y + 3, f.facing * FOE.kopter.bombXI, 0);
  }
  if (n === 4) k.bombCounter -= FOE.kopter.reload;
  k.missiles = n;
}

/**
 * The Mookopter alive: spotting the bro (300 by 250) it hangs back sightDelay, then runs its pattern; its input moves
 * the point it flies at (Mookopter.RunInput: 62 a second up or down, its speed along, 60% of it while bombing) and it
 * springs after it (RunMovement: xI += dx * t * 20, damped by t * 5), 8 over the ground at least. Its rotor hurts
 * what jumps into it (RotorHitUnits: 20).
 */
function stepKopter(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  const k = f.kopter!;
  const c = FOE.kopter;
  const p = ctx.player && !ctx.player.dead ? ctx.player : null;
  if (k.bombDelay > 0) k.bombDelay -= t;
  if (!f.alerted) {
    if ((k.look -= t) <= 0) {
      k.look = c.look;
      if (p && Math.abs(p.x - f.x) < s.sightX && Math.abs(p.y - f.y) < s.sightY && ctx.visible(f.x, f.y, 0, 0)) {
        f.alerted = true;
        k.greet = s.sightDelay ?? 0; // PolymorphicAI.FullyAlert: the greeting, then sightDelay
        f.facing = p.x < f.x ? -1 : 1;
      }
    }
  } else if (k.greet > 0) {
    k.greet -= t;
  } else {
    if (k.queue.length === 0) kopterThink(f, k, p);
    const a = k.queue[0];
    let bombing = false;
    let inX = 0;
    let inY = 0;
    if (a?.type === 'wait') {
      if ((a.t -= t) <= 0) k.queue.shift();
    } else if (a?.type === 'face') {
      f.facing = a.x < f.x ? -1 : 1;
      k.queue.shift();
    } else if (a?.type === 'fire') {
      if (k.gun.delay <= 0) k.gun.firing = true;
      k.queue.shift();
    } else if (a?.type === 'move') {
      bombing = (k.pattern === 1 || k.pattern === 4) && k.bombDelay <= 0;
      if (Math.abs(f.y - a.y) > 2) {
        inY = Math.sign(a.y - f.y);
        k.ty += inY * s.speedY! * 0.5 * t;
      } else if (Math.abs(f.x - a.x) > 2) {
        inX = Math.sign(a.x - f.x);
        k.tx += inX * s.speed * (bombing ? c.bombingM : 1) * t;
        if (inX !== f.facing && !k.gun.firing) f.facing = inX < 0 ? -1 : 1;
      }
      if (Math.abs(f.x - a.x) < 4 && Math.abs(f.y - a.y) < 4) k.queue.shift();
    }
    if (bombing) runBombs(f, k, ctx, t);
    else if (k.bombs > 0) k.bombs = k.missiles = 0; // the rack reloads
    // Mookopter.RunAI: an input let go stops the setpoint where the kopter is
    if (k.held.y !== 0 && inY !== k.held.y) k.ty = f.y;
    if (k.held.x !== 0 && inX !== k.held.x) k.tx = f.x;
    k.held = { x: inX, y: inY };
  }
  runChaingun(f, k, ctx, t);
  // Mookopter.RunMovement
  f.xI += (k.tx - f.x) * t * c.spring;
  f.xI *= 1 - t * c.damp;
  f.yI += (k.ty - f.y) * t * c.spring;
  f.yI *= 1 - t * c.damp;
  const b = FOE_BOX.kopter;
  const nx = f.x + f.xI * t;
  if (ctx.map.boxHitsSolid(nx - b.halfWidth, f.y, nx + b.halfWidth, f.y + 24)) f.xI = 0;
  else f.x = nx;
  let ny = f.y + f.yI * t;
  const ground = groundUnder(ctx.map, f);
  if (ny < ground + c.floor) {
    ny = ground + c.floor;
    f.yI = 0;
  }
  f.y = ny;
  f.onGround = false;
  if (p && Math.abs(p.x - f.x) < c.rotorX && p.y <= f.y + c.rotorY + 2 && p.y + c.unitHeight >= f.y + c.rotorY - 2) ctx.hurtPlayer(c.rotorDamage);
}

/** One step of a foe: its own AI, then the Tank's movement and rolling frames. */
export function stepFoe(f: Foe, s: FoeStats, ctx: FoeContext, t: number): void {
  if (f.hidden) return;
  if (f.hurt > 0) f.hurt -= t;
  if (f.immune > 0) f.immune -= t;
  if (f.dead) {
    f.deadTime += t;
    move(f, ctx.map, t);
    if (f.kopter && f.onGround) f.kopter.crashed = true; // Mookopter.Land
    return;
  }
  if (f.kind === 'kopter') {
    stepKopter(f, s, ctx, t);
    return;
  }
  if (isBike(f.kind)) stepBike(f, s, ctx, t);
  else if (f.kind === 'artillery') stepArtillery(f, s, ctx, t);
  else stepCarrier(f, s, ctx, t);
  animate(f, t);
  move(f, ctx.map, t);
}
