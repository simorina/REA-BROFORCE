import { isVisible } from './camera';
import { DOLPH, GRENADE_FUSE, TILE } from './constants';
import type { Blast } from './explosions';
import { getColumn, getRow } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import { fireDrunkRocket } from './projectiles';
import type { Unit } from './types';
import { runFiring, runGun } from './units';
import type { World } from './world';

/** The universal soldier's mind: DolfLundgrenAI's queue, as the soldier runs it. */
export type DolphAction =
  | { type: 'wait'; t: number }
  | { type: 'face'; x: number }
  | { type: 'move'; x: number; t: number }
  | { type: 'fire'; t: number }
  | { type: 'grenade'; t: number }
  | { type: 'superJump'; c: number; r: number; t: number };

/** DolphLundrenSoldier and DolfLundgrenAI's state. */
export interface DolphState {
  alerted: boolean;
  queue: DolphAction[];
  centerX: number; // DolfLundgrenAI.centerX: where he holds his ground
  revives: number; // reviveCount
  downTime: number; // deathDownTime
  reviveTime: number; // getting up
  bonus: number; // bonusHealth
  pressure: number; // damagePressure
  moveCount: number;
  moveBack: number; // possibleMoveBackCount
  siegeFrame: number; // the launcher's siege mode, 0-3
  siegeCounter: number;
  beep: number;
  charge: number; // jumpChargeCounter, -1 when not charging
  jumping: { c: number; r: number } | null; // superJumping: the cell he leaps for
  crouch: number; // crouchTime after a hard landing
  defeated: boolean; // ours: down for good
  thrown: boolean; // hasReachApex
  thrownGrenade: boolean;
}

export function makeDolphState(x: number): DolphState {
  return {
    alerted: false, queue: [], centerX: x, revives: 0, downTime: 0, reviveTime: 0, bonus: 0, pressure: 0, moveCount: 0, moveBack: 0,
    siegeFrame: 0, siegeCounter: 0, beep: 0, charge: -1, jumping: null, crouch: 0, defeated: false, thrown: false, thrownGrenade: false,
  };
}

/** DolphLundrenSoldier.Damage: what his bonus health soaks up never reaches his health; DolfLundgrenAI.AddDamagePressure. */
export function soakDolph(m: Unit, amount: number): number {
  const d = m.dolph;
  if (!d) return amount;
  if (d.bonus > amount) {
    d.bonus -= amount;
    amount = 0;
  }
  d.pressure += amount;
  return amount;
}

const playerOf = (w: World): Unit | null => (w.player.dead ? null : w.player);
const near = (m: Unit, p: Unit | null, rx: number, ry: number): boolean => p !== null && Math.abs(p.x - m.x) < rx && Math.abs(p.y - m.y) < ry;
const blocked = (w: World, x: number, y: number, dir: number, reach: number): boolean => w.map.rayBlocked(x, y, x + dir * reach, y);
/** CanGoTo: there is ground somewhere under x (a ray from high above). */
const groundAt = (w: World, x: number): boolean => {
  const c = getColumn(x);
  for (let r = 0; r < w.map.rows; r++) if (w.map.get(c, r)) return true;
  return false;
};

/** DolfLundgrenAI.Revived: a wait, his centre 92 further on, and a super jump to it (to safety). */
function revived(m: Unit, d: DolphState): void {
  d.revives++;
  d.queue = [{ type: 'wait', t: 1 }];
  const next = Math.floor(m.x / TILE) * TILE + DOLPH.reviveStep;
  d.centerX = next > d.centerX ? next : d.centerX + DOLPH.reviveStep;
  d.queue.push({ type: 'superJump', c: getColumn(d.centerX), r: getRow(m.y) + DOLPH.safetyRows, t: 4 });
}

/**
 * DolfLundgrenAI.DoAlertedThink: out of sight he waits; the bro close (36), 55% of the time a super jump; facing away,
 * a turn; 50% with 50 clear ahead, a grenade; 60%, his rocket launcher for attackTime; otherwise a walk about his centre
 * (64 and 32 either side), stepping it back 96 when the bro is near or the hits pile up (32).
 */
