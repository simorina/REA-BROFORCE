import { screenMaxY } from './camera';
import { GRAVITY, HALF_TILE, MECH, SPEECH_DURATION, TILE } from './constants';
import { rocketBlast, type Blast } from './explosions';
import { cellLeft, getColumn, getRow, type TileMap } from './map';
import { fireFrom, skyRocket } from './projectiles';
import type { GameStats } from './types';
import type { World } from './world';

/** GoliathMechAI's patterns: Bombardment (the chain guns), Stomping, FrontAssault (missiles), and its rocket rain. */
export type MechPattern = 'bombard' | 'stomp' | 'missiles' | 'sky';
export type MechState = 'dormant' | 'pause' | 'bombard' | 'rise' | 'glide' | 'slam' | 'missiles' | 'dying';

/** Epstein's Goliath: Broforce's GoliathMech, the island's last fight. `y` is its feet. */
export interface Mech {
  id: number;
  x: number;
  y: number;
  yI: number;
  facing: 1 | -1;
  onGround: boolean;
  health: number;
  maxHealth: number;
  awake: boolean;
  destroyed: boolean;
  state: MechState;
  stateTime: number;
  step: number; // where it is in its pattern
  floor: number; // the ground it rose from
  targetX: number; // where its stomp comes down
  shotClock: number;
  shotsLeft: number;
  gun: number; // which chain gun fires next
  flash: number; // hit flash, seconds left
  look: number; // its turning frame: 0 facing right ... 6 facing left
  lookClock: number;
  minX: number; // its arena
  maxX: number;
}

export function makeMech(id: number, x: number, y: number, stats: GameStats, map: TileMap): Mech {
  const lo = cellLeft(0) + MECH.box.halfWidth;
  const hi = cellLeft(map.cols) - MECH.box.halfWidth;
  return {
    id, x, y, yI: 0, facing: -1, onGround: true, health: stats.mech.health, maxHealth: stats.mech.health, awake: false,
    destroyed: false, state: 'dormant', stateTime: 0, step: 0, floor: y, targetX: x, shotClock: 0, shotsLeft: 0, gun: 0,
    flash: 0, look: 6, lookClock: 0, minX: Math.max(lo, x - MECH.arena), maxX: Math.min(hi, x + MECH.arena),
  };
}

const HIT_MARGIN = 2;

/** The bro's shots stop on its body. */
export function mechAt(m: Mech | null | undefined, x: number, y: number): boolean {
  if (!m || m.destroyed) return false;
  const b = MECH.box;
  return Math.abs(x - m.x) <= b.halfWidth + HIT_MARGIN && y >= m.y - HIT_MARGIN && y <= m.y + b.height + HIT_MARGIN;
}

/** Map.ExplodeUnits reaching it: its box within the blast's unit range. */
export function mechInBlast(m: Mech, b: Blast): boolean {
  const box = MECH.box;
  return !m.destroyed && Math.abs(m.x - b.x) < b.unitRange + box.halfWidth
    && Math.abs(m.y + box.height / 2 - b.y) < b.unitRange + box.height / 2;
}

const enraged = (m: Mech): boolean => m.health <= m.maxHealth / 2; // GoliathMechAI.UnitIsAboveHalfHealth

/** A hit: shooting it awake wakes it; at nothing left it starts to blow apart. */
export function damageMech(w: World, m: Mech, amount: number): void {
  if (m.destroyed || m.state === 'dying' || amount <= 0) return;
  if (!m.awake) wake(w, m);
  m.health = Math.max(0, m.health - amount);
  m.flash = MECH.flash;
  if (m.health === 0) {
    m.state = 'dying';
    m.stateTime = 0;
    m.shotClock = 0;
  }
}

/** The top of the highest block under its box at or below y (-Infinity over a pit). */
function groundBelow(map: TileMap, x: number, y: number): number {
  let best = -Infinity;
  const eps = 0.001;
  for (let c = getColumn(x - MECH.box.halfWidth); c <= getColumn(x + MECH.box.halfWidth - eps); c++) {
    for (let r = Math.min(map.rows - 1, getRow(y)); r >= 0; r--) {
      const top = r * TILE + HALF_TILE;
      if (map.get(c, r) && top <= y + eps) {
        best = Math.max(best, top);
        break;
      }
    }
  }
  return best;
}

