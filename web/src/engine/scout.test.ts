import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { fullyAlert, thinkMook } from './ai';
import { FIXED_DT, TILE } from './constants';
import type { LevelData } from './level';
import { TileMap, makeBlock } from './map';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS } from './types';
import { damageUnit, makeUnit } from './units';
import { createWorld, stepWorld, type GameEvent, type World } from './world';

function line(cols: number, entries: Array<[number, string]> = [], fillCh = '.'): string {
  const a = Array<string>(cols).fill(fillCh);
  for (const [c, ch] of entries) a[c] = ch;
  return a.join('');
}
/** Entities on row 2 (feet at y = 24), dirt on row 1, steel bedrock on row 0. */
function level(row2: Array<[number, string]>, cols = 30): LevelData {
  const empty = line(cols);
  return { cols, rows: 8, tiles: [empty, empty, empty, empty, empty, line(cols, row2), line(cols, [], 'd'), line(cols, [], 's')] };
}

/** A small deterministic generator, so long runs don't get stuck on one constant. */
function lcg(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Steps the world with no input, collecting its events; stops early when `until` holds. */
function run(w: World, seconds: number, until: (w: World, events: GameEvent[]) => boolean = () => false): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    stepWorld(w, NO_CONTROLS, NO_CONTROLS, FIXED_DT);
    events.push(...w.events);
    w.events = [];
    if (until(w, events)) break;
  }
  return events;
}

describe('ScoutAI', () => {
  const map = new TileMap(60, 10);
  for (let c = 0; c < 60; c++) map.set(c, 0, makeBlock('dirt', TEST_STATS));
  const scene = (doors: Array<{ c: number; r: number }>) => ({
    player: makeUnit(1, 'bro', 'player', 10 * TILE, 8, TEST_STATS.bros.bro_base), map, runSpeed: TEST_STATS.scoutRunSpeed,
    doors: doors.map((d) => ({ ...d, x: d.c * TILE, y: d.r * TILE })),
  });

  it('runs for the nearest door, then paces in front of it', () => {
    const s = makeUnit(2, 'mook_scout', 'enemy', 20 * TILE, 8, TEST_STATS.units.mook_scout);
    fullyAlert(s, TEST_STATS.ai.mook_scout, 10 * TILE, 8, () => 0.5, scene([{ c: 50, r: 1 }, { c: 28, r: 1 }]));
    const ai = s.ai!;
    expect(ai.mental).toBe('alerted');
    expect(ai.speed).toBe(100); // ScoutMook.runSpeed
    expect([ai.startC, ai.startR]).toEqual([10, 1]); // where it saw the player
    expect(ai.queue.map((a) => a.type)).toEqual([
      'greet', 'wait', 'followPath', 'special2', ...Array<string>(12).fill('move'), 'becomeIdle',
    ]);
    expect(ai.queue[2]).toMatchObject({ c: 28, r: 1 });
    expect(ai.queue.slice(4, 8).map((a) => a.c)).toEqual([27, 29, 27, 29]);
  });

  it('with no door around, runs 32 columns away from the noise', () => {
    const s = makeUnit(2, 'mook_scout', 'enemy', 20 * TILE, 8, TEST_STATS.units.mook_scout);
    fullyAlert(s, TEST_STATS.ai.mook_scout, 10 * TILE, 8, () => 0.5, scene([]));
    expect(s.ai!.queue[2]).toMatchObject({ type: 'followPath', c: 52, r: 1 });
  });

  it('greets with the Rambro face instead of "!", and waves while alerted', () => {
    const s = makeUnit(2, 'mook_scout', 'enemy', 20 * TILE, 8, TEST_STATS.units.mook_scout);
    const sc = scene([{ c: 28, r: 1 }]);
    fullyAlert(s, TEST_STATS.ai.mook_scout, 10 * TILE, 8, () => 0.5, sc);
    const out = thinkMook(s, { map, player: sc.player, rng: () => 0.5, stats: TEST_STATS.ai.mook_scout, doors: sc.doors }, FIXED_DT);
    expect(out.fire).toBe(true); // ScoutAI.GetInput: alertDelay starts at 0
    expect(s.ai!.bubble).toBeNull();
    expect(s.ai!.rambro).toBeCloseTo(0.55, 5); // alertDelay / 2, alertDelay = 0.7 + 0.5 * 0.8
  });
});