function think(w: World, m: Unit, d: DolphState): void {
  const p = playerOf(w);
  const rng = w.rng;
  const s = w.stats.ai.mook_dolph;
  const wait = (): DolphAction => ({ type: 'wait', t: DOLPH.waitMin + rng() * (DOLPH.waitMax - DOLPH.waitMin) });
  if (!isVisible(w.camera, m.x, m.y + 10, DOLPH.visible, DOLPH.visible)) {
    d.queue.push({ type: 'wait', t: 0.3 });
  } else if (rng() < DOLPH.jumpChance && near(m, p, DOLPH.tooClose, DOLPH.tooClose)) {
    const c = getColumn(m.x) + (rng() < 0.8 ? 0 : groundAt(w, m.x - 32) && rng() < 0.8 ? -1 : 1);
    d.queue.push({ type: 'superJump', c, r: getRow(m.y) + DOLPH.closeRows, t: 2.5 });
  } else if (p && Math.sign(p.x - m.x) !== m.facing) {
    d.queue.push({ type: 'face', x: p.x }, { type: 'wait', t: 0.5 + rng() * 0.5 });
  } else if (rng() < 0.5 && !blocked(w, m.x - m.facing * 3, m.y + 6, m.facing, 50) && !blocked(w, m.x - m.facing * 3, m.y + 24, m.facing, 50)) {
    d.queue.push({ type: 'grenade', t: DOLPH.specialTime }, wait());
  } else if (rng() < 0.6) {
    d.queue.push({ type: 'fire', t: s.attackTime }, wait());
  } else {
    d.moveBack++;
    if ((d.moveBack % 2 === 1 && near(m, p, 150, 150)) || d.pressure > DOLPH.pressure) {
      if (groundAt(w, d.centerX + 176) || groundAt(w, d.centerX + 192)) d.centerX += DOLPH.backStep;
      d.pressure = 0;
    }
    d.moveCount++;
    const step = [-64, 64, -32, 32][d.moveCount % 4];
    const x = step > 0 && !groundAt(w, d.centerX + step) ? d.centerX - 16 : d.centerX + step;
    d.queue.push({ type: 'move', x, t: 3 });
  }
}

/**
 * DolphLundrenSoldier.UseFire / RunFiring: the launcher's siege mode (3 frames of 0.0667 s), half a second of beeping,
 * then a DrunkRocket every fireRate from (X + dir*17, Y + 18) at dir*160.
 */
function runSiege(w: World, m: Unit, d: DolphState, fire: boolean, t: number): void {
  if (fire && d.reviveTime <= 0) {
    if (d.siegeFrame < 3) {
      d.siegeCounter += t;
      if (d.siegeCounter > DOLPH.siegeRate) {
        d.siegeCounter -= DOLPH.siegeRate;
        if (++d.siegeFrame === 3) m.fireDelay = DOLPH.beepTime;
      }
      d.beep += t;
    } else if (m.fireDelay > 0) {
      d.beep += t;
    } else if (runFiring(m, true, t)) {
      w.projectiles.push(fireDrunkRocket(w.nextId++, m, w.stats, w.rng, DOLPH.ox, DOLPH.oy, DOLPH.speed));
      if (m.gunFrame <= 1) m.gunFrame = 3;
      w.events.push({ type: 'shot', weapon: 'rocket', x: m.x, y: m.y, facing: m.facing });
    }
  } else {
    m.wasFire = false;
    d.beep = 0;
    if (d.siegeFrame > 0 && (d.siegeCounter += t) > DOLPH.siegeRate) {
      d.siegeCounter -= DOLPH.siegeRate;
      d.siegeFrame--;
    }
  }
  m.fireDelay -= t;
}

/** DolphLundrenSoldier.UseSpecial: a GrenadeEvilMedium from (X + dir*18, Y + 22), thrown harder the further the bro. */
function throwGrenade(w: World, m: Unit): void {
  const p = playerOf(w);
  let vx = DOLPH.tossX + w.rng() * 10;
  let vy = DOLPH.tossY;
  if (p) {
    const k = Math.max(0.5, Math.min(1.5, (50 + Math.abs(p.x - m.x) * 0.7 + (p.y - m.y) * 0.33) * DOLPH.tossM));
    vx *= k;
    vy *= k;
  }
  w.projectiles.push({
    id: w.nextId++, kind: 'grenade', team: 'enemy', x: m.x + m.facing * 18, y: m.y + 22, xI: m.facing * vx, yI: vy,
    life: GRENADE_FUSE, bounces: 0, dead: false,
  });
  w.events.push({ type: 'shot', weapon: 'grenade', x: m.x, y: m.y, facing: m.facing });
}

/** DolphLundrenSoldier.MakeLandBlast: ExplodeUnits(25, Crush, 32, 20, .., 150, 90) and DamageGround(15, 56) at his feet. */
function landBlast(m: Unit): Blast {
  return {
    x: m.x, y: m.y + DOLPH.landY, groundDamage: DOLPH.landGround, groundRange: DOLPH.landGroundRange, unitDamage: DOLPH.landDamage,
    unitRange: DOLPH.landRange, killRange: DOLPH.landKill, force: DOLPH.landForce, extraY: DOLPH.landExtraY, team: 'enemy', big: true,
    noise: DOLPH.landNoise, source: 'stomp', doodadDamage: 0, doodadRange: 0, spare: m,
  };
}