function wake(w: World, m: Mech): void {
  m.awake = true;
  m.state = 'pause';
  m.stateTime = 0;
  m.facing = w.player.x < m.x ? -1 : 1;
  w.effects.push({ kind: 'speech', x: m.x, y: m.y + MECH.box.height, age: 0, duration: SPEECH_DURATION, text: MECH.line, unit: m.id });
  w.events.push({ type: 'voice', text: MECH.line, lang: 'en-US' });
  const b = w.boss;
  if (b && !b.dead && b.boss && !b.boss.gone) { // the Epstein nobody beat at his temple: he is in here now
    b.boss.gone = true;
    w.events.push({ type: 'bossFled', x: b.x, y: b.y });
    w.enemies = w.enemies.filter((e) => e !== b);
  }
}

/** Starts one of its patterns (exported for the tests to pick one). */
export function beginPattern(w: World, m: Mech, pattern: MechPattern): void {
  m.stateTime = 0;
  m.shotClock = 0;
  if (pattern === 'bombard') {
    m.state = 'bombard';
  } else if (pattern === 'stomp') {
    m.state = 'rise';
    m.floor = groundBelow(w.map, m.x, m.y);
  } else if (pattern === 'missiles') {
    m.state = 'missiles';
    m.shotsLeft = MECH.missiles.count;
  } else {
    skyRockets(w);
    m.state = 'pause';
  }
}

function nextPattern(w: World, m: Mech): void {
  const patterns = MECH.pattern[enraged(m) ? 1 : 0];
  const pattern = patterns[m.step % patterns.length];
  m.step++;
  beginPattern(w, m, pattern);
}

function toPause(m: Mech): void {
  m.state = 'pause';
  m.stateTime = 0;
}

/** Its chain guns, by turns, at the bro (MechChainGun). */
function chainGuns(w: World, m: Mech, t: number): void {
  m.shotClock -= t;
  if (m.shotClock > 0) return;
  m.shotClock += MECH.fire.every[enraged(m) ? 1 : 0];
  const g = MECH.guns[m.gun];
  m.gun = 1 - m.gun;
  const ox = m.x + m.facing * g.x;
  const oy = m.y + g.y;
  w.projectiles.push(fireFrom(w.nextId++, 'bullet', 'enemy', ox, oy, m.facing, w.player.x, w.player.y + 8, MECH.fire.speed,
    MECH.fire.maxAim, w.stats.bullet.life));
  w.events.push({ type: 'shot', weapon: 'bullet', x: ox - m.facing * 10, y: oy - 8, facing: m.facing });
}

/** The missile turret's volley (GoliathMechAI.FrontAssault), at the bro. */
function missile(w: World, m: Mech): void {
  const hole = MECH.missiles.from[m.shotsLeft % 2];
  const ox = m.x + m.facing * hole.x;
  const oy = m.y + hole.y;
  w.projectiles.push(fireFrom(w.nextId++, 'rocket', 'enemy', ox, oy, m.facing, w.player.x, w.player.y + 8,
    MECH.missiles.speed, MECH.missiles.maxAim, w.stats.rocketMook.life));
  w.events.push({ type: 'shot', weapon: 'rocket', x: ox, y: oy, facing: m.facing });
}

/** GoliathMechAI's RocketBombardment: rockets falling at -300 from above the screen around the bro. */
function skyRockets(w: World): void {
  const s = MECH.sky;
  const top = screenMaxY(w.camera) + 32;
  for (let i = 0; i < s.count; i++) {
    const x = w.player.x - s.spread / 2 + ((i + w.rng()) * s.spread) / s.count;
    w.projectiles.push(skyRocket(w.nextId++, x, top + i * s.gap, s.speed, w.stats));
  }
}

/** Off the ground and back down: gravity and the floor under its box. */
function settle(m: Mech, map: TileMap, t: number): void {
  const ground = groundBelow(map, m.x, m.y);
  if (m.y > ground + 0.001) {
    m.yI -= GRAVITY * t;
    m.y = Math.max(ground, m.y + m.yI * t);
  }
  m.onGround = m.y <= ground + 0.001;
  if (m.onGround) m.yI = 0;
}

/** Its turning frames, one every MECH.turnRate. */
function turn(m: Mech, t: number): void {
  const target = m.facing === 1 ? 0 : 6;
  if (m.look === target) return;
  m.lookClock += t;
  if (m.lookClock >= MECH.turnRate) {
    m.lookClock = 0;
    m.look += target > m.look ? 1 : -1;
  }
}

