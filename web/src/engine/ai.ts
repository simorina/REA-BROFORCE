import {
  AI_FACE_LINGER, AI_GREET_WAIT, AI_SAME_SPOT_TIME, AI_STUCK_TIME, BUBBLE_TIME, SIGHT_EYE, SIGHT_PROBE_BACK,
  SIGHT_PROBE_UP, SUICIDE_BLOCKED_M, SUICIDE_DEATH_FUSE, SUICIDE_DELAY, SUICIDE_SPEED_ALERTED, SUICIDE_TIMER,
  SUICIDE_TRIGGER, TILE, UNIT_HALF_WIDTH,
} from './constants';
import { getColumn, getRow, type TileMap } from './map';
import { getMove, getPath, makeAgent, setPath, unitColumn, unitRow } from './pathagent';
import { NO_INTENT, type MoveIntent } from './physics';
import type { AiAction, AiActionType, AiState, AiStats, MentalState, PathCaps, PathPoint, Unit } from './types';

/**
 * A port of PolymorphicAI's action queue with the MookTrooperAI, MookBazookaAi and SuicideAI thinks.
 * When the queue runs dry the mook "thinks" a new batch of actions for its mental state; every step it
 * turns the front action into input and ticks it (RunQueue). Mental states: idle, suspicious, alerted,
 * hiding (in long grass), panicking (Mook.Panic) and attracted (Attract). FollowPath walks a
 * PathfindingController path with a PathAgent; ScoutAI runs to the nearest mook door to raise the alarm.
 */
export interface AiContext {
  map: TileMap;
  player: Unit | null;
  rng: () => number;
  stats: AiStats;
  visible?: boolean; // SortOfFollow.IsItSortOfVisible(x, y, 128, 128): idle mooks off screen don't think
  onScreen?: (x: number, y: number, bufferX: number, bufferY: number) => boolean; // SortOfFollow.IsItSortOfVisible
  inGrass?: (x: number, y: number, range: number) => boolean; // Map.IsInSubstance
  path?: PathCaps; // the unit's PathAgent
  doors?: readonly DoorPoint[]; // Map.mookInterestPoints: the mook doors, for scouts
  runSpeed?: number; // ScoutMook.runSpeed
  dogRunSpeed?: number; // MookDog.awareRunSpeed
}

/** A ScoutMookInterestPoint: a mook door's cell and position. */
export interface DoorPoint {
  c: number;
  r: number;
  x: number;
  y: number;
}

/** What ScoutAI.FullyAlert needs beyond the mook itself. */
export interface AlertScene {
  player: Unit | null;
  doors: readonly DoorPoint[];
  map: TileMap;
  runSpeed: number;
}

export interface AiOutput {
  intent: MoveIntent;
  fire: boolean;
  explode: boolean;
  alertNearby?: boolean; // ScoutAI: Map.AlertNearbyMooks(x, y, 64, 40) while it runs for the door
  alarm?: { door: number; c: number; r: number }; // ScoutAI: MookDoor.AlarmMooks(startPoint)
}

const IDLE: AiOutput = { intent: NO_INTENT, fire: false, explode: false };
const PATH_TIME_LIMIT = 10; // PolymorphicAI.RunQueue: pathAgent.GetPath(..., 10f) milliseconds
const MAX_REPATHS = 5; // RunQueue: FollowPath gives up after repathCount > 5
const SCOUT_FLEE_COLUMNS = 32; // ScoutAI.FullyAlert: with no door around, run 32 columns away
const SCOUT_DOOR_REACH = 32; // ScoutAI.GetInput: AlarmMooks within 32 of the door
export const SCOUT_SHOUT = { x: 64, y: 40 }; // ScoutAI.GetInput: Map.AlertNearbyMooks(x, y, 64, 40)
const ACTION_TIME = 0.0334; // PolymorphicAI.AddAction(type): a one-off action lasts 0.0334 s

const sign = (v: number): -1 | 1 => (v < 0 ? -1 : 1); // Mathf.Sign: zero counts as positive
const randInt = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo)); // Random.Range(int, int)
const randFloat = (rng: () => number, lo: number, hi: number): number => lo + rng() * (hi - lo);
const act = (type: AiActionType, duration = 0, c = -1, r = -1): AiAction => ({ type, duration, c, r });
const alive = (p: Unit | null): Unit | null => (p && !p.dead ? p : null);

/** Map.GetUnitXOffset, keyed by unit id instead of a global counter. */
export function unitXOffset(n: number): number {
  return -5 + ((n % 4) / 3) * 6 + ((n % 7) / 8) * 2 + ((n % 25) / 24) * 2;
}

export function makeAiState(id: number): AiState {
  return {
    mental: 'idle', queue: [], walkDir: 1, setup: false, grid: [], blockOffset: unitXOffset(id), seenPlayer: false,
    thoughtsSinceSeen: 0, suspiciousThinks: 0, stuckTime: 0, sameSpotTime: 0, lastC: -1, lastR: -1,
    bubble: null, bubbleTime: 0, attractC: 0, attractR: 0, wasJump: false, agent: makeAgent(), repathCount: 0, speed: null,
    startC: null, startR: 0, interest: null, runDir: 0, alertDelay: 0, rambro: 0, rambroLife: 0,
    litFuse: false, suicideDelay: SUICIDE_DELAY, suicideTimer: SUICIDE_TIMER, deathFuse: SUICIDE_DEATH_FUSE, exploded: false,
    droppedGrenade: false, attackingDir: 0,
  };
}

