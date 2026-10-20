import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 420;
const ROWS = 20;

/**
 * Mission 7: "Il convoglio". An armoured convoy carries the evidence out through an industrial city: its mortar mooks
 * on the rooftops, a troop truck and motorbikes on the road, an artillery truck in the yard, an APC at the checkpoint
 * with a nuclear motorbike behind it, the Mookopter over the helipad, and at its head the universal soldier, who won't
 * stay down. Rows count from the bottom (0 = bedrock).
 */
export function buildConvoy(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  /** A brick building from c0 to c1 on the road (row 4): walls up to `top`, a roof over them, doorways two high. */
  const building = (c0: number, c1: number, top: number, floor = 0) => {
    fill(c0, c0, 4, top, 'b');
    fill(c1, c1, 4, top, 'b');
    fill(c0, c1, top + 1, top + 1, 'b');
    fill(c0, c0, 4, 5, '.');
    fill(c1, c1, 4, 5, '.');
    if (floor) fill(c0 + 1, c1 - 1, floor, floor, 'b');
  };

  // The road: steel bedrock, three rows of earth
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'd');

  // The outskirts (0-58): the first mooks, a minefield sign, a warehouse with a mortar mook on its roof
  put(3, 4, 'P');
  put(12, 4, 'm');
  put(16, 4, 'm');
  put(20, 4, 'w');
  put(24, 4, 'c');
  put(26, 4, 'm');
  building(28, 38, 8);
  put(32, 4, 'm');
  put(35, 4, 'h');
  put(33, 10, 'R'); // the mortar on the roof
  put(30, 10, 'c');
  put(40, 4, 'm');
  put(42, 4, 'q');
  put(45, 4, 'm');
  put(48, 4, 'n');
  put(52, 4, 'C');

  // The road in (60-130): a scout runs for his door; an office block, an elite Bruiser inside; the troop truck comes
  // down the road with two motorbikes behind it
  put(62, 4, 'o');
  put(66, 4, 'm');
  put(70, 4, 'z');
  put(74, 4, 'D');
  building(78, 92, 10, 7);
  put(82, 4, 'm');
  put(88, 4, 'G');
  put(84, 8, 'N'); // upstairs, crouched in the dark
  put(85, 12, 'R');
  put(96, 4, 'm');
  put(100, 4, 'm');
  put(104, 4, 'h');
  put(108, 4, 'k');
  put(112, 4, 'k');
  put(118, 4, 'T');
  put(124, 4, 'I');
  put(127, 4, 'I');
  put(130, 4, 'C');

  // The yard (132-200): stacked containers, an alarmist out in the open, a barricade, the artillery truck at the end
  fill(136, 141, 4, 6, 'b');
  put(138, 7, 'R');
  put(140, 7, 'j');
  put(144, 4, 'm');
  put(146, 4, 'A');
  put(149, 4, 'm');
  put(151, 4, 'n');
  put(155, 4, 'w');
  put(160, 4, 'q');
  put(164, 4, 'm');
  fill(170, 171, 4, 5, 'b');
  put(173, 4, 'z');
  put(175, 4, 'm');
  put(178, 4, 'm');
  put(182, 4, 'J');
  put(186, 4, 'm');
  put(190, 4, 'Q');
  put(198, 4, 'C');

  // The checkpoint (200-270): sandbags, a scout and his door, the APC with a motorbike on its roof, a Bruiser and a
  // nuclear motorbike behind it
  fill(206, 207, 4, 4, 'b');
  put(210, 4, 'o');
  put(214, 4, 'h');
  put(217, 4, 'm');
  put(220, 4, 'D');
  fill(222, 223, 4, 4, 'b');
  put(228, 4, 'k');
  put(231, 4, 'k');
  put(236, 4, 'm');
  put(240, 4, 'w');
  put(244, 4, 'm');
  put(250, 4, 'V');
  put(258, 4, 'B');
  put(262, 4, 'm');
  put(264, 4, 'z');
  put(266, 4, 'Z');
  put(268, 4, 'C');

  // The helipad (272-346): between two towers, the Mookopter's arena
  building(274, 280, 12);
  put(277, 14, 'R');
  put(290, 4, 'm');
  put(296, 4, 'N');
  put(298, 4, 'A');
  put(300, 4, 'm');
  put(306, 4, 'm');
  put(306, 9, 'H');
  put(312, 4, 'q');
  put(316, 4, 'm');
  put(320, 4, 'n');
  put(322, 4, 'k');
  put(326, 4, 'm');
  put(330, 4, 'j');
  building(336, 342, 12);
  put(339, 4, 'c');
  put(339, 14, 'z');
  put(346, 4, 'C');

  // The convoy's head (348-419): the universal soldier and his guard, the flag behind them
  put(352, 4, 'm');
  put(355, 4, 'c');
  put(360, 4, 'm');
  put(364, 4, 'h');
  put(368, 4, 'm');
  put(372, 4, 'G');
  put(376, 4, 'z');
  put(380, 4, 'm');
  put(384, 4, 'n');
  put(390, 4, 'U');
  put(412, 4, 'F');
  fill(419, 419, 4, ROWS - 1, 's');

  // Long grass by the road: cover, and mooks wait hidden in it
  const grass: Cell[] = [10, 11, 64, 65, 98, 99, 162, 163, 288, 289, 358, 359].map((c) => ({ c, r: 4 }));

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: city(), grass, flexPower: 'allure', theme: 'city' };
}

/**
 * Themeholder City's background, spread along the road as a level designer places Parallax1/2/3 doodads: near 10
 * variants (buildings and structures), mid 2, distant 2. Spacing and heights are ours.
 */
export function city(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 7200, step: 380, y: 148, variants: 2 },
    { layer: 'mid', from: -480, to: 7000, step: 460, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 6900, step: 220, y: 31, variants: 10 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
