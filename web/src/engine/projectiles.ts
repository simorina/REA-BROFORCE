import {
  AIRSTRIKE_FUSE, AIRSTRIKE_ROCKETS, AIRSTRIKE_SPEED_MIN, AIRSTRIKE_SPEED_RAND, AIRSTRIKE_THROW,
  AIRSTRIKE_THROW_DUCK, AIRSTRIKE_X_OFFSET, BAZOOKA_ROCKET_SPEED, BRUISER, FLAME_WALL, FLAMETHROWER, FOOTBALL, CRICKET, GRAVITY, GRENADE_EXTRA_Y, GRENADE_FUSE, M60, MOLOTOV, MOLOTOV_FIRE, NEURALISER, REVOLVER, GRENADIER, GRENADIER_REACH, HEAVY_SHELL_DIP, JET_BOMB, JET_ROCKET, JUDO_THROW, SHIELD, MOOK_BULLET_SPEED, RIFLE, TANK_CANNON, TANK_ROCKET_CRUSH, TANK_SHELL,
  TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, cricketBlast, rocketBlast, shellBlast, suicideBlast, type Blast } from './explosions';
import { TileMap, getColumn, getRow } from './map';
import { damageUnit, inHitBox, knock } from './units';
import type { BlockKind, EnemyKind, FlameWall, GameStats, Projectile, ProjectileKind, RocketStats, Team, Unit } from './types';
import { vehicleAt, type Vehicle } from './vehicle';
import { mechAt, type Mech } from './mech';

export type ProjectileEvent =
  | { type: 'explode'; blast: Blast }
  | { type: 'airstrike'; x: number; y: number }
  | { type: 'block'; c: number; r: number; kind: BlockKind; damage: number }
  | { type: 'hit'; unit: Unit; x: number; y: number; xI: number; yI: number }
  | { type: 'gib'; kind: EnemyKind; x: number; y: number; xI: number; yI: number }
  | { type: 'callTank'; x: number; y: number; dir: 1 | -1 }
  | { type: 'callJet'; x: number; y: number }
  | { type: 'blind'; x: number; y: number; range: number } // Map.BlindUnits, from the Neuraliser
  | { type: 'cricketBeam'; x: number; y: number } // NoisyCricket.RunBeam's puff
  | { type: 'fire'; x: number; y: number; range: number; damage: number; xI: number } // Map.HitLivingUnits(.., Fire, ..)
  | { type: 'molotov'; x: number; y: number } // GrenadeMolotov.Death
  | { type: 'flameFx'; x: number; y: number } // a little fire's flames
  | { type: 'callNuke'; x: number; y: number }
  | { type: 'hitVehicle'; vehicle: Vehicle; damage: number }
  | { type: 'hitMech'; damage: number }
  | { type: 'shieldHit'; unit: Unit; x: number; y: number; broke: boolean }
  | { type: 'scorch'; x: number; y: number; range: number; damage: number; xI: number } // Map.HitUnits(.., Fire, ..): mooks catch fire
  | { type: 'quench'; x: number; y: number; range: number } // Map.HitProjectiles(.., Fire, ..): the shots around go out
  | { type: 'flameWallPuff'; x: number; y: number; variant: number; delay: number; dir: 1 | -1; xI: number }
  | { type: 'wallShake'; x: number; y: number }; // FlameWallExplosion.RunPoints: SortOfFollow.Shake(0.2)

export interface ProjectileWorld {
  map: TileMap;
  units: readonly Unit[];
  stats: GameStats;
  vehicles?: readonly Vehicle[];
  mech?: Mech | null; // Epstein's Goliath: the bro's shots stop on it
  rng?: () => number; // the world's: which flame puffs, and when
}

const hitsMech = (w: ProjectileWorld, p: Projectile): boolean => p.team === 'player' && mechAt(w.mech, p.x, p.y);
const struck = (w: ProjectileWorld, p: Projectile): boolean => unitAt(w.units, p.x, p.y, p.team) !== null || hitsMech(w, p);

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

/** MookBigGuy.UseFire / FireWeapon: a Bullet MookMiniGun from (X + dir*17, Y + 9) at dir*400, from 15 down to 29 up. */
export function fireMinigunBullet(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'minigun', m.team, m.x + m.facing * BRUISER.ox, m.y + BRUISER.oy, m.facing * BRUISER.speed,
    Math.floor(rng() * BRUISER.spreadCount) + BRUISER.spreadFrom, stats.minigun.life);
}

/** MookBazooka.UseFire: from (x + facing * 12, y + 8) at 100. Homing (RocketSeeking) is not ported. */
export function fireBazookaRocket(id: number, m: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'rocket', m.team, m.x + m.facing * 12, m.y + 8, m.facing * BAZOOKA_ROCKET_SPEED,
    (Math.floor(rng() * 4) - 2) * 0.2, stats.rocketMook.life);
}