/**
 * HeroController.CanSeePlayer: the player is within range of a point 5 behind and 10 above the looker,
 * on the side it looks to (direction 0: either side), and no block cuts the line between their y + 6.
 */
export function canSeePlayer(
  x: number, y: number, dir: -1 | 0 | 1, rangeX: number, rangeY: number, p: Unit | null, map: TileMap,
): boolean {
  if (!p || p.dead) return false;
  const dx = p.x - (x - dir * SIGHT_PROBE_BACK);
  const dy = p.y - (y + SIGHT_PROBE_UP);
  if (dir !== 0 && sign(dx) !== dir) return false;
  if (Math.abs(dx) >= rangeX || Math.abs(dy) >= rangeY) return false;
  return !map.rayBlocked(x, y + SIGHT_EYE, p.x, p.y + SIGHT_EYE, SIGHT_EYE);
}

const isThisWay = (p: Unit | null, x: number, dir: number): boolean => p !== null && sign(p.x - x) === sign(dir);

/** PolymorphicAI.IsBlockedForward: a 11-unit ray at y + 6 starting 3 behind the mook. */
function blockedForward(m: Unit, dir: -1 | 1, map: TileMap): boolean {
  for (let k = -3; k <= UNIT_HALF_WIDTH + 2; k++) if (map.solidAt(m.x + dir * k, m.y + 6)) return true;
  return false;
}

/** PolymorphicAI.SetupAvailableGridPoints: standable cells up to patrolBlocksRadius (max 5) either side. */
function setupGrid(m: Unit, ai: AiState, map: TileMap, radius: number): void {
  const c = getColumn(m.x);
  const r = getRow(m.y);
  const open = (cc: number) => map.isSolid(cc, r - 1) && !map.isSolid(cc, r) && !map.isSolid(cc, r + 1);
  const reach = Math.min(radius, 5);
  const grid = [{ c, r }];
  for (let k = 1; k <= reach && open(c - k); k++) grid.unshift({ c: c - k, r });
  for (let k = 1; k <= reach && open(c + k); k++) grid.push({ c: c + k, r });
  ai.grid = grid;
}

const isAvailable = (ai: AiState, c: number, r: number): boolean =>
  ai.mental === 'panicking' || ai.grid.some((g) => g.c === c && g.r === r);

/** PolymorphicAI.GetNewGridPoint: a random patrol cell other than the current one. */
function newGridPoint(m: Unit, ai: AiState, rng: () => number): { c: number; r: number } {
  const c = getColumn(m.x);
  const r = getRow(m.y);
  const here = (g: { c: number; r: number }) => g.c === c && g.r === r;
  if (ai.grid.length <= 1) return { c, r };
  for (let i = 0; i < ai.grid.length * 3; i++) {
    const g = ai.grid[Math.floor(rng() * ai.grid.length)];
    if (!here(g)) return g;
  }
  return ai.grid.find((g) => !here(g)) ?? { c, r };
}

function setMental(ai: AiState, mental: MentalState): void {
  ai.mental = mental;
  if (mental !== 'alerted') ai.attackingDir = 0; // BigGuyAI.SetMentalState
  if (mental === 'suspicious') ai.suspiciousThinks = 0;
}

function showBubble(ai: AiState, bubble: '!' | '?'): void {
  ai.bubble = bubble;
  ai.bubbleTime = BUBBLE_TIME;
}

/** ReactionBubble.RestartBubble(life) on the scout's Rambro face. */
function restartRambro(ai: AiState, life: number): void {
  ai.rambro = ai.rambroLife = life;
}

/** RestartExclamationBubble_Networked: a scout shows the Rambro face (when it is not up) instead of "!". */
function exclaim(m: Unit, ai: AiState): void {
  if (m.kind !== 'mook_scout') showBubble(ai, '!');
  else if (ai.rambro <= 0) restartRambro(ai, ai.alertDelay / 2);
}

/** PolymorphicAI.FollowPath: take this path, dropping whatever was queued. */
export function followPath(m: Unit, path: readonly PathPoint[]): void {
  const ai = m.ai;
  if (!ai || path.length === 0) return;
  setPath(ai.agent, [...path], m);
  const end = path[path.length - 1];
  ai.queue = [act('followPath', 0, end.c, end.r)];
}

