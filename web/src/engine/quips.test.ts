import { describe, expect, it } from 'vitest';
import { BROLUSCONI, MUSK, PUTIN, TRUMP, WILL_SMITH } from '../bros';
import type { BroDef } from './bro';
import { FIXED_DT, QUIP, SATAN_LASER_LINE } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls, type Unit } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A flat floor with the bro at 3, the flag at 38 and `cells` on the floor row. */
function floor(cells: Array<[number, string]>): LevelData {
  const a = Array<string>(COLS).fill('.');
  for (const [c, ch] of [[3, 'P'], [38, 'F'], ...cells] as Array<[number, string]>) a[c] = ch;
  const e = '.'.repeat(COLS);
  return { cols: COLS, rows: 6, tiles: [e, e, e, a.join(''), 'd'.repeat(COLS), 's'.repeat(COLS)] };
}

const world = (bro: BroDef, cells: Array<[number, string]>): World => {
  const w = createWorld(floor(cells), TEST_STATS, [bro], () => 0.5);
  w.player.invulnerable = 999;
  return w;
};
const steps = (s: number) => Math.round(s / FIXED_DT);

function play(w: World, frames: number, controls: Partial<Controls> = {}, onStep?: () => void): void {
  const c = { ...NO_CONTROLS, ...controls };
  let prev = NO_CONTROLS;
  for (let i = 0; i < frames; i++) {
    stepWorld(w, c, prev, FIXED_DT);
    prev = c;
    onStep?.();
  }
}

/** Kills enemy `m` (or the world's enemy `m`) outright and lets the world report it. */
function kill(w: World, m: Unit | number): void {
  const u = typeof m === 'number' ? w.enemies[m] : m;
  damageUnit(u, u.health + 1, true);
  play(w, 1);
}

const spoken = (w: World, text: string) => w.events.filter((e) => e.type === 'voice' && e.text === text);
const bubbles = (w: World, text: string) => w.effects.filter((e) => e.kind === 'speech' && e.text === text && e.unit === undefined);

describe('the lines the lore gives the bros', () => {
  it("Trump fires the mooks: \"You're fired!\" over his head and aloud, at most every QUIP.cooldown", () => {
    const w = world(TRUMP, [[20, 'm'], [22, 'm'], [24, 'm']]);
    const [a, b, c] = w.enemies; // the dead are cleared away in time
    kill(w, a);
    expect(bubbles(w, "You're fired!")).toHaveLength(1);
    expect(spoken(w, "You're fired!")).toEqual([{ type: 'voice', text: "You're fired!", lang: 'en-US' }]);
    kill(w, b);
    expect(spoken(w, "You're fired!")).toHaveLength(1);
    play(w, steps(QUIP.cooldown));
    kill(w, c);
    expect(spoken(w, "You're fired!")).toHaveLength(2);
  });

  it('Bro In Black welcomes the aliens to Earth, and has nothing to say to a mook', () => {
    const w = world(WILL_SMITH, [[20, 'm'], [24, 'X']]);
    kill(w, 0);
    expect(spoken(w, 'Welcome to Earth!')).toHaveLength(0);
    kill(w, 1);
    expect(spoken(w, 'Welcome to Earth!')).toHaveLength(1);
  });

  it('Silvio calls his airstrike with "Ghe pensi mi!" and the mooks he kills poor communists', () => {
    expect(BROLUSCONI.voiceLine).toBe('Ghe pensi mi!');
    const w = world(BROLUSCONI, [[20, 'm']]);
    kill(w, 0);
    expect(spoken(w, 'Siete solo dei poveri comunisti!')).toEqual([{ type: 'voice', text: 'Siete solo dei poveri comunisti!', lang: 'it-IT' }]);
  });

  it('a bro without a kill line keeps quiet', () => {
    const w = world(PUTIN, [[20, 'm']]);
    kill(w, 0);
    expect(w.events.filter((e) => e.type === 'voice')).toEqual([]);
  });

  it('he never talks over his own line: a kill while his special line shows says nothing', () => {
    const w = world(TRUMP, [[20, 'm']]);
    play(w, 1, { special: true });
    expect(bubbles(w, TRUMP.voiceLine)).toHaveLength(1);
    kill(w, 0);
    expect(spoken(w, "You're fired!")).toHaveLength(0);
  });

  it("Satan laughs at Musk's laser the first time he sees it, and says so", () => {
    const w = world(MUSK, [[12, '6']]);
    const satan = w.enemies[0];
    const lines = new Set<object>();
    play(w, steps(3), { fire: true }, () => {
      for (const e of w.effects) if (e.kind === 'speech' && e.text === SATAN_LASER_LINE && e.unit === satan.id) lines.add(e);
    });
    expect(lines.size).toBe(1);
  });

  it('without the laser, Satan just laughs', () => {
    const w = world(BROLUSCONI, [[12, '6']]);
    play(w, steps(3));
    expect(w.effects.some((e) => e.kind === 'speech' && e.text === SATAN_LASER_LINE)).toBe(false);
  });
});