/** BroniversalSoldier.FireWeapon: from (X + dir*14, Y + 8.5) at dir*420, ySpeed -10 + random*20. */
export function fireRifleBullet(id: number, u: Unit, stats: GameStats, rng: () => number): Projectile {
  return make(id, 'rifle', u.team, u.x + u.facing * RIFLE.ox, u.y + RIFLE.oy, u.facing * RIFLE.speed,
    -RIFLE.jitter + rng() * RIFLE.jitter * 2, stats.rifle.life);
}

/** A bullet aimed at (tx, ty) from (X + dir*10, Y + 8), within maxAim of level (the boss's; mooks fire level). */
export function fireAimedBullet(id: number, u: Unit, tx: number, ty: number, speed: number, maxAim: number,
  stats: GameStats): Projectile {
  return fireFrom(id, 'bullet', u.team, u.x + u.facing * 10, u.y + 8, u.facing, tx, ty, speed, maxAim, stats.bullet.life);
}

/** A shot from (ox, oy) the way `facing` points, aimed at (tx, ty) within maxAim of level. */
export function fireFrom(id: number, kind: ProjectileKind, team: Team, ox: number, oy: number, facing: 1 | -1, tx: number,
  ty: number, speed: number, maxAim: number, life: number): Projectile {
  const a = Math.max(-maxAim, Math.min(maxAim, Math.atan2(ty - oy, Math.abs(tx - ox))));
  return make(id, kind, team, ox, oy, facing * Math.cos(a) * speed, Math.sin(a) * speed, life);
}

/** A rocket falling straight down from above the screen, the enemy's (the Goliath's RocketBombardment). */
export function skyRocket(id: number, x: number, y: number, speed: number, stats: GameStats): Projectile {
  return make(id, 'bomb', 'enemy', x, y, 0, -speed, stats.bomb.life);
}

/** MookGrenadier.AnimateThrowingHeldObject: from (X + dir*8, Y + 24) at (dir*130, 130), faster for a bro further off. */
export function throwGrenade(id: number, m: Unit, tx: number): Projectile {
  const f = Math.min(1.5, Math.max(0.5, Math.abs(tx - m.x) / GRENADIER_REACH));
  return make(id, 'grenade', m.team, m.x + m.facing * GRENADIER.ox, m.y + GRENADIER.oy, m.facing * GRENADIER.x * f,
    GRENADIER.y * f, GRENADE_FUSE);
}

/** MookGrenadier.DropDeathGrenade: from (X, Y + 4) at (xI * 0.3, yI * 0.5) over its weight of 2, plus 110 up. */
export function dropGrenade(id: number, m: Unit): Projectile {
  return make(id, 'grenade', m.team, m.x, m.y + 4, m.xI * 0.15, m.yI * 0.25 + 110, GRENADE_FUSE);
}

export function kickFootball(id: number, u: Unit): Projectile {
  return make(id, 'football', u.team, u.x + u.facing * 8, u.y + 8, u.facing * FOOTBALL.kickX, FOOTBALL.kickY, FOOTBALL.fuse);
}

/** BroBase.UseSpecial: the airstrike grenade; ducking lobs it short. */
export function throwMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = ducking ? AIRSTRIKE_THROW_DUCK : AIRSTRIKE_THROW;
  return make(id, 'marker', u.team, u.x + u.facing * p.ox, u.y + p.oy, u.facing * p.x, p.y, AIRSTRIKE_FUSE);
}

/** TankBro's signal grenade: the airstrike grenade with callInTank set (GrenadeAirstrike.Death -> SpawnTank). */
export function throwTankMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = throwMarker(id, u, ducking);
  p.call = 'tank';
  return p;
}

/** Trump's signal grenade: the airstrike grenade calling in his jet. */
export function throwJetMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = throwMarker(id, u, ducking);
  p.call = 'jet';
  return p;
}

/** Brononymous.UseSpecial: the Neuraliser, at (X + dir * 4, Y + height + 3); its beam grows from there. */
export function useNeuraliser(id: number, u: Unit, _ducking: boolean): Projectile {
  const x = u.x + u.facing * NEURALISER.ox;
  const p = make(id, 'neuraliser', u.team, x, u.y + NEURALISER.oy, 0, 0, 0);
  p.beam = {
    startX: x, dir: u.facing, started: false, growing: true, growDelay: 0, steps: 0, flash: NEURALISER.flash, flicker: 0,
  };
  return p;
}

/** Blade's spinning silver glaive: high-velocity piercing boomerang blade. */
export function throwGlaive(id: number, u: Unit, ducking: boolean): Projectile {
  return make(id, 'football', u.team, u.x + u.facing * 10, u.y + 8, u.facing * 340, ducking ? 50 : 130, 2.0);
}

/** Kim Jong-un's tactical ICBM target beacon: calls a nuclear missile from the stratosphere. */
export function throwNukeMarker(id: number, u: Unit, ducking: boolean): Projectile {
  const p = throwMarker(id, u, ducking);
  p.call = 'nuke';
  p.life = 0.9;
  return p;
}

