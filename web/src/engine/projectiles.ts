import {
  AIRSTRIKE_FUSE, AIRSTRIKE_ROCKETS, AIRSTRIKE_SPEED_MIN, AIRSTRIKE_SPEED_RAND, AIRSTRIKE_THROW,
  AIRSTRIKE_THROW_DUCK, AIRSTRIKE_X_OFFSET, BAZOOKA_ROCKET_SPEED, FOOTBALL, GRAVITY, MOOK_BULLET_SPEED,
  TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, rocketBlast, type Blast } from './explosions';
import { TileMap, getColumn, getRow } from './map';
import { damageUnit } from './units';
import type { BlockKind, GameStats, Projectile, ProjectileKind, RocketStats, Team, Unit } from './types';

export type ProjectileEvent =
  | { type: 'explode'; blast: Blast }
  | { type: 'airstrike'; x: number; y: number }
  | { type: 'block'; c: number; r: number; kind: BlockKind; damage: number }
  | { type: 'hit'; unit: Unit; x: number; y: number; xI: number; yI: number };

export interface ProjectileWorld {
  map: TileMap;
  units: readonly Unit[];
  stats: GameStats;
}

const HIT_MARGIN = 2;
const FOOTBALL_BLAST: RocketStats = {
  damage: FOOTBALL.damage, range: FOOTBALL.range, blastForce: FOOTBALL.blastForce,
  blastForceExtraY: FOOTBALL.blastForceExtraY, life: FOOTBALL.fuse,
};

function make(id: number, kind: ProjectileKind, team: Team, x: number, y: number, xI: number, yI: number, life: number): Projectile {
  return { id, kind, team, x, y, xI, yI, life, bounces: 0, dead: false };
}

/** Mook.UseFire: from (x + facing * 10, y + 8) at 250, with a small random vertical spread. */
export function fireMookBullet(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'bullet', m.team, m.x + m.facing * 10, m.y + 8, m.facing * MOOK_BULLET_SPEED,
    (Math.floor(rng() * 4) - 2) * 0.2, stats.bullet.life);
}

/** MookBazooka.UseFire: from (x + facing * 12, y + 8) at 100. Homing (RocketSeeking) is not ported. */
export function fireBazookaRocket(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'rocket', m.team, m.x + m.facing * 12, m.y + 8, m.facing * BAZOOKA_ROCKET_SPEED,
    (Math.floor(rng() * 4) - 2) * 0.2, stats.rocketMook.life);
}

export function kickFootball(id: number, u: Unit): Projectile {
  return make(id, 'football', u.team, u.x + u.facing * 8, u.y + 8, u.facing * FOOTBALL.kickX, FOOTBALL.kickY, FOOTBALL.fuse);
}

/** BroBase.UseSpecial: the airstrike grenade; ducking lobs it short. */
export function throwMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = ducking ? AIRSTRIKE_THROW_DUCK : AIRSTRIKE_THROW;
  return make(id, 'marker', u.team, u.x + u.facing * p.ox, u.y + p.oy, u.facing * p.x, p.y, AIRSTRIKE_FUSE);
}

/** GrenadeAirstrike.Death: five bombs from the upper left at 45°, landing from x - 60 to x + 100. */
export function spawnAirstrike(nextId: () => number, x: number, y: number, screenMaxY: number, stats: GameStats, rng: () => number): Projectile[] {
  const h = Math.max(0, screenMaxY - y); // SortOfFollow.GetScreenMaxY() - Y
  return AIRSTRIKE_ROCKETS.map((offset) => {
    const v = AIRSTRIKE_SPEED_MIN + rng() * AIRSTRIKE_SPEED_RAND;
    return make(nextId(), 'bomb', 'player', x - AIRSTRIKE_X_OFFSET - h, y + offset + h, v, -v, stats.bomb.life);
  });
}

/** The first live unit of another team at (x, y). Invulnerable units let shots through (Map.HitUnits). */
export function unitAt(units: readonly Unit[], x: number, y: number, notTeam: Team): Unit | null {
  for (const u of units) {
    if (u.dead || u.team === notTeam || u.invulnerable > 0) continue;
    if (Math.abs(x - u.x) <= UNIT_HALF_WIDTH + HIT_MARGIN && y >= u.y - HIT_MARGIN && y <= u.y + UNIT_HEIGHT + HIT_MARGIN) {
      return u;
    }
  }
  return null;
}

function hitBlock(p: Projectile, w: ProjectileWorld, damage: number, events: ProjectileEvent[]): void {
  const c = getColumn(p.x);
  const r = getRow(p.y);
  const kind = w.map.damage(c, r, damage);
  if (kind) events.push({ type: 'block', c, r, kind, damage });
  if (kind === 'barrel') events.push({ type: 'explode', blast: barrelBlast(c * TILE, r * TILE, w.stats.barrelRange) });
}

function bounce(p: Projectile, map: TileMap, t: number, bounceM: number, frictionM: number): void {
  p.yI -= GRAVITY * t;
  if (map.blockAt(p.x + p.xI * t, p.y)) {
    p.xI = -p.xI * bounceM;
    p.bounces++;
  } else {
    p.x += p.xI * t;
  }
  if (map.blockAt(p.x, p.y + p.yI * t)) {
    p.yI = -p.yI * bounceM;
    p.xI *= frictionM;
    p.bounces++;
  } else {
    p.y += p.yI * t;
  }
}

function explodeAt(p: Projectile, stats: RocketStats, big: boolean, events: ProjectileEvent[]): void {
  p.dead = true;
  const source = p.kind === 'football' ? 'football' : p.kind === 'bomb' ? 'bomb' : 'rocket';
  events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, stats, p.team, big, source) });
}

export function stepProjectile(p: Projectile, w: ProjectileWorld, t: number): ProjectileEvent[] {
  const events: ProjectileEvent[] = [];
  if (p.dead) return events;
  p.life -= t;
  switch (p.kind) {
    case 'bullet': {
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y)) {
        hitBlock(p, w, w.stats.bullet.damage, events);
        p.dead = true;
        break;
      }
      const target = unitAt(w.units, p.x, p.y, p.team);
      if (target) {
        damageUnit(target, w.stats.bullet.damage);
        events.push({ type: 'hit', unit: target, x: p.x, y: p.y, xI: p.xI, yI: p.yI });
        p.dead = true;
      } else if (p.life <= 0) {
        p.dead = true;
      }
      break;
    }
    case 'rocket':
    case 'bomb': {
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || unitAt(w.units, p.x, p.y, p.team) || p.life <= 0) {
        explodeAt(p, p.kind === 'rocket' ? w.stats.rocketMook : w.stats.bomb, true, events);
      }
      break;
    }
    case 'football': {
      if (w.map.blockAt(p.x, p.y)) {
        // kicked point-blank into a wall: blow up against it rather than bouncing out behind the bro
        explodeAt(p, FOOTBALL_BLAST, false, events);
        break;
      }
      bounce(p, w.map, t, FOOTBALL.bounceM, FOOTBALL.frictionM);
      if (unitAt(w.units, p.x, p.y, p.team) || p.bounces > FOOTBALL.maxBounces || p.life <= 0) {
        explodeAt(p, FOOTBALL_BLAST, false, events);
      }
      break;
    }
    case 'marker': {
      bounce(p, w.map, t, w.stats.marker.bounceM, w.stats.marker.frictionM);
      if (p.life <= 0) {
        p.dead = true;
        events.push({ type: 'airstrike', x: p.x, y: p.y });
      }
      break;
    }
  }
  return events;
}