/** DolfLundgrenAI.GetInput for the front action: his walk (jumping what is in the way), the super jump's charge and leap. */
function input(w: World, m: Unit, d: DolphState, t: number): { intent: MoveIntent; fire: boolean } {
  const out = { intent: { ...NO_INTENT } as MoveIntent, fire: false };
  if (d.crouch > 0) {
    d.crouch -= t;
    return out;
  }
  const a = d.queue[0];
  if (!a) return out;
  if (a.type === 'superJump') {
    if (d.charge < 0 && !d.jumping) d.charge = DOLPH.charge;
    if (d.charge > 0) {
      d.charge -= t;
      if (d.charge <= 0) d.jumping = { c: a.c, r: a.r };
      return out;
    }
    const j = d.jumping;
    if (j && getRow(m.y) < j.r && !d.thrown) {
      m.yI = DOLPH.superYI; // the leap: 440 up while he is under the row he wants
      m.onGround = false;
      if (getColumn(m.x) < j.c) out.intent.dir = 1;
      else if (getColumn(m.x) > j.c) m.xI = 0;
    } else if (j) {
      d.thrown = true; // the apex: he lets go and falls
      m.xI = 0;
    }
    return out;
  }
  if (a.type === 'move') {
    const c = getColumn(a.x);
    const dir = c < getColumn(m.x) ? -1 : c > getColumn(m.x) ? 1 : m.facing;
    out.intent.dir = dir;
    const wall = blocked(w, m.x - dir * 3, m.y + 6, dir, 16) || blocked(w, m.x - dir * 3, m.y + 18, dir, 16);
    if (wall && !blocked(w, m.x - dir * 3, m.y + 24, dir, 24) && !blocked(w, m.x - dir * 3, m.y + 36, dir, 24)) {
      out.intent.jumpPressed = out.intent.jumpHeld = m.onGround;
    }
  } else if (a.type === 'fire') {
    out.fire = true;
  }
  return out;
}

/** Runs the front action's clock and finishes it. */
function runQueue(w: World, m: Unit, d: DolphState, t: number): void {
  const a = d.queue[0];
  if (!a) return;
  if (a.type === 'face') {
    m.facing = a.x < m.x ? -1 : 1;
    d.queue.shift();
    return;
  }
  if (a.type === 'grenade' && !d.thrownGrenade && (a.t -= t) <= DOLPH.specialTime - DOLPH.tossAt) {
    d.thrownGrenade = true;
    throwGrenade(w, m);
  }
  if (a.type === 'move') {
    a.t -= t;
    if (getColumn(m.x) === getColumn(a.x) || a.t <= 0) d.queue.shift();
    return;
  }
  if (a.type === 'superJump') {
    a.t -= t;
    // UseSpecial2 lasts until its time is up and he is back on the ground
    if ((a.t <= 0 || d.thrown) && m.onGround && d.charge <= 0) {
      d.queue.shift();
      d.jumping = null;
      d.thrown = false;
      d.charge = -1;
    }
    return;
  }
  if (a.type !== 'grenade') a.t -= t;
  if (a.t <= 0) {
    d.queue.shift();
    d.thrownGrenade = false;
  }
}

/**
 * One step of the universal soldier. Knocked down (health 0) he lies there; 2 s on the ground and he gets up (1.7 s,
 * his health 120 and half again as bonus, which drains at a quarter of it a second) and jumps to safety. Ours: the third
 * time he goes down he stays down; falling off the map beats him too.
 */
export function stepDolph(w: World, m: Unit, t: number, blasts: Blast[]): void {
  const d = m.dolph!;
  if (d.defeated) return;
  d.bonus = Math.max(0, d.bonus - t * DOLPH.revive * 0.25);
  if (m.y < -64) {
    d.defeated = true;
    m.dead = true;
    return;
  }
  if (m.dead) {
    m.deadTime += t;
    stepUnit(m, NO_INTENT, w.map, t, w.time);
    if (m.onGround && (d.downTime += t) > DOLPH.down) {
      if (d.revives >= DOLPH.revives) {
        d.defeated = true;
        return;
      }
      d.downTime = 0;
      m.dead = false;
      m.reported.death = false;
      m.health = DOLPH.revive;
      d.bonus = DOLPH.revive / 2;
      d.reviveTime = DOLPH.getUp;
      d.queue = [];
      w.events.push({ type: 'alert', x: m.x, y: m.y }); // CreateWhiteFlashPop
    }
    return;
  }
  if (d.reviveTime > 0) {
    m.health = DOLPH.revive;
    if ((d.reviveTime -= t) <= 0) revived(m, d);
    stepUnit(m, NO_INTENT, w.map, t, w.time);
    return;
  }
  if (!d.alerted) {
    const p = playerOf(w);
    if (p && isVisible(w.camera, m.x, m.y + 24, -64, -16)) { // DolfLundgrenAI.LookForEnemy: any bro, once he is well on screen
      d.alerted = true;
      m.facing = p.x < m.x ? -1 : 1;
      d.queue = [{ type: 'wait', t: 2 }]; // FullyAlert: the greeting and 2 s
      w.events.push({ type: 'alert', x: m.x, y: m.y });
    }
  } else if (d.queue.length === 0) {
    think(w, m, d);
  }
  const { intent, fire } = input(w, m, d, t);
  runQueue(w, m, d, t);
  m.landYI = 0;
  stepUnit(m, intent, w.map, t, w.time);
  if (m.landYI < DOLPH.landBelow) { // DolphLundrenSoldier.Land: a hard landing shakes the ground; Crouch
    blasts.push(landBlast(m));
    d.crouch = DOLPH.crouch;
  }
  runSiege(w, m, d, fire, t);
  runGun(m, t);
}