/** Rambro's M60 (TestVanDammeAnim.UseFire / FireWeapon): Bullet Rambo, the rifle's bullet. */
export function fireM60Bullet(id: number, u: Unit, stats: GameStats, rng: () => number): Projectile {
  const yI = Math.floor(rng() * M60.jitter * 2) - M60.jitter; // Random.Range(-20, 20): an int, 20 excluded
  return make(id, 'rifle', u.team, u.x + u.facing * M60.ox, u.y + M60.oy, u.facing * M60.speed, yI, stats.rifle.life);
}

/** BroBase.UseSpecial with a GrenadeMolotov: thrown like the airstrike grenade. */
export function throwMolotov(id: number, u: Unit, ducking: boolean): Projectile {
  const p = ducking ? AIRSTRIKE_THROW_DUCK : AIRSTRIKE_THROW;
  return make(id, 'molotov', u.team, u.x + u.facing * p.ox, u.y + p.oy, u.facing * p.x, p.y, MOLOTOV.fuse);
}

/** BaBroracus.UseFire / FireWeapon: two flames, each one of FlameThrower Bullet 1-3 at random, on top of her own speed. */
export function fireFlames(nextId: () => number, u: Unit, stats: GameStats, rng: () => number): Projectile[] {
  return FLAMETHROWER.shots.map((s) => {
    const yI = rng() * s.spread * 2 - s.spread;
    const p = make(nextId(), 'flame', u.team, u.x + u.facing * FLAMETHROWER.ox, u.y + s.oy, u.facing * s.speed + u.xI, yI, stats.flame.life);
    p.variant = Math.min(FLAMETHROWER.variants - 1, Math.floor(rng() * FLAMETHROWER.variants));
    return p;
  });
}

/** EllenRipbro.UseSpecial: a FlameWallExplosion from (X + dir*5, Y + 9), spreading the way she faces. */
export function makeFlameWall(id: number, u: Unit): Projectile {
  const p = make(id, 'flameWall', u.team, u.x + u.facing * FLAME_WALL.ox, u.y + FLAME_WALL.oy, 0, 0, Infinity);
  p.wall = {
    col: getColumn(p.x), row: getRow(p.y), dir: u.facing, started: false, minC: 0, maxC: 0, minR: 0, maxR: 0,
    points: [], used: new Set(), counter: 0, left: 0, time: 0, maxTime: 0,
  };
  return p;
}

/** GrenadeMolotov.Death: four little fires from (X, Y + 2), up and around (Point3OnCircle), at 210-260. */
export function molotovFlames(nextId: () => number, x: number, y: number, stats: GameStats, rng: () => number, team: Team = 'player'): Projectile[] {
  const a0 = MOLOTOV.firstAngle - rng() * MOLOTOV.firstAngleRand;
  const angles = [a0, ...MOLOTOV.gaps.map((g) => a0 + g + rng() * MOLOTOV.gapRand)];
  return angles.map((a) => {
    const speed = MOLOTOV.speed + rng() * MOLOTOV.speedRand;
    const p = make(nextId(), 'molotovFire', team, x, y + MOLOTOV.flameY, Math.cos(a) * speed, Math.sin(a) * speed, stats.molotovFire.life);
    p.flame = { counter: 0, count: 0 };
    return p;
  });
}

/** DirtyHarry.UseFire / FireWeapon: Django's .44, from (X + dir * 14, Y + 8.5) at 750, up to 10 off level. */
export function fireRevolverBullet(id: number, u: Unit, stats: GameStats, rng: () => number): Projectile {
  const p = make(id, 'revolver', u.team, u.x + u.facing * REVOLVER.ox, u.y + REVOLVER.oy, u.facing * REVOLVER.speed,
    -REVOLVER.jitter + rng() * REVOLVER.jitter * 2, stats.revolver.life);
  p.power = stats.revolver.damage;
  p.pierced = [];
  return p;
}

/** Brononymous.UseFire: the Noisy Cricket's shot, from (X + dir * 14, Y + 9.5) at 700, living its prefab's 0.18 s. */
export function fireNoisyCricket(id: number, u: Unit, stats: GameStats): Projectile {
  const p = make(id, 'cricket', u.team, u.x + u.facing * CRICKET.ox, u.y + CRICKET.oy, u.facing * CRICKET.speed, 0, stats.cricket.life);
  p.beamX = p.x;
  return p;
}

/** Kim Jong-un's RPG rocket: straight-flying heavy ballistic missile. */
export function fireRpgRocket(id: number, u: Unit, stats: GameStats): Projectile {
  return make(id, 'rocket', u.team, u.x + u.facing * 14, u.y + 8, u.facing * 320, 0, stats.rocketMook.life);
}

interface Gun {
  x: number;
  y: number;
  facing: 1 | -1;
}

/** HarrierJet.Update: a pair of shots from (X + dir*32, Y - 5) and (X + dir*8, Y - 5) at (dir*450, -285), jittered
 *  within 12; here they are RocketBombardment rockets (the user asked for rockets). */
