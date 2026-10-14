import {
  BAZOOKA_FIRE_DELAY, LOST_SIGHT_TIME, MOOK_BURST, MOOK_BURST_PAUSE, MOOK_REACTION, PATROL_TURN_TIME,
  SIGHT_X, SIGHT_Y, SUICIDE_FUSE_MIN, SUICIDE_FUSE_RAND, SUICIDE_TRIGGER_DX, SUICIDE_TRIGGER_DY,
} from './constants';
import type { TileMap } from './map';
import { NO_INTENT, touchesWall, type MoveIntent } from './physics';
import type { AiState, Unit } from './types';

export interface AiContext {
  map: TileMap;
  player: Unit | null;
  rng: () => number;
}

export interface AiAction {
  intent: MoveIntent;
  fire: boolean;
  explode: boolean;
}

const IDLE: AiAction = { intent: NO_INTENT, fire: false, explode: false };

/** EnemyAI sight box (300 x 20), facing the player, with a clear line at chest height. */
export function canSee(m: Unit, p: Unit, map: TileMap): boolean {
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (Math.abs(dx) > SIGHT_X || Math.abs(dy) > SIGHT_Y) return false;
  if (Math.abs(dx) > 16 && Math.sign(dx) !== m.facing) return false;
  const steps = Math.ceil(Math.abs(dx) / 8);
  for (let i = 1; i < steps; i++) {
    if (map.solidAt(m.x + (dx * i) / steps, m.y + 8)) return false;
  }
  return true;
}

function patrol(m: Unit, ai: AiState, t: number): void {
  ai.patrolTimer -= t;
  if (ai.patrolTimer <= 0) {
    m.facing = m.facing === 1 ? -1 : 1;
    ai.patrolTimer = PATROL_TURN_TIME;
  }
}

function thinkSuicide(m: Unit, ai: AiState, p: Unit | null, sees: boolean, ctx: AiContext, t: number): AiAction {
  if (ai.mode === 'idle') {
    if (sees) ai.mode = 'charging';
    else patrol(m, ai, t);
    return IDLE;
  }
  if (ai.fuse > 0) {
    ai.fuse -= t;
    return ai.fuse <= 0 ? { ...IDLE, explode: true } : IDLE;
  }
  if (!p) return IDLE;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (Math.abs(dx) < SUICIDE_TRIGGER_DX && Math.abs(dy) < SUICIDE_TRIGGER_DY) {
    ai.fuse = SUICIDE_FUSE_MIN + ctx.rng() * SUICIDE_FUSE_RAND; // MookSuicide.deathCounter
    return IDLE;
  }
  const dir: -1 | 1 = dx >= 0 ? 1 : -1;
  const blocked = touchesWall(m, dir, ctx.map);
  return { intent: { dir, jumpPressed: blocked && m.onGround, jumpHeld: blocked, dash: false }, fire: false, explode: false };
}

/** A small reduction of EnemyAI/PolymorphicAI: patrol, notice, react, shoot. */
export function thinkMook(m: Unit, ctx: AiContext, t: number): AiAction {
  const ai = m.ai;
  if (!ai || m.dead || ai.mode === 'exploded') return IDLE;
  const p = ctx.player && !ctx.player.dead ? ctx.player : null;
  const sees = p !== null && canSee(m, p, ctx.map);
  if (m.kind === 'mook_suicide') return thinkSuicide(m, ai, p, sees, ctx, t);
  if (ai.mode === 'idle') {
    if (sees && p) {
      ai.mode = 'alert';
      ai.reaction = MOOK_REACTION;
      ai.burstLeft = 0;
      ai.cooldown = 0;
      ai.lostSight = 0;
      m.facing = p.x >= m.x ? 1 : -1;
    } else {
      patrol(m, ai, t);
    }
    return IDLE;
  }
  if (p) m.facing = p.x >= m.x ? 1 : -1;
  ai.lostSight = sees ? 0 : ai.lostSight + t;
  if (ai.lostSight > LOST_SIGHT_TIME) {
    ai.mode = 'idle';
    ai.patrolTimer = PATROL_TURN_TIME;
    return IDLE;
  }
  if (ai.reaction > 0) {
    ai.reaction -= t;
    return IDLE;
  }
  ai.cooldown -= t;
  if (!sees || ai.cooldown > 0) return IDLE;
  if (m.kind === 'mook_bazooka') {
    ai.cooldown = BAZOOKA_FIRE_DELAY;
    return { ...IDLE, fire: true };
  }
  if (ai.burstLeft <= 0) ai.burstLeft = MOOK_BURST;
  ai.burstLeft -= 1;
  ai.cooldown = ai.burstLeft > 0 ? m.stats.fireRate : MOOK_BURST_PAUSE;
  return { ...IDLE, fire: true };
}