describe('MookDoor', () => {
  it('lets a mook out every second or so while on screen, up to three alive', () => {
    const w = createWorld(level([[2, 'P'], [10, 'D'], [27, 'F']]), TEST_STATS, BROLUSCONI, lcg());
    w.player.invulnerable = Infinity;
    run(w, 2, () => w.enemies.length > 0);
    expect(w.time).toBeGreaterThan(0.9);
    expect(w.enemies).toHaveLength(1);
    const m = w.enemies[0];
    expect(m.exitDoor).not.toBeNull(); // RegisterOriginDoor: it walks out of the doorway ...
    expect(m.invulnerable).toBeGreaterThan(0); // ... invulnerable for 0.6 s
    expect(Math.abs(m.x - 10 * TILE)).toBe(TILE);
    expect(m.y).toBe(24);
    run(w, 1);
    expect(m.exitDoor).toBeNull();
    run(w, 6);
    expect(w.doors[0].mookCount).toBe(3);
    expect(w.enemies.filter((e) => !e.dead)).toHaveLength(3);
  });

  it('counts a dead mook out (Mook.Death: RemoveMook)', () => {
    const w = createWorld(level([[2, 'P'], [10, 'D'], [27, 'F']]), TEST_STATS, BROLUSCONI, lcg());
    run(w, 1.05);
    expect(w.doors[0].mookCount).toBe(1);
    w.enemies[0].invulnerable = 0;
    damageUnit(w.enemies[0], 10);
    run(w, 1 / 60);
    expect(w.doors[0].mookCount).toBe(0);
  });

  it('stays shut while off screen', () => {
    const w = createWorld(level([[2, 'P'], [55, 'D'], [58, 'F']], 60), TEST_STATS, BROLUSCONI, lcg());
    run(w, 3);
    expect(w.enemies).toHaveLength(0);
  });

  it('a scout runs to the door and its alarm sends mooks along a path to the player', () => {
    const w = createWorld(level([[2, 'P'], [12, 'o'], [25, 'D'], [28, 'F']]), TEST_STATS, BROLUSCONI, lcg());
    w.player.invulnerable = Infinity;
    const scout = w.enemies[0];
    run(w, 8, () => w.doors[0].alarmed > 0);
    expect(scout.ai?.mental).toBe('alerted');
    expect(Math.abs(scout.x - 25 * TILE)).toBeLessThan(32);
    expect(w.doors[0].path?.at(-1)).toMatchObject({ c: 2, r: 2 });
    run(w, 1.5);
    const followers = w.enemies.filter((e) => e !== scout && e.ai?.queue[0]?.type === 'followPath');
    expect(followers.length).toBeGreaterThan(0);
    expect(followers.every((e) => e.originDoor === -1 && e.exitDoor === null)).toBe(true);
  });

  it('collapses with its block, lets out burning mooks, then blows up', () => {
    const w = createWorld(level([[2, 'P'], [10, 'D'], [27, 'F']]), TEST_STATS, BROLUSCONI, lcg());
    w.player.invulnerable = Infinity;
    w.map.set(10, 1, null); // the block it stands on is gone
    const events = run(w, 4, (_, ev) => ev.some((e) => e.type === 'doorBlast'));
    const types = events.map((e) => e.type);
    expect(types).toContain('doorCollapse');
    expect(types).toContain('flame');
    expect(types).toContain('doorBlast');
    expect(w.doors[0].wrecked).toBe(true);
    expect(w.doors[0].spawning).toBe(false);
    // DestroyDoor's two large shader explosions shake the screen, one of them after a delay
    expect(w.effects.filter((e) => e.kind === 'shake').length).toBeGreaterThanOrEqual(2);
    // the burning mooks die when the fire goes out (Mook.StopBurning), half a second after they caught fire
    const burnt = w.enemies.filter((e) => e.burnDamage > 0);
    expect(burnt.length).toBeGreaterThan(0);
    run(w, 0.6);
    expect(burnt.every((e) => e.dead)).toBe(true);
  });
});
