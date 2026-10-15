import type { TileMap } from './map';
import type { PathCaps, PathMoveMode, PathPoint } from './types';

/**
 * A port of PathfindingController.FindPath: A* over grid cells with a Manhattan heuristic, where a cell
 * is reached by walking, jumping (straight up or diagonally), drifting down from the air, dropping or
 * wall climbing. Ladders, roof climbing and flying are left out: nothing in Brolusconi's levels uses them.
 *
 * The C# stops after a time limit in milliseconds (10 for PolymorphicAI's FollowPath, 100 for a mook door)
 * and falls back on the best point found so far; this port counts expanded points instead, so the result
 * does not depend on the machine (see PATH_EXPANSIONS_PER_MS).
 */
export const PATH_EXPANSIONS_PER_MS = 60;

/** Map.IsBlockSolid: outside the map counts as solid, above and below included. */
export const isBlockSolid = (map: TileMap, c: number, r: number): boolean => !map.inBounds(c, r) || map.get(c, r) !== null;

const makePoint = (c: number, r: number, g: number, mode: PathMoveMode = 'normal'): PathPoint =>
  ({ c, r, g, mode, f: 0, h: 0, previous: null });

const heuristic = (c: number, r: number, toC: number, toR: number): number => Math.abs(r - toR) + Math.abs(c - toC);

const cellKey = (c: number, r: number): number => (c + 1024) * 8192 + (r + 1024);

/** A List<PathPoint> with its order kept for the C#'s first-match scans, indexed by cell for speed. */
class PointList {
  readonly items: PathPoint[] = [];
  private readonly byCell = new Map<number, PathPoint[]>();

  add(p: PathPoint): void {
    this.items.push(p);
    const k = cellKey(p.c, p.r);
    const bucket = this.byCell.get(k);
    if (bucket) bucket.push(p);
    else this.byCell.set(k, [p]);
  }

  remove(p: PathPoint): void {
    const i = this.items.indexOf(p);
    if (i >= 0) this.items.splice(i, 1);
    const bucket = this.byCell.get(cellKey(p.c, p.r));
    const j = bucket ? bucket.indexOf(p) : -1;
    if (bucket && j >= 0) bucket.splice(j, 1);
  }

  /** PathfindingController.IsInSet: same cell and move mode. */
  has(c: number, r: number, mode: PathMoveMode): boolean {
    return (this.byCell.get(cellKey(c, r)) ?? []).some((p) => p.mode === mode);
  }

  /** FindSimilarPoint: the first point of the cell in list order, whatever its mode. */
  similar(p: PathPoint): PathPoint | null {
    const bucket = this.byCell.get(cellKey(p.c, p.r));
    if (!bucket || bucket.length === 0) return null;
    let best: PathPoint | null = null;
    let bestIndex = Infinity;
    for (const q of bucket) {
      if (q === p) continue;
      const i = this.items.indexOf(q);
      if (i < bestIndex) {
        bestIndex = i;
        best = q;
      }
    }
    return best;
  }

  get size(): number {
    return this.items.length;
  }
}

/** GetAccessiblePoints: lazily, as the C# iterator, so its set checks see the sets as the loop changes them. */
function* accessiblePoints(map: TileMap, point: PathPoint, caps: PathCaps, open: PointList, closed: PointList):
  Generator<PathPoint> {
  const solid = (c: number, r: number) => isBlockSolid(map, c, r);
  const { c, r, g } = point;
  if (solid(c, r - 1)) {
    if (!solid(c + 1, r) && !closed.has(c + 1, r, 'normal')) yield makePoint(c + 1, r, g + 1);
    if (!solid(c - 1, r) && !closed.has(c - 1, r, 'normal')) yield makePoint(c - 1, r, g + 1);
    if (caps.canJump) {
      let max = caps.jumpHeight;
      for (let i = 1; i < max; i++) {
        if (solid(c, r + i)) break;
        yield makePoint(c, r + i, g + 2 + i, 'jump');
      }
      max = solid(c - 1, r) ? Math.min(caps.jumpHeight, 2) : caps.jumpHeight;
      for (let j = 1; j < max; j++) {
        if (solid(c - j, r + j) || solid(c - j, r + j + 1) || solid(c - j + 1, r + j)) break;
        yield makePoint(c - j, r + j, g + (1.5 + j * 1.5), 'jump');
      }
      max = solid(c + 1, r) ? Math.min(caps.jumpHeight, 2) : caps.jumpHeight;
      for (let k = 1; k < max; k++) {
        if (solid(c + k, r + k) || solid(c + k, r + k + 1) || solid(c + k - 1, r + k)) break;
        yield makePoint(c + k, r + k, g + (1.5 + k * 1.5), 'jump');
      }
    }
  } else {
    // in the air: drift a cell sideways while falling, if this fall began on the ground or in a jump
    let canDrift = false;
    let p: PathPoint | null = point;
    for (let l = 0; l < 2 && p; l++) {
      const prev: PathPoint | null = p.previous;
      if (!prev || solid(prev.c, prev.r - 1) || prev.mode === 'jump') {
        canDrift = true;
        break;
      }
      p = prev;
    }
    if (canDrift) {
      if (!solid(c - 1, r) && !solid(c - 1, r - 1) && !open.has(c - 1, r - 1, 'normal')) yield makePoint(c - 1, r - 1, g + 1.5);
      if (!solid(c + 1, r) && !solid(c + 1, r - 1) && !open.has(c + 1, r - 1, 'normal')) yield makePoint(c + 1, r - 1, g + 1.5);
    }
  }
  const mode = point.mode;
  if (caps.canJump && caps.canWallClimb && c > 0 && c < map.cols - 1
    && (mode === 'jump' || mode === 'wallClimbRight' || mode === 'wallClimbLeft' || !solid(c, r - 1))) {
    if (solid(c - 1, r) && solid(c - 1, r + 1) && !solid(c, r + 1) && !solid(c, r + 2)) {
      if (mode !== 'wallClimbRight' || !solid(c - 1, r + 1) || !solid(c + 1, r + 1)) yield makePoint(c, r + 1, g + 2, 'wallClimbLeft');
    } else if (solid(c - 1, r) && !solid(c - 1, r + 1)) {
      yield makePoint(c - 1, r + 1, g + 2, 'wallClimbLeft');
    }
    if (solid(c + 1, r) && solid(c + 1, r + 1) && !solid(c, r + 1) && !solid(c, r + 2)) {
      if (mode !== 'wallClimbLeft' || !solid(c - 1, r + 1) || !solid(c + 1, r + 1)) yield makePoint(c, r + 1, g + 2, 'wallClimbRight');
    } else if (solid(c + 1, r) && !solid(c + 1, r + 1)) {
      yield makePoint(c + 1, r + 1, g + 2, 'wallClimbRight');
    }
  }
  if (!solid(c, r - 1)) {
    if (caps.canWallClimb && !solid(c, r - 1) && !closed.has(c, r - 1, 'normal')) yield makePoint(c, r - 1, g + 1);
    let drop = 1;
    while (!solid(c, r - drop) && r - drop > 0) drop++;
    if (drop < caps.maxDropDistance && !closed.has(c, r - 1, 'normal')) yield makePoint(c, r - 1, g + 1);
  }
}

