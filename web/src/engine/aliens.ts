import { canSeePlayer } from './ai';
import { ALIEN, GRAVITY, TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT } from './constants';
import type { Blast } from './explosions';
import { getColumn, type TileMap } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import type { AiStats, Unit } from './types';
import { damageUnit } from './units';

/** Broforce's aliens: Alien / AlienClimber kinds with their DogAI-derived minds. */
export type AlienKind = 'alien_xeno' | 'alien_xeno_brain' | 'alien_hugger' | 'alien_snake' | 'alien_melter' | 'alien_brute' | 'alien_mosquito';
export const ALIEN_KINDS: readonly AlienKind[] = ['alien_xeno', 'alien_xeno_brain', 'alien_hugger', 'alien_snake', 'alien_melter', 'alien_brute', 'alien_mosquito'];
export const isAlien = (kind: string): kind is AlienKind => (ALIEN_KINDS as readonly string[]).includes(kind);

/** The run speeds an alien's prefab gives it (Alien: unawareRunSpeed, awareRunSpeed, awareMegaRunSpeed). */
export interface AlienSpeeds {
  unaware: number;
  aware: number;
  mega: number;
}

export interface AlienState {
  alerted: boolean;
  look: number; // time to its next look
  wander: number; // idle: time to its next stroll, and where to
  wanderX: number;
  wanderDir: -1 | 1; // its strolls go back and forth
  attack: number; // time since its last attack (lastForcedAttackTime)
  panic: number; // panicSurroundingMooksDelay
  // AlienFaceHugger
  charge: number; // chargingSpecial, -1 when not
  leaping: boolean;
  hugging: boolean; // connectedToFace
  hugTime: number; // the bro's inseminationCounter
  // AlienMelter / AlienMosquito: dead, the fuse to its acid burst (deathCounter)
  fuse: number;
  burst: boolean;
  // AlienBrute
  ram: number; // the charge's time left (its Fire action)
  rammed: boolean; // HitLivingUnits has landed this charge
  ramDelay: number; // damageDelay
  skid: boolean; // skiddingToHalt
  stun: number; // after charging into steel
  // AlienMosquito
  flying: boolean;
  takeOff: number;
  prepare: number; // divePositionCounter
  dive: { x: number; y: number; delay: number; speed: number } | null;
}

export function makeAlienState(rng: () => number): AlienState {
  return {
    alerted: false, look: rng() * 0.3, wander: 0.5 + rng(), wanderX: 0, wanderDir: rng() < 0.5 ? 1 : -1, attack: 99, panic: 0, charge: -1, leaping: false, hugging: false,
    hugTime: 0, fuse: -1, burst: false, ram: 0, rammed: false, ramDelay: 0, skid: false, stun: 0, flying: false,
    takeOff: ALIEN.mosquito.takeOff, prepare: 0, dive: null,
  };
}

/** What an alien needs of the world as it steps. */
export interface AlienContext {
  map: TileMap;
  player: Unit | null;
  stats: AiStats;
  speeds: AlienSpeeds;
  rng: () => number;
  time: number;
  blasts: Blast[];
  flexing: () => boolean; // the bro mid-flex (TestVanDammeAnim.IsFlexing)
  panicMooks: (x: number, y: number, range: number) => void; // Map.PanicUnits
  alert: (x: number, y: number) => void; // the '!' and its sound
  hug: (x: number, y: number) => void; // a facehugger on his face
}

const sign = (v: number): -1 | 1 => (v < 0 ? -1 : 1);
const near = (p: Unit, x: number, y: number, rx: number, ry: number): boolean => Math.abs(p.x - x) < rx && Math.abs(p.y - y) < ry;
const blockedAhead = (map: TileMap, m: Unit, dir: number): boolean => map.solidAt(m.x + dir * (UNIT_HALF_WIDTH + 2), m.y + 4);
const clearAbove = (map: TileMap, m: Unit, dir: number): boolean =>
  !map.solidAt(m.x + dir * (UNIT_HALF_WIDTH + 2), m.y + 4 + TILE) && !map.solidAt(m.x, m.y + UNIT_HEIGHT + 4);

