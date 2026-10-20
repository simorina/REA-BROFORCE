import type { LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 470;
const ROWS = 20;

/**
 * Mission 9: "L'inferno". The lab's experiments have torn a way through to hell, and hell is pouring out of it: undead
 * mooks lying in the graveyard who get up again, skinless mooks who jump on the bro's back, a warlock behind his wall
 * raising undead suicide mooks out of portals, lost souls over the bridge's gaps and Soul Catchers full of them, Boomers
 * that vomit and burst, the hell Bruisers' fortress with its flame waves and armoured fronts, two warlocks on their
 * towers, and Satan himself, laughing, at every turn. Rows count from the bottom (0 = bedrock).
 */
export function buildInferno(): LevelData {
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

  // The ground: steel bedrock, three rows of earth; the bridge's three bottomless gaps
  fill(0, COLS - 1, 0, 0, 's');
  fill(0, COLS - 1, 1, 3, 'd');
  for (const g of [158, 176, 194]) fill(g, g + 1, 0, 3, '.');

  // The way in (0-69): the last guards, a minefield sign, the first undead (two of them lying there), hell dogs, a hut with
  // an undead on its roof, and Satan
  put(3, 4, 'P');
  put(10, 4, 'm');
  put(13, 4, 'm');
  put(16, 4, 'w');
  put(20, 4, 'r');
  put(23, 4, 'u');
  put(26, 4, 'r');
  put(29, 4, 'c');
  put(32, 4, 'e');
  put(34, 4, 'e');
  put(37, 4, 'q');
  put(40, 4, 'm');
  put(43, 4, 'h');
  put(46, 4, 'm');
  building(49, 57, 8);
  put(52, 4, 'u');
  put(54, 4, 'n');
  put(53, 10, 'r');
  put(61, 4, '6');
  put(64, 4, 'm');
  put(67, 4, 'C');

  // The graveyard (70-150): the dead between their tombstones, a skinless mook, an alarmist out in the open, the first
  // warlock up on a mound behind a wall (he sees through it), a jetpack mook, an undead suicide mook, a second sign
  put(72, 4, 'y');
  put(75, 4, 'r');
  put(77, 4, 'b');
  put(78, 4, 'r');
  put(80, 4, 'b');
  put(81, 4, 'r');
  put(83, 4, 'b');
  put(84, 4, 'u');
  put(88, 4, 'A');
  put(91, 4, 'm');
  put(94, 4, 'm');
  fill(97, 97, 4, 7, 'b');
  fill(100, 106, 4, 6, 'd');
  put(103, 7, 'v');
  put(110, 4, 'j');
  put(113, 4, 'r');
  put(116, 4, 'u');
  put(119, 4, 'i');
  put(122, 4, 'e');
  put(125, 4, 'm');
  put(128, 4, 'y');
  put(131, 4, 'w');
  put(134, 4, 'c');
  put(138, 4, '6');
  put(141, 4, 'm');
  put(144, 4, 'm');
  put(147, 4, 'C');

  // The bridge (150-240): lost souls hanging over its gaps, a Boomer, a Soul Catcher on the far side, a Bruiser
  put(152, 4, 'm');
  put(155, 4, 'n');
  put(166, 4, 'l');
  put(169, 4, 'm');
  put(172, 4, 'h');
  put(184, 4, 'l');
  put(188, 4, 'O');
  put(202, 4, 'l');
  put(205, 4, 'm');
  put(208, 4, 'J');
  put(212, 4, 'p');
  put(216, 4, 'm');
  put(219, 4, 'q');
  put(222, 4, 'm');
  put(226, 4, 'O');
  put(230, 4, 'c');
  put(233, 4, 'B');
  put(237, 4, 'C');

  // The hell Bruisers' fortress (240-330): a barricade, a hell Bruiser before it, a two-floor keep with an armoured one
  // at its door (his back is the weak side), a ninja upstairs, then the yard behind it and another armoured one
  fill(246, 247, 4, 5, 'b');
  put(252, 4, '1');
  put(256, 4, 'm');
  put(259, 4, 'm');
  building(262, 282, 10, 7);
  fill(263, 264, 7, 7, '.');
  fill(280, 281, 7, 7, '.');
  put(266, 4, '2');
  put(270, 4, 'u');
  put(274, 4, 'm');
  put(278, 4, '1');
  put(268, 8, 'N');
  put(272, 8, 'r');
  put(276, 8, 'n');
  put(270, 12, 'z');
  put(275, 12, 'm');
  put(286, 4, 'y');
  put(289, 4, 'i');
  put(292, 4, 'e');
  put(298, 4, '2');
  put(302, 4, 'm');
  put(305, 4, 'm');
  put(311, 4, '6');
  put(315, 4, 'u');
  put(318, 4, 'r');
  put(321, 4, 'c');
  put(326, 4, 'C');

  // The warlocks' towers (330-410): one on each, raising their undead suicide mooks, a Boomer and a Soul Catcher between
  fill(336, 338, 4, 9, 'b');
  put(337, 10, 'v');
  put(342, 4, 'm');
  put(345, 4, 'i');
  put(348, 4, 'i');
  put(352, 4, 'O');
  fill(358, 360, 4, 11, 'b');
  put(359, 12, 'v');
  put(364, 4, 'y');
  put(367, 4, 'm');
  put(371, 4, 'p');
  put(375, 4, 'l');
  put(378, 4, 'l');
  put(382, 4, 'k');
  put(385, 4, 'h');
  put(389, 4, 'c');
  put(405, 4, 'C');

  // The gate (410-469): a hell Bruiser and an armoured one keep it, Satan laughs at the last, the flag behind them
  put(414, 4, '1');
  put(420, 4, '2');
  put(426, 4, 'u');
  put(432, 4, 'e');
  put(440, 4, '6');
  put(446, 4, 'r');
  put(462, 4, 'F');
  fill(469, 469, 4, ROWS - 1, 's');

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: hellscape(), flexPower: 'allure', theme: 'hell' };
}

/**
 * Themeholder Hell's background, spread along the way as a level designer places Parallax1/2/3 doodads: near 39 variants
 * (rock spires, bones and flames), mid 19, distant 24. Spacing and heights are ours.
 */
export function hellscape(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 7900, step: 300, y: 148, variants: 24 },
    { layer: 'mid', from: -480, to: 7700, step: 320, y: 47, variants: 19 },
    { layer: 'near', from: -390, to: 7600, step: 240, y: 31, variants: 39 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
