import { describe, expect, it } from 'vitest';
import { attract, blind, canSeePlayer, hearSound, panic, playerDied, thinkMook, type AiOutput } from './ai';
import { FIXED_DT, SUICIDE_SPEED_ALERTED } from './constants';
import { TileMap, getColumn, makeBlock } from './map';
import { stepUnit } from './physics';
import { TEST_STATS } from './testStats';
import { makeUnit, runFiring } from './units';
import type { EnemyKind, Unit } from './types';

function scene(kind: EnemyKind = 'mook', broX = 120) {
  const map = new TileMap(40, 10);
  for (let c = 0; c < 40; c++) map.set(c, 0, makeBlock('dirt', TEST_STATS));
  const mook = makeUnit(2, kind, 'enemy', 200, 8, TEST_STATS.units[kind]); // faces left (-1)
  const bro = makeUnit(1, 'bro', 'player', broX, 8, TEST_STATS.units.bro);
  return { map, mook, bro };
}

interface Trace {
  shots: number[];
  alertAt: number;
  explodedAt: number;
  cols: number[];
  maxSpeed: number;
}

/** Runs one mook's AI, movement and trigger for some seconds, like stepEnemies does. */
function run(m: Unit, map: TileMap, player: Unit | null, seconds: number, rng: () => number = () => 0.5): Trace {
  const trace: Trace = { shots: [], alertAt: -1, explodedAt: -1, cols: [], maxSpeed: 0 };
  let time = 0;
  for (let i = 0; i < seconds * 60; i++) {
    time += FIXED_DT;
    const out: AiOutput = thinkMook(m, { map, player, rng, stats: TEST_STATS.ai[m.kind as EnemyKind] }, FIXED_DT);
    stepUnit(m, out.intent, map, FIXED_DT, time);
    if (runFiring(m, out.fire, FIXED_DT)) trace.shots.push(time);
    if (m.ai?.bubble === '!' && trace.alertAt < 0) trace.alertAt = time;
    trace.cols.push(getColumn(m.x));
    trace.maxSpeed = Math.max(trace.maxSpeed, Math.abs(m.xI));
    if (out.explode) {
      trace.explodedAt = time;
      break;
    }
  }
  return trace;
}

describe('canSeePlayer (HeroController.CanSeePlayer)', () => {
  const look = (m: Unit, p: Unit, map: TileMap, dir: -1 | 0 | 1 = -1, rangeY = 20) =>
    canSeePlayer(m.x, m.y, dir, 300, rangeY, p, map);

  it('sees a player in range, on the side it looks to, with a clear line', () => {
    const { map, mook, bro } = scene();
    expect(look(mook, bro, map)).toBe(true);
  });

  it('is blocked by a wall', () => {
    const { map, mook, bro } = scene();
    map.set(10, 1, makeBlock('dirt', TEST_STATS));
    expect(look(mook, bro, map)).toBe(false);
  });

  it('looks from 10 above its feet: 20 of range reaches 30 up but only 10 down', () => {
    const { map, mook, bro } = scene();
    bro.y = 8 + 29;
    expect(look(mook, bro, map)).toBe(true);
    bro.y = 8 + 31;
    expect(look(mook, bro, map)).toBe(false);
    bro.y = 8 - 11;
    expect(look(mook, bro, map)).toBe(false);
    bro.y = 8 + 40;
    expect(look(mook, bro, map, -1, 64)).toBe(true); // MookBazookaAi.sightRangeY = 64
  });

  it("doesn't see behind its back or beyond 300, unless it looks both ways", () => {
    const { map, mook, bro } = scene();
    expect(look(mook, bro, map, 1)).toBe(false);
    expect(look(mook, bro, map, 0)).toBe(true);
    bro.x = 200 - 296;
    expect(look(mook, bro, map)).toBe(false);
  });
});