function constructPath(last: PathPoint): PathPoint[] {
  const out: PathPoint[] = [];
  for (let p: PathPoint | null = last; p; p = p.previous) out.unshift(p);
  return out;
}

/** The fallbacks' Union + OrderBy(fScoreHeuristic) + FirstOrDefault: open points first, a stable sort. */
function bestByHeuristic(open: PointList, closed: PointList, accept: (p: PathPoint) => boolean): PathPoint | null {
  const all = [...open.items, ...closed.items].map((p, i) => ({ p, i }));
  all.sort((a, b) => a.p.h - b.p.h || a.i - b.i);
  return all.find(({ p }) => accept(p))?.p ?? null;
}

/**
 * PathfindingController.FindPath from one cell to another; null when nothing at all is reachable.
 * When the target cannot be reached, the path ends at the closest standable point instead.
 */
export function findPath(map: TileMap, fromC: number, fromR: number, toC: number, toR: number, caps: PathCaps,
  timeLimitMs: number, rng: () => number = Math.random): PathPoint[] | null {
  const solid = (c: number, r: number) => isBlockSolid(map, c, r);
  const open = new PointList();
  const closed = new PointList();
  const start = makePoint(fromC, fromR, 0);
  if (!solid(fromC, fromR - 1)) {
    if (caps.canWallClimb && solid(fromC - 1, fromR)) start.mode = 'wallClimbLeft';
    if (caps.canWallClimb && solid(fromC + 1, fromR)) start.mode = 'wallClimbRight';
    if (start.mode === 'normal') start.mode = 'jump';
  }
  start.f = start.h = heuristic(fromC, fromR, toC, toR);
  open.add(start);
  const isStart = (p: PathPoint) => p.c === fromC && p.r === fromR;
  const budget = timeLimitMs * PATH_EXPANSIONS_PER_MS;
  let expanded = 0;
  while (open.size > 0) {
    let current = open.items[0];
    for (const p of open.items) if (p.f < current.f) current = p;
    if (current.c === toC && current.r === toR) return constructPath(current);
    if (expanded++ > budget) {
      const best = bestByHeuristic(open, closed, (p) => p.mode === 'normal' && !isStart(p)
        && p.previous?.mode !== 'jump' && solid(p.c, p.r - 1));
      return constructPath(best ?? current);
    }
    open.remove(current);
    closed.add(current);
    for (const next of accessiblePoints(map, current, caps, open, closed)) {
      if (closed.has(next.c, next.r, next.mode)) continue;
      next.previous = current;
      next.h = heuristic(next.c, next.r, toC, toR);
      next.f = next.g + next.h;
      if (caps.fudge) next.f *= 0.8 + rng() * 0.4;
      if (open.has(next.c, next.r, next.mode)) {
        const similar = open.similar(next);
        if (similar && similar.f > next.f && similar.mode === next.mode) {
          open.remove(similar);
          closed.add(similar);
        } else if (similar && similar.mode === next.mode) {
          continue;
        }
      }
      open.add(next);
    }
  }
  if (closed.size === 0) return null;
  // the C# also accepts wall-climb points here, which its moveMode == Normal test has already ruled out
  const best = bestByHeuristic(open, closed, (p) => p.mode === 'normal' && !isStart(p) && p.previous?.mode !== 'jump'
    && solid(p.c, p.r - 1));
  return best ? constructPath(best) : null;
}