/** PolymorphicAI.FullyAlert: Wait 0.2, "!", Wait sightDelay, face the player; a hidden mook leaps out. */
export function fullyAlert(m: Unit, stats: AiStats, x: number, y: number, rng: () => number = Math.random,
  scene?: AlertScene): void {
  const ai = m.ai;
  if (!ai || m.dead) return;
  if (m.kind === 'mook_scout') {
    scoutAlert(m, ai, stats, x, scene);
    return;
  }
  if (ai.mental === 'hiding') {
    ai.seenPlayer = true;
    setMental(ai, 'alerted');
    m.facing = x < m.x ? -1 : 1;
    m.xI = 5 * m.facing;
    ai.queue = [act('jump', 0.07), act('wait', randFloat(rng, 1, 1.1))]; // JumpOutOfHiding
    return;
  }
  if (ai.mental === 'alerted' || ai.mental === 'panicking' || ai.mental === 'attracted') return;
  ai.seenPlayer = true;
  ai.queue = [act('wait', AI_GREET_WAIT), act('greet'), act('wait', stats.sightDelay)];
  if (ai.agent.path) setPath(ai.agent, null, m);
  ai.walkDir = sign(x - m.x);
  ai.queue.push(act('face', 0, getColumn(x), getRow(y)));
  setMental(ai, 'alerted');
  if (m.kind === 'mook_bruiser') { // BigGuyAI.FullyAlert: he keeps shooting the way the alert came from
    if (x < m.x - 8) ai.attackingDir = -1;
    else if (x > m.x + 8) ai.attackingDir = 1;
    ai.thoughtsSinceSeen = 0;
  }
}