/** AlienMelter / AlienMosquito.MakeEffects: DamageGround(15, explodeRange) and ExplodeUnits(9, Acid, range * 2.3, range * 1.5, 500, 300). */
export function acidBlast(x: number, y: number): Blast {
  const r = ALIEN.acid.range;
  return {
    x, y: y + ALIEN.acid.y, groundY: y, groundDamage: ALIEN.acid.ground, groundRange: r, unitDamage: ALIEN.acid.damage, unitRange: r * 2.3,
    killRange: r * ALIEN.acid.killM, force: ALIEN.acid.force, extraY: ALIEN.acid.extraY, team: 'neutral', big: true, noise: ALIEN.acid.noise,
    source: 'acid', doodadDamage: 0, doodadRange: 0,
  };
}

function burst(m: Unit, a: AlienState, ctx: AlienContext): void {
  if (a.burst) return;
  a.burst = true;
  ctx.blasts.push(acidBlast(m.x, m.y));
  if (!m.dead) {
    m.dead = true;
    m.deadTime = 0;
  }
  m.gibbed = true;
}

/**
 * XenomorphAI.HearSound: a noise within half its hearing alerts it; further off it turns to it and looks.
 */
export function hearAlien(m: Unit, x: number, y: number, range: number): void {
  const a = m.alien;
  if (!a || a.alerted || m.dead) return;
  if (Math.abs(x - m.x) >= range + m.stats.hearingX || Math.abs(y - m.y) >= range + m.stats.hearingY) return;
  m.facing = x < m.x ? -1 : 1;
  a.look = 0;
  if (Math.abs(x - m.x) < m.stats.hearingX / 2 + range && Math.abs(y - m.y) < m.stats.hearingY / 2 + range) a.alerted = true;
}

/** Alien LookForEnemy: the bro the way it faces within its sight; Mook.Damage: a hit gives it away too. */
function look(m: Unit, a: AlienState, ctx: AlienContext, t: number): void {
  const p = ctx.player;
  if (a.alerted || !p) return;
  if (m.health < m.stats.health) {
    alertTo(m, a, ctx, p);
    return;
  }
  if ((a.look -= t) > 0) return;
  a.look = ALIEN.lookEvery;
  if (canSeePlayer(m.x, m.y, m.facing, ctx.stats.sightX, ctx.stats.sightY, p, ctx.map)) alertTo(m, a, ctx, p);
}

function alertTo(m: Unit, a: AlienState, ctx: AlienContext, p: Unit): void {
  a.alerted = true;
  m.facing = sign(p.x - m.x);
  a.attack = 99;
  ctx.alert(m.x, m.y);
}

/** DogAI's idle think: a few steps either way and back, at its unaware speed. */
function wander(m: Unit, a: AlienState, ctx: AlienContext, t: number): MoveIntent {
  const intent: MoveIntent = { ...NO_INTENT };
  if ((a.wander -= t) <= 0) {
    a.wander = ctx.stats.minIdleWait + ctx.rng() * (ctx.stats.maxIdleWait - ctx.stats.minIdleWait) + 0.5;
    a.wanderDir = a.wanderDir === 1 ? -1 : 1;
    a.wanderX = m.x + a.wanderDir * TILE * (1 + Math.floor(ctx.rng() * ctx.stats.patrolRadius));
    m.facing = a.wanderDir;
  }
  if (Math.abs(a.wanderX - m.x) > 2 && a.wanderX !== 0 && !blockedAhead(ctx.map, m, sign(a.wanderX - m.x))) {
    intent.dir = sign(a.wanderX - m.x);
    intent.speed = ctx.speeds.unaware;
  }
  return intent;
}

/** DogAI's chase at its aware speed: straight at the bro, jumping a step in its way (JumpOverStep) or up at him. */
function chase(m: Unit, ctx: AlienContext, p: Unit, speed: number): MoveIntent {
  const dir = sign(p.x - m.x);
  const intent: MoveIntent = { ...NO_INTENT, dir, speed };
  const jump = m.onGround && ((blockedAhead(ctx.map, m, dir) && clearAbove(ctx.map, m, dir))
    || (p.y > m.y + TILE && Math.abs(p.x - m.x) < ALIEN.jumpAtX));
  if (jump) intent.jumpPressed = intent.jumpHeld = true;
  return intent;
}

