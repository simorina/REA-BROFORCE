import { thinkMook } from './ai';
import type { BroDef, SpecialId, WeaponId } from './bro';
import {
  CORPSE_TIME, EXPLOSION_DURATION, EXTRACTION_TIME, FLAG_REACH, HALF_TILE, LIVES_START,
  PRISONER_RESCUE_DIST, RESPAWN_DELAY, SPEECH_DURATION, TILE,
} from './constants';
import { applyBlast, barrelBlast, suicideBlast, type Blast } from './explosions';
import { parseLevel, type LevelData } from './level';
import type { TileMap } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import {
  fireBazookaRocket, fireMookBullet, kickFootball, spawnAirstrike, stepProjectile, throwMarker,
} from './projectiles';
import { damageUnit, makeUnit } from './units';
import type { Controls, GameStats, Projectile, Unit } from './types';

export interface Effect {
  kind: 'explosion' | 'explosion_small' | 'speech';
  x: number;
  y: number;
  age: number;
  duration: number;
  text?: string;
}

export interface Prisoner {
  x: number;
  y: number;
  freed: boolean;
}

export type GameEvent = { type: 'voice'; text: string } | { type: 'explosion' } | { type: 'rescue' } | { type: 'death' };
export type WorldState = 'playing' | 'extracting' | 'won' | 'lost';

export interface World {
  map: TileMap;
  stats: GameStats;
  bro: BroDef;
  rng: () => number;
  player: Unit;
  spawn: { x: number; y: number };
  enemies: Unit[];
  projectiles: Projectile[];
  effects: Effect[];
  prisoners: Prisoner[];
  flag: { x: number; y: number };
  lives: number;
  specialAmmo: number;
  respawnTimer: number;
  state: WorldState;
  extractionTime: number;
  time: number;
  nextId: number;
  cameraTop: number;
  events: GameEvent[];
}

const cellX = (c: number): number => c * TILE;
const feetY = (r: number): number => r * TILE - HALF_TILE;

const WEAPON_SPAWN: Record<WeaponId, (id: number, u: Unit) => Projectile> = { football: kickFootball };
const SPECIAL_SPAWN: Record<SpecialId, (id: number, u: Unit, ducking: boolean) => Projectile> = { airstrike: throwMarker };

export function createWorld(level: LevelData, stats: GameStats, bro: BroDef, rng: () => number = Math.random): World {
  const parsed = parseLevel(level, stats);
  let nextId = 1;
  const spawn = { x: cellX(parsed.player.c), y: feetY(parsed.player.r) };
  const player = makeUnit(nextId++, 'bro', 'player', spawn.x, spawn.y, stats.units.bro);
  const enemies = parsed.enemies.map((e) => makeUnit(nextId++, e.kind, 'enemy', cellX(e.c), feetY(e.r), stats.units[e.kind]));
  return {
    map: parsed.map, stats, bro, rng, player, spawn, enemies, projectiles: [], effects: [],
    prisoners: parsed.cages.map((c) => ({ x: cellX(c.c), y: feetY(c.r), freed: false })),
    flag: { x: cellX(parsed.flag.c), y: feetY(parsed.flag.r) },
    lives: LIVES_START, specialAmmo: stats.units.bro.specialAmmo, respawnTimer: 0,
    state: 'playing', extractionTime: 0, time: 0, nextId, cameraTop: spawn.y + 120, events: [],
  };
}

function intentFrom(c: Controls, prev: Controls): MoveIntent {
  return { dir: c.left === c.right ? 0 : c.left ? -1 : 1, jumpPressed: c.jump && !prev.jump, jumpHeld: c.jump, dash: c.dash };
}