/** Map.GetNearestMookInterestPoint: Manhattan distance, scanning from the last one registered. */
function nearestDoor(doors: readonly DoorPoint[], c: number, r: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (let i = doors.length - 1; i >= 0; i--) {
    const d = Math.abs(doors[i].c - c) + Math.abs(doors[i].r - r);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/**
 * ScoutAI.FullyAlert: remember where the player was, speed up to runSpeed and run for the nearest mook
 * door (or 32 columns away from the noise), then pace in front of it until it gives up.
 */
function scoutAlert(m: Unit, ai: AiState, stats: AiStats, x: number, scene?: AlertScene): void {
  if (ai.mental === 'panicking' || ai.mental === 'attracted' || ai.mental === 'alerted') return;
  ai.seenPlayer = true;
  if (ai.agent.path) setPath(ai.agent, null, m);
  ai.walkDir = sign(x - m.x);
  setMental(ai, 'alerted');
  const player = alive(scene?.player ?? null);
  ai.startC = player ? getColumn(player.x) : unitColumn(m);
  ai.startR = player ? getRow(player.y) : unitRow(m);
  if (scene) ai.speed = scene.runSpeed;
  const doors = scene?.doors ?? [];
  let c: number;
  let r: number;
  if (ai.interest === null) ai.interest = nearestDoor(doors, unitColumn(m), unitRow(m));
  if (ai.interest !== null) {
    ({ c, r } = doors[ai.interest]);
  } else {
    c = getColumn(m.x);
    r = getRow(m.y);
    if (ai.runDir === 0) {
      const cols = scene?.map.cols ?? c + SCOUT_FLEE_COLUMNS;
      if (m.x - x < 0) {
        ai.runDir = -1;
        c = Math.min(Math.max(c - SCOUT_FLEE_COLUMNS, 1), c);
      } else {
        ai.runDir = 1;
        c = Math.min(Math.max(c + SCOUT_FLEE_COLUMNS, c), cols);
      }
    }
  }
  ai.queue = [act('greet', ACTION_TIME), act('wait', stats.sightDelay), act('followPath', 0, c, r), act('special2', ACTION_TIME)];
  for (let i = 0; i < 6; i++) ai.queue.push(act('move', 0, c - 1, r), act('move', 0, c + 1, r));
  ai.queue.push(act('becomeIdle', ACTION_TIME));
}

/** PolymorphicAI.HearSound (via Map.DisturbWildLife): an idle mook turns to the noise with a "?". */
export function hearSound(m: Unit, stats: AiStats, rng: () => number, x: number, y: number): void {
  const ai = m.ai;
  if (!ai || m.dead) return;
  if ((m.kind === 'mook_suicide' || m.kind === 'mook_scout') && ai.mental === 'alerted') return; // SuicideAI/ScoutAI.HearSound
  ai.thoughtsSinceSeen = 0;
  ai.suspiciousThinks = 0;
  const point = act('face', 0, getColumn(x), getRow(y));
  if (ai.mental === 'hiding') {
    ai.queue = [act('wait', 0.1 + rng()), act('question'), act('wait', 0.4)];
    m.facing = sign(x - m.x); // Mook.HearSound: a hidden mook turns to the noise at once
  } else if (ai.mental === 'idle') {
    setMental(ai, 'suspicious');
    ai.queue = [];
    if (m.facing === sign(x - m.x)) ai.queue.push(act('look'));
    ai.queue.push(act('wait', 0.2 + rng() * 0.9), act('question'), point, act('wait', 0.4));
  } else if (Math.abs(x - m.x) > 12 && ((m.facing < 0 && x > m.x) || (m.facing > 0 && m.x > x))) {
    if (ai.queue.some((a) => a.type === 'face')) return;
    ai.queue = [act('wait', 0.35)];
    ai.walkDir = sign(x - m.x); // FaceDirectionWhileAlerted
    ai.queue.push(point, act('wait', stats.sightDelay * 0.3 + randFloat(rng, 0.1, 0.5)));
  }
}

/** PolymorphicAI.TryLaughAtDeadPlayer: alerted mooks laugh, then go back to idle. */
export function playerDied(m: Unit, rng: () => number, laughIndex = m.id + 1): void {
  const ai = m.ai;
  if (!ai || m.dead) return;
  if (m.kind === 'mook_scout') {
    // ScoutAI.ForgetPlayer
    ai.startC = null;
    ai.interest = null;
    ai.runDir = 0;
  }
  if (!ai.seenPlayer) return;
  if (m.kind === 'mook_suicide' && ai.mental === 'alerted') return; // SuicideAI keeps charging
  if (ai.mental !== 'alerted') {
    ai.queue.push(act('becomeIdle'));
    return;
  }
  // AddLaughAction: a global laugh index staggers the laughs
  ai.queue = [];
  ai.mental = 'idle';
  ai.queue.push(act('wait', 0.3 + rng() * 0.2 + (laughIndex % 4) * 0.4), act('laugh'), act('wait', 0.8), act('look', 0.1));
  if (rng() > 0.5) {
    ai.queue.push(act('wait', 0.3 + rng() * 0.5), act('face', 0, ai.lastC - m.facing * 6, ai.lastR), act('look', 0.1),
      act('wait', 0.3));
  }
}

const sceneOf = (m: Unit, ctx: AiContext): AlertScene =>
  ({ player: ctx.player, doors: ctx.doors ?? [], map: ctx.map, runSpeed: ctx.runSpeed ?? m.stats.speed });

function lookForEnemy(m: Unit, ctx: AiContext): void {
  const p = alive(ctx.player);
  if (!p) return;
  if (m.ai?.mental === 'hiding') {
    // HeroController.GetNearestPlayer(X, Y + 8, hidingLookXRange, 20)
    if (Math.abs(p.x - m.x) < ctx.stats.hidingLookX && Math.abs(p.y - (m.y + 8)) < 20) {
      fullyAlert(m, ctx.stats, p.x, p.y, ctx.rng, sceneOf(m, ctx));
    }
    return;
  }
  if (canSeePlayer(m.x, m.y, m.facing, ctx.stats.sightX, ctx.stats.sightY, p, ctx.map)) {
    fullyAlert(m, ctx.stats, p.x, p.y, ctx.rng, sceneOf(m, ctx));
  }
}

/** PolymorphicAI.HideInGrass */
function hideInGrass(ai: AiState, rng: () => number): void {
  ai.queue = [act('wait', 1 + rng())];
  ai.mental = 'hiding';
}

/** PolymorphicAI.Panic: run along walkDirection (flipping it clears the plan). */
export function panicAi(m: Unit, direction: -1 | 1, forgetPlayer: boolean): boolean {
  const ai = m.ai;
  if (!ai) return false;
  if (direction !== ai.walkDir) {
    ai.walkDir = direction;
    ai.queue = [];
  }
  if (ai.mental === 'panicking') return false;
  ai.queue = [];
  ai.walkDir = direction;
  setMental(ai, 'panicking');
  if (forgetPlayer) ai.seenPlayer = false;
  return true;
}

/** Mook.Panic(time, forgetPlayer): panics in its walk direction and stays stunned for `time` (blindTime). */
export function panic(m: Unit, time: number, forgetPlayer: boolean): void {
  if (!m.ai) return;
  if (!m.dead && m.blindTime <= 0) panicAi(m, m.ai.walkDir, forgetPlayer);
  m.blindTime = Math.max(m.blindTime, time);
}

/** Mook.Blind(time) and PolymorphicAI.Blind: forgets the player, staggers 1-1.85 s, then fights blind. */
export function blind(m: Unit, time: number, rng: () => number = Math.random): void {
  const ai = m.ai;
  if (!ai) return;
  m.blindTime = Math.max(m.blindTime, time);
  if (m.dead) return;
  ai.queue = [act('wait', randFloat(rng, 1, 1.85))];
  ai.seenPlayer = false;
  setMental(ai, 'alerted');
}

/** PolymorphicAI.Attract: forgets the player and goes to have a look. */
export function attract(m: Unit, x: number, y: number, rng: () => number = Math.random): void {
  const ai = m.ai;
  if (!ai || m.dead) return;
  ai.attractC = getColumn(x);
  ai.attractR = getRow(y);
  if (ai.mental === 'attracted') return;
  ai.seenPlayer = false;
  ai.queue = [act('wait', rng() * 0.3)];
  setMental(ai, 'attracted');
}

/** PolymorphicAI.StopPanicking, from Mook.StopBurning. */
export function stopPanicking(m: Unit, map: TileMap, stats: AiStats): void {
  const ai = m.ai;
  if (!ai || ai.mental !== 'panicking') return;
  setupGrid(m, ai, map, stats.patrolRadius); // Reassess
  ai.queue = [];
  setMental(ai, ai.seenPlayer ? 'alerted' : 'idle');
}

/** PolymorphicAI.StopBeingBlind / StopPanicking, when Mook.blindTime runs out. */
function stopBeingBlind(m: Unit, ai: AiState, ctx: AiContext): void {
  if (ai.mental === 'alerted') ai.queue = [act('becomeIdle')];
  if (ai.mental === 'panicking') {
    setupGrid(m, ai, ctx.map, ctx.stats.patrolRadius); // Reassess
    ai.queue = [];
    setMental(ai, ai.seenPlayer ? 'alerted' : 'idle');
  }
}

/** ScoutAI.DoIdleThink: shorter waits, and it only looks around while well inside the screen. */
function scoutIdleThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng } = ctx;
  for (let i = 0; i < randInt(rng, 3, 6); i++) {
    const wait = randFloat(rng, 0.3, 0.6);
    if (rng() > 0.5) {
      const g = newGridPoint(m, ai, rng);
      ai.queue.push(act('move', wait, g.c, g.r));
    } else {
      ai.queue.push(act('wait', wait));
    }
    if (ctx.onScreen?.(m.x, m.y, -8, -8) ?? true) ai.queue.push(act('look'));
  }
}

