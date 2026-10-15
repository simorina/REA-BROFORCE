import { HALF_TILE, TILE } from './constants';
import { getColumn, getRow, type TileMap } from './map';
import { findPath, isBlockSolid } from './pathfinding';
import type { PathAgentState, PathCaps, PathPoint, Unit } from './types';

/**
 * A port of PathAgent: walks a unit along a NavPath by pressing left, right and jump the way a player
 * would. Ladders, roof climbing and flying are left out, as in pathfinding.ts.
 */
export interface PathInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
}

const NONE: PathInput = { left: false, right: false, up: false, down: false, jump: false };
const STUCK_RELEASE_FROM = 0.6; // GetMove: between 0.6 and 0.7 s on one node every key is let go ...
const STUCK_RELEASE_TO = 0.7;
const STUCK_GIVE_UP = 1; // ... and after 1 s the path is dropped

/** TestVanDammeAnim.CalculateGridPosition: the cell a unit is in. */
export const unitColumn = (u: Unit): number => Math.floor((u.x + HALF_TILE) / TILE);
export const unitRow = (u: Unit): number => Math.floor((u.y + TILE) / TILE);

const sign = (v: number): -1 | 0 | 1 => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function makeAgent(): PathAgentState {
  return {
    path: null, index: 0, stuck: 0, reachedCenter: false, startX: 0, startY: 0, agentX: 0, agentY: 0, targetX: 0,
    targetY: 0, direction: 0, jitter: 0,
  };
}

/** PathAgent.InitCurrentNavPoint: where the unit set off for the current node. */
function initNavPoint(a: PathAgentState, u: Unit): void {
  a.reachedCenter = false;
  if (a.path && a.index > 0 && a.index < a.path.length) {
    const prev = a.path[a.index - 1];
    a.startX = prev.c * TILE;
    a.startY = prev.r * TILE;
  } else {
    a.startX = getColumn(u.x) * TILE;
    a.startY = getRow(u.y) * TILE;
  }
}

/** The PathAgent.CurrentPath setter. */
export function setPath(a: PathAgentState, path: PathPoint[] | null, u: Unit): void {
  a.stuck = 0;
  a.index = 0;
  a.path = path ? [...path] : null;
  initNavPoint(a, u);
}

/**
 * PathAgent.GetPath. It assigns the path field, not the property, so the node index is left alone; it is
 * only ever called once the old path is gone, so MergePaths never has anything to merge.
 */
export function getPath(a: PathAgentState, u: Unit, c: number, r: number, caps: PathCaps, map: TileMap, timeLimitMs: number,
  rng: () => number): void {
  a.path = findPath(map, unitColumn(u), unitRow(u), c, r, caps, timeLimitMs, rng);
}

const currentNode = (a: PathAgentState): PathPoint | null =>
  (a.path && a.index >= 0 && a.index < a.path.length ? a.path[a.index] : null);

function goNextPoint(a: PathAgentState, u: Unit): void {
  a.index++;
  a.stuck = 0;
  initNavPoint(a, u);
}

/** CheckWhetherToAdvanceNode, against the positions of the previous call as in the C#. */
function shouldAdvance(a: PathAgentState, u: Unit, agentSize: number): boolean {
  const node = currentNode(a);
  if (!node) return false;
  const row = unitRow(u);
  if (a.direction > 0 && a.agentX > a.targetX && row === node.r) return true;
  if (a.direction < 0 && a.agentX < a.targetX && row === node.r) return true;
  return (a.agentX - a.targetX) ** 2 + (a.agentY - a.targetY) ** 2 < agentSize * agentSize;
}

/** ApplyNaiveDirectionalMovement */
function naive(a: PathAgentState, u: Unit, out: PathInput): void {
  if (a.agentX - a.targetX < -0.9) out.right = true;
  if (a.agentX - a.targetX > 0.9) out.left = true;
  if (a.direction === 0 && Math.abs(a.agentX - a.targetX) < 2 && u.onGround) u.xI *= 0.5;
  if (a.agentY - a.targetY < 0) out.up = true;
  if (a.agentY - a.targetY > 0) out.down = true;
}

