import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import { foeAt } from './foes';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS } from './types';
import { createWorld, stepWorld, type World } from './world';

const COLS = 60;

/** A flat strip: the bro at column `bro`, a foe at `at`, solid steel ends; `ground` overrides tiles of the ground row. */
function road(foe: string, at = 30, bro = 2, ground: Array<[number, string]> = []): LevelData {
  const row = (fill: string, cells: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of cells) a[c] = ch;
    return a.join('');
  };
  const empty = row('.', []);
  return {
    cols: COLS, rows: 10,
    tiles: [empty, empty, empty, empty, empty, empty, row('.', [[bro, 'P'], [at, foe], [58, 'F']]), row('d', ground), row('d', []), row('s', [])],
  };
}

function play(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) stepWorld(w, NO_CONTROLS, NO_CONTROLS, FIXED_DT);
}
const steps = (s: number) => Math.round(s / FIXED_DT);

/** A world whose camera sees the foe (the bro stands a few blocks off it). */
function near(foe: string, at = 30, gap = 14, ground: Array<[number, string]> = []): World {
  const w = createWorld(road(foe, at, at - gap, ground), TEST_STATS, [BROLUSCONI], () => 0.5);
  w.player.invulnerable = 999;
  return w;
}

describe('the troop truck (MookTruck, MookTruckPolyAI)', () => {
  it("reads the truck ('T') as a foe with its 20 health", () => {
    expect(parseLevel(road('T'), TEST_STATS).foes).toEqual([{ c: 30, r: 3, kind: 'truck' }]);
    const w = createWorld(road('T'), TEST_STATS, [BROLUSCONI], () => 0.5);
    expect(w.foes).toHaveLength(1);
    expect(w.foes[0]).toMatchObject({ kind: 'truck', health: 20, facing: -1, dead: false });
  });

  it('waits off screen; in sight it drives left (80) as far as its road goes: two blocks short of a gap, 15 at most', () => {
    const far = createWorld(road('T', 50, 2), TEST_STATS, [BROLUSCONI], () => 0.5);
    far.player.invulnerable = 999;
    play(far, steps(1));
    expect(far.foes[0].x).toBe(50 * 16);
    const w = near('T', 30, 25, [[24, '.']]); // a gap at column 24: it stops at column 26
    play(w, steps(0.6));
    expect(w.foes[0].xI).toBe(-80);
    play(w, steps(4));
    expect(Math.round(w.foes[0].x / 16)).toBe(26);
    expect(w.foes[0].xI).toBe(0);
  });

  it('there it unloads its seven mooks out of the back, one every 0.6 s, thrown out behind it', () => {
    const w = near('T', 30, 25, [[26, '.']]);
    const truck = w.foes[0];
    play(w, steps(10));
    const mooks = w.enemies.filter((e) => e.kind === 'mook');
    expect(mooks).toHaveLength(7);
    expect(truck.spawned).toBe(7);
  });

  it('a bro in front of it within 120 stops it at once, and the mooks come out alerted', () => {
    const w = near('T', 30, 6);
    play(w, steps(1.5));
    const truck = w.foes[0];
    expect(truck.alerted).toBe(true);
    const mooks = w.enemies.filter((e) => e.kind === 'mook');
    expect(mooks.length).toBeGreaterThan(0);
    expect(mooks[0].ai?.mental).toBe('alerted');
  });

  it("the bro's shots hit it (a second within 0.096 s does at most 1) and at 0 it blows up into a wreck", () => {
    const w = near('T');
    const truck = w.foes[0];
    expect(foeAt(w.foes, truck.x, truck.y + 16)).toBe(truck);
    expect(foeAt(w.foes, truck.x, truck.y + 80)).toBeNull();
    w.projectiles.push({ id: 900, kind: 'rocket', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, 3);
    expect(truck.health).toBeLessThan(20);
    for (let i = 0; i < 40 && !truck.dead; i++) {
      w.projectiles.push({ id: 1000 + i, kind: 'bullet', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
      play(w, 4);
    }
    expect(truck.dead).toBe(true);
    expect(foeAt(w.foes, truck.x, truck.y + 16)).toBeNull();
  });

  it('its death blast (12 within 32-48) hurts what is around it', () => {
    const w = near('T', 30, 25);
    const truck = w.foes[0];
    truck.health = 1;
    w.projectiles.push({ id: 900, kind: 'bullet', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    w.player.invulnerable = 0;
    w.player.x = truck.x - 20;
    play(w, 3);
    expect(truck.dead).toBe(true);
    expect(w.player.dead).toBe(true);
  });
});