/** AlienXenomorph.RunFiring: HitLivingUnits(6, Melee, 3, 8) at (X + dir*11, Y + 6), every 0.4 s within its attack range. */
function claw(m: Unit, a: AlienState, ctx: AlienContext, p: Unit): void {
  if (a.attack < ALIEN.xeno.every) return;
  const reach = near(p, m.x - m.facing * 6, m.y + 16 - UNIT_HEIGHT / 2, ctx.stats.attackRangeX ?? 26, (ctx.stats.attackRangeY ?? 16) + UNIT_HEIGHT / 2)
    && sign(p.x - m.x) === m.facing;
  if (!reach) return;
  a.attack = 0;
  const cx = m.x + m.facing * ALIEN.xeno.clawX;
  if (Math.abs(p.x - cx) < ALIEN.xeno.clawW + UNIT_HALF_WIDTH && p.y < m.y + ALIEN.xeno.clawY + ALIEN.xeno.clawH && p.y + UNIT_HEIGHT > m.y) {
    damageUnit(p, ALIEN.xeno.damage);
  }
}

/**
 * FacehuggerAI.PerformMediumRangeAttack: on the ground with the bro within 90, 1.5 s after its last try, it turns to him,
 * crouches (AnimateSpecial: four frames of 0.125 s and a hold) and leaps (attackJumpXSpeed, attackJumpYSpeed); in the air it
 * hugs the bro's face if it touches him (InseminateUnits, 6 by 8 at its middle).
 */
function hugger(m: Unit, a: AlienState, ctx: AlienContext, p: Unit, t: number): MoveIntent {
  const h = ALIEN.hugger;
  if (a.charge >= 0) {
    a.charge += t;
    m.facing = sign(p.x - m.x);
    if (a.charge >= h.charge) {
      a.charge = -1;
      a.leaping = true;
      m.xI = m.facing * h.leapX;
      m.yI = h.leapY;
      m.onGround = false;
    }
    return { ...NO_INTENT };
  }
  if (a.leaping) {
    if (Math.abs(p.x - m.x) < h.hugX + UNIT_HALF_WIDTH && p.y < m.y + 4 + h.hugY && p.y + UNIT_HEIGHT > m.y + 4 - h.hugY && !p.dead && p.invulnerable <= 0) {
      a.leaping = false;
      a.hugging = true;
      a.hugTime = 0;
      ctx.hug(p.x, p.y);
    } else if (m.onGround && m.yI <= 0) {
      a.leaping = false;
    }
    m.yI += GRAVITY * (1 - h.gravityM) * t; // ApplyFallingGravity: two thirds of it while it leaps
    return { ...NO_INTENT, dir: m.facing, speed: Math.abs(m.xI) };
  }
  if (m.onGround && a.attack > h.every && Math.abs(p.x - m.x) <= h.range && Math.abs(p.y - m.y) < ctx.stats.sightY * 2) {
    a.attack = 0;
    a.charge = 0;
    return { ...NO_INTENT };
  }
  return chase(m, ctx, p, ctx.speeds.aware);
}

/**
 * On the bro's face (TestVanDammeAnim with inseminatorUnit): it rides him; after 2 s he dies unless he is flexing,
 * and the facehugger lets go.
 */
function hugging(m: Unit, a: AlienState, ctx: AlienContext, p: Unit, t: number): void {
  m.x = p.x + p.facing * 2;
  m.y = p.y + ALIEN.hugger.faceY;
  m.xI = m.yI = 0;
  m.facing = p.facing;
  if ((a.hugTime += t) > ALIEN.hugger.hugTime) {
    if (!ctx.flexing()) damageUnit(p, p.health + 1);
    a.hugging = false;
    a.attack = 0;
    m.x = p.x + p.facing * 6;
  }
}

/**
 * AlienMelter: it runs at the bro and, in its attack range, bursts in acid (RunFiring: MakeEffects); a little further off
 * it rolls into a ball and launches itself at him (UseSpecial: 300 along, 140 up).
 */
function melter(m: Unit, a: AlienState, ctx: AlienContext, p: Unit): MoveIntent {
  const s = ctx.stats;
  if (near(p, m.x, m.y, (s.attackRangeX ?? 26) + UNIT_HALF_WIDTH, (s.attackRangeY ?? 26))) {
    burst(m, a, ctx);
    return { ...NO_INTENT };
  }
  if (m.onGround && a.attack > ALIEN.hugger.every && Math.abs(p.x - m.x) <= ALIEN.melter.rollRange && Math.abs(p.y - m.y) < TILE) {
    a.attack = 0;
    m.facing = sign(p.x - m.x);
    m.xI = m.facing * ALIEN.melter.rollX;
    m.yI = ALIEN.melter.rollY;
    m.onGround = false;
    a.leaping = true;
  }
  if (a.leaping) {
    if (m.onGround && m.yI <= 0) a.leaping = false;
    return { ...NO_INTENT, dir: m.facing, speed: Math.abs(m.xI) };
  }
  return chase(m, ctx, p, ctx.speeds.aware);
}

