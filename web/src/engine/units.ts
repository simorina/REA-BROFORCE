import type { Team, Unit, UnitKind, UnitStats } from './types';

export function makeUnit(id: number, kind: UnitKind, team: Team, x: number, y: number, stats: UnitStats): Unit {
  return {
    id, kind, team, x, y, xI: 0, yI: 0,
    facing: team === 'player' ? 1 : -1,
    health: stats.health, stats,
    onGround: false, lastGroundedTime: -Infinity,
    wallClimbing: false, climbTimer: 0, jumpTime: 0, jumpBuffer: 0, dashing: false,
    fireCooldown: 0, dead: false, deadTime: 0, animTime: 0,
    ai: team === 'enemy'
      ? { mode: 'idle', reaction: 0, burstLeft: 0, cooldown: 0, fuse: 0, patrolTimer: 2, lostSight: 0 }
      : null,
  };
}

/** Returns true when this damage killed the unit. */
export function damageUnit(u: Unit, amount: number): boolean {
  if (u.dead || amount <= 0) return false;
  u.health -= amount;
  if (u.health > 0) return false;
  u.dead = true;
  u.deadTime = 0;
  u.wallClimbing = false;
  return true;
}

export function knock(u: Unit, kx: number, ky: number): void {
  u.xI += kx;
  u.yI += ky;
  u.onGround = false;
}
