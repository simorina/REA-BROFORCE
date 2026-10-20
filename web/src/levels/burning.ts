import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 220;
const ROWS = 20;

/**
 * Mission 2, the burning jungle, built with helpers so the rows stay aligned. Rows count from the bottom
 * (0 = bedrock). Through a village of brick huts and barrels, over two gaps, past a scout's door, a steel bunker
 * and a last scout to the flag.
 */
export function buildBurning(): LevelData {
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
  /** A brick hut from c0 to c1 standing on row r: open doorways two tiles high on both sides, a flat roof. */
  const hut = (c0: number, c1: number, r: number, ch = 'b') => {
    fill(c0, c0, r, r + 3, ch);
    fill(c1, c1, r, r + 3, ch);
    fill(c0, c1, r + 4, r + 4, ch);
    fill(c0, c0, r, r + 1, '.');
    fill(c1, c1, r, r + 1, '.');
  };

  // The village's edge (0-44): mooks, barrels, a dog, a hut with a riot shield mook inside and a prisoner on top.
  ground(0, 44, 3);
  put(3, 4, 'P');
  put(12, 4, 'm');
  put(16, 4, 'm');
  put(19, 4, 'x');
  put(20, 4, 'x');
  put(24, 4, 'q');
  hut(27, 35, 4);
  hut(29, 33, 9); // a second storey, the prisoner inside it
  put(31, 4, 'h');
  put(31, 9, 'c');
  put(35, 9, 'z');
  put(27, 9, 'j');
  put(38, 4, 'k');
  put(41, 4, 'C');

  // A gap (45-47), then terraces (48-90): a grenadier up top, a hut with a dog, a bazooka mook and a prisoner on it.
  ground(48, 60, 5);
  put(51, 6, 'm');
  put(57, 6, 'n');
  ground(61, 90, 7);
  put(63, 8, 'x');
  put(64, 8, 'x');
  put(67, 8, 'm');
  put(69, 8, 'J');
  hut(72, 80, 8);
  put(75, 8, 'm');
  put(77, 8, 'q');
  put(74, 13, 'c');
  put(76, 13, 'z');
  put(84, 8, 'k');
  put(87, 8, 'C');

  // The scout's run (91-135): he runs for his door; a shield mook, a row of barrels, a grenadier, a prisoner.
  ground(91, 135, 7);
  put(95, 8, 'o');
  put(104, 8, 'D');
  put(107, 8, 'N'); // crouched in the long grass
  put(108, 8, 'm');
  put(111, 8, 'h');
  put(114, 8, 'x');
  put(115, 8, 'x');
  put(116, 8, 'x');
  put(119, 8, 'm');
  put(123, 8, 'n');
  put(126, 8, 'c');
  put(129, 8, 'm');
  put(132, 8, 'C');

  // A second gap (136-138), then the camp (139-180): a steel bunker full of mooks, a grenadier and a prisoner on it.
  ground(139, 180, 7);
  put(140, 8, 'w');
  put(143, 8, 'q');
  put(146, 8, 'A');
  hut(150, 162, 8, 's');
  put(153, 8, 'm');
  put(156, 8, 'k');
  put(158, 8, 'x');
  put(160, 8, 'm');
  put(164, 8, 'w');
  put(152, 13, 'c');
  put(156, 13, 'n');
  put(166, 8, 'h');
  put(170, 8, 'm');
  put(173, 8, 'x');
  put(174, 8, 'x');
  put(177, 8, 'C');
  put(179, 8, 'c');

  // The last run (181-219): a scout and his door, then the guards before the flag and a steel wall.
  ground(181, 219, 7);
  put(184, 8, 'o');
  put(193, 8, 'D');
  put(197, 8, 'm');
  put(198, 8, 'N');
  put(200, 8, 'q');
  put(203, 8, 'k');
  put(206, 8, 'z');
  put(209, 8, 'B'); // the Bruiser holding the way to the flag
  put(213, 8, 'F');
  fill(219, 219, 8, ROWS - 1, 's');

  // Long grass: mooks wait hidden in it (PolymorphicAI.HideInGrass).
  const grass: Cell[] = [106, 107, 108, 109, 110, 196, 197, 198].map((c) => ({ c, r: 8 }));

  return { cols: COLS, rows: ROWS, tiles: grid.map((row) => row.join('')), parallax: burningJungle(), grass, flexPower: 'allure', theme: 'burning' };
}

/**
 * The Jungle Burning theme's background, spread along the level as a level designer places Parallax1/2/3 doodads:
 * near 6 variants (three with huts), mid 2, distant 3. Spacing and heights are ours.
 */
export function burningJungle(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 4400, step: 300, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 4200, step: 420, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 4100, step: 260, y: 31, variants: 6 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
  }
  return out;
}