/**
 * AlienBrute with AlienBruteAI: it plods (33, standing still four frames in twenty); a bro ahead within its attack range
 * (190 by 64) gets a charge (its Fire action: (distance + 60 * 0.5-1.5) / 160 s, 0.3-1.5) at its mega speed, ramming what
 * it meets (HitLivingUnits 20 after 0.3 s) and smashing blocks (15 crush); charging into steel stuns it (6 s); after the
 * charge it skids to a halt.
 */
function brute(m: Unit, a: AlienState, ctx: AlienContext, p: Unit, t: number): MoveIntent {
  const b = ALIEN.brute;
  if (a.stun > 0) {
    a.stun -= t;
    return { ...NO_INTENT };
  }
  if (a.ram > 0) {
    a.ram -= t;
    const dir = m.facing;
    // AlienBrute.Update: what it runs into at waist and head height takes 15 crush; steel stops it dead
    for (const yy of [b.waist, b.head]) {
      const c = getColumn(m.x + dir * (UNIT_HALF_WIDTH + 2));
      const r = Math.floor((m.y + yy + TILE / 2) / TILE);
      const block = ctx.map.get(c, r);
      if (!block) continue;
      if (block.kind === 'steel') {
        a.stun = b.stun;
        a.ram = 0;
        m.xI = 0;
        m.xIBlast = -dir * b.recoil;
        m.yI = b.recoilY;
        return { ...NO_INTENT };
      }
      ctx.map.damage(c, r, b.smash);
    }
    if ((a.ramDelay -= t) < 0 && !a.rammed && Math.abs(p.x - (m.x + dir * b.ramX)) < b.ramW + UNIT_HALF_WIDTH && Math.abs(p.y - m.y) < UNIT_HEIGHT) {
      a.rammed = true;
      damageUnit(p, b.damage); // AlienBrute.RunFiring: BruteCharge
      p.xI += dir * b.ramPush;
    }
    if (a.ram <= 0) {
      a.skid = true;
      m.xI = dir * ctx.speeds.aware * 2;
    }
    return { ...NO_INTENT, dir, speed: ctx.speeds.mega };
  }
  if (a.skid) {
    m.xI -= Math.sign(m.xI) * b.skidDecel * t;
    if (Math.abs(m.xI) < 5) {
      m.xI = 0;
      a.skid = false;
    }
    return { ...NO_INTENT };
  }
  const ahead = sign(p.x - m.x) === m.facing || a.attack > 1;
  if (m.onGround && ahead && near(p, m.x - m.facing * 6, m.y + 16, ctx.stats.attackRangeX ?? 190, ctx.stats.attackRangeY ?? 64) && a.attack > b.rest) {
    m.facing = sign(p.x - m.x);
    a.attack = 0;
    a.ram = Math.max(b.minRam, Math.min(b.maxRam, (Math.abs(p.x - m.x) + 60 * (0.5 + ctx.rng())) / 160));
    a.ramDelay = b.ramDelay;
    a.rammed = false;
    return { ...NO_INTENT, dir: m.facing, speed: ctx.speeds.mega };
  }
  // AlienBrute.AddSpeedLeft: it stands still four frames in twenty of its run
  const plod = Math.floor(m.animTime / b.plodFrame) % 20;
  const intent = chase(m, ctx, p, ctx.speeds.aware);
  intent.jumpPressed = intent.jumpHeld = false; // AlienBruteAI.CheckJump: never
  if (plod === 0 || plod === 1 || plod === 10 || plod === 11) intent.dir = 0;
  return intent;
}

/**
 * AlienMosquito with AlienMosquitoAI: alert, it takes off and flies (60) to get above the bro, then dives at where it saw
 * him (when level enough with him, or after 3 s): a 0.5 s line of warning, then 240 a second and faster (120 more a
 * second), bursting in acid on whatever it hits.
 */