/** It comes apart in blasts of the bro's (they spare him), then goes up with Epstein inside. */
function dying(w: World, m: Mech, blasts: Blast[]): void {
  if (m.stateTime >= m.shotClock) {
    m.shotClock += MECH.dying.every;
    const x = m.x + (w.rng() - 0.5) * MECH.box.halfWidth * 2;
    const y = m.y + w.rng() * MECH.box.height;
    blasts.push(rocketBlast(x, y, w.stats.bomb, 'player', false, 'bomb'));
  }
  if (m.stateTime >= MECH.dying.time) {
    m.destroyed = true;
    blasts.push(rocketBlast(m.x, m.y + MECH.box.height / 2, MECH.dying.blast, 'player', true, 'bomb'));
    w.events.push({ type: 'gib', x: m.x, y: m.y + MECH.box.height / 2, team: 'enemy', kind: 'boss', xI: 0, yI: 200 });
    w.events.push({ type: 'bossDown', x: m.x, y: m.y });
  }
}

/** One fixed step of the Goliath. */
export function stepMech(w: World, t: number, blasts: Blast[]): void {
  const m = w.mech;
  if (!m || m.destroyed) return;
  m.flash = Math.max(0, m.flash - t);
  const p = w.player;
  if (!m.awake) {
    if (!p.dead && Math.abs(p.x - m.x) < MECH.wake.x && Math.abs(p.y - m.y) < MECH.wake.y) wake(w, m);
    settle(m, w.map, t);
    return;
  }
  m.stateTime += t;
  const phase = enraged(m) ? 1 : 0;
  const faceBro = () => {
    if (!p.dead) m.facing = p.x < m.x ? -1 : 1;
  };
  switch (m.state) {
    case 'dying':
      dying(w, m, blasts);
      break;
    case 'pause':
      faceBro();
      if (!p.dead && m.stateTime >= MECH.pause[phase]) nextPattern(w, m);
      break;
    case 'bombard':
      faceBro();
      chainGuns(w, m, t);
      if (m.stateTime >= MECH.fire.time) toPause(m);
      break;
    case 'rise': {
      const top = m.floor + MECH.stomp.rise;
      m.yI = MECH.stomp.riseSpeed;
      m.y = Math.min(top, m.y + m.yI * t);
      m.onGround = false;
      if (m.y >= top) {
        // GoliathMechAI.Stomping: toward the bro, at most 8 columns (16 once under half health), within its arena
        const reach = MECH.stomp.reach[phase];
        const dx = Math.max(-reach, Math.min(reach, p.x - m.x));
        m.targetX = Math.max(m.minX, Math.min(m.maxX, m.x + dx));
        m.state = 'glide';
        m.stateTime = 0;
      }
      break;
    }
    case 'glide': {
      const d = m.targetX - m.x;
      const step = MECH.stomp.glide * t;
      if (d !== 0) m.facing = d < 0 ? -1 : 1;
      if (Math.abs(d) <= step) {
        m.x = m.targetX;
        m.state = 'slam';
        m.stateTime = 0;
      } else {
        m.x += Math.sign(d) * step;
      }
      if (phase === 1) chainGuns(w, m, t); // under half health it fires while stomping
      break;
    }
    case 'slam': {
      const ground = groundBelow(w.map, m.x, m.y);
      m.yI = -MECH.stomp.fall;
      m.y += m.yI * t;
      if (m.y <= ground) {
        m.y = ground;
        m.yI = 0;
        m.onGround = true;
        blasts.push(rocketBlast(m.x, m.y + 4, MECH.stomp.blast, 'enemy', true, 'rocket')); // the stomp's shockwave
        toPause(m);
      } else if (m.y < -64) {
        m.state = 'dying'; // over a pit: it falls and blows up
        m.stateTime = MECH.dying.time;
        m.health = 0;
      }
      break;
    }
    case 'missiles':
      faceBro();
      m.shotClock -= t;
      if (m.shotsLeft > 0 && m.shotClock <= 0) {
        missile(w, m);
        m.shotsLeft--;
        m.shotClock = MECH.missiles.gap;
      } else if (m.shotsLeft === 0 && m.shotClock <= 0) {
        toPause(m);
      }
      break;
    default:
      break;
  }
  if (m.state !== 'rise' && m.state !== 'glide' && m.state !== 'slam') settle(m, w.map, t);
  turn(m, t);
}