export function fireJetRockets(nextId: () => number, j: Gun, stats: GameStats, rng: () => number): Projectile[] {
  return JET_ROCKET.ox.map((ox) => {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * JET_ROCKET.jitter;
    return make(nextId(), 'bomb', 'player', j.x + j.facing * ox, j.y + JET_ROCKET.oy,
      j.facing * JET_ROCKET.x + Math.cos(a) * r, JET_ROCKET.y + Math.sin(a) * r, stats.bomb.life);
  });
}

/** The jet's bomb: straight down from under it, falling, with RocketBombardment's blast. */
export function dropJetBomb(id: number, j: Gun & { xI: number }, stats: GameStats): Projectile {
  return make(id, 'jetBomb', 'player', j.x, j.y + JET_BOMB.oy, j.xI, JET_BOMB.yI, stats.bomb.life);
}

/** TankBroTankTurret.FireShell: a HeavyShell from (X + dir*17, Y + 33) at (dir*150, 150) * 0.9. */
export function fireShell(id: number, k: Gun, stats: GameStats): Projectile {
  const v = TANK_SHELL.speed * TANK_SHELL.m;
  return make(id, 'shell', 'player', k.x + k.facing * TANK_SHELL.ox, k.y + TANK_SHELL.oy, k.facing * v, v, stats.tankShell.life);
}

/** TankBroTankTurret.FireCannon: a RocketMassive from (X + dir*24, Y + 22) at dir*cannonFireSpeed. */
export function fireBigRocket(id: number, k: Gun, stats: GameStats): Projectile {
  const p = make(id, 'bigRocket', 'player', k.x + k.facing * TANK_CANNON.ox, k.y + TANK_CANNON.oy,
    k.facing * stats.tank.cannonFireSpeed, 0, stats.tankRocket.life);
  p.crush = stats.tankRocket.crushLayers;
  return p;
}

/** RocketMassive.Bounce: instead of bouncing off the wall, crush it (while it has layers left). */
function crushWall(p: Projectile, w: ProjectileWorld, dir: 1 | -1, events: ProjectileEvent[]): void {
  for (const [c, r] of w.map.cellsInCircle(p.x + dir * TANK_ROCKET_CRUSH.ox, p.y, TANK_ROCKET_CRUSH.range / 2)) {
    const kind = w.map.damage(c, r, TANK_ROCKET_CRUSH.damage);
    if (kind) events.push({ type: 'block', c, r, kind, damage: TANK_ROCKET_CRUSH.damage });
    if (kind === 'barrel') events.push({ type: 'explode', blast: barrelBlast(c * TILE, r * TILE, w.stats.barrelRange) });
  }
}

/** The judo throw: the grabbed mook flies ahead as a body and blows up where it lands (our mechanic). */
export function throwBody(id: number, p: Unit, kind: EnemyKind): Projectile {
  const b = make(id, 'body', p.team, p.x + p.facing * JUDO_THROW.ox, p.y + JUDO_THROW.oy, p.facing * JUDO_THROW.x,
    JUDO_THROW.y, JUDO_THROW.fuse);
  b.body = kind;
  return b;
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
  damageBlock(w, getColumn(p.x), getRow(p.y), damage, events);
}

function damageBlock(w: ProjectileWorld, c: number, r: number, damage: number, events: ProjectileEvent[]): void {
  const kind = w.map.damage(c, r, damage);
  if (kind) events.push({ type: 'block', c, r, kind, damage });
  if (kind === 'barrel') events.push({ type: 'explode', blast: barrelBlast(c * TILE, r * TILE, w.stats.barrelRange) });
}

/** Fire on a block: earth, brick and steel don't burn; a barrel goes up. */
function burnBlock(w: ProjectileWorld, c: number, r: number, damage: number, events: ProjectileEvent[]): void {
  if (w.map.get(c, r)?.kind === 'barrel') damageBlock(w, c, r, damage, events);
}