/** PerformJitterPrevention: in the air, never turn back on the way the unit was steering. */
function preventJitter(a: PathAgentState, u: Unit, out: PathInput): void {
  if (u.onGround) {
    a.jitter = 0;
    return;
  }
  if (out.left) {
    if (a.jitter > 0) out.left = false;
    else a.jitter = -1;
  }
  if (out.right) {
    if (a.jitter < 0) out.right = false;
    else a.jitter = 1;
  }
}

/** PathAgent.GetMove: the keys to press this step, or null once there is no path to follow. */
export function getMove(a: PathAgentState, u: Unit, map: TileMap, agentSize: number, t: number): PathInput | null {
  const col = unitColumn(u);
  const row = unitRow(u);
  const out: PathInput = { ...NONE };
  if (shouldAdvance(a, u, agentSize)) goNextPoint(a, u);
  const p = a.path;
  if (p && a.index === 0 && p.length > 1 && p[0].mode === 'normal' && p[1].mode === 'normal' && p[0].r === p[1].r) {
    // already between the first two nodes: skip the one behind
    const x0 = p[0].c * TILE;
    const x1 = p[1].c * TILE;
    if ((x0 < u.x && x1 > u.x) || (x0 > u.x && x1 < u.x)) goNextPoint(a, u);
  }
  if (a.path && a.index >= a.path.length) setPath(a, null, u);
  const path = a.path;
  if (!path) return null;
  const node = path[a.index];
  a.targetX = node.c * TILE;
  a.targetY = node.r * TILE;
  a.direction = sign(node.c - col);
  a.agentX = u.x;
  a.agentY = u.y + HALF_TILE;
  const jumping = !u.onGround; // ActionState.Jumping
  if (node.mode === 'jump') {
    if (!a.reachedCenter) {
      if (a.direction > 0 && a.agentX > a.startX) out.left = true;
      else if (a.direction < 0 && a.agentX < a.startX) out.right = true;
      else {
        a.reachedCenter = true;
        if (a.direction < 0) out.left = true;
        if (a.direction > 0) out.right = true;
      }
      if ((Math.abs(a.agentX - a.startX) < 5 || node.c === col) && u.onGround) a.reachedCenter = true;
    } else {
      naive(a, u, out);
      if (!jumping) {
        if (isBlockSolid(map, col + a.direction, row) || Math.abs(a.agentX - a.startX) > agentSize * 0.75 || node.c === col) out.jump = true;
      } else if (a.agentY < a.targetY) {
        out.jump = true;
      }
    }
  } else {
    naive(a, u, out);
    if (a.agentY - a.targetY > 0) out.down = u.wallClimbing;
  }
  if (jumping && a.agentY >= a.targetY
    && ((a.startX < a.targetX && a.agentX >= a.targetX) || (a.startX > a.targetX && a.agentX <= a.targetX))) {
    goNextPoint(a, u);
    if (a.index < path.length) {
      a.direction = sign(path[a.index].c - col);
      if (a.direction > 0) {
        out.right = true;
        out.left = false;
      }
      if (a.direction < 0) {
        out.left = true;
        out.right = false;
      }
    }
  }
  if (node.mode === 'wallClimbLeft' || node.mode === 'wallClimbRight') {
    out.left = node.mode === 'wallClimbLeft';
    out.right = !out.left;
    if (a.startY < a.targetY) {
      out.jump = out.up = true;
      out.down = false;
      if (a.agentY > a.targetY + 12) goNextPoint(a, u);
    } else {
      out.jump = out.up = false;
      out.down = true;
      if (a.agentY < a.targetY - 10) goNextPoint(a, u);
    }
  }
  // standing on a later node of the path: skip ahead to it
  const here = path.findIndex((q) => q.c === col && q.r === row);
  if (here > a.index) {
    a.index = here;
    a.stuck = 0;
  }
  a.stuck += t;
  if (a.stuck > STUCK_RELEASE_FROM && a.stuck < STUCK_RELEASE_TO) {
    if (currentNode(a)) Object.assign(out, NONE);
  } else if (a.stuck > STUCK_GIVE_UP) {
    setPath(a, null, u);
  }
  preventJitter(a, u, out);
  return out;
}
