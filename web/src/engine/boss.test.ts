import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import type { BroDef } from './bro';
import { screenMaxY } from './camera';
import { BOSS, FIXED_DT } from './constants';
import { bossBar } from './boss';
import { judoTarget } from './judo';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const PILOT: BroDef = { ...BROLUSCONI, id: 'pilot' };
const COLS = 40;

/** A flat arena: the bro at column 2, Epstein at 20, the flag at 36 (rows top to bottom). */
function arena(entities: Array<[number, string]> = [[2, 'P'], [20, 'E'], [36, 'F']]): LevelData {
  const row = (fill: string, at: Array<[number, string]> = []) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of at) a[c] = ch;
    return a.join('');
  };
  const empty = row('.');
  return { cols: COLS, rows: 10, tiles: [empty, empty, empty, empty, empty, empty, empty, row('.', entities), row('d'), row('s')] };
}

function play(w: World, controls: Partial<Controls>, frames: number): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}

const steps = (seconds: number) => Math.round(seconds / FIXED_DT);
const bossShots = (w: World) => w.events.filter((e) => e.type === 'shot' && e.weapon === 'bullet').length;
const guards = (w: World) => w.enemies.filter((e) => e.kind !== 'boss');

/** A world with the bro shielded (he must outlive the bullets) and Epstein woken by standing near him. */
function awake(rng = () => 0.5): World {
  const w = createWorld(arena(), TEST_STATS, [PILOT], rng);
  w.player.invulnerable = 1e9;
  w.player.x = w.boss!.x - 100;
  play(w, {}, 1);
  return w;
}

describe('Jeffrey Epstein, the boss', () => {
  it("is the level's 'E', once", () => {
    expect(parseLevel(arena(), TEST_STATS).boss).toEqual({ c: 20, r: 2 });
    expect(() => parseLevel(arena([[2, 'P'], [20, 'E'], [25, 'E'], [36, 'F']]), TEST_STATS)).toThrow('more than one E');
  });

  it('stands among the enemies with his own health and no mook mind', () => {
    const w = createWorld(arena(), TEST_STATS, [PILOT], () => 0.5);
    expect(w.boss).toMatchObject({ kind: 'boss', team: 'enemy', health: BOSS.health, ai: null });
    expect(w.enemies).toContain(w.boss);
  });

  it('waits until the bro comes near, then wakes with his line', () => {
    const w = createWorld(arena(), TEST_STATS, [PILOT], () => 0.5);
    w.player.invulnerable = 1e9;
    play(w, {}, steps(3));
    expect(w.boss!.boss!.awake).toBe(false);
    expect(bossShots(w)).toBe(0);
    w.player.x = w.boss!.x - 100;
    play(w, {}, 1);
    expect(w.boss!.boss!.awake).toBe(true);
    expect(w.events).toContainEqual({ type: 'voice', text: BOSS.line, lang: 'en-US' });
  });

  it('fires bursts of three bullets at the bro, the first 0.8 s after waking, then every 1.6 s', () => {
    const w = awake();
    expect(w.boss!.facing).toBe(-1);
    play(w, {}, steps(0.5));
    expect(bossShots(w)).toBe(0);
    play(w, {}, steps(0.7)); // 1.2 s
    expect(bossShots(w)).toBe(3);
    const b = w.projectiles.find((p) => p.team === 'enemy' && p.kind === 'bullet');
    expect(b!.xI).toBeLessThan(0);
    play(w, {}, steps(1.5)); // 2.7 s
    expect(bossShots(w)).toBe(6);
  });

  it('calls three guards in from above the screen every 8 s, never more than six alive', () => {
    const w = awake();
    play(w, {}, steps(8.3));
    expect(guards(w)).toHaveLength(0); // still calling
    play(w, {}, steps(0.3));
    expect(guards(w)).toHaveLength(3);
    expect(guards(w).every((g) => g.kind === 'mook' && g.y > screenMaxY(w.camera) - 64)).toBe(true);
    play(w, {}, steps(16));
    expect(guards(w)).toHaveLength(BOSS.maxGuards);
  });

  it('under half health he fires every second, calls every 5 s and sends suicide mooks too', () => {
    const w = awake(() => 0.1);
    damageUnit(w.boss!, BOSS.health / 2 + 1);
    play(w, {}, steps(5.7));
    expect(w.boss!.boss!.enraged).toBe(true);
    expect(guards(w).some((g) => g.kind === 'mook_suicide')).toBe(true);
    const before = bossShots(w);
    play(w, {}, steps(2));
    expect(bossShots(w) - before).toBe(6);
  });

  it('keeps his distance: comes closer when the bro is far, backs off when he is close', () => {
    const w = awake();
    w.player.x = w.boss!.x - 200;
    const x0 = w.boss!.x;
    play(w, {}, steps(0.5));
    expect(w.boss!.x).toBeLessThan(x0);
    w.player.x = w.boss!.x - 24;
    const x1 = w.boss!.x;
    play(w, {}, steps(0.5));
    expect(w.boss!.x).toBeGreaterThan(x1);
  });

  it("the HUD's bar shows his health only while he fights", () => {
    const w = createWorld(arena(), TEST_STATS, [PILOT], () => 0.5);
    expect(bossBar(w)).toBeNull(); // asleep
    w.player.invulnerable = 1e9;
    w.player.x = w.boss!.x - 100;
    play(w, {}, 1);
    expect(bossBar(w)).toBe(1);
    damageUnit(w.boss!, BOSS.health / 4);
    expect(bossBar(w)).toBe(0.75);
    damageUnit(w.boss!, BOSS.health);
    expect(bossBar(w)).toBeNull();
    expect(bossBar(createWorld(arena([[2, 'P'], [36, 'F']]), TEST_STATS, [PILOT], () => 0.5))).toBeNull(); // no boss
  });

  it('his gun flashes with each shot', () => {
    const w = awake();
    play(w, {}, steps(0.9));
    expect(w.boss!.gunFrame).toBeGreaterThan(0);
  });

  it("can't be grabbed by Putin's judo", () => {
    const w = awake();
    w.player.x = w.boss!.x - 10;
    w.player.facing = 1;
    expect(judoTarget(w.enemies, w.player)).toBeNull();
  });

  it('blows up when his health runs out, sparing the bro beside him, and only then the flag ends the level', () => {
    const w = awake();
    w.player.x = w.flag.x;
    play(w, {}, 2);
    expect(w.state).toBe('playing'); // the flag is locked while he lives
    w.player.x = w.boss!.x - 20;
    w.player.invulnerable = 0;
    damageUnit(w.boss!, BOSS.health);
    play(w, {}, 2);
    expect(w.boss!.gibbed).toBe(true);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'explosion' }));
    expect(w.player.dead).toBe(false);
    w.player.x = w.flag.x;
    play(w, {}, 2);
    expect(w.state).toBe('extracting');
  });
});