function bounce(p: Projectile, map: TileMap, t: number, bounceM: number, frictionM: number, gravityM = 1): void {
  p.yI -= GRAVITY * gravityM * t;
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

/** Map.HitLivingUnits' test: a living, vulnerable unit of the other side within range of (x, y). */
const foeNear = (w: ProjectileWorld, p: Projectile, range: number): boolean =>
  w.units.some((u) => !u.dead && u.team !== p.team && u.invulnerable <= 0 && inHitBox(u, p.x, p.y, range));

/** A grenade falling under its gravity: where it was, and where it is now. */
function fall(p: Projectile, t: number, gravityM: number): { x: number; y: number } {
  const was = { x: p.x, y: p.y };
  p.yI -= GRAVITY * gravityM * t;
  p.x += p.xI * t;
  p.y += p.yI * t;
  return was;
}

/**
 * FlameBullet: it flies straight. Reaching mooks it sets them alight (HitUnits: Map.HitUnits(1, Fire, 8)) and goes out;
 * a wall puts it out too (Projectile.HitWall), with fire damage only a barrel minds.
 */
function stepFlame(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  p.x += p.xI * t;
  p.y += p.yI * t;
  if (w.map.blockAt(p.x, p.y)) {
    burnBlock(w, getColumn(p.x), getRow(p.y), w.stats.flame.damage, events);
    p.dead = true;
  } else if (hitsMech(w, p)) {
    events.push({ type: 'hitMech', damage: w.stats.flame.damage });
    p.dead = true;
  } else if (w.units.some((u) => !u.dead && u.team !== p.team && u.invulnerable <= 0 && inHitBox(u, p.x, p.y, FLAMETHROWER.hitRange))) {
    events.push({ type: 'scorch', x: p.x, y: p.y, range: FLAMETHROWER.hitRange, damage: w.stats.flame.damage, xI: p.xI });
    p.dead = true;
  } else if (p.life <= 0) {
    p.dead = true;
  }
}

const cellKey = (c: number, r: number) => c * 4096 + r;

/** FlameWallExplosion.Setup with a forced direction, then Start: the band it may burn, and its first cell. */
function startWall(f: FlameWall, w: ProjectileWorld): boolean {
  const s = w.stats.flameWall;
  if (f.dir > 0) {
    f.minC = f.col;
    f.maxC = Math.min(f.col + s.columns + 1, w.map.cols);
  } else {
    f.maxC = f.col + 1;
    f.minC = Math.max(0, f.col - s.columns);
  }
  f.minR = f.row;
  f.maxR = f.row + s.rows;
  f.left = s.explosions;
  f.maxTime = s.explosions * s.rate;
  if (f.col < f.minC || f.col >= f.maxC || f.row < f.minR || f.row >= f.maxR) return false;
  f.points = [{ c: f.col, r: f.row, dc: 0 }];
  return true;
}

/**
 * FlameWallExplosion.RunPoints: each burning cell spreads its way to the free cells beside it, level and a row up or
 * down (CreateFlashBangPoint takes the diagonal step with the cell's own sideways direction, so the start's column
 * fills upward), never into a cell already burnt. A cell that won't take the fire is ground: if a barrel, it goes up.
 */
function runPoints(f: FlameWall, w: ProjectileWorld, events: ProjectileEvent[]): void {
  const s = w.stats.flameWall;
  const rng = w.rng ?? (() => 0.5);
  const next: FlameWall['points'] = [];
  let spread = false;
  const create = (c: number, r: number, dc: number, dr: number) => {
    const nc = c + dc;
    const nr = r + dr;
    f.used.add(cellKey(nc, nr));
    next.push({ c: nc, r: nr, dc });
    spread = true;
    const x = nc * TILE;
    const bottom = nr * TILE - TILE / 2;
    const variant = Math.min(2, Math.floor(rng() * 3));
    events.push({ type: 'flameWallPuff', x, y: bottom + FLAME_WALL.puffY, variant, delay: rng() * s.puffDelay, dir: dc < 0 ? -1 : 1, xI: dc * FLAME_WALL.drift });
    events.push({ type: 'scorch', x, y: bottom + FLAME_WALL.hitY, range: FLAME_WALL.hitRange, damage: s.damage, xI: dc * FLAME_WALL.hitXI });
    events.push({ type: 'quench', x: c * TILE, y: r * TILE, range: FLAME_WALL.quenchRange });
    f.left--;
  };
  // the cell `side` and `dr` from p: checked there, made with p's own sideways direction for the diagonals (as in Broforce)
  const tryCell = (p: FlameWall['points'][number], side: number, dr: number) => {
    const nc = p.c + side;
    const nr = p.r + dr;
    if (f.used.has(cellKey(nc, nr))) return;
    if (!w.map.get(nc, nr)) create(p.c, p.r, dr === 0 ? side : p.dc, dr);
    else burnBlock(w, nc, nr, s.damage, events);
  };
  for (const p of f.points) {
    for (const side of [-1, 1]) {
      const allowed = side < 0
        ? p.dc <= 0 && p.c - 1 >= f.minC && f.dir !== 1
        : p.dc >= 0 && p.c + 1 < f.maxC && f.dir !== -1;
      if (!allowed) continue;
      tryCell(p, side, 0);
      if (p.r - 1 >= f.minR) tryCell(p, side, -1);
      if (p.r + 1 < f.maxR) tryCell(p, side, 1);
    }
  }
  f.points = next;
  if (spread) events.push({ type: 'wallShake', x: f.col * TILE, y: f.row * TILE });
  else f.maxTime = 0;
}

/** FlameWallExplosion: Start on its first step, then Update: a spread every explosionRate, gone when the fire is out. */
function stepFlameWall(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const f = p.wall;
  if (!f) {
    p.dead = true;
    return;
  }
  if (!f.started) {
    f.started = true;
    if (!startWall(f, w)) {
      p.dead = true;
      return;
    }
    runPoints(f, w, events);
  }
  f.time += t;
  f.counter += Math.min(t, FLAME_WALL.maxStep);
  if (f.counter >= w.stats.flameWall.rate) {
    f.counter -= w.stats.flameWall.rate;
    runPoints(f, w, events);
  }
  if (f.time > f.maxTime || f.left <= 0) p.dead = true;
}

/** GrenadeMolotov: it bursts on the first mook it reaches (setting him alight) or the first thing it hits. */
function stepMolotov(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const was = fall(p, t, w.stats.molotov.gravityM);
  if (foeNear(w, p, MOLOTOV.touch)) {
    events.push({ type: 'fire', x: p.x, y: p.y, range: MOLOTOV.touch, damage: MOLOTOV.touchDamage, xI: p.xI });
  } else if (w.map.blockAt(p.x, p.y)) {
    p.x = was.x; // deathOnBounce: it bursts where it touched
    p.y = was.y;
  } else if (p.life > 0) {
    return;
  }
  p.dead = true;
  events.push({ type: 'molotov', x: p.x, y: p.y });
}

/**
 * GrenadeMolotovFire: as it flies it burns what is around it (a range of 16 every fourth tick, its flames on the
 * others); where it lands, or when its life runs out, a range of 24.
 */
function stepMolotovFire(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const was = fall(p, t, w.stats.molotovFire.gravityM);
  const f = (p.flame ??= { counter: 0, count: 0 });
  f.counter += t;
  if (f.counter > MOLOTOV_FIRE.tick) {
    f.counter -= MOLOTOV_FIRE.tickCost;
    f.count++;
    if (f.count % MOLOTOV_FIRE.every === 0) {
      events.push({ type: 'fire', x: p.x, y: p.y, range: MOLOTOV_FIRE.flyRange, damage: MOLOTOV_FIRE.flyDamage, xI: p.xI });
    } else {
      events.push({ type: 'flameFx', x: p.x, y: p.y });
    }
  }
  const landed = w.map.blockAt(p.x, p.y);
  if (!landed && p.life > 0) return;
  if (landed) {
    p.x = was.x;
    p.y = was.y;
  }
  p.dead = true;
  events.push({ type: 'fire', x: p.x, y: p.y, range: MOLOTOV_FIRE.landRange, damage: MOLOTOV_FIRE.landDamage, xI: p.xI });
}

/** MookRiotShield.Damage: a shot at his face stops on the shield, which gives way past 35. */
function shieldStops(target: Unit, p: Projectile, damage: number, events: ProjectileEvent[]): boolean {
  if (target.shield <= 0 || Math.sign(p.xI) !== -target.facing) return false;
  target.shield = Math.max(0, target.shield - damage);
  knock(target, p.xI * 0.05, SHIELD.knock);
  events.push({ type: 'shieldHit', unit: target, x: p.x, y: p.y, broke: target.shield === 0 });
  return true;
}

/**
 * BulletSnakeBroskin with Bullet DirtyBrory's values: it flies at 0.99 of real time (Update: t * 0.33, three times)
 * and goes through up to maxPenetrations units, each hit once and each for one less damage (HitUnits); a wall takes
 * its damage and stops it (Bounce), and so does a riot shield.
 */
function stepRevolver(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const s = w.stats.revolver;
  const dt = t * REVOLVER.timeScale;
  p.x += p.xI * dt;
  p.y += p.yI * dt;
  p.life += t - dt; // stepProjectile took t off
  const power = p.power ?? s.damage;
  if (w.map.blockAt(p.x, p.y)) {
    hitBlock(p, w, power, events);
    p.dead = true;
    return;
  }
  if (hitsMech(w, p)) {
    events.push({ type: 'hitMech', damage: power });
    p.dead = true;
    return;
  }
  const pierced = (p.pierced ??= []);
  const target = w.units.find((u) => !pierced.includes(u.id) && unitAt([u], p.x, p.y, p.team) !== null);
  if (target && shieldStops(target, p, power, events)) {
    p.dead = true;
  } else if (target) {
    damageUnit(target, power);
    events.push({ type: 'hit', unit: target, x: p.x, y: p.y, xI: p.xI, yI: p.yI });
    pierced.push(target.id);
    p.power = power - 1;
    if (pierced.length >= s.maxPenetrations) p.dead = true;
  } else if (p.life <= 0) {
    p.dead = true;
  }
}

/**
 * NoisyCricket.Update / RunProjectile: it flies (and its life runs) at 0.99 of real time, leaving a beam puff every
 * 16 units (RunBeam). A unit in its way takes its damage (Projectile.HitUnits; Fire sets damageInternal = damage), a wall stops it
 * (ReflectProjectile); either, or the end of its life, sets it off (MakeEffects).
 */
function stepCricket(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const s = w.stats.cricket;
  const dt = t * CRICKET.timeScale;
  p.x += p.xI * dt;
  p.life += t - dt; // stepProjectile took t off; its life runs at the same 0.99
  let beamX = p.beamX ?? p.x;
  while (Math.abs(p.x - beamX) + 7 > CRICKET.beamStep) {
    const dir = Math.sign(p.x - beamX) || 1;
    events.push({ type: 'cricketBeam', x: beamX + dir * CRICKET.beamStep / 2, y: p.y });
    beamX += dir * CRICKET.beamStep;
  }
  p.beamX = beamX;
  const target = unitAt(w.units, p.x, p.y, p.team);
  const hit = target !== null || hitsMech(w, p) || (p.team === 'enemy' && vehicleAt(w.vehicles ?? [], p.x, p.y) !== null);
  if (target) {
    damageUnit(target, s.damage);
    events.push({ type: 'hit', unit: target, x: p.x, y: p.y, xI: p.xI, yI: p.yI });
  }
  if (hit || w.map.blockAt(p.x, p.y) || p.life <= 0) {
    p.dead = true;
    events.push({ type: 'explode', blast: cricketBlast(p.x, p.y, s, p.team) });
  }
}

/** The first solid point within `reach` ahead of (x, y) along dir, or null (Physics.Raycast against the ground). */
function rayToGround(map: TileMap, x: number, y: number, dir: 1 | -1, reach: number): number | null {
  for (let d = 1; d <= reach; d++) if (map.blockAt(x + dir * d, y)) return x + dir * (d - 1);
  return null;
}

/**
 * Neuraliser.Update: the beam grows a 16-unit step every ~0.02 s, blinding a range of 24 at its tip after each step
 * (Map.BlindUnits, 9 s), until the ground stops it, it has taken 32 steps or it is 240 units out; then it flashes
 * for 0.11 s and is gone. EffectFirstUpdate blinds a range of 16 where it starts.
 */
function stepNeuraliser(p: Projectile, w: ProjectileWorld, t: number, events: ProjectileEvent[]): void {
  const b = p.beam;
  if (!b) {
    p.dead = true;
    return;
  }
  if (!b.started) {
    b.started = true;
    b.growDelay = NEURALISER.firstDelay;
    events.push({ type: 'blind', x: p.x, y: p.y, range: NEURALISER.startRange });
  }
  if (b.growing) {
    b.growDelay += t;
    const n = Math.floor(b.growDelay / NEURALISER.stepTime);
    if (n <= 0) return;
    b.growDelay -= n * NEURALISER.stepCost;
    b.flicker++;
    for (let i = 0; i < n && b.growing; i++) {
      b.steps++;
      const wall = rayToGround(w.map, p.x, p.y, b.dir, NEURALISER.step);
      if (wall !== null) {
        p.x = wall;
        b.growing = false;
      } else if (b.steps > NEURALISER.maxSteps) {
        b.growing = false;
      } else {
        p.x += b.dir * NEURALISER.step;
        if (Math.abs(p.x - b.startX) > NEURALISER.reach) b.growing = false;
      }
      events.push({ type: 'blind', x: p.x, y: p.y, range: NEURALISER.range });
    }
  } else {
    b.flicker++;
    b.flash -= t;
    if (b.flash <= 0) p.dead = true;
  }
}

function explodeAt(p: Projectile, stats: RocketStats, big: boolean, events: ProjectileEvent[]): void {
  p.dead = true;
  const source = p.kind === 'football' ? 'football' : p.kind === 'bomb' || p.kind === 'jetBomb' ? 'bomb' : 'rocket';
  events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, stats, p.team, big, source) });
}

