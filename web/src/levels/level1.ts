import type { LevelData } from '../engine/level';

const COLS = 120;
const ROWS = 18;

/** Level 1, built with helpers so the rows stay aligned. Here rows count from the bottom (0 = bedrock). */
export function buildLevel1(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };

  // Ground: steel bedrock, three rows of dirt, a pit at columns 37-40.
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'd');
  fill(37, 40, 1, 3, '.');
  // Start.
  put(3, 4, 'P');
  // Bunker: brick walls, a dirt roof, two mooks inside, a prisoner on the roof.
  fill(14, 14, 4, 7, 'b');
  fill(25, 25, 4, 7, 'b');
  fill(14, 25, 8, 8, 'd');
  put(18, 4, 'm');
  put(22, 4, 'm');
  put(20, 9, 'c');
  // Barrels next to a mook.
  put(28, 4, 'x');
  put(29, 4, 'x');
  put(33, 4, 'm');
  // A suicide mook past the pit; a hill with a steel core and a bazooka mook on top.
  put(42, 4, 'k');
  fill(44, 54, 4, 5, 'd');
  fill(46, 52, 6, 7, 'd');
  fill(48, 50, 4, 6, 's');
  put(49, 8, 'z');
  // Tunnel: a dirt mass with a two-tile corridor holding a barrel, mooks and a prisoner.
  fill(58, 79, 4, 9, 'd');
  fill(58, 79, 4, 5, '.');
  put(63, 4, 'x');
  put(66, 4, 'm');
  put(69, 4, 'c');
  put(72, 4, 'm');
  put(76, 4, 'k');
  // Open field with a brick tower.
  put(86, 4, 'm');
  put(90, 4, 'm');
  fill(92, 93, 4, 8, 'b');
  put(92, 9, 'm');
  put(97, 4, 'z');
  // End: the last prisoner, the flag and a steel wall.
  put(104, 4, 'c');
  put(114, 4, 'F');
  fill(119, 119, 4, ROWS - 1, 's');

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')) };
}
