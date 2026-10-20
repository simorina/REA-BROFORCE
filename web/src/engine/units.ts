import { makeAiState } from './ai';
import { BRUISER, DOLPH, FIRE_START_LIMIT, HELL_BIGGUY, JETPACK, GIB_THRESHOLD, GUN_FRAME_RATE, SHIELD, UNIT_BOX_HEIGHT, UNIT_WIDTH } from './constants';
import { armourStops, isHellBigGuy } from './hell';
import { soakDolph } from './dolph';
import type { JetpackState, Team, Unit, UnitKind, UnitStats } from './types';

export function makeUnit(id: number, kind: UnitKind, team: Team, x: number, y: number, stats: UnitStats): Unit {
  return {
    id, kind, team, x, y, xI: 0, yI: 0, xIBlast: 0,
    facing: team === 'player' ? 1 : -1,
    health: stats.health, stats,
    onGround: false, lastGroundedTime: -Infinity,
    wallClimbing: false, climbTimer: 0, jumpTime: 0, jumpBuffer: 0, dashing: false,
    fireCooldown: 0, fireCounter: 0, fireDelay: 0, wasFire: false, invulnerable: 0, ducking: false, special2: -1, blindTime: 0,
    burnTime: 0, burnDamage: 0, burnCounter: 0, waveTime: 0, exitDoor: null, originDoor: -1, flex: null, attack: null, attackRow: 0,
    burstLeft: 0, burstCounter: 0, gunFrame: 0, gunCounter: 0,
    dead: false, deadTime: 0, gibbed: false, reported: { death: false, gib: false }, animTime: 0,
    ai: team === 'enemy' ? makeAiState(id) : null,
    boss: null,
    shield: kind === 'mook_shield' ? SHIELD.points : 0,
    jet: kind === 'mook_jetpack' || kind === 'mook_jetpack_bazooka' ? makeJetpack(y) : null,
    landYI: 0, getUp: 0, hasJumped: false,
  };
}

/**
 * TestVanDammeAnim.Damage: invulnerable units take nothing; corpses keep taking damage, and a unit
 * whose health falls below gibThreshold is gibbed. Returns true when this damage killed the unit.
 */
/** MookJetpack.Start: its hover 48 over the ground it stands on. */
export function makeJetpack(groundY: number, crashDelay = 0.5): JetpackState {
  return {
    on: false, height: groundY + JETPACK.height, delay: JETPACK.delay, crash: -1, crashDelay, spiral: false, spiralTime: 0,
    fuse: -1, exploded: false, flameCounter: 0,
  };
}

/** MookBigGuy and what derives from it: heavy, and stumbling under big hits. */
export const isBigGuy = (kind: string): boolean =>
  kind === 'mook_bruiser' || kind === 'mook_bruiser_elite' || kind === 'hell_bigguy' || kind === 'hell_armoured';

/** Which way the hit was travelling (for the armoured hell Bruiser's front) and whether it was fire. */
export interface HitInfo {
  dir?: number;
  fire?: boolean;
}

