import { TileMap, makeBlock } from './map';
import type { FoeKind } from './foes';
import type { BlockKind, EnemyKind, GameStats } from './types';

export interface Cell {
  c: number;
  r: number;
}

/** A background hill of the theme at a world position (DoodadType.Parallax1/2/3 in Map.PlaceDoodad). */
export interface ParallaxDoodad {
  layer: 'near' | 'mid' | 'distant';
  variant: number;
  x: number;
  y: number;
}

/** tiles[0] is the TOP row. */
/** The ThemeHolder a level's background comes from. */
export type LevelTheme = 'jungle' | 'desert' | 'burning';

export interface LevelData {
  cols: number;
  rows: number;
  tiles: string[];
  parallax?: ParallaxDoodad[];
  grass?: Cell[]; // long grass that can share a cell with a unit ('g' tiles add more)
  flexPower?: 'allure'; // Map.MapData.flexPowerType: SpawnWithAllure gives the bro the Alluring flex
  theme?: LevelTheme; // the background (jungle when unset)
}

export interface ParsedLevel {
  map: TileMap;
  player: Cell;
  enemies: Array<Cell & { kind: EnemyKind }>;
  cages: Cell[];
  checkpoints: Cell[];
  grass: Cell[]; // DoodadGrass: long grass mooks can hide in
  doors: Cell[]; // DoodadMookDoor: mooks walk out of these
  foes: Array<Cell & { kind: FoeKind }>; // enemy vehicles
  signs: Cell[]; // 'w': Mine Field Signs, each with a mine buried near it
  flag: Cell;
  boss: Cell | null; // 'E': Jeffrey Epstein
  mech: Cell | null; // 'M': Epstein again, in his Goliath mech
}

const FOES: Record<string, FoeKind> = { T: 'truck', V: 'apc', I: 'bike', Z: 'nukebike', Q: 'artillery', H: 'kopter' };
const BLOCKS: Record<string, BlockKind> = { d: 'dirt', a: 'sand', b: 'brick', t: 'temple', s: 'steel', x: 'barrel' };
const ENEMIES: Record<string, EnemyKind> = {
  m: 'mook', k: 'mook_suicide', z: 'mook_bazooka', o: 'mook_scout', h: 'mook_shield', n: 'mook_grenadier', q: 'dog',
  B: 'mook_bruiser', j: 'mook_jetpack', J: 'mook_jetpack_bazooka', N: 'mook_ninja', A: 'mook_alarmist', R: 'mook_mortar', G: 'mook_bruiser_elite', U: 'mook_dolph',
};

export function parseLevel(level: LevelData, stats: GameStats): ParsedLevel {
  if (level.tiles.length !== level.rows) {
    throw new Error(`level has ${level.tiles.length} rows, expected ${level.rows}`);
  }
  const map = new TileMap(level.cols, level.rows);
  const enemies: ParsedLevel['enemies'] = [];
  const cages: Cell[] = [];
  const checkpoints: Cell[] = [];
  const grass: Cell[] = [];
  const doors: Cell[] = [];
  const signs: Cell[] = [];
  const foes: ParsedLevel['foes'] = [];
  let player: Cell | null = null;
  let flag: Cell | null = null;
  let boss: Cell | null = null;
  let mech: Cell | null = null;
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
      else if (ch === 'C') checkpoints.push({ c, r });
      else if (ch === 'g') grass.push({ c, r });
      else if (ch === 'D') doors.push({ c, r });
      else if (ch === 'w') signs.push({ c, r });
      else if (ch in FOES) foes.push({ c, r, kind: FOES[ch] });
      else if (ch === 'P') {
        if (player) throw new Error('level has more than one P');
        player = { c, r };
      } else if (ch === 'E') {
        if (boss) throw new Error('level has more than one E');
        boss = { c, r };
      } else if (ch === 'M') {
        if (mech) throw new Error('level has more than one M');
        mech = { c, r };
      } else if (ch === 'F') {
        if (flag) throw new Error('level has more than one F');
        flag = { c, r };
      } else {
        throw new Error(`unknown tile '${ch}' at column ${c}, row ${i}`);
      }
    }
  }
  for (const g of level.grass ?? []) {
    if (!map.inBounds(g.c, g.r)) throw new Error(`grass at ${g.c},${g.r} is outside the level`);
    grass.push(g);
  }
  if (!player) throw new Error('level has no player start (P)');
  if (!flag) throw new Error('level has no flag (F)');
  return { map, player, enemies, cages, checkpoints, grass, doors, signs, foes, flag, boss, mech };
}
