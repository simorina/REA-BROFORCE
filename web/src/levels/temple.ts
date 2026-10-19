import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 390;
const ROWS = 20;

/**
 * Mission 6: "Il tempio sotterraneo" (The Underground Temple).
 * Deep beneath the airstrip lies Epstein's subterranean ritual temple.
 * Navigate catacombs, trap-filled corridors, bottomless chasms, and cult chambers
 * to uncover the final clues pointing to Little Saint James.
 */
export function buildTemple(): LevelData {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
  const put = (c: number, r: number, ch: string) => {
    grid[ROWS - 1 - r][c] = ch;
  };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch);
  };
  const ground = (c0: number, c1: number, top: number, ch = 't') => {
    fill(c0, c1, 0, 0, 's');
    fill(c0, c1, 1, top, ch);
  };

  // Section 1: Cave entrance & Descent (cols 0-70)
  ground(0, 70, 3, 't');
  put(3, 4, 'P');
  put(10, 4, 'm');
  put(14, 4, 'm');
  put(18, 4, 'q');
  put(22, 4, 'x');
  put(23, 4, 'x');
  put(26, 4, 'k');
  put(30, 4, 'm');
  put(34, 4, 'h');
  put(38, 4, 'z');
  put(42, 4, 'c');
  put(46, 4, 'k');
  put(50, 4, 'm');
  put(55, 4, 'q');
  put(60, 4, 'n');
  put(65, 4, 'C');

  // Section 2: Lower catacombs (cols 71-150)
  ground(71, 150, 3, 't');
  fill(75, 75, 4, 11, 't');
  fill(140, 140, 4, 11, 't');
  fill(75, 140, 12, 12, 't'); // roof
  fill(75, 75, 4, 5, '.'); // door in
  fill(140, 140, 4, 5, '.'); // door out
  fill(85, 130, 7, 7, 't'); // internal gallery floor
  fill(140, 140, 8, 9, '.'); // window

  put(78, 4, 'm');
  put(82, 4, 'h');
  put(88, 4, 'x');
  put(89, 4, 'x');
  put(94, 4, 'm');
  put(98, 4, 'k');
  put(104, 4, 'm');
  put(108, 4, 'q');
  put(114, 4, 'm');
  put(120, 4, 'h');
  put(126, 4, 'k');
  put(132, 4, 'm');

  put(90, 8, 'm');
  put(96, 8, 'z');
  put(102, 8, 'c');
  put(106, 13, 'n');
  put(110, 8, 'n');
  put(118, 8, 'z');
  put(124, 8, 'm');

  put(144, 4, 'm');
  put(148, 4, 'C');

  // Section 3: Ritual Chamber & Scout 1 (cols 151-230)
  ground(151, 230, 3, 't');
  put(154, 4, 'm');
  put(158, 4, 'q');
  put(162, 4, 'h');
  put(166, 4, 'k');
  put(170, 4, 'x');
  put(171, 4, 'x');
  put(174, 4, 'm');
  put(178, 4, 'c');
  put(182, 4, 'z');
  put(186, 4, 'm');
  put(190, 4, 'k');
  put(194, 4, 'm');

  // Pillars
  fill(200, 200, 4, 9, 't');
  fill(208, 208, 4, 9, 't');
  fill(216, 216, 4, 9, 't');

  put(204, 4, 'm');
  put(212, 4, 'c');

  // Scout 1 running to door at 225
  put(218, 4, 'o');
  put(225, 4, 'D');
  put(228, 4, 'C');

  // Section 4: The Chasm & Terraces (cols 231-310)
  ground(231, 250, 5, 't');
  put(235, 6, 'm');
  put(239, 6, 'h');
  put(243, 6, 'k');
  put(247, 6, 'z');

  // Chasm pit
  fill(251, 254, 0, 0, 's');

  ground(255, 275, 7, 't');
  put(258, 8, 'm');
  put(262, 8, 'q');
  put(266, 8, 'c');
  put(270, 8, 'n');
  put(274, 8, 'C');

  ground(276, 310, 5, 't');
  put(280, 6, 'm');
  put(284, 6, 'k');
  put(288, 6, 'm');
  put(292, 6, 'x');
  put(293, 6, 'x');
  put(296, 6, 'm');

  // Scout 2 running to door at 308 (both on row 6)
  put(300, 6, 'o');
  put(308, 6, 'D');
  put(310, 6, 'C');

  // Section 5: Inner Sanctum & Exit (cols 311-389)
  ground(311, 389, 3, 't');
  fill(320, 320, 4, 12, 't');
  fill(360, 360, 4, 12, 't');
  fill(320, 360, 13, 13, 't');
  fill(320, 320, 4, 5, '.');
  fill(360, 360, 4, 5, '.');

  put(325, 4, 'm');
  put(330, 4, 'z');
  put(335, 4, 'm');
  put(340, 4, 'c');
  put(345, 4, 'k');
  put(350, 4, 'm');
  put(355, 4, 'm');

  put(365, 4, 'm');
  put(370, 4, 'C');
  put(375, 4, 'm');
  put(380, 4, 'F');
  fill(389, 389, 4, ROWS - 1, 's');

  const grass: Cell[] = [12, 13, 80, 81, 156, 157, 282, 283, 367, 368].map((c) => ({
    c,
    r: c >= 231 && c <= 250 ? 6 : c >= 255 && c <= 275 ? 8 : c >= 276 && c <= 310 ? 6 : 4,
  }));

  return {
    cols: COLS,
    rows: ROWS,
    tiles: grid.map((row) => row.join('')),
    parallax: templeJungle(),
    grass,
    flexPower: 'allure',
    theme: 'burning',
  };
}

export function templeJungle(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 7500, step: 300, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 7200, step: 420, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 7000, step: 260, y: 31, variants: 6 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) {
      out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
    }
  }
  return out;
}