export function damageUnit(u: Unit, amount: number, ignoreInvulnerable = false, hit: HitInfo = {}): boolean {
  if (amount <= 0 || (u.invulnerable > 0 && !ignoreInvulnerable) || u.gibbed) return false;
  if (armourStops(u, amount, hit.dir ?? 0, !!hit.fire)) return false;
  if (u.boss?.flees) { // the island's boss, with his Goliath still to come, can't die here: he runs (boss.ts)
    u.health = Math.max(0, u.health - amount);
    return false;
  }
  if (u.dolph) amount = soakDolph(u, amount); // his bonus health soaks it up first
  u.health -= amount;
  if (u.health < GIB_THRESHOLD && !u.dolph) u.gibbed = true; // canGib: never the universal soldier
  if (u.hell) {
    u.hell.hurt = true;
    // MookHellBigGuy.Damage: a hit over 7 stuns him
    if (isHellBigGuy(u.kind) && amount > HELL_BIGGUY.stunDamage && u.health > 0) u.hell.stun = HELL_BIGGUY.stun;
  }
  // MookBigGuy.Damage: a hit when he is down to half, or a big one, makes the Bruiser stumble and hold his fire
  if (isBigGuy(u.kind) && u.health > 0 && !ignoreInvulnerable && (u.health <= u.stats.health / 2 || amount >= BRUISER.stumbleDamage)) {
    u.fireDelay = Math.max(u.fireDelay, BRUISER.stumble);
  }
  // MookJetpack.Damage: a hit that leaves it alive wrecks the jetpack (in the game, a hit in the back or fire); it
  // sputters, then spirals down to a crash
  const j = u.jet;
  if (j && u.health > 0 && !j.exploded && !j.spiral && j.crash < 0) {
    j.on = false;
    j.crash = u.onGround ? j.crashDelay : j.crashDelay * JETPACK.airCrashM;
  }
  if (u.dead || u.health > 0) return false;
  u.dead = true;
  u.deadTime = 0;
  u.wallClimbing = false;
  return true;
}

/** TestVanDammeAnim.RunGun: after a shot the gun shows its muzzle frames 3, 2, 1 for 0.0334 s each. */
export function runGun(u: Unit, t: number): void {
  if (u.gunFrame <= 0) return;
  u.gunCounter += t;
  if (u.gunCounter > GUN_FRAME_RATE) {
    u.gunCounter -= GUN_FRAME_RATE;
    u.gunFrame--;
  }
}

/** TestVanDammeAnim.Knock: half the push goes to xI and half to xIBlast; heroes fly up less. */
export function knock(u: Unit, kx: number, ky: number): void {
  if (u.dolph) { // DolphLundrenSoldier.Knock: barely; lifted only when he is down
    u.xIBlast = Math.max(-DOLPH.blastMax, Math.min(DOLPH.blastMax, u.xIBlast + kx / 2));
    if (u.health <= 0) {
      u.yI = Math.min(DOLPH.liftMax, u.yI + ky / DOLPH.liftM);
      if (u.yI > 0) u.onGround = false;
    }
    return;
  }
  if (isBigGuy(u.kind)) { // MookBigGuy.Knock: he is heavy
    const b = BRUISER;
    u.xI = Math.max(-b.knockMax, Math.min(b.knockMax, u.xI + kx / b.knockX));
    u.xIBlast = Math.max(-b.blastMax, Math.min(b.blastMax, u.xIBlast + kx / 2));
    u.yI = Math.min(b.liftMax, u.yI + ky / b.liftM);
    if (u.yI > 0) u.onGround = false;
    return;
  }
  u.xI = Math.max(-200, Math.min(200, u.xI + kx / 2));
  u.xIBlast = Math.max(-200, Math.min(200, u.xIBlast + kx / 2));
  u.yI = Math.min(u.team === 'player' ? 300 : 400, u.yI + ky);
  u.onGround = false;
}

/** TestVanDammeAnim.StartFiring + RunFiring: true on the steps that fire a shot while the trigger is held. */
export function runFiring(u: Unit, fire: boolean, t: number, fireRate = u.stats.fireRate): boolean {
  if (fire && !u.wasFire && u.fireDelay <= 0) u.fireCounter = fireRate < FIRE_START_LIMIT ? fireRate : 0;
  u.wasFire = fire;
  u.fireDelay -= t;
  if (!fire || u.fireDelay > 0) return false;
  u.fireCounter += t;
  if (u.fireCounter < fireRate) return false;
  u.fireCounter -= fireRate;
  return true;
}

/** Map.HitUnits' box test (the one Map.AlertNearbyMooks uses too). */
export function inHitBox(u: Unit, x: number, y: number, range: number): boolean {
  return Math.abs(u.x - x) - range < UNIT_WIDTH && Math.abs(u.y + UNIT_BOX_HEIGHT / 2 + 3 - y) - range < UNIT_BOX_HEIGHT;
}
