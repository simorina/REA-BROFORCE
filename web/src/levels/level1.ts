import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 300;
const ROWS = 22;

/**
 * Level 1, Epstein's island, built with helpers so the rows stay aligned. Rows count from the bottom (0 = bedrock).
 * From the beach the bro climbs through the jungle, a cave, a ravine of bottomless gaps, a guarded compound and the
 * road up to the temple, where Jeffrey Epstein waits; the flag in the temple's hall opens once he is down.
 */
export function buildLevel1(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  /** Steel bedrock under columns c0..c1, then `ch` up to row `top` (the ground's surface). */
  const ground = (c0: number, c1: number, top: number, ch = 'd') => {
    fill(c0, c1, 0, 0, 's');
    fill(c0, c1, 1, top, ch);
  };

  // The beach (0-39): sand. A dune with a prisoner, and a scout who runs for the mook door.
  ground(0, 39, 3, 'a');
  put(3, 4, 'P');
  put(12, 4, 'm');
  put(17, 4, 'm');
  fill(22, 28, 4, 4, 'a');
  fill(24, 26, 5, 5, 'a');
  put(25, 6, 'c');
  put(31, 4, 'o');
  put(34, 4, 'k');
  put(37, 4, 'D');

  // The jungle's edge (40-74): terraces up from the beach, mooks waiting in the long grass, a watchtower.
  ground(40, 47, 3);
  put(42, 4, 'C');
  ground(48, 57, 5);
  put(50, 6, 'm');
  put(54, 6, 'm');
  ground(58, 74, 7);
  put(59, 8, 'x');
  put(60, 8, 'x');
  fill(62, 62, 8, 12, 'b');
  fill(66, 66, 8, 12, 'b');
  fill(61, 67, 13, 13, 'b');
  put(64, 8, 'm');
  put(62, 14, 'c');
  put(64, 14, 'z');
  put(70, 8, 'k');
  put(72, 8, 'm');

  // The hill (75-112): a cave runs under it, full of mooks; a bazooka and suicide mooks keep the path over it.
  ground(75, 112, 7);
  fill(78, 108, 8, 14, 'd');
  fill(78, 108, 8, 9, '.');
  fill(90, 91, 10, 14, 's');
  put(82, 8, 'm');
  put(85, 8, 'x');
  put(88, 8, 'm');
  put(94, 8, 'c');
  put(98, 8, 'm');
  put(102, 8, 'k');
  put(105, 8, 'm');
  put(84, 15, 'z');
  put(96, 15, 'm');
  put(100, 15, 'k');
  put(110, 8, 'C');

  // The ravine (113-150): bottomless gaps between ledges held by mooks.
  ground(113, 117, 7);
  ground(120, 127, 7);
  put(124, 8, 'm');
  ground(130, 137, 7);
  put(133, 8, 'z');
  put(135, 8, 'c');
  ground(140, 150, 7);
  put(143, 8, 'm');
  put(146, 8, 'k');
  put(149, 8, 'C');

  // The compound (151-200): a scout and a door, a two-floor guardhouse with a prisoner on its roof, barrels.
  ground(151, 200, 7);
  put(153, 8, 'o');
  put(159, 8, 'D');
  fill(163, 163, 8, 15, 'b');
  fill(177, 177, 8, 15, 'b');
  fill(163, 177, 11, 11, 'b');
  fill(163, 177, 16, 16, 'b');
  fill(163, 163, 8, 9, '.'); // the way in
  fill(177, 177, 8, 9, '.'); // and out, through the ground floor
  fill(177, 177, 12, 13, '.'); // the upper floor's window
  put(167, 8, 'm');
  put(172, 8, 'm');
  put(175, 8, 'x');
  put(168, 12, 'm');
  put(171, 12, 'z');
  put(170, 17, 'c');
  put(182, 8, 'm');
  put(185, 8, 'x');
  put(186, 8, 'x');
  put(188, 8, 'm');
  put(193, 8, 'k');
  put(196, 8, 'm');
  put(199, 8, 'C');

  // The road up to the temple (201-245): terraces, long grass, a last scout and door.
  ground(201, 212, 7);
  put(205, 8, 'm');
  put(209, 8, 'z');
  ground(213, 222, 9);
  put(216, 10, 'm');
  put(219, 10, 'k');
  put(221, 10, 'c');
  ground(223, 245, 11);
  put(226, 12, 'o');
  put(229, 12, 'm');
  put(234, 12, 'D');
  put(238, 12, 'm');
  put(241, 12, 'k');
  put(244, 12, 'C');

  // The hilltop (246-299): an open arena before the temple, white and blue with its dome; the flag in its hall.
  ground(246, 299, 11);
  put(266, 12, 'E');
  fill(280, 296, 16, 18, 't'); // the roof on its columns
  for (const c of [280, 282, 284, 292, 294, 296]) fill(c, c, 12, 15, 't');
  fill(284, 292, 19, 19, 't');
  fill(286, 290, 20, 20, 't');
  put(288, 21, 't');
  put(290, 12, 'F');
  fill(299, 299, 12, ROWS - 1, 's');

  // Long grass: mooks wait hidden in it (PolymorphicAI.HideInGrass), more tufts for cover.
  const grass: Cell[] = [
    ...[49, 50, 51, 53, 54, 55].map((c) => ({ c, r: 6 })),
    ...[203, 204, 205, 206].map((c) => ({ c, r: 8 })),
    ...[214, 215, 216, 217].map((c) => ({ c, r: 10 })),
  ];

  // FlexPowerMapType.SpawnWithAllure: flexing (F) draws the mooks over to have a look
  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: jungle(), grass, flexPower: 'allure' };
}

/**
 * The Jungle theme's background hills, spread along the island as a level designer places Parallax1/2/3 doodads.
 * Spacing and heights are ours; each layer's art (near 3, mid 2, distant 3 variants) and parallax come from the
 * ThemeHolder.
 */
export function jungle(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 5600, step: 300, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 5400, step: 420, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 5300, step: 260, y: 31, variants: 3 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
