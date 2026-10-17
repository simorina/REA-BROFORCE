import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import type { BroDef } from './bro';
import { bossBar, bossName } from './boss';
import { FIXED_DT, MECH } from './constants';
import type { LevelData } from './level';
import { beginPattern } from './mech';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls, type Projectile } from './types';
import { createWorld, speaker, stepWorld, type GameEvent, type World } from './world';

const PILOT: BroDef = { ...BROLUSCONI, id: 'pilot' };
const COLS = 64;

/** A steel-floored hangar: the bro at column 4, the Goliath at 40, the flag at 60 (rows top to bottom). */
function hangar(entities: Array<[number, string]> = [[4, 'P'], [40, 'M'], [60, 'F']]): LevelData {
  const row = (fill: string, at: Array<[number, string]> = []) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of at) a[c] = ch;
    return a.join('');
  };
  const empty = row('.');
  return { cols: COLS, rows: 16, tiles: [...Array<string>(12).fill(empty), row('.', entities), row('s'), row('s'), row('s')] };
}

function play(w: World, controls: Partial<Controls>, frames: number): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}

const steps = (seconds: number) => Math.round(seconds / FIXED_DT);
const shots = (w: World, weapon: string) =>
  w.events.filter((e): e is Extract<GameEvent, { type: 'shot' }> => e.type === 'shot' && e.weapon === weapon);
const shot = (kind: Projectile['kind'], team: Projectile['team'], x: number, y: number): Projectile =>
  ({ id: 1e6, kind, team, x, y, xI: 0, yI: 0, life: 0.1, bounces: 0, dead: false });

/** The bro shielded, 200 px to the left of a woken Goliath. */
function awake(rng = () => 0.5): World {
  const w = createWorld(hangar(), TEST_STATS, [PILOT], rng);
  w.player.invulnerable = 1e9;
  w.player.x = w.mech!.x - 200;
  play(w, {}, 1);
  return w;
}