/** A thrown suicide mook goes off with its own blast (MookSuicide.MakeEffects), now the thrower's; others pop. */
function explodeBody(p: Projectile, w: ProjectileWorld, events: ProjectileEvent[]): void {
  p.dead = true;
  const kind = p.body ?? 'mook';
  const blast = kind === 'mook_suicide'
    ? { ...suicideBlast(p.x, p.y, w.stats.suicide), team: p.team }
    : rocketBlast(p.x, p.y, FOOTBALL_BLAST, p.team, false, 'football');
  events.push({ type: 'explode', blast }, { type: 'gib', kind, x: p.x, y: p.y, xI: p.xI, yI: p.yI });
}

export function stepProjectile(p: Projectile, w: ProjectileWorld, t: number): ProjectileEvent[] {
  const events: ProjectileEvent[] = [];
  if (p.dead) return events;
  p.life -= t;
  switch (p.kind) {
    case 'bullet':
    case 'rifle':
    case 'minigun': {
      const damage = p.kind === 'rifle' ? w.stats.rifle.damage : p.kind === 'minigun' ? w.stats.minigun.damage : w.stats.bullet.damage;
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y)) {
        // MookMiniGunBullet.HitWalls: only every third of the Bruiser's bullets chips the block
        hitBlock(p, w, p.kind === 'minigun' && p.id % 3 !== 0 ? 0 : damage, events);
        p.dead = true;
        break;
      }
      if (hitsMech(w, p)) {
        events.push({ type: 'hitMech', damage });
        p.dead = true;
        break;
      }
      const vehicle = p.team === 'enemy' ? vehicleAt(w.vehicles ?? [], p.x, p.y) : null;
      if (vehicle) {
        events.push({ type: 'hitVehicle', vehicle, damage });
        p.dead = true;
        break;
      }
      const target = unitAt(w.units, p.x, p.y, p.team);
      if (target && shieldStops(target, p, damage, events)) {
        p.dead = true;
      } else if (target) {
        damageUnit(target, damage);
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
      if (w.map.blockAt(p.x, p.y) || struck(w, p) || p.life <= 0
        || (p.team === 'enemy' && vehicleAt(w.vehicles ?? [], p.x, p.y) !== null)) {
        explodeAt(p, p.kind === 'rocket' ? w.stats.rocketMook : w.stats.bomb, true, events);
      }
      break;
    }
    case 'cricket':
      stepCricket(p, w, t, events);
      break;
    case 'revolver':
      stepRevolver(p, w, t, events);
      break;
    case 'molotov':
      stepMolotov(p, w, t, events);
      break;
    case 'molotovFire':
      stepMolotovFire(p, w, t, events);
      break;
    case 'flame':
      stepFlame(p, w, t, events);
      break;
    case 'flameWall':
      stepFlameWall(p, w, t, events);
      break;
    case 'neuraliser':
      stepNeuraliser(p, w, t, events);
      break;
    case 'football': {
      if (w.map.blockAt(p.x, p.y)) {
        // kicked point-blank into a wall: blow up against it rather than bouncing out behind the bro
        explodeAt(p, FOOTBALL_BLAST, false, events);
        break;
      }
      bounce(p, w.map, t, FOOTBALL.bounceM, FOOTBALL.frictionM);
      if (struck(w, p) || p.bounces > FOOTBALL.maxBounces || p.life <= 0) {
        explodeAt(p, FOOTBALL_BLAST, false, events);
      }
      break;
    }
    case 'jetBomb': {
      p.yI -= GRAVITY * t;
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || struck(w, p) || p.life <= 0) {
        explodeAt(p, w.stats.bomb, true, events);
      }
      break;
    }
    case 'grenade': {
      // the grenadier's long-fuse grenade: it bounces until its fuse burns down
      const g = w.stats.grenadeMook;
      bounce(p, w.map, t, g.bounceM, g.frictionM, g.gravityM);
      if (p.life <= 0) {
        p.dead = true;
        const blast = { damage: g.damage, range: g.range, blastForce: g.blastForce, blastForceExtraY: GRENADE_EXTRA_Y, life: 0 };
        events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, blast, p.team, true, 'rocket') });
      }
      break;
    }
    case 'body': {
      p.yI -= GRAVITY * t;
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || struck(w, p) || p.life <= 0) explodeBody(p, w, events);
      break;
    }
    case 'shell': {
      // HeavyShell.RunProjectile: coast for 0.1 s, drag in from 0.1 to 0.35 s, then fall as the drag eases off
      const d = (p.dip = (p.dip ?? 0) + t);
      const s = HEAVY_SHELL_DIP;
      if (d >= s.coast && d < s.slow) {
        const n = (d - s.coast) / (s.slow - s.coast);
        p.xI *= 1 - t * s.drag * n;
        p.yI *= 1 - t * s.drag * n;
      } else if (d >= s.slow) {
        const n = Math.min(1, Math.max(0, 1 - (d - s.slow) / s.fall));
        p.xI *= 1 - t * s.drag * n;
        p.yI *= 1 - t * s.drag * n;
        p.yI -= s.gravity * t * (1 - n);
      }
      p.x += p.xI * t;
      p.y += p.yI * t;
      if (w.map.blockAt(p.x, p.y) || struck(w, p) || p.life <= 0) {
        p.dead = true;
        events.push({ type: 'explode', blast: shellBlast(p.x, p.y, w.stats.tankShell, p.team) });
      }
      break;
    }
    case 'bigRocket': {
      const dir = p.xI < 0 ? -1 : 1;
      p.xI += dir * w.stats.tankRocket.acceleration * t; // RocketMassive.RunProjectile
      const nx = p.x + p.xI * t;
      if (w.map.blockAt(nx, p.y)) {
        if ((p.crush ?? 0) <= 0) {
          p.dead = true;
          events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, w.stats.tankRocket, p.team, true, 'bigRocket') });
          break;
        }
        p.crush = (p.crush ?? 0) - 1;
        crushWall(p, w, dir, events);
      } else {
        p.x = nx;
      }
      p.y += p.yI * t;
      if (struck(w, p) || p.life <= 0) {
        p.dead = true;
        events.push({ type: 'explode', blast: rocketBlast(p.x, p.y, w.stats.tankRocket, p.team, true, 'bigRocket') });
      }
      break;
    }
    case 'marker': {
      bounce(p, w.map, t, w.stats.marker.bounceM, w.stats.marker.frictionM);
      if (p.life <= 0) {
        p.dead = true;
        events.push(p.call === 'tank'
          ? { type: 'callTank', x: p.x, y: p.y, dir: p.xI < 0 ? -1 : 1 }
          : p.call === 'jet'
            ? { type: 'callJet', x: p.x, y: p.y }
            : p.call === 'nuke'
              ? { type: 'callNuke', x: p.x, y: p.y }
              : { type: 'airstrike', x: p.x, y: p.y });
      }
      break;
    }
  }
  return events;
}