function stepPlayer(w: World, controls: Controls, prev: Controls, t: number): void {
  const p = w.player;
  if (p.dead) {
    if (p.deadTime === 0) {
      w.respawnTimer = RESPAWN_DELAY;
      w.events.push({ type: 'death' });
    }
    p.deadTime += t;
    stepUnit(p, NO_INTENT, w.map, t, w.time);
    w.respawnTimer -= t;
    if (w.respawnTimer <= 0) {
      if (w.lives > 0) {
        w.lives -= 1;
        w.player = makeUnit(w.nextId++, 'bro', 'player', w.spawn.x, w.spawn.y, w.stats.units.bro);
      } else {
        w.state = 'lost';
      }
    }
    return;
  }
  stepUnit(p, intentFrom(controls, prev), w.map, t, w.time);
  p.fireCooldown -= t;
  if (controls.fire && p.fireCooldown <= 0) {
    w.projectiles.push(WEAPON_SPAWN[w.bro.weapon](w.nextId++, p));
    p.fireCooldown = p.stats.fireRate;
  }
  if (controls.special && !prev.special && w.specialAmmo > 0) {
    w.specialAmmo -= 1;
    w.projectiles.push(SPECIAL_SPAWN[w.bro.special](w.nextId++, p, controls.down));
    w.effects.push({ kind: 'speech', x: p.x, y: p.y + 40, age: 0, duration: SPEECH_DURATION, text: w.bro.voiceLine });
    w.events.push({ type: 'voice', text: w.bro.voiceLine });
  }
  if (p.y < -64) damageUnit(p, p.health);
  for (const pr of w.prisoners) {
    if (!pr.freed && Math.abs(p.x - pr.x) < PRISONER_RESCUE_DIST && Math.abs(p.y - pr.y) < PRISONER_RESCUE_DIST) {
      pr.freed = true;
      w.lives += 1;
      w.events.push({ type: 'rescue' });
    }
  }
  if (!p.dead && Math.abs(p.x - w.flag.x) < FLAG_REACH && Math.abs(p.y - w.flag.y) < FLAG_REACH * 2) {
    w.state = 'extracting';
    w.extractionTime = 0;
    w.projectiles = [];
    p.xI = 0;
  }
}

function stepEnemies(w: World, t: number, blasts: Blast[]): void {
  const player = w.player.dead ? null : w.player;
  for (const m of w.enemies) {
    if (m.dead) {
      m.deadTime += t;
      if (m.kind === 'mook_suicide' && m.ai && m.ai.mode !== 'exploded') {
        m.ai.mode = 'exploded'; // MookSuicide blows up when it dies, whatever killed it
        blasts.push(suicideBlast(m.x, m.y + 8, w.stats.suicide));
      }
      stepUnit(m, NO_INTENT, w.map, t, w.time);
      continue;
    }
    const action = thinkMook(m, { map: w.map, player, rng: w.rng }, t);
    stepUnit(m, action.intent, w.map, t, w.time);
    if (action.fire) {
      w.projectiles.push(m.kind === 'mook_bazooka'
        ? fireBazookaRocket(w.nextId++, m, w.stats, w.rng)
        : fireMookBullet(w.nextId++, m, w.stats, w.rng));
    }
    if (action.explode || m.y < -64) damageUnit(m, m.health);
  }
}

function stepProjectiles(w: World, t: number, blasts: Blast[]): void {
  const pw = { map: w.map, units: [w.player, ...w.enemies], stats: w.stats };
  for (const p of [...w.projectiles]) {
    for (const ev of stepProjectile(p, pw, t)) {
      if (ev.type === 'explode') blasts.push(ev.blast);
      else w.projectiles.push(...spawnAirstrike(() => w.nextId++, ev.x, ev.y, w.cameraTop, w.stats, w.rng));
    }
  }
}

/** Applies blasts in order; destroyed barrels append their own blast, and each barrel can only be destroyed once. */
function resolveBlasts(w: World, blasts: Blast[]): void {
  const units = [w.player, ...w.enemies];
  for (let i = 0; i < blasts.length; i++) {
    const b = blasts[i];
    const res = applyBlast(w.map, units, b);
    w.effects.push({ kind: b.big ? 'explosion' : 'explosion_small', x: b.x, y: b.y, age: 0, duration: EXPLOSION_DURATION });
    w.events.push({ type: 'explosion' });
    for (const d of res.destroyed) {
      if (d.kind === 'barrel') blasts.push(barrelBlast(cellX(d.c), d.r * TILE, w.stats.barrelRange));
    }
  }
}

function ageEffects(w: World, t: number): void {
  for (const e of w.effects) e.age += t;
  w.effects = w.effects.filter((e) => e.age < e.duration);
}

export function stepWorld(w: World, controls: Controls, prev: Controls, t: number): void {
  if (w.state === 'won' || w.state === 'lost') return;
  w.time += t;
  if (w.state === 'extracting') {
    w.extractionTime += t;
    if (w.extractionTime >= EXTRACTION_TIME) w.state = 'won';
    ageEffects(w, t);
    return;
  }
  const blasts: Blast[] = [];
  stepPlayer(w, controls, prev, t);
  stepEnemies(w, t, blasts);
  stepProjectiles(w, t, blasts);
  resolveBlasts(w, blasts);
  ageEffects(w, t);
  w.enemies = w.enemies.filter((e) => !(e.dead && e.deadTime > CORPSE_TIME));
  w.projectiles = w.projectiles.filter((p) => !p.dead);
}