/** PolymorphicAI.DoAlertedThink, which ScoutAI keeps: a wave, and it gives up after 6 thoughts without you. */
function baseAlertedThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng, stats, map } = ctx;
  const c = unitColumn(m);
  const r = unitRow(m);
  ai.queue.push(act('fire', stats.attackTime));
  if (!canSeePlayer(m.x, m.y, ai.walkDir, stats.sightX, stats.sightY, alive(ctx.player), map)) {
    ai.thoughtsSinceSeen++;
    if (ai.thoughtsSinceSeen > 2) ai.walkDir = rng() <= 0.5 ? -1 : 1;
    if (ai.thoughtsSinceSeen > 6) ai.queue.push(act('becomeIdle', ACTION_TIME));
  } else {
    ai.thoughtsSinceSeen = 0;
  }
  for (let i = 0; i < 3; i++) {
    if (rng() > 0.7 && (isAvailable(ai, c + ai.walkDir, r) || m.blindTime > 0)) {
      ai.queue.push(act('move', 0, c + ai.walkDir, r), act('wait', 0.4));
    } else if (rng() <= 0.5 || ai.queue[ai.queue.length - 1]?.type === 'fire') {
      ai.queue.push(act('wait', 0.4));
    }
  }
  ai.queue.push(act('wait', stats.delayBetweenFiring));
}

function idleThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng, stats } = ctx;
  if (m.kind === 'mook_scout') {
    scoutIdleThink(m, ai, ctx);
    return;
  }
  // the C# re-rolls Random.Range(3, 6) on every pass of the loop condition
  for (let i = 0; i < randInt(rng, 3, 6); i++) {
    let a = act('wait', randFloat(rng, stats.minIdleWait, stats.maxIdleWait));
    if (rng() > 0.5) {
      const g = newGridPoint(m, ai, rng);
      a = act('move', stats.maxIdleWait, g.c, g.r);
    }
    ai.queue.push(a, act('look'));
  }
  if (m.kind === 'mook_suicide' && rng() < 0.2) ai.queue.push(act('special2', 1.5)); // SuicideAI: UseSpecial2 for 1.5 s
}

function suspiciousThink(m: Unit, ai: AiState, ctx: AiContext): void {
  ai.suspiciousThinks++;
  ai.queue.push(act('wait', 0.3), act('look'));
  if (ai.suspiciousThinks > 10 && ctx.rng() > 0.8) {
    ai.suspiciousThinks = 8;
    ai.queue.push(act('face', 0, getColumn(m.x) - m.facing * 2, getRow(m.y)));
  }
  ai.queue.push(act('wait', 0.3));
}

/** The shared tail of the alerted thinks: up to three single steps along walkDirection, or pauses. */
function shuffle(ai: AiState, c: number, r: number, rng: () => number, pauseFirst: boolean): void {
  for (let i = 0; i < 3; i++) {
    if (rng() > 0.7 && isAvailable(ai, c + ai.walkDir, r)) {
      if (pauseFirst) ai.queue.push(act('wait', 0.2));
      ai.queue.push(act('move', 0, c + ai.walkDir, r), act('wait', 0.4));
    } else if (rng() <= 0.5 || ai.queue[ai.queue.length - 1]?.type === 'fire') {
      ai.queue.push(act('wait', 0.4));
    }
  }
}

/** MookTrooperAI.DoAlertedThink: one shot, sometimes a second, a little shuffling, then delayBetweenFiring. */
function trooperThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng, stats, map } = ctx;
  const p = alive(ctx.player);
  const c = getColumn(m.x);
  const r = getRow(m.y);
  if (m.blindTime > 0) {
    if (isThisWay(p, m.x, m.facing)) ai.walkDir = ai.walkDir === 1 ? -1 : 1; // blinded, it turns its back on you
  } else if (!canSeePlayer(m.x, m.y, ai.walkDir, stats.sightX, stats.sightY, p, map)) {
    ai.thoughtsSinceSeen++;
    if (ai.thoughtsSinceSeen > 2) ai.walkDir = rng() <= 0.5 ? -1 : 1;
  } else {
    ai.thoughtsSinceSeen = 0;
    if (!isThisWay(p, m.x, ai.walkDir)) {
      ai.walkDir = ai.walkDir === 1 ? -1 : 1;
      ai.queue.push(act('move', 0, c + ai.walkDir, r), act('wait', stats.sightDelay));
    }
  }
  ai.queue.push(act('fire', stats.attackTime));
  if (ai.thoughtsSinceSeen > 1 && rng() > 0.7 && isThisWay(p, m.x, ai.walkDir) && p && Math.abs(p.y - m.y) < 36) {
    ai.queue.push(act('wait', 0.27), act('fire', stats.attackTime));
  }
  shuffle(ai, c, r, rng, true);
  ai.queue.push(act('wait', stats.delayBetweenFiring));
}

