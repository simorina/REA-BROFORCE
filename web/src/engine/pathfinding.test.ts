import { describe, expect, it } from 'vitest';
import { followPath, thinkMook } from './ai';
import { FIXED_DT, TILE } from './constants';
import { TileMap, makeBlock } from './map';
import { getMove, makeAgent, setPath, unitColumn, unitRow } from './pathagent';
import { findPath } from './pathfinding';
import { stepUnit } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { PathCaps, PathPoint } from './types';

const MOOK: PathCaps = TEST_STATS.paths.mook; // jumpHeight 3, maxDropDistance 4

/** A map from rows of text, the top row first; '#' is dirt. */
function grid(rows: string[]): TileMap {
  const map = new TileMap(rows[0].length, rows.length);
  rows.forEach((line, i) => {
    for (let c = 0; c < line.length; c++) if (line[c] === '#') map.set(c, rows.length - 1 - i, makeBlock('dirt', TEST_STATS));
  });
  return map;
}

const cells = (path: PathPoint[] | null) => (path ?? []).map((p) => [p.c, p.r]);
const end = (path: PathPoint[] | null) => cells(path).at(-1);

describe('findPath (PathfindingController.FindPath)', () => {
  const flat = grid(['..........', '..........', '..........', '##########']);

  it('walks along the ground, one cell at a time', () => {
    const path = findPath(flat, 1, 1, 6, 1, MOOK, 10);
    expect(cells(path)).toEqual([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]);
    expect(path?.every((p) => p.mode === 'normal')).toBe(true);
  });

  it('jumps up a two-block step and lands on it', () => {
    const step = grid(['..........', '..........', '.....#####', '.....#####', '##########']);
    const path = findPath(step, 1, 1, 7, 3, MOOK, 10);
    expect(end(path)).toEqual([7, 3]);
    expect(path?.some((p) => p.mode === 'jump')).toBe(true);
  });

  it('cannot jump three blocks up with jumpHeight 3: it settles for the closest standable cell', () => {
    const wall = grid(['..........', '..........', '.....#####', '.....#####', '.....#####', '##########']);
    const path = findPath(wall, 1, 1, 7, 4, MOOK, 10);
    expect(end(path)).toEqual([4, 1]);
  });

  it('drops off a ledge lower than maxDropDistance, but not off a higher one', () => {
    // three blocks down: it steps off, drifts a cell sideways and drops the rest
    const low = grid(['..........', '#####.....', '#####.....', '#####.....', '##########']);
    expect(end(findPath(low, 3, 4, 7, 1, MOOK, 10))).toEqual([7, 1]);
    const high = grid(['..........', '#####.....', '#####.....', '#####.....', '#####.....', '#####.....', '##########']);
    expect(end(findPath(high, 3, 6, 7, 1, MOOK, 10))).toEqual([4, 6]);
  });

  it('returns null when nothing at all is reachable', () => {
    const boxed = grid(['###', '#.#', '###']);
    expect(findPath(boxed, 1, 1, 5, 5, MOOK, 10)).toBeNull();
  });

  it('stops at its time budget with the best point so far', () => {
    const wide = grid(['.'.repeat(200), '#'.repeat(200)]);
    const path = findPath(wide, 1, 1, 190, 1, MOOK, 0.5);
    const last = end(path) as number[];
    expect(last[1]).toBe(1);
    expect(last[0]).toBeGreaterThan(1);
    expect(last[0]).toBeLessThan(190);
  });
});

describe('PathAgent', () => {
  it('walks a mook along a path up a step (GetMove)', () => {
    const map = grid(['..........', '..........', '..........', '.....#####', '.....#####', '##########']);
    const m = makeUnit(1, 'mook', 'enemy', 1 * TILE, TILE - 8, TEST_STATS.units.mook);
    const path = findPath(map, 1, 1, 7, 3, MOOK, 10);
    const agent = makeAgent();
    setPath(agent, path, m);
    let time = 0;
    let jumped = false;
    for (let i = 0; i < 4 * 60 && agent.path; i++) {
      time += FIXED_DT;
      const keys = getMove(agent, m, map, MOOK.agentSize, FIXED_DT);
      if (!keys) break;
      jumped ||= keys.jump;
      const dir = keys.left === keys.right ? 0 : keys.left ? -1 : 1;
      stepUnit(m, { dir, jumpPressed: keys.jump, jumpHeld: keys.jump, dash: false }, map, FIXED_DT, time);
    }
    expect(jumped).toBe(true);
    expect([unitColumn(m), unitRow(m)]).toEqual([7, 3]);
  });

  it('FollowPath: a mook sent along a path gets there and drops the action', () => {
    const map = grid(['..............', '..............', '..............', '.......#######', '.......#######', '##############']);
    const m = makeUnit(1, 'mook', 'enemy', 1 * TILE, TILE - 8, TEST_STATS.units.mook);
    followPath(m, findPath(map, 1, 1, 10, 3, MOOK, 10) ?? []);
    expect(m.ai?.queue[0]).toMatchObject({ type: 'followPath', c: 10, r: 3 });
    let time = 0;
    for (let i = 0; i < 5 * 60 && m.ai?.queue[0]?.type === 'followPath'; i++) {
      time += FIXED_DT;
      const out = thinkMook(m, { map, player: null, rng: () => 0.5, stats: TEST_STATS.ai.mook, path: MOOK }, FIXED_DT);
      stepUnit(m, out.intent, map, FIXED_DT, time);
    }
    expect([unitColumn(m), unitRow(m)]).toEqual([10, 3]);
    expect(m.ai?.queue[0]?.type).not.toBe('followPath');
  });

  it('FollowPath repaths when the path is lost, and gives up after five tries', () => {
    const map = grid(['..........', '..........', '.....#####', '.....#####', '.....#####', '##########']);
    const m = makeUnit(1, 'mook', 'enemy', 1 * TILE, TILE - 8, TEST_STATS.units.mook);
    const ai = m.ai!;
    ai.queue = [{ type: 'followPath', duration: 0, c: 8, r: 4 }]; // up a wall too high to jump
    let time = 0;
    for (let i = 0; i < 20 * 60 && ai.queue[0]?.type === 'followPath'; i++) {
      time += FIXED_DT;
      const out = thinkMook(m, { map, player: null, rng: () => 0.5, stats: TEST_STATS.ai.mook, path: MOOK }, FIXED_DT);
      stepUnit(m, out.intent, map, FIXED_DT, time);
    }
    expect(ai.queue[0]?.type).not.toBe('followPath');
    expect(m.x).toBeLessThan(5 * TILE - 8); // as close as it could get, at the foot of the wall
    expect(m.x).toBeGreaterThan(3 * TILE);
  });
});
