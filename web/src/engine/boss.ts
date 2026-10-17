import { screenMaxY } from './camera';
import { BOSS, SPEECH_DURATION } from './constants';
import { rocketBlast, type Blast } from './explosions';
import { cellLeft } from './map';
import { NO_INTENT, stepUnit } from './physics';
import { fireAimedBullet } from './projectiles';
import type { BossState, EnemyKind, GameStats, Unit, UnitStats } from './types';
import { damageUnit, makeUnit, runGun } from './units';
import type { World } from './world';

/** Jeffrey Epstein, the island's boss: a mook's body with the boss's health, and his own mind instead of a mook's. */
export function makeBoss(id: number, x: number, y: number, stats: GameStats): Unit {
  const s: UnitStats = {
    ...stats.units.mook, health: BOSS.health, speed: BOSS.speed, canHideInGrass: false, canBeSetOnFire: false,
    panicsOnFire: false,
  };
  const m = makeUnit(id, 'boss', 'enemy', x, y, s);
  m.ai = null; // no mook mind: he never panics, hides, laughs or goes looking for noises
  m.boss = { awake: false, enraged: false, burstClock: 0, shots: 0, shotTimer: 0, callClock: 0, calling: -1, guards: [] };
  return m;
}

export const bossAlive = (w: World): boolean => w.boss !== null && !w.boss.dead;

/** The HUD's bar: his health (in 40ths) while he fights, nothing while he sleeps or once he is down. */
export function bossBar(w: World): number | null {
  const b = w.boss;
  if (!b || b.dead || !b.boss?.awake) return null;
  return Math.round((b.health / BOSS.health) * 40) / 40;
}

/** One fixed step of the living boss: asleep until the bro comes near, then he keeps his distance, fires bursts at him
 *  and calls his guards in. */
export function stepBoss(w: World, m: Unit, t: number): void {
  const s = m.boss as BossState;
  const p = w.player;
  let dir: -1 | 0 | 1 = 0;
  if (!s.awake) {
    if (!p.dead && Math.abs(p.x - m.x) < BOSS.wake.x && Math.abs(p.y - m.y) < BOSS.wake.y) wake(w, m, s);
  } else if (!p.dead) {
    s.enraged = m.health <= BOSS.health / 2;
    const phase = s.enraged ? 1 : 0;
    if (s.calling >= 0) {
      s.calling += t; // standing still, waving them in (MookGeneral.AnimateSpecial)
      if (s.calling >= BOSS.callTime) {
        s.calling = -1;
        callGuards(w, m, s);
      }
    } else {
      const dx = p.x - m.x;
      if (Math.abs(dx) > BOSS.far) dir = dx < 0 ? -1 : 1;
      else if (Math.abs(dx) < BOSS.near) dir = dx < 0 ? 1 : -1;
      s.callClock += t;
      if (s.callClock >= BOSS.callEvery[phase]) {
        s.callClock = 0;
        s.calling = 0;
        dir = 0;
        w.events.push({ type: 'bossCall', x: m.x, y: m.y });
      }
      s.burstClock += t;
      if (s.shots === 0 && s.burstClock >= BOSS.burstEvery[phase]) {
        s.burstClock = 0;
        s.shots = BOSS.burst;
        s.shotTimer = 0;
      }
      if (s.shots > 0 && (s.shotTimer -= t) <= 0) {
        s.shots--;
        s.shotTimer += BOSS.shotGap;
        w.projectiles.push(fireAimedBullet(w.nextId++, m, p.x, p.y + 8, BOSS.bulletSpeed, BOSS.maxAim, w.stats));
        m.gunFrame = 3;
        m.gunCounter = 0;
        w.events.push({ type: 'shot', weapon: 'bullet', x: m.x, y: m.y, facing: m.facing });
      }
    }
  }
  stepUnit(m, { ...NO_INTENT, dir }, w.map, t, w.time);
  runGun(m, t);
  if (s.awake) m.facing = p.x < m.x ? -1 : 1; // he backs off facing the bro
  if (m.y < -64) damageUnit(m, m.health);
}

function wake(w: World, m: Unit, s: BossState): void {
  s.awake = true;
  s.burstClock = BOSS.burstEvery[0] - BOSS.firstBurst;
  s.callClock = 0;
  m.facing = w.player.x < m.x ? -1 : 1;
  w.effects.push({ kind: 'speech', x: m.x, y: m.y + 40, age: 0, duration: SPEECH_DURATION, text: BOSS.line });
  w.events.push({ type: 'voice', text: BOSS.line, lang: 'en-US' });
}

/**
 * MookGeneral.UseSpecial: three mooks (some suicide mooks, by the map's odds) side by side 16 px apart, 32 px above
 * the screen around X + Random.Range(-64, 64). Ours keep to the map and to six alive at once.
 */
function callGuards(w: World, m: Unit, s: BossState): void {
  s.guards = s.guards.filter((id) => w.enemies.some((e) => e.id === id && !e.dead));
  const room = Math.min(3, BOSS.maxGuards - s.guards.length);
  const lo = cellLeft(0) + 16;
  const hi = cellLeft(w.map.cols) - 16 - 32;
  const base = Math.min(Math.max(Math.round(m.x) + Math.floor(w.rng() * 128) - 64 - 16, lo), hi);
  const y = screenMaxY(w.camera) + 32;
  for (let i = 0; i < room; i++) {
    const kind: EnemyKind = w.rng() >= BOSS.guardSuicide[s.enraged ? 1 : 0] ? 'mook' : 'mook_suicide';
    const g = makeUnit(w.nextId++, kind, 'enemy', base + 16 * i, y, w.stats.units[kind]);
    g.facing = w.player.x < g.x ? -1 : 1;
    w.enemies.push(g);
    s.guards.push(g.id);
  }
}

/** His end: he goes up in a blast of the bro's (it spares the bro and takes his guards with him). */
export function bossDown(w: World, m: Unit, blasts: Blast[]): void {
  m.gibbed = true;
  blasts.push(rocketBlast(m.x, m.y + 8, w.stats.bomb, 'player', true, 'bomb'));
  w.events.push({ type: 'bossDown', x: m.x, y: m.y });
}