describe("Epstein's Goliath", () => {
  it("stands dormant with the prefab's health until the bro comes near, then wakes with his line", () => {
    const w = createWorld(hangar(), TEST_STATS, [PILOT], () => 0.5);
    expect(w.mech).toMatchObject({ health: TEST_STATS.mech.health, awake: false });
    play(w, {}, steps(2));
    expect(w.mech!.awake).toBe(false);
    w.player.x = w.mech!.x - 200;
    play(w, {}, 1);
    expect(w.mech!.awake).toBe(true);
    expect(w.events).toContainEqual({ type: 'voice', text: MECH.line, lang: 'en-US' });
  });

  it('waking, it swallows the Epstein nobody beat at his temple', () => {
    const w = createWorld(hangar([[4, 'P'], [24, 'E'], [40, 'M'], [60, 'F']]), TEST_STATS, [PILOT], () => 0.5);
    w.player.invulnerable = 1e9;
    w.player.x = w.mech!.x - 200;
    play(w, {}, 2);
    expect(w.boss!.boss!.gone).toBe(true);
    expect(w.enemies).not.toContain(w.boss);
  });

  it('bombardment: both chain guns fire at the bro for 2 s, then it pauses', () => {
    const w = awake();
    beginPattern(w, w.mech!, 'bombard');
    play(w, {}, steps(2.1));
    const fired = shots(w, 'bullet');
    expect(fired.length).toBeGreaterThanOrEqual(15);
    expect(new Set(fired.map((e) => Math.round(e.x))).size).toBe(2);
    expect(w.projectiles.some((p) => p.team === 'enemy' && p.kind === 'bullet' && p.xI < 0)).toBe(true);
    play(w, {}, steps(0.6));
    expect(shots(w, 'bullet').length).toBe(fired.length);
  });

  it('stomp: it rises, glides up to 8 columns toward the bro and slams down with a blast that kills him beside it', () => {
    const w = awake();
    w.player.invulnerable = 0;
    const m = w.mech!;
    const x0 = m.x;
    const ground = m.y;
    beginPattern(w, m, 'stomp');
    let top = ground;
    for (let i = 0; i < steps(2); i++) {
      play(w, {}, 1);
      top = Math.max(top, m.y);
    }
    expect(top).toBeGreaterThanOrEqual(ground + MECH.stomp.rise - 1);
    expect(m.x).toBeCloseTo(x0 - MECH.stomp.reach[0], -1);
    expect(m.y).toBe(ground);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'explosion' }));
    expect(w.player.dead).toBe(true);
  });

  it('missiles: a volley of four rockets fired at the bro', () => {
    const w = awake();
    beginPattern(w, w.mech!, 'missiles');
    play(w, {}, steps(1.5));
    expect(shots(w, 'rocket')).toHaveLength(MECH.missiles.count);
    expect(w.projectiles.some((p) => p.team === 'enemy' && p.kind === 'rocket' && p.xI < 0)).toBe(true);
  });

  it('under half health it opens with a stomp, and its sky rockets fall around the bro', () => {
    const w = awake();
    const m = w.mech!;
    m.health = TEST_STATS.mech.health / 2 - 1;
    m.state = 'pause';
    m.stateTime = 99;
    m.step = 0;
    play(w, {}, 1);
    expect(m.state).toBe('rise');
    beginPattern(w, m, 'sky');
    const rain = w.projectiles.filter((p) => p.team === 'enemy' && p.kind === 'bomb');
    expect(rain).toHaveLength(MECH.sky.count);
    expect(rain.every((p) => Math.abs(p.x - w.player.x) <= MECH.sky.spread / 2 && p.y > w.player.y && p.yI < 0)).toBe(true);
  });

  it("the bro's bullets and blasts hurt it anywhere in its big box; the mooks' shots don't", () => {
    const w = awake();
    const m = w.mech!;
    const full = m.health;
    w.projectiles.push(shot('rifle', 'player', m.x + 30, m.y + 40)); // far outside a unit's box
    play(w, {}, 1);
    expect(m.health).toBe(full - TEST_STATS.rifle.damage);
    w.projectiles.push(shot('bullet', 'enemy', m.x + 30, m.y + 40));
    play(w, {}, 1);
    expect(m.health).toBe(full - TEST_STATS.rifle.damage);
    w.projectiles.push(shot('bomb', 'player', m.x - 20, m.y + 30));
    play(w, {}, 1);
    expect(m.health).toBeLessThan(full - TEST_STATS.rifle.damage);
  });

  it('keeps to its arena', () => {
    const w = awake();
    const m = w.mech!;
    m.minX = m.x - 50;
    beginPattern(w, m, 'stomp');
    play(w, {}, steps(2));
    expect(m.x).toBeGreaterThanOrEqual(m.minX);
  });

  it('destroyed, it blows apart with Epstein inside, and only then the flag ends the level', () => {
    const w = awake();
    const m = w.mech!;
    w.player.x = w.flag.x;
    play(w, {}, 2);
    expect(w.state).toBe('playing');
    m.health = 1;
    w.projectiles.push(shot('rifle', 'player', m.x, m.y + 30));
    play(w, {}, steps(MECH.dying.time + 0.5));
    expect(m.destroyed).toBe(true);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'gib', kind: 'boss' }));
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'bossDown' }));
    play(w, {}, 2);
    expect(w.state).toBe('extracting');
  });

  it('its line hangs over it', () => {
    const w = awake();
    const line = w.effects.find((e) => e.kind === 'speech' && e.text === MECH.line)!;
    const at = speaker(w, line)!;
    expect(at.x).toBe(w.mech!.x);
    expect(at.y).toBeGreaterThan(w.mech!.y + MECH.box.height / 2);
  });

  it("the HUD names whichever Epstein is fighting", () => {
    const w = awake();
    expect(bossName(w)).toBe('JEFFREY EPSTEIN · GOLIATH');
    w.mech!.destroyed = true;
    expect(bossName(w)).toBeNull();
  });

  it("the HUD's bar follows its health once it's awake", () => {
    expect(bossBar(createWorld(hangar(), TEST_STATS, [PILOT], () => 0.5))).toBeNull();
    const w = awake();
    expect(bossBar(w)).toBe(1);
    w.mech!.health = TEST_STATS.mech.health * 0.75;
    expect(bossBar(w)).toBe(0.75);
  });
});
