import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 120;
const ROWS = 18;

/**
 * Mission 1, the desert: the game's first level, on sand, built with helpers so the rows stay aligned. Rows count
 * from the bottom (0 = bedrock).
 */
export function buildDesert(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };

  // Ground: steel bedrock, three rows of sand, a pit at columns 37-40.
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'a');
  fill(37, 40, 1, 3, '.');
  // Start.
  put(3, 4, 'P');
  // Bunker: brick walls, a sand roof, two mooks inside, a prisoner on the roof.
  fill(14, 14, 4, 7, 'b');
  fill(25, 25, 4, 7, 'b');
  fill(14, 25, 8, 8, 'a');
  put(18, 4, 'm');
  put(22, 4, 'm');
  put(20, 9, 'c');
  // Barrels next to a mook, and a dog between them.
  put(28, 4, 'x');
  put(29, 4, 'x');
  put(31, 4, 'q');
  put(33, 4, 'm');
  // Checkpoints (CheckPoint flagpoles): before the pit, after the hill and after the tunnel.
  put(35, 4, 'C');
  put(56, 4, 'C');
  put(82, 4, 'C');
  // A suicide mook past the pit; a hill with a steel core, a bazooka mook and a grenadier on top, a prisoner on its step.
  put(42, 4, 'k');
  fill(44, 54, 4, 5, 'a');
  fill(46, 52, 6, 7, 'a');
  fill(48, 50, 4, 6, 's');
  put(49, 8, 'z');
  put(47, 8, 'n');
  put(51, 8, 'j'); // a jetpack mook takes off from the hilltop
  put(53, 6, 'c');
  // Tunnel: a sand mass with a two-tile corridor holding a barrel, mooks and a prisoner.
  fill(58, 79, 4, 9, 'a');
  fill(58, 79, 4, 5, '.');
  put(63, 4, 'x');
  put(66, 4, 'm');
  put(69, 4, 'c');
  put(72, 4, 'm');
  put(76, 4, 'k');
  // Open field with a brick tower, a riot shield mook and a second dog; two minefield signs, a mine near each.
  put(84, 4, 'w');
  put(96, 4, 'w');
  put(86, 4, 'm');
  put(88, 4, 'h');
  put(90, 4, 'm');
  fill(92, 93, 4, 8, 'b');
  put(92, 9, 'm');
  put(95, 4, 'q');
  put(97, 4, 'z');
  // A scout past the tower, who runs for the mook door between the last prisoner and the flag.
  put(99, 4, 'o');
  // End: the last prisoner, the door, the flag and a steel wall.
  put(104, 4, 'c');
  put(108, 4, 'D');
  put(114, 4, 'F');
  fill(119, 119, 4, ROWS - 1, 's');

  // Long grass: the open-field mooks wait hidden in it (PolymorphicAI.HideInGrass), more tufts for cover.
  const grass: Cell[] = [86, 90, 8, 9, 30, 84, 85, 99, 100].map((c) => ({ c, r: 4 }));

  // FlexPowerMapType.SpawnWithAllure: flexing (F) draws the mooks over to have a look
  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: hills(), grass, flexPower: 'allure', theme: 'desert' };
}

/**
 * The Desert theme's background hills, spread along the level as a level designer places Parallax1/2/3
 * doodads. Spacing and heights are ours; each layer's art and parallax factor come from the ThemeHolder.
 */
export function hills(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 2700, step: 650, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 2400, step: 470, y: 47, variants: 3 },
    { layer: 'near', from: -390, to: 2300, step: 430, y: 31, variants: 5 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