/** MookBazookaAi.DoAlertedThink: loses interest ("?") quickly; fires midway through delayBetweenFiring. */
function bazookaThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng, stats, map } = ctx;
  if (!canSeePlayer(m.x, m.y, ai.walkDir, stats.sightX, stats.sightY, alive(ctx.player), map)) {
    ai.thoughtsSinceSeen++;
    if (ai.thoughtsSinceSeen > 1) {
      setMental(ai, 'suspicious');
      ai.queue.push(act('wait', 0.5));
      showBubble(ai, '?');
      ai.thoughtsSinceSeen = 0;
    }
  } else {
    ai.thoughtsSinceSeen = 0;
  }
  if (ai.mental === 'alerted') {
    ai.queue.push(act('wait', stats.delayBetweenFiring / 2), act('fire', stats.attackTime), act('wait', stats.delayBetweenFiring / 2));
  }
  shuffle(ai, getColumn(m.x), getRow(m.y), rng, false);
}

/**
 * BigGuyAI.DoAlertedThink: the Bruiser turns back to the way he was shooting, sprays the minigun for attackTime, and
 * after a few thoughts without the bro he looks around, then gives up with a "?".
 */
function bruiserThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const { rng, stats, map } = ctx;
  if (ai.attackingDir !== 0 && m.facing !== ai.attackingDir) {
    ai.queue.push(act('face', 0, getColumn(m.x) - m.facing * 6, getRow(m.y)), act('wait', stats.sightDelay));
  }
  ai.queue.push(act('fire', stats.attackTime));
  if (!canSeePlayer(m.x, m.y, ai.walkDir, stats.sightX, stats.sightY, alive(ctx.player), map)) {
    ai.thoughtsSinceSeen++;
    if (ai.thoughtsSinceSeen > 2) {
      ai.walkDir = rng() <= 0.5 ? -1 : 1;
      ai.attackingDir = 0;
    }
    if (ai.thoughtsSinceSeen > 6) ai.queue.push(act('becomeIdle', ACTION_TIME), act('question'), act('wait', 0.25));
  } else {
    ai.thoughtsSinceSeen = 0;
    ai.attackingDir = ai.walkDir;
  }
  ai.queue.push(act('wait', 0.4), act('wait', stats.delayBetweenFiring));
}

/** SuicideAI.DoAlertedThink: keep running at the last place the player was seen. */
function suicideThink(m: Unit, ai: AiState, ctx: AiContext): void {
  const p = alive(ctx.player);
  if (ai.seenPlayer) {
    if (p && canSeePlayer(m.x, m.y + 2, 0, ctx.stats.sightX, ctx.stats.sightY, p, ctx.map)) {
      ai.walkDir = sign(p.x - m.x);
      ai.thoughtsSinceSeen = 0;
    } else {
      ai.thoughtsSinceSeen++;
    }
  }
  ai.queue.push(act('move', 0, getColumn(m.x) + ai.walkDir, getRow(m.y))); // Random.Range(1, 2) is always 1
}

/** PolymorphicAI.DoHidingThink */
function hidingThink(ai: AiState, rng: () => number): void {
  ai.queue.push(act('wait', randFloat(rng, 0.25, 0.3)), act('look'), act('wait', randFloat(rng, 0.25, 0.3)), act('look'));
}

/** PolymorphicAI.DoAttractedThink */
function attractedThink(m: Unit, ai: AiState, rng: () => number): void {
  const c = getColumn(m.x);
  let dir = Math.sign(ai.attractC - c);
  if (dir === 0) dir = rng() <= 0.5 ? -1 : 1;
  if (rng() < 0.7) ai.queue.push(act('question'));
  ai.queue.push(act('wait', 0.3), act('move', 0, c + dir * randInt(rng, 2, 4), getRow(m.y)), act('becomeIdle'));
}

function think(m: Unit, ai: AiState, ctx: AiContext): void {
  if (ai.mental === 'idle') idleThink(m, ai, ctx);
  else if (ai.mental === 'suspicious') suspiciousThink(m, ai, ctx);
  else if (ai.mental === 'hiding') hidingThink(ai, ctx.rng);
  else if (ai.mental === 'attracted') attractedThink(m, ai, ctx.rng);
  else if (ai.mental === 'panicking') {
    ai.queue.push(act('move', 0, getColumn(m.x) + ai.walkDir * randInt(ctx.rng, 2, 4), getRow(m.y))); // DoPanicThink
  }
  else if (m.kind === 'mook_suicide' || m.kind === 'dog') suicideThink(m, ai, ctx); // DogAI: it runs at the bro too
  else if (m.kind === 'mook_bazooka' || m.kind === 'mook_grenadier') bazookaThink(m, ai, ctx); // the grenadier's AI is MookBazookaAi
  else if (m.kind === 'mook_scout') baseAlertedThink(m, ai, ctx);
  else if (m.kind === 'mook_bruiser') bruiserThink(m, ai, ctx);
  else trooperThink(m, ai, ctx);
}

