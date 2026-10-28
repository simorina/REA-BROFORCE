import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 440;
const ROWS = 20;

/**
 * Mission 8: "Il laboratorio". Deep in the Congo forest the island pays for a secret lab that breeds aliens, and
 * someone has opened the cages: snakes in the grass at the forest's edge, a pen of facehuggers by the fence, the lab
 * block with xenomorphs loose among its guards (an alerted alien sends the mooks round it running), the breeding hall
 * under its catwalks with mosquitoes in the rafters, and two brutes: one in its pen behind a brick wall it smashes
 * through, one by the exit with steel to stun itself on. Rows count from the bottom (0 = bedrock).
 */
export function buildLab(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  /** A brick building from c0 to c1 on the ground (row 4): walls up to `top`, a roof over them, doorways two high. */
  const building = (c0: number, c1: number, top: number, floor = 0) => {
    fill(c0, c0, 4, top, 'b');
    fill(c1, c1, 4, top, 'b');
    fill(c0, c1, top + 1, top + 1, 'b');
    fill(c0, c0, 4, 5, '.');
    fill(c1, c1, 4, 5, '.');
    if (floor) fill(c0 + 1, c1 - 1, floor, floor, 'b');
  };

  // The forest floor: steel bedrock, three rows of earth
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'd');

  // The forest's edge (0-68): the first guards, a minefield sign, snakes in the long grass, a guard hut
  put(3, 4, 'P');
  put(10, 4, 'm');
  put(14, 4, 'm');
  put(18, 4, 'w');
  put(22, 4, 'S');
  put(26, 4, 'c');
  put(29, 4, 'q');
  put(33, 4, 'm');
  put(36, 4, 'h');
  put(40, 4, 'm');
  building(43, 51, 8);
  put(46, 4, 'm');
  put(48, 4, 'z');
  put(55, 4, 'n');
  put(58, 4, 'S');
  put(66, 4, 'C');

  // The perimeter (68-140): a scout runs for his door, a low fence, an alarmist out in the open, a jetpack mook, the
  // facehuggers' pen (open-topped, low brick walls), a second minefield sign
  put(70, 4, 'o');
  put(74, 4, 'm');
  put(77, 4, 'k');
  put(80, 4, 'D');
  fill(84, 84, 4, 5, 'b');
  put(88, 4, 'A');
  put(91, 4, 'm');
  put(94, 4, 'j');
  put(98, 4, 'q');
  fill(104, 104, 4, 5, 'b');
  put(107, 4, 'f');
  put(111, 4, 'f');
  fill(114, 114, 4, 5, 'b');
  put(118, 4, 'w');
  put(122, 4, 'm');
  put(125, 4, 'B');
  put(132, 4, 'c');
  put(136, 4, 'C');

  // The lab block (144-170): two floors with a stairwell at each end; xenomorphs and a melter loose among the guards
  // downstairs, a facehugger and a ninja upstairs, a bazooka and a mortar on the roof. Then the yard behind it.
  building(144, 170, 11, 7);
  fill(145, 146, 7, 7, '.');
  fill(168, 169, 7, 7, '.');
  put(148, 4, 'm');
  put(151, 4, 'X');
  put(154, 4, 'm');
  put(157, 4, 'L');
  put(159, 4, 'x');
  put(161, 4, 'm');
  put(165, 4, 'X');
  put(149, 8, 'n');
  put(153, 8, 'f');
  put(158, 8, 'N');
  put(163, 8, 'm');
  put(166, 8, 'c');
  put(152, 13, 'z');
  put(160, 13, 'R');
  put(177, 4, 'h');
  put(180, 4, 'W');
  put(184, 4, 'm');
  put(187, 4, 'k');
  put(190, 4, 'Y');
  put(197, 4, 'J');
  put(201, 4, 'q');
  put(208, 4, 'L');
  put(212, 4, 'c');
  put(216, 4, 'C');

  // The breeding hall (226-290): a high roof over three catwalks, mosquitoes under the rafters, barrels by the tanks
  building(226, 290, 14);
  fill(234, 242, 9, 9, 'b');
  fill(256, 264, 9, 9, 'b');
  fill(276, 284, 9, 9, 'b');
  put(230, 4, 'm');
  put(233, 4, 'X');
  put(244, 4, 'm');
  put(248, 4, 'W');
  put(250, 4, 'x');
  put(252, 4, 'f');
  put(260, 4, 'Y');
  put(268, 4, 'x');
  put(270, 4, 'W');
  put(274, 4, 'X');
  put(280, 4, 'n');
  put(286, 4, 'm');
  put(237, 10, 'm');
  put(240, 10, 'S');
  put(259, 10, 'N');
  put(262, 10, 'c');
  put(279, 10, 'z');
  put(282, 10, 'f');
  put(296, 4, 'C');

  // The containment yard (300-372): an elite Bruiser on guard, the first brute in its pen (brick in front, steel behind)
  put(302, 4, 'm');
  put(305, 4, 'G');
  put(309, 4, 'L');
  put(315, 4, 'h');
  fill(318, 318, 4, 6, 'b');
  put(326, 4, 'K');
  fill(334, 334, 4, 6, 's');
  put(338, 4, 'm');
  put(341, 4, 'X');
  put(344, 4, 'k');
  put(347, 4, 'W');
  put(354, 4, 'q');
  put(357, 4, 'f');
  put(361, 4, 'm');
  put(364, 4, 'c');
  put(368, 4, 'C');

  // The way out (372-439): the second brute behind a steel barrier, the last aliens, the flag
  put(376, 4, 'm');
  put(379, 4, 'Y');
  put(383, 4, 'S');
  fill(390, 391, 4, 5, 's');
  put(396, 4, 'K');
  put(402, 4, 'X');
  put(405, 4, 'm');
  put(408, 4, 'W');
  put(412, 4, 'n');
  put(420, 4, 'L');
  put(432, 4, 'F');
  fill(439, 439, 4, ROWS - 1, 's');

  // Long grass at the forest's edge and in the yards: the snakes lie in it, and mooks wait hidden there
  const grass: Cell[] = [21, 22, 23, 57, 58, 59, 96, 97, 182, 183, 352, 353, 382, 383, 384].map((c) => ({ c, r: 4 }));

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: forest(), grass, flexPower: 'allure', theme: 'forest', music: 'Alien' };
}

/**
 * Themeholder Forest's background, spread along the lab as a level designer places Parallax1/2/3 doodads: near 12
 * variants (trees and bushes), mid 5, distant 2. Spacing and heights are ours.
 */
export function forest(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 7400, step: 260, y: 148, variants: 2 },
    { layer: 'mid', from: -480, to: 7200, step: 300, y: 47, variants: 5 },
    { layer: 'near', from: -390, to: 7100, step: 200, y: 31, variants: 12 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