describe('thinkMook (PolymorphicAI)', () => {
  it('an idle mook patrols the cells within patrolBlocksRadius, and no further', () => {
    const { map, mook } = scene();
    const trace = run(mook, map, null, 12, () => 0.9); // x = 200 is column 13
    expect(Math.min(...trace.cols)).toBe(13 - 2);
    expect(Math.max(...trace.cols)).toBe(13 + 2);
  });

  it("patrols stop where there's no floor", () => {
    const { map, mook } = scene();
    map.set(14, 0, null);
    const trace = run(mook, map, null, 12, () => 0.9);
    expect(Math.max(...trace.cols)).toBe(13);
  });

  it('a trooper greets with "!", waits 0.2 + sightDelay, then fires one shot per Fire action', () => {
    const { map, mook, bro } = scene();
    const trace = run(mook, map, bro, 9);
    const ai = TEST_STATS.ai.mook;
    expect(trace.alertAt).toBeGreaterThan(0);
    expect(trace.shots[0] - trace.alertAt).toBeGreaterThanOrEqual(ai.sightDelay);
    expect(trace.shots[1] - trace.shots[0]).toBeGreaterThan(ai.delayBetweenFiring); // attackTime 0.06 < fireRate 0.17
  });

  it('a mook never shoots while idle', () => {
    const { map, mook, bro } = scene();
    mook.facing = 1; // looking away
    expect(run(mook, map, bro, 5).shots).toEqual([]);
  });

  it('a noise makes an idle mook turn to it with a "?", and then it spots the player', () => {
    const { map, mook, bro } = scene();
    mook.facing = 1;
    hearSound(mook, TEST_STATS.ai.mook, () => 0.5, bro.x, bro.y);
    expect(mook.ai?.mental).toBe('suspicious');
    const trace = run(mook, map, bro, 2);
    expect(mook.facing).toBe(-1);
    expect(trace.alertAt).toBeGreaterThan(0);
  });

  it('when the player dies an alerted mook laughs and goes back to idle', () => {
    const { map, mook, bro } = scene();
    run(mook, map, bro, 3);
    expect(mook.ai?.mental).toBe('alerted');
    bro.dead = true;
    playerDied(mook, () => 0.5);
    expect(mook.ai?.mental).toBe('idle');
    expect(mook.ai?.queue.map((a) => a.type)).toContain('laugh');
  });

  it('a suicide mook charges at 140 and blows up within 24 of the player', () => {
    const { map, mook, bro } = scene('mook_suicide');
    const trace = run(mook, map, bro, 6);
    expect(trace.explodedAt).toBeGreaterThan(0);
    expect(trace.maxSpeed).toBeCloseTo(SUICIDE_SPEED_ALERTED, 0);
    expect(Math.abs(mook.x - bro.x)).toBeLessThan(24);
  });

  it('a lit suicide mook stuck against a step burns its 4 s fuse 3.5x faster', () => {
    const { map, mook, bro } = scene('mook_suicide');
    map.set(9, 1, makeBlock('steel', TEST_STATS)); // a step it can't climb, short enough to see over
    bro.y = 8 + 20;
    const trace = run(mook, map, bro, 8);
    expect(Math.abs(mook.x - bro.x)).toBeGreaterThan(24); // never got close
    expect(trace.explodedAt).toBeGreaterThan(0);
    expect(trace.explodedAt).toBeLessThan(4); // lit at ~1.5 s: unblocked it would go off at ~5.5 s
  });

  it('a mook in long grass hides, crouching, until the player comes within hidingLookXRange, then leaps out', () => {
    const { map, mook, bro } = scene('mook', 120);
    const grass = (x: number, y: number, range: number) => Math.abs(x - 200) < range + 2 && Math.abs(y - 16) < range + 8;
    const ctx = { map, player: bro, rng: () => 0.5, stats: TEST_STATS.ai.mook, inGrass: grass };
    let time = 0;
    const step = () => {
      time += FIXED_DT;
      const out = thinkMook(mook, ctx, FIXED_DT);
      stepUnit(mook, out.intent, map, FIXED_DT, time);
      return out;
    };
    for (let i = 0; i < 120; i++) step();
    expect(mook.ai?.mental).toBe('hiding');
    expect(mook.ducking).toBe(true);
    bro.x = 200 - 40; // inside 50
    let jumped = false;
    for (let i = 0; i < 60; i++) jumped ||= step().intent.jumpPressed;
    expect(mook.ai?.mental).toBe('alerted');
    expect(jumped).toBe(true);
  });

  it('panic: runs along its walk direction while blindTime lasts, then calms down', () => {
    const { map, mook } = scene();
    mook.ai!.walkDir = -1;
    panic(mook, 0.9, false);
    expect(mook.ai?.mental).toBe('panicking');
    const startX = mook.x;
    const trace = run(mook, map, null, 0.8);
    expect(mook.x).toBeLessThan(startX - 16);
    expect(trace.shots).toEqual([]);
    run(mook, map, null, 0.5);
    expect(mook.ai?.mental).toBe('idle');
    expect(mook.blindTime).toBe(0);
  });

  it('blinded: forgets the player, staggers, then goes idle when blindTime runs out', () => {
    const { map, mook, bro } = scene();
    blind(mook, 1, () => 0.5);
    expect(mook.ai?.mental).toBe('alerted');
    expect(mook.ai?.seenPlayer).toBe(false);
    expect(mook.ai?.queue.map((a) => a.type)).toEqual(['wait']);
    run(mook, map, bro, 0.95);
    expect(mook.blindTime).toBeGreaterThan(0);
    run(mook, map, null, 0.2);
    expect(mook.blindTime).toBe(0);
    expect(mook.ai?.mental).toBe('idle'); // StopBeingBlind: BecomeIdle
  });

  it('attracted: wanders towards the point with a "?" and goes idle', () => {
    const { map, mook } = scene();
    attract(mook, 120, 8, () => 0.5);
    expect(mook.ai?.mental).toBe('attracted');
    const startX = mook.x;
    run(mook, map, null, 3);
    expect(mook.x).toBeLessThan(startX);
    expect(mook.ai?.mental).toBe('idle');
  });

  it('an idle mook off screen does not think (PolymorphicAI.Update)', () => {
    const { map, mook, bro } = scene();
    const ctx = { map, player: bro, rng: () => 0.5, stats: TEST_STATS.ai.mook, visible: false };
    for (let i = 0; i < 120; i++) thinkMook(mook, ctx, FIXED_DT);
    expect(mook.ai?.queue).toEqual([]);
    expect(mook.ai?.mental).toBe('idle');
  });
});

