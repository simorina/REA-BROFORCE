import { makeAiState } from './ai';
import { FIRE_START_LIMIT, GIB_THRESHOLD } from './constants';
import type { Team, Unit, UnitKind, UnitStats } from './types';

export function makeUnit(id: number, kind: UnitKind, team: Team, x: number, y: number, stats: UnitStats): Unit {
  return {
    id, kind, team, x, y, xI: 0, yI: 0, xIBlast: 0,
    facing: team === 'player' ? 1 : -1,
    health: stats.health, stats,
    onGround: false, lastGroundedTime: -Infinity,
    wallClimbing: false, climbTimer: 0, jumpTime: 0, jumpBuffer: 0, dashing: false,
    fireCooldown: 0, fireCounter: 0, fireDelay: 0, wasFire: false, invulnerable: 0, ducking: false, special2: -1, blindTime: 0,
    burnTime: 0, burnDamage: 0, burnCounter: 0, waveTime: 0, exitDoor: null, originDoor: -1, flex: null, attack: null, attackRow: 0,
    dead: false, deadTime: 0, gibbed: false, reported: { death: false, gib: false }, animTime: 0,
    ai: team === 'enemy' ? makeAiState(id) : null,
  };
}

/**
 * TestVanDammeAnim.Damage: invulnerable units take nothing; corpses keep taking damage, and a unit
 * whose health falls below gibThreshold is gibbed. Returns true when this damage killed the unit.
 */
export function damageUnit(u: Unit, amount: number, ignoreInvulnerable = false): boolean {
  if (amount <= 0 || (u.invulnerable > 0 && !ignoreInvulnerable) || u.gibbed) return false;
  u.health -= amount;
  if (u.health < GIB_THRESHOLD) u.gibbed = true;
  if (u.dead || u.health > 0) return false;
  u.dead = true;
  u.deadTime = 0;
  u.wallClimbing = false;
  return true;
}

/** TestVanDammeAnim.Knock: half the push goes to xI and half to xIBlast; heroes fly up less. */
export function knock(u: Unit, kx: number, ky: number): void {
  u.xI = Math.max(-200, Math.min(200, u.xI + kx / 2));
  u.xIBlast = Math.max(-200, Math.min(200, u.xIBlast + kx / 2));
  u.yI = Math.min(u.team === 'player' ? 300 : 400, u.yI + ky);
  u.onGround = false;
}

/** TestVanDammeAnim.StartFiring + RunFiring: true on the steps that fire a shot while the trigger is held. */
export function runFiring(u: Unit, fire: boolean, t: number): boolean {
  if (fire && !u.wasFire && u.fireDelay <= 0) u.fireCounter = u.stats.fireRate < FIRE_START_LIMIT ? u.stats.fireRate : 0;
  u.wasFire = fire;
  u.fireDelay -= t;
  if (!fire || u.fireDelay > 0) return false;
  u.fireCounter += t;
  if (u.fireCounter < u.stats.fireRate) return false;
  u.fireCounter -= u.stats.fireRate;
  return true;
}
