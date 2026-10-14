import { TileMap, makeBlock } from './map';
import type { BlockKind, GameStats, UnitKind } from './types';

/** tiles[0] is the TOP row. */
export interface LevelData {
  cols: number;
  rows: number;
  tiles: string[];
}

export interface Cell {
  c: number;
  r: number;
}

export interface ParsedLevel {
  map: TileMap;
  player: Cell;
  enemies: Array<Cell & { kind: UnitKind }>;
  cages: Cell[];
  flag: Cell;
}

const BLOCKS: Record<string, BlockKind> = { d: 'dirt', b: 'brick', s: 'steel', x: 'barrel' };
const ENEMIES: Record<string, UnitKind> = { m: 'mook', k: 'mook_suicide', z: 'mook_bazooka' };

export function parseLevel(level: LevelData, stats: GameStats): ParsedLevel {
  if (level.tiles.length !== level.rows) {
    throw new Error(`level has ${level.tiles.length} rows, expected ${level.rows}`);
  }
  const map = new TileMap(level.cols, level.rows);
  const enemies: ParsedLevel['enemies'] = [];
  const cages: Cell[] = [];
  let player: Cell | null = null;
  let flag: Cell | null = null;
  for (let i = 0; i < level.tiles.length; i++) {
    const line = level.tiles[i];
    if (line.length !== level.cols) throw new Error(`row ${i} has ${line.length} columns, expected ${level.cols}`);
    const r = level.rows - 1 - i;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '.') continue;
      if (ch in BLOCKS) map.set(c, r, makeBlock(BLOCKS[ch], stats));
      else if (ch in ENEMIES) enemies.push({ c, r, kind: ENEMIES[ch] });
      else if (ch === 'c') cages.push({ c, r });
      else if (ch === 'P') {
        if (player) throw new Error('level has more than one P');
        player = { c, r };
      } else if (ch === 'F') {
        if (flag) throw new Error('level has more than one F');
        flag = { c, r };
      } else {
        throw new Error(`unknown tile '${ch}' at column ${c}, row ${i}`);
      }
    }
  }
  if (!player) throw new Error('level has no player start (P)');
  if (!flag) throw new Error('level has no flag (F)');
  return { map, player, enemies, cages, flag };
}