function mosquito(m: Unit, a: AlienState, ctx: AlienContext, p: Unit, t: number): void {
  const q = ALIEN.mosquito;
  if (!a.flying) {
    if ((a.takeOff -= t) <= 0) a.flying = true;
    return;
  }
  const d = a.dive;
  if (d) {
    if (d.delay > 0) {
      d.delay -= t;
      m.xI *= 1 - Math.min(1, t * 8);
      m.yI *= 1 - Math.min(1, t * 8);
    } else {
      const dx = d.x - m.x;
      const dy = d.y + 5 - m.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      d.speed += q.diveAccel * t;
      m.xI = (dx / len) * d.speed;
      m.yI = (dy / len) * d.speed;
      m.facing = sign(m.xI);
      if (Math.hypot(p.x - m.x, p.y + UNIT_HEIGHT / 2 - m.y) < q.hit + UNIT_HALF_WIDTH) burst(m, a, ctx);
    }
  } else {
    a.prepare += t;
    const vx = p.x - m.x;
    const vy = p.y - m.y;
    const ceilingFree = !ctx.map.solidAt(m.x, m.y + 2 * TILE);
    let ax = 0;
    let ay = 0;
    if (a.prepare >= q.maxDelay) a.dive = { x: p.x, y: p.y, delay: q.diveDelay, speed: q.diveSpeed };
    else if (vy > -2 * TILE && ceilingFree) ay = 1;
    else if (Math.abs(vx) < Math.abs(vy) + 2 * TILE) a.dive = { x: p.x, y: p.y, delay: q.diveDelay, speed: q.diveSpeed };
    else {
      ax = sign(vx);
      if (vy > -4 * TILE && ceilingFree) ay = 1;
    }
    m.xI += (ax * q.fly - m.xI) * Math.min(1, t * 4);
    m.yI += (ay * q.fly - m.yI) * Math.min(1, t * 4);
    if (ax) m.facing = ax < 0 ? -1 : 1;
  }
  // flying: no gravity; walls and the ground end a dive in acid
  const nx = m.x + m.xI * t;
  const ny = m.y + m.yI * t;
  const hit = ctx.map.solidAt(nx, ny) || ctx.map.solidAt(nx, ny + 8);
  if (hit) {
    if (d && d.delay <= 0) {
      burst(m, a, ctx);
      return;
    }
    m.xI = m.yI = 0;
  } else {
    m.x = nx;
    m.y = ny;
  }
  m.onGround = false;
  m.animTime += t;
}

/** One step of an alien: dead (the melter's and mosquito's acid fuse), latched on a face, or its kind's mind. */
export function stepAlien(m: Unit, ctx: AlienContext, t: number): void {
  const a = m.alien!;
  const p = ctx.player && !ctx.player.dead ? ctx.player : null;
  if (m.dead) {
    if ((m.kind === 'alien_melter' || m.kind === 'alien_mosquito') && !a.burst) {
      if (a.fuse < 0) a.fuse = ALIEN.acid.fuse; // AlienMelter.Death: deathCounter 0.4
      a.fuse -= t;
      if (a.fuse <= 0 && m.onGround) burst(m, a, ctx);
    }
    a.hugging = false;
    if (!m.gibbed) stepUnit(m, NO_INTENT, ctx.map, t, ctx.time);
    return;
  }
  a.attack += t;
  if (a.hugging) {
    if (p) hugging(m, a, ctx, p, t);
    else a.hugging = false;
    return;
  }
  look(m, a, ctx, t);
  // Alien.Update: alert, it sends the mooks around it running
  if (a.alerted && (a.panic -= t) < 0) {
    a.panic = ALIEN.panicEvery;
    ctx.panicMooks(m.x, m.y, ALIEN.panicRange);
  }
  if (m.kind === 'alien_mosquito') {
    if (a.alerted && p) mosquito(m, a, ctx, p, t);
    else stepUnit(m, wander(m, a, ctx, t), ctx.map, t, ctx.time);
    return;
  }
  let intent: MoveIntent;
  if (!a.alerted || !p) intent = wander(m, a, ctx, t);
  else if (m.kind === 'alien_hugger' || m.kind === 'alien_snake') intent = hugger(m, a, ctx, p, t);
  else if (m.kind === 'alien_melter') intent = melter(m, a, ctx, p);
  else if (m.kind === 'alien_brute') intent = brute(m, a, ctx, p, t);
  else {
    intent = chase(m, ctx, p, ctx.speeds.aware);
    claw(m, a, ctx, p);
  }
  if (a.burst) return;
  stepUnit(m, intent, ctx.map, t, ctx.time);
}
