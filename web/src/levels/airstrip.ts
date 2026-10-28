import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 330;
const ROWS = 18;

/**
 * Mission 5: "La pista d'atterraggio" (The Airstrip).
 * Raid Epstein's private airfield, where his private jet waits with the evidence.
 * Fight across hangars, the runway, control tower, and terminal to ground the flights permanently.
 */
export function buildAirstrip(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  const ground = (c0: number, c1: number, top: number, ch = 'a') => {
    fill(c0, c1, 0, 0, 's');
    fill(c0, c1, 1, top, ch);
  };

  // Section 1: Perimeter & Approach (cols 0-60)
  ground(0, 60, 3, 'a');
  put(3, 4, 'P');
  put(10, 4, 'm');
  put(14, 4, 'm');
  put(18, 4, 'q');
  put(22, 4, 'x');
  put(23, 4, 'x');
  put(26, 4, 'k');
  put(30, 4, 'm');
  put(33, 4, 'w'); // the perimeter is mined
  put(35, 4, 'h');
  put(38, 4, 'w');
  put(40, 4, 'z');
  put(44, 4, 'q');
  put(46, 4, 'w');
  put(48, 4, 'c');
  put(52, 4, 'k');
  put(56, 4, 'C');

  // Section 2: Hangar 1 (cols 61-120)
  ground(61, 120, 3, 'a');
  fill(65, 65, 4, 10, 'b');
  fill(110, 110, 4, 10, 'b');
  fill(65, 110, 11, 11, 'b'); // roof
  fill(65, 65, 4, 5, '.'); // door in
  fill(110, 110, 4, 5, '.'); // door out
  fill(72, 102, 7, 7, 'b'); // catwalk
  fill(110, 110, 8, 9, '.'); // window

  put(68, 4, 'm');
  put(74, 4, 'm');
  put(78, 4, 'h');
  put(84, 4, 'x');
  put(85, 4, 'x');
  put(90, 4, 'm');
  put(95, 4, 'k');
  put(100, 4, 'B');
  put(104, 4, 'q');

  put(76, 8, 'm');
  put(82, 8, 'z');
  put(88, 8, 'c');
  put(92, 8, 'N');
  put(96, 8, 'n');
  put(102, 12, 'z');

  put(114, 4, 'm');
  put(118, 4, 'C');

  // Section 3: The Runway & Scout 1 (cols 121-185)
  ground(121, 185, 3, 'a');
  put(124, 4, 'm');
  put(128, 4, 'q');
  put(130, 4, 'j');
  put(132, 4, 'h');
  put(136, 4, 'k');
  put(140, 4, 'A'); // out on the open runway: the paratroopers come down all around
  put(144, 4, 'c');
  put(148, 4, 'n');
  put(152, 4, 'x');
  put(153, 4, 'x');
  put(156, 4, 'J');
  put(158, 4, 'm');

  // Scout 1 running to door at 170
  put(162, 4, 'o');
  put(170, 4, 'D');
  put(174, 4, 'm');
  put(178, 4, 'z');
  put(182, 4, 'C');

  // Section 4: Hangar 2 & Control Tower (cols 186-260)
  ground(186, 260, 3, 'a');
  // Control tower
  fill(192, 192, 4, 13, 'b');
  fill(202, 202, 4, 13, 'b');
  fill(192, 202, 14, 14, 'b');
  fill(192, 192, 4, 5, '.');
  fill(202, 202, 4, 5, '.');
  fill(192, 202, 8, 8, 'b');
  fill(202, 202, 9, 10, '.');

  put(196, 4, 'm');
  put(197, 9, 'z');
  put(198, 9, 'c');
  put(200, 15, 'n');
  put(194, 15, 'j'); // he takes off from the control tower's roof

  put(206, 4, 'm');
  put(210, 4, 'q');
  put(214, 4, 'k');
  put(218, 4, 'm');
  put(222, 4, 'x');
  put(223, 4, 'x');
  put(226, 4, 'h');
  put(230, 4, 'm');
  put(235, 4, 'C');

  // Scout 2 running to door at 250
  put(240, 4, 'o');
  put(250, 4, 'D');
  put(254, 4, 'm');
  put(258, 4, 'c');

  // Section 5: Terminal & Runway End (cols 261-329)
  ground(261, 329, 3, 'a');
  put(264, 4, 'm');
  put(268, 4, 'k');
  put(272, 4, 'm');
  put(276, 4, 'n');
  put(280, 4, 'C');
  // The terminal: two floors, up through the gap by its far wall or in at its upper window
  fill(284, 284, 4, 11, 'b');
  fill(306, 306, 4, 11, 'b');
  fill(284, 306, 12, 12, 'b');
  fill(285, 303, 8, 8, 'b');
  fill(284, 284, 4, 5, '.');
  fill(306, 306, 4, 5, '.');
  fill(306, 306, 9, 10, '.');
  put(286, 4, 'm');
  put(292, 4, 'm');
  put(298, 4, 'B');
  put(304, 4, 'c');
  put(288, 9, 'N');
  put(292, 9, 'z');
  put(310, 4, 'C');
  put(318, 4, 'F');
  fill(329, 329, 4, ROWS - 1, 's');

  const grass: Cell[] = [12, 13, 126, 127, 160, 161, 288, 289].map((c) => ({ c, r: 4 }));

  return {
    cols: COLS,
    rows: ROWS,
    tiles: grid.map((row) => row.join('')),
    parallax: airstripHills(),
    grass,
    flexPower: 'allure',
    theme: 'desert',
  };
}

export function airstripHills(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 6500, step: 650, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 6200, step: 470, y: 47, variants: 3 },
    { layer: 'near', from: -390, to: 6000, step: 430, y: 31, variants: 5 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) {
      out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
    }
  }
  return out;
}
