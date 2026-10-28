import type { Cell, LevelData, ParallaxDoodad } from '../engine/level';

const COLS = 170;
const ROWS = 18;

/**
 * Mission 2: "Il porto dei segreti" (The Harbor of Secrets).
 * Fight through docks, shipping containers, and a fortified warehouse to intercept Epstein's cargo.
 */
export function buildHarbor(): LevelData {
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

  // Section 1: Docks start (cols 0-52)
  ground(0, 52, 3, 'd');
  put(3, 4, 'P');
  put(10, 4, 'm');
  put(15, 4, 'm');
  put(18, 4, 'x');
  put(19, 4, 'x');
  put(22, 4, 'q');

  // Shipping containers (brick blocks): a stack of two, the top one overhanging, a ninja crouched under it
  fill(24, 29, 4, 6, 'b');
  fill(26, 31, 7, 9, 'b');
  put(29, 10, 'c');
  put(30, 4, 'N');
  put(32, 4, 'm');
  fill(35, 39, 4, 7, 'b');
  put(37, 8, 'n');
  put(41, 4, 'j'); // a jetpack mook takes off from between the containers
  put(43, 4, 'h');
  put(45, 4, 'A'); // kill the alarmist and the paratroopers drop onto the docks
  put(47, 4, 'k');
  put(50, 4, 'C');

  // Water hazard gap (cols 53-56): bedrock at row 0 only
  fill(53, 56, 0, 0, 's');

  // Section 2: Warehouse (cols 57-105)
  ground(57, 105, 3, 'd');
  put(60, 4, 'm');
  put(64, 4, 'q');
  put(67, 4, 'k');

  // Fortified warehouse building
  fill(70, 70, 4, 10, 'b');
  fill(105, 105, 4, 10, 'b');
  fill(70, 105, 11, 11, 'b'); // roof
  fill(70, 70, 4, 5, '.'); // entrance door
  fill(105, 105, 4, 5, '.'); // exit door
  fill(75, 100, 7, 7, 'b'); // 2nd floor platform
  fill(105, 105, 8, 9, '.'); // 2nd floor window

  put(74, 4, 'm');
  put(78, 12, 'z');
  put(80, 8, 'm');
  put(82, 8, 'N'); // upstairs, in the dark
  put(84, 4, 'h');
  put(88, 4, 'B'); // a Bruiser holds the warehouse floor
  put(86, 8, 'm');
  put(90, 4, 'x');
  put(91, 4, 'x');
  put(92, 8, 'c');
  put(95, 12, 'n');
  put(98, 4, 'm');
  put(102, 4, 'q');

  // Section 3: Crane docks and Pier (cols 106-169)
  ground(106, 169, 3, 'd');
  put(108, 4, 'C');
  put(112, 4, 'm');
  put(117, 4, 'c');

  // Steel crane structure
  fill(115, 115, 4, 13, 's');
  fill(125, 125, 4, 13, 's');
  fill(115, 125, 12, 12, 's');
  put(120, 13, 'z');

  put(119, 4, 'J'); // and a jetpack bazooka mook from under the crane
  put(122, 4, 'x');
  put(123, 4, 'x');
  fill(126, 134, 7, 7, 's'); // a gantry off the crane's leg, a grenadier on it
  put(130, 8, 'n');
  put(128, 4, 'm');
  put(131, 4, 'c');
  put(133, 4, 'k');

  // Scout sprinting to alert the mook door
  put(135, 4, 'o');
  put(142, 4, 'D');

  put(146, 4, 'z');
  // The pier's end: a minefield, the last checkpoint, and a Bruiser holding the flag
  put(150, 4, 'w');
  put(152, 4, 'x');
  put(154, 4, 'w');
  put(156, 4, 'C');
  put(160, 4, 'B');
  put(163, 4, 'F');
  fill(169, 169, 4, ROWS - 1, 's');

  const grass: Cell[] = [12, 13, 61, 62, 113, 114, 129, 130].map((c) => ({ c, r: 4 }));

  return {
    cols: COLS,
    rows: ROWS,
    tiles: grid.map((row) => row.join('')),
    parallax: harborJungle(),
    grass,
    flexPower: 'allure',
    theme: 'jungle',
    music: 'JungleBlueSky', // the blue sky over the docks
  };
}

export function harborJungle(): ParallaxDoodad[] {
  const layers = [
    { layer: 'distant', from: -800, to: 3400, step: 300, y: 148, variants: 3 },
    { layer: 'mid', from: -480, to: 3200, step: 420, y: 47, variants: 2 },
    { layer: 'near', from: -390, to: 3100, step: 260, y: 31, variants: 3 },
  ] as const;
  const out: ParallaxDoodad[] = [];
  for (const l of layers) {
    for (let x = l.from, i = 0; x <= l.to; x += l.step, i++) {
      out.push({ layer: l.layer, variant: i % l.variants, x, y: l.y });
    }
  }
  return out;
}
