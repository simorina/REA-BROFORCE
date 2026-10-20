import { MINE, TILE } from './constants';
import type { Blast } from './explosions';
import type { Cell } from './level';
import { getColumn, type TileMap } from './map';
import type { Block, BlockKind, Unit } from './types';

/** Mine: buried in a block, it clicks when stepped on and goes off MINE.fuse later, or at once if its block is destroyed. */
export interface Mine {
  c: number;
  r: number;
  x: number; // its block's centre
  y: number;
  block: Block; // the block it is buried in: once that is gone, so is the mine
  fuse: number; // detonationTime
  state: 'armed' | 'detonating' | 'exploded';
}

/** The Mine Field Sign doodad over the mine; it falls with the ground under it. */
export interface MineSign {
  c: number;
  r: number;
  x: number;
  y: number;
  fallen: boolean;
}

// MineFieldSign.CanPlaceInBlock (steel, barrels, bridges and falling blocks never hold a mine)
const UNMINEABLE: ReadonlySet<BlockKind> = new Set(['steel', 'barrel']);

/** A surface block at the sign's level: ground at (c, r - 1) and none at (c, r) (SetupMines' pair of raycasts). */
const surface = (map: TileMap, c: number, r: number): boolean => map.get(c, r - 1) !== null && map.get(c, r) === null;

/**
 * MineFieldSign.SetupMines with numberOfMines 1: the block under the sign and up to two surface blocks either side are
 * the candidates; it tries them in random order until one can hold the mine.
 */
export function plantMine(map: TileMap, sign: Cell, rng: () => number): Mine | null {
  const cols = [sign.c];
  for (const side of [-1, 1]) {
    for (let i = 1; i <= MINE.signReach && surface(map, sign.c + side * i, sign.r); i++) cols.push(sign.c + side * i);
  }
  while (cols.length > 0) {
    const [c] = cols.splice(Math.floor(rng() * cols.length), 1);
    const block = map.get(c, sign.r - 1);
    if (block && !UNMINEABLE.has(block.kind) && !(block.replacement && UNMINEABLE.has(block.replacement.kind))) {
      return { c, r: sign.r - 1, x: c * TILE, y: (sign.r - 1) * TILE, block, fuse: MINE.fuse, state: 'armed' };
    }
  }
  return null;
}

/** TestVanDammeAnim.CheckForTraps: a foot within MINE.trigger above the mine's block, on any of the three rays. */
export function steppedOn(m: Mine, u: Unit): boolean {
  const top = m.y + TILE / 2;
  if (u.y < top - 1 || u.y - top >= MINE.trigger) return false;
  return [u.x, u.x - MINE.feet, u.x + MINE.feet].some((x) => getColumn(x) === m.c);
}

/** Mine.Explode: DamageGround(12, range) at the mine; ExplodeUnits(20, range * 2, range * 2, 200, 300) 6 below it, hitting everyone. */
export function mineBlast(m: Mine): Blast {
  return {
    x: m.x, y: m.y + MINE.unitY, groundY: m.y, groundDamage: MINE.groundDamage, groundRange: MINE.range,
    unitDamage: MINE.unitDamage, unitRange: MINE.range * 2, killRange: MINE.range * 2, force: MINE.force, extraY: MINE.extraY,
    team: 'neutral', big: true, noise: MINE.noise, source: 'mine', doodadDamage: 0, doodadRange: 0, // it only shakes the trees
  };
}
