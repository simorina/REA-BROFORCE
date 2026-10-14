import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 30;
function line(entries: Array<[number, string]> = [], fillCh = '.'): string {
  const a = Array<string>(COLS).fill(fillCh);
  for (const [c, ch] of entries) a[c] = ch;
  return a.join('');
}
/** Entities on row 2 (feet at y = 24), dirt on row 1, steel bedrock on row 0. */
function level(row2: Array<[number, string]>): LevelData {
  return { cols: COLS, rows: 8, tiles: [line(), line(), line(), line(), line(), line(row2), line([], 'd'), line([], 's')] };
}
function play(w: World, controls: Partial<Controls>, frames: number, prev: Controls = NO_CONTROLS): Controls {
  const c = { ...NO_CONTROLS, ...controls };
  let p = prev;
  for (let i = 0; i < frames; i++) {
    stepWorld(w, c, p, FIXED_DT);
    p = c;
  }
  return p;
}
const EMPTY = level([[2, 'P'], [27, 'F']]);

describe('createWorld', () => {
  it('spawns everything from the level', () => {
    const w = createWorld(level([[0, 'P'], [4, 'c'], [16, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    expect([w.player.x, w.player.y]).toEqual([0, 24]);
    expect(w.enemies.map((e) => [e.kind, e.x, e.y])).toEqual([['mook', 256, 24]]);
    expect(w.prisoners).toEqual([{ x: 64, y: 24, freed: false }]);
    expect(w.flag).toEqual({ x: 432, y: 24 });
    expect(w.lives).toBe(3);
    expect(w.specialAmmo).toBe(4);
  });
});

describe('stepWorld', () => {
  it('kicks footballs no faster than the fireRate', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    const seen = new Set<number>();
    let prev = NO_CONTROLS;
    for (let i = 0; i < 30; i++) {
      prev = play(w, { fire: true }, 1, prev);
      for (const p of w.projectiles) if (p.kind === 'football') seen.add(p.id);
    }
    expect(seen.size).toBe(2); // at 0 s and 0.27 s
  });

  it('special fires once per press, speaks, and stops at zero ammo', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    let prev = play(w, { special: true }, 30);
    expect(w.specialAmmo).toBe(3);
    expect(w.projectiles.filter((p) => p.kind === 'marker')).toHaveLength(1);
    expect(w.events.filter((e) => e.type === 'voice')).toEqual([{ type: 'voice', text: BROLUSCONI.voiceLine }]);
    expect(w.effects.some((e) => e.kind === 'speech' && e.text === BROLUSCONI.voiceLine)).toBe(true);
    prev = play(w, {}, 1, prev);
    prev = play(w, { special: true }, 1, prev);
    expect(w.specialAmmo).toBe(2);
    w.specialAmmo = 0;
    prev = play(w, {}, 1, prev);
    play(w, { special: true }, 1, prev);
    expect(w.specialAmmo).toBe(0);
    expect(w.events.filter((e) => e.type === 'voice')).toHaveLength(2);
  });

  it('the airstrike brings five bombs from outside the map, and they all land', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    const prev = play(w, { special: true }, 1);
    play(w, {}, 62, prev);
    expect(w.projectiles.filter((p) => p.kind === 'bomb')).toHaveLength(5);
    play(w, {}, 300);
    expect(w.projectiles.filter((p) => p.kind === 'bomb')).toHaveLength(0);
    expect(w.events.filter((e) => e.type === 'explosion').length).toBeGreaterThanOrEqual(5);
    expect(w.player.dead).toBe(false);
  });

  it('touching a cage frees the prisoner and adds a life', () => {
    const w = createWorld(level([[0, 'P'], [4, 'c'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    play(w, { right: true }, 60);
    expect(w.prisoners[0].freed).toBe(true);
    expect(w.lives).toBe(4);
    expect(w.events).toContainEqual({ type: 'rescue' });
  });

  it('reaching the flag starts the extraction, which wins the level', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = w.flag.x - 4;
    play(w, {}, 1);
    expect(w.state).toBe('extracting');
    play(w, {}, 186);
    expect(w.state).toBe('won');
  });

  it('dying respawns at the start for a life; with none left the game is lost', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = 200;
    damageUnit(w.player, 1);
    play(w, {}, 100);
    expect(w.player.dead).toBe(false);
    expect(w.player.x).toBe(w.spawn.x);
    expect(w.lives).toBe(2);
    expect(w.events).toContainEqual({ type: 'death' });
    w.lives = 0;
    damageUnit(w.player, 1);
    play(w, {}, 100);
    expect(w.state).toBe('lost');
  });

  it('barrels chain-explode once each', () => {
    const barrels: Array<[number, string]> = [];
    for (let c = 10; c <= 19; c++) barrels.push([c, 'x']);
    const w = createWorld(level([[0, 'P'], ...barrels, [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    w.projectiles.push({ id: 999, kind: 'bullet', team: 'enemy', x: 140, y: 30, xI: 250, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, {}, 10);
    for (let c = 10; c <= 19; c++) expect(w.map.get(c, 2)).toBeNull();
    expect(w.events.filter((e) => e.type === 'explosion')).toHaveLength(10);
    expect(w.player.dead).toBe(false);
  });

  it('falling off the bottom of the map kills the player', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.y = -70;
    play(w, {}, 1);
    expect(w.player.dead).toBe(true);
  });
});