const targetX = (ai: AiState, a: AiAction): number => a.c * TILE + ai.blockOffset;

function atGridPoint(m: Unit, ai: AiState, a: AiAction): boolean {
  const near = Math.abs(m.x - targetX(ai, a)) < UNIT_HALF_WIDTH;
  return m.kind === 'mook_suicide' || m.kind === 'dog' ? near : near && getRow(m.y) === a.r; // SuicideAI ignores the row
}

function remove(ai: AiState, a: AiAction): void {
  const i = ai.queue.indexOf(a);
  if (i >= 0) ai.queue.splice(i, 1);
}

/** PolymorphicAI.RunQueue: ticks the front action. */
function runQueue(m: Unit, ai: AiState, ctx: AiContext, t: number): void {
  const a = ai.queue[0];
  if (!a) return;
  switch (a.type) {
    case 'wait':
    case 'fire':
    case 'special2':
    case 'jump':
      a.duration -= t; // RunNormalAction
      if (a.duration <= 0) remove(ai, a);
      return;
    case 'move': {
      if (atGridPoint(m, ai, a)) {
        remove(ai, a);
        ai.stuckTime = 0;
        ai.sameSpotTime = 0;
      }
      ai.walkDir = m.facing;
      if (blockedForward(m, ai.walkDir, ctx.map) && (ai.stuckTime += t) > AI_STUCK_TIME) {
        remove(ai, a);
        ai.stuckTime = 0;
      }
      const c = getColumn(m.x);
      const r = getRow(m.y);
      if (c === ai.lastC && r === ai.lastR) {
        if ((ai.sameSpotTime += t) > AI_SAME_SPOT_TIME) {
          remove(ai, a);
          ai.sameSpotTime = 0;
        }
      } else {
        ai.lastC = c;
        ai.lastR = r;
        ai.sameSpotTime = 0;
      }
      return;
    }
    case 'look':
      lookForEnemy(m, ctx);
      remove(ai, a);
      return;
    case 'greet':
    case 'laugh': // GreetPlayer and LaughAtPlayer both restart the exclamation bubble
      exclaim(m, ai);
      remove(ai, a);
      return;
    case 'followPath': {
      if (ai.repathCount > MAX_REPATHS || (unitColumn(m) === a.c && unitRow(m) === a.r)) {
        ai.repathCount = 0;
        remove(ai, a);
      } else if (!ai.agent.path && ctx.path) {
        ai.repathCount++;
        getPath(ai.agent, m, a.c, a.r, ctx.path, ctx.map, PATH_TIME_LIMIT, ctx.rng);
      }
      if (a.duration > 0 && (a.duration -= t) <= 0) {
        setPath(ai.agent, null, m);
        remove(ai, a);
      }
      return;
    }
    case 'question':
      showBubble(ai, '?');
      remove(ai, a);
      return;
    case 'face':
      a.duration -= t;
      if (a.duration < -AI_FACE_LINGER) remove(ai, a);
      return;
    case 'becomeIdle':
      if (ai.mental !== 'idle') {
        ai.mental = 'idle';
        setupGrid(m, ai, ctx.map, ctx.stats.patrolRadius); // Reassess
      }
      ai.queue = [];
  }
}

interface Input {
  dir: -1 | 0 | 1;
  fire: boolean;
  down?: boolean;
  jump?: boolean;
}

/** PolymorphicAI.GetInput for the front action. */
function input(m: Unit, ai: AiState, a: AiAction | undefined, ctx: AiContext, t: number): Input {
  const hiding = ai.mental === 'hiding';
  if (!a) return { dir: 0, fire: false, down: hiding };
  if (a.type === 'followPath') {
    const keys = ai.agent.path ? getMove(ai.agent, m, ctx.map, ctx.path?.agentSize ?? 0, t) : null;
    if (!keys) return { dir: 0, fire: false };
    return { dir: keys.left === keys.right ? 0 : keys.left ? -1 : 1, fire: false, down: keys.down, jump: keys.jump };
  }
  if ((a.type === 'wait' || a.type === 'look') && hiding) return { dir: 0, fire: false, down: true };
  if (a.type === 'jump') return { dir: m.facing, fire: false, jump: true }; // RunJumpingInput
  if (a.type === 'face' && hiding) {
    const c = getColumn(m.x);
    if (c > a.c && m.facing > 0) m.facing = -1; // ForceFaceDirection
    if (c < a.c && m.facing < 0) m.facing = 1;
    return { dir: 0, fire: false, down: true };
  }
  if (a.type === 'fire') return { dir: 0, fire: m.onGround };
  if (a.type === 'move' && m.onGround) {
    const tx = targetX(ai, a);
    if (Math.abs(m.x - tx) > 1) return { dir: m.x > tx ? -1 : 1, fire: false };
  }
  if (a.type === 'face' && m.onGround) {
    const c = getColumn(m.x);
    if (c > a.c && m.facing > 0) return { dir: -1, fire: false };
    if (c < a.c && m.facing < 0) return { dir: 1, fire: false };
  }
  return { dir: 0, fire: false };
}

