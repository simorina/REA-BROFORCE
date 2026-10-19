import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 270;
const ROWS = 22;

/**
 * Mission 4: "Il grattacielo" (The Skyscraper).
 * Infiltrate Epstein's Manhattan skyscraper. Fight up floor by floor, through offices
 * and terraces to reach the penthouse safe containing the secret client list.
 */
export function buildTower(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  const ground = (c0: number, c1: number, top: number, ch = 'd') => {
    fill(c0, c1, 0, 0, 's');
    fill(c0, c1, 1, top, ch);
  };

  // Section 1: Street Approach & Lobby (cols 0-65)
  ground(0, 65, 3, 'd');
  put(3, 4, 'P');
  put(12, 4, 'm');
  put(16, 4, 'm');
  put(20, 4, 'q');
  put(24, 4, 'x');
  put(25, 4, 'x');
  put(28, 4, 'k');
  put(32, 4, 'C');

  // Lobby building
  fill(35, 35, 4, 11, 'b');
  fill(65, 65, 4, 11, 'b');
  fill(35, 65, 12, 12, 'b'); // roof
  fill(35, 35, 4, 5, '.'); // entrance door
  fill(65, 65, 4, 5, '.'); // exit door
  fill(38, 62, 7, 7, 'b'); // 2nd floor platform
  fill(65, 65, 8, 9, '.'); // 2nd floor window

  put(40, 4, 'm');
  put(44, 4, 'h');
  put(48, 8, 'm');
  put(52, 8, 'c');
  put(54, 8, 'z');
  put(58, 4, 'm');
  put(62, 13, 'n');

  // Section 2: Ascending terraces (cols 66-125)
  ground(66, 85, 5, 'd');
  put(70, 6, 'm');
  put(74, 6, 'k');
  put(78, 6, 'h');
  put(82, 6, 'C');

  ground(86, 105, 7, 'd');
  put(90, 8, 'm');
  put(94, 8, 'q');
  put(98, 8, 'c');
  put(102, 8, 'z');

  ground(106, 125, 9, 'd');
  put(110, 10, 'm');
  put(114, 10, 'k');
  put(117, 10, 'o');
  put(122, 10, 'D');
  put(124, 10, 'C');

  // Section 3: Mid-tower Complex (cols 126-195)
  ground(126, 195, 9, 'd');
  fill(130, 130, 10, 17, 'b');
  fill(175, 175, 10, 17, 'b');
  fill(130, 175, 18, 18, 'b'); // roof
  fill(130, 130, 10, 11, '.'); // entrance
  fill(175, 175, 10, 11, '.'); // exit
  fill(135, 170, 14, 14, 'b'); // upper level

  put(136, 10, 'm');
  put(140, 10, 'h');
  put(145, 10, 'x');
  put(146, 10, 'x');
  put(150, 10, 'm');
  put(155, 10, 'm');
  put(160, 10, 'k');
  put(165, 10, 'c');
  put(170, 10, 'm');

  put(142, 15, 'm');
  put(148, 15, 'z');
  put(156, 15, 'n');
  put(164, 15, 'm');
  put(172, 19, 'z');

  put(180, 10, 'm');
  put(184, 10, 'q');
  put(188, 10, 'o');
  put(193, 10, 'D');
  put(195, 10, 'C');

  // Section 4: Penthouse Safe & Helipad (cols 196-269)
  ground(196, 269, 11, 'd');
  put(200, 12, 'm');
  put(204, 12, 'h');
  put(208, 12, 'k');
  put(212, 12, 'm');
  put(216, 12, 'x');
  put(217, 12, 'x');
  put(220, 12, 'c');
  put(224, 12, 'm');
  put(228, 12, 'n');
  put(232, 12, 'C');

  // Steel safe room
  fill(236, 236, 12, 18, 's');
  fill(255, 255, 12, 18, 's');
  fill(236, 255, 19, 19, 's');
  fill(236, 236, 12, 13, '.');
  fill(255, 255, 12, 13, '.');

  put(240, 12, 'm');
  put(245, 12, 'm');
  put(250, 12, 'c');
  put(258, 12, 'C');
  put(263, 12, 'F');
  fill(269, 269, 12, ROWS - 1, 's');

  const grass: Cell[] = [14, 15, 68, 69, 88, 89, 108, 109, 198, 199].map((c) => ({
    c,
    r: c < 66 ? 4 : c < 86 ? 6 : c < 106 ? 8 : c < 126 ? 10 : 12,
  }));

  return {
    cols: COLS,
    rows: ROWS,
    tiles: grid.map((row) => row.join('')),
    parallax: towerJungle(),
    grass,
    flexPower: 'allure',
    theme: 'jungle',
  };
}

export function towerJungle(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 5200, step: 300, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 5000, step: 420, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 4800, step: 260, y: 31, variants: 3 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) {
      out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
    }
  }
  return out;
}
