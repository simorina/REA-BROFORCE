import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT, MINE } from './constants';
import { parseLevel, type LevelData } from './level';
import { plantMine } from './mines';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS } from './types';
import { createWorld, stepWorld, type World } from './world';

const COLS = 30;

/** A flat strip: the bro at column 2, a minefield sign ('w') at `sign`, and `ground` / `level` overrides (column, tile). */
function field(sign: number, ground: Array<[number, string]> = [], level: Array<[number, string]> = []): LevelData {
  const row = (fill: string, at: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [col, ch] of at) a[col] = ch;
    return a.join('');
  };
  const empty = row('.', []);
  return {
    cols: COLS, rows: 8,
    tiles: [empty, empty, empty, empty, empty, row('.', [[2, 'P'], [sign, 'w'], [27, 'F'], ...level]), row('d', ground), row('s', [])],
  };
}

function play(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) stepWorld(w, NO_CONTROLS, NO_CONTROLS, FIXED_DT);
}

const steps = (seconds: number) => Math.round(seconds / FIXED_DT);
const mineBlew = (w: World) => w.events.some((e) => e.type === 'explosion' && e.source === 'mine');

/** A world whose sign planted its mine right under it (column 10), with the bro's spawn invulnerability gone. */
function mined(level: LevelData = field(10)): World {
  const w = createWorld(level, TEST_STATS, [BROLUSCONI], () => 0);
  w.player.invulnerable = 0;
  return w;
}

describe('the minefield (MineFieldSign, Mine)', () => {
  it("reads the minefield sign ('w')", () => {
    expect(parseLevel({ cols: 4, rows: 2, tiles: ['PwF.', 'dddd'] }, TEST_STATS).signs).toEqual([{ c: 1, r: 1 }]);
  });

  it('plants its one mine in the block under it or in one of the two surface blocks either side (SetupMines)', () => {
    const map = parseLevel(field(10), TEST_STATS).map;
    expect(plantMine(map, { c: 10, r: 2 }, () => 0)).toMatchObject({ c: 10, r: 1, state: 'armed' });
    expect(plantMine(map, { c: 10, r: 2 }, () => 0.99)).toMatchObject({ c: 12, r: 1 }); // centre, -1, -2, +1, +2
  });

  it('a side stops at the first gap or at a block on the sign\'s own level', () => {
    const gap = parseLevel(field(10, [[11, '.']]), TEST_STATS).map;
    expect(plantMine(gap, { c: 10, r: 2 }, () => 0.99)).toMatchObject({ c: 8 }); // no right side: centre, -1, -2
    const wall = parseLevel(field(10, [], [[9, 'd']]), TEST_STATS).map;
    expect(plantMine(wall, { c: 10, r: 2 }, () => 0.99)).toMatchObject({ c: 12 }); // no left side: centre, +1, +2
    expect(plantMine(wall, { c: 10, r: 2 }, () => 0.4)).toMatchObject({ c: 11 });
  });

  it('never in steel or a barrel (CanPlaceInBlock): it tries another block', () => {
    const map = parseLevel(field(10, [[10, 's']]), TEST_STATS).map;
    expect(plantMine(map, { c: 10, r: 2 }, () => 0)).toMatchObject({ c: 9, r: 1 });
  });

  it("never under a checkpoint's flagpole, whose blocks turn to steel", () => {
    expect(mined(field(11, [], [[10, 'C']])).mines[0]).toMatchObject({ c: 12 });
  });

  it('the createWorld plants one mine per sign, at the centre of its block', () => {
    const w = mined();
    expect(w.mines).toHaveLength(1);
    expect(w.mines[0]).toMatchObject({ c: 10, r: 1, x: 160, y: 16 });
    expect(w.signs).toEqual([{ c: 10, r: 2, x: 160, y: 32, fallen: false }]);
  });

  it('a bro stepping on it sets it off with a click, and 0.3 s later it blows him up', () => {
    const w = mined();
    w.player.x = w.mines[0].x;
    play(w, 1);
    expect(w.mines[0].state).toBe('detonating');
    expect(w.events.some((e) => e.type === 'mineArmed')).toBe(true);
    play(w, steps(MINE.fuse - 0.05));
    expect(w.mines[0].state).toBe('detonating');
    let blew = false;
    for (let i = 0; i < steps(0.1) && !blew; i++) {
      play(w, 1);
      blew = mineBlew(w);
    }
    expect(blew).toBe(true);
    expect(w.mines[0].state).toBe('exploded');
    expect(w.player.dead).toBe(true);
  });

  it('it goes off under a foot within 3 of its column (the three rays of CheckForTraps)', () => {
    const w = mined();
    w.player.x = w.mines[0].x - 8 - 2; // standing on the next block, his toes over the mine's
    play(w, 1);
    expect(w.mines[0].state).toBe('detonating');
  });

  it('mooks set it off too, and the blast kills them', () => {
    const w = mined(field(10, [], [[20, 'm']]));
    const m = w.enemies[0];
    m.x = w.mines[0].x;
    play(w, steps(MINE.fuse + 0.1));
    expect(w.mines[0].state).toBe('exploded');
    expect(m.dead).toBe(true);
    expect(w.player.dead).toBe(false);
  });

  it('an invulnerable bro walks over it safely', () => {
    const w = mined();
    w.player.invulnerable = 5;
    w.player.x = w.mines[0].x;
    play(w, steps(1));
    expect(w.mines[0].state).toBe('armed');
  });

  it('destroying its block sets it off at once (Block.Collapse: Detonate(true))', () => {
    const w = mined();
    const mine = w.mines[0];
    w.map.damage(mine.c, mine.r, 999);
    play(w, 1);
    expect(mine.state).toBe('exploded');
    expect(mineBlew(w)).toBe(true);
  });

  it('its blast digs out its block (DamageGround 12 in range 20) and the sign over it falls', () => {
    const w = mined();
    w.player.x = w.mines[0].x;
    play(w, steps(MINE.fuse + 0.1));
    expect(w.map.get(10, 1)).toBeNull();
    expect(w.signs[0].fallen).toBe(true);
  });
});