/**
 * ScoutAI.GetInput: while alerted it waves (fires) every 0.7-1.5 s with the Rambro face up, shouting to the
 * mooks around it while it runs; at the door, it sends the door's mooks to where it saw the player.
 */
function scoutInput(m: Unit, ai: AiState, front: AiAction | undefined, ctx: AiContext, t: number, out: AiOutput): boolean {
  let fire = false;
  if (ai.mental === 'alerted' && (ai.alertDelay -= t) < 0) {
    ai.alertDelay = randFloat(ctx.rng, 0.7, 1.5);
    if (front?.type === 'followPath') out.alertNearby = true;
    if (front) {
      fire = true;
      restartRambro(ai, ai.alertDelay / 2);
    }
  }
  const door = ai.interest !== null ? ctx.doors?.[ai.interest] : undefined;
  if (front?.type === 'special2' && door && ai.interest !== null && ai.startC !== null
    && Math.hypot(m.x - door.x, m.y - door.y) < SCOUT_DOOR_REACH) {
    out.alarm = { door: ai.interest, c: ai.startC, r: ai.startR };
  }
  return fire;
}

/** One step of a mook's AI. `fire` is the trigger held down; `explode` is a suicide mook setting itself off. */
export function thinkMook(m: Unit, ctx: AiContext, t: number): AiOutput {
  const ai = m.ai;
  if (!ai || m.dead || ai.exploded) return IDLE;
  if (ai.bubble && (ai.bubbleTime -= t) <= 0) ai.bubble = null;
  if (ai.rambro > 0) ai.rambro -= t;
  if (m.blindTime > 0 && (m.blindTime -= t) <= 0) {
    m.blindTime = 0;
    stopBeingBlind(m, ai, ctx);
  }
  // PolymorphicAI.Update: an idle mook off screen neither sets up nor thinks (LateUpdate still runs its queue)
  const thinking = ai.mental !== 'idle' || ctx.visible !== false;
  if (thinking && !ai.setup) {
    setupGrid(m, ai, ctx.map, ctx.stats.patrolRadius); // InitialSetup
    if (m.stats.canHideInGrass && ctx.inGrass?.(m.x, m.y, 3)) hideInGrass(ai, ctx.rng);
    ai.setup = true;
  }
  runQueue(m, ai, ctx, t);
  if (thinking && ai.queue.length === 0) think(m, ai, ctx);
  const front = ai.queue[0];
  const keys = input(m, ai, front, ctx, t);
  let { dir, fire, down, jump } = keys;
  const out: AiOutput = { intent: NO_INTENT, fire: false, explode: false };
  if (m.kind === 'mook_scout') fire = scoutInput(m, ai, front, ctx, t, out) || fire;
  if (m.exitDoor) {
    // Mook.GetEnemyMovement: walking out of its door, a mook only heads for the door's x
    dir = m.exitDoor.dir < 0 ? -1 : 1;
    if ((dir < 0 && m.x <= m.exitDoor.x) || (dir > 0 && m.x >= m.exitDoor.x)) {
      m.exitDoor = null;
      dir = 0;
    }
    fire = down = jump = false;
  }
  if (m.kind === 'mook_suicide' && front?.type === 'special2' && m.special2 < 0 && m.onGround) m.special2 = 0;
  const intent: MoveIntent = { dir, jumpPressed: !!jump && !ai.wasJump, jumpHeld: !!jump, dash: false, down: !!down };
  if (ai.speed !== null) intent.speed = ai.speed;
  if (m.kind === 'dog' && ai.mental === 'alerted' && ctx.dogRunSpeed) intent.speed = ctx.dogRunSpeed; // MookDog.awareRunSpeed
  ai.wasJump = !!jump;
  if (m.kind !== 'mook_suicide') return { ...out, intent, fire };

  // SuicideAI.Update / GetInput and MookSuicide.AnimateRunning
  if (ai.litFuse) {
    ai.suicideDelay -= t;
    ai.suicideTimer -= t;
  }
  if (ai.suicideTimer <= 0) return { ...IDLE, explode: true };
  let explode = false;
  if (ai.mental === 'alerted') {
    intent.speed = SUICIDE_SPEED_ALERTED;
    if (!ai.litFuse && dir !== 0 && m.onGround && ai.queue[0]) ai.litFuse = true;
    if (ai.suicideDelay <= 0 && dir !== 0) {
      if (blockedForward(m, ai.walkDir, ctx.map)) ai.suicideTimer -= t * SUICIDE_BLOCKED_M;
      const p = alive(ctx.player);
      if (p && sign(p.x - m.x) === ai.walkDir && Math.abs(p.x - m.x) < SUICIDE_TRIGGER && Math.abs(p.y - m.y) < SUICIDE_TRIGGER) {
        explode = true;
      }
    }
  }
  return { intent, fire: false, explode };
}
