import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

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
const blastAt = (id: number, x: number, y: number, kind: 'bomb' | 'rocket' = 'bomb', team: 'player' | 'enemy' = 'player') =>
  ({ id, kind, team, x, y, xI: 0, yI: 0, life: 0.001, bounces: 0, dead: false });
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
    expect(w.events).toContainEqual({ type: 'rescue', x: 64, y: 24 });
  });

  it('reaching the flag starts the extraction, which wins the level', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = w.flag.x - 4;
    play(w, {}, 1);
    expect(w.state).toBe('extracting');
    play(w, {}, 186);
    expect(w.state).toBe('won');
  });

  it('dying respawns at the start after 1.8 s for a life; with none left the game is lost', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = 200;
    damageUnit(w.player, 1);
    play(w, {}, 100);
    expect(w.player.dead).toBe(true); // HeroController.broRespawnDelay = 1.8
    play(w, {}, 10);
    expect(w.player.dead).toBe(false);
    expect(w.player.x).toBe(w.spawn.x);
    expect(w.lives).toBe(2);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'death', x: 200, y: 24 }));
    w.lives = 0;
    play(w, {}, 30);
    damageUnit(w.player, 1);
    play(w, {}, 120);
    expect(w.state).toBe('lost');
  });

  it('a respawned bro is invulnerable for 0.5 s (Player.SpawnHero)', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    damageUnit(w.player, 1);
    play(w, {}, 109);
    expect(w.player.invulnerable).toBeGreaterThan(0.4);
    expect(damageUnit(w.player, 1)).toBe(false);
    play(w, {}, 30);
    expect(w.player.invulnerable).toBe(0);
    expect(damageUnit(w.player, 1)).toBe(true);
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

  it('reaching a checkpoint raises its flag and moves the respawn there (Map.CheckCheckPoint)', () => {
    const w = createWorld(level([[0, 'P'], [10, 'C'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    expect(w.checkpoints).toEqual([{ x: 160, y: 24, activated: false, raisedAt: 0 }]);
    play(w, { right: true }, 100);
    expect(w.checkpoints[0].activated).toBe(true);
    expect(w.spawn).toEqual({ x: 160, y: 24 + 16 });
    expect(w.events).toContainEqual({ type: 'checkpoint', x: 160, y: 24 });
    damageUnit(w.player, 1);
    play(w, {}, 120);
    expect(w.player.dead).toBe(false);
    expect(w.player.x).toBe(160);
  });

  it('walking into a mook alerts it (Map.AlertNearbyMooks)', () => {
    const w = createWorld(level([[2, 'P'], [3, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    w.enemies[0].facing = 1; // its back to the bro
    play(w, {}, 1);
    expect(w.enemies[0].ai?.mental).toBe('idle'); // 16 apart: just out of reach
    w.player.x = 40;
    play(w, {}, 1);
    expect(w.enemies[0].ai?.mental).toBe('alerted');
  });

  it('an explosion makes mooks in earshot turn to look (Rocket.MakeEffects: DisturbWildLife 80)', () => {
    const w = createWorld(level([[0, 'P'], [12, 'm'], [25, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    for (const m of w.enemies) m.facing = 1;
    w.projectiles.push(blastAt(999, 120, 30, 'rocket', 'enemy'));
    play(w, {}, 2);
    expect(w.enemies[0].ai?.mental).toBe('suspicious'); // 72 away: within 80 + its hearing 50
    expect(w.enemies[1].ai?.mental).toBe('idle'); // 280 away
  });

  it('mooks only shoot while on screen', () => {
    const w = createWorld(level([[0, 'P'], [40, 'm'], [57, 'F']], 60), TEST_STATS, BROLUSCONI, () => 0.5);
    const m = w.enemies[0]; // x = 640, the camera starts at x = 192
    const fire = () => {
      m.ai!.mental = 'alerted';
      m.ai!.queue = [{ type: 'fire', duration: 1, c: 0, r: 0 }];
      m.wasFire = false;
    };
    fire();
    play(w, {}, 3);
    expect(w.projectiles.filter((p) => p.kind === 'bullet')).toHaveLength(0);
    w.player.x = m.x - 100;
    w.camera.x = m.x - 100;
    fire();
    play(w, {}, 3);
    expect(w.projectiles.filter((p) => p.kind === 'bullet')).toHaveLength(1);
  });

  it('a killed suicide mook goes off 0.7 s later (MookSuicide.Damage)', () => {
    const w = createWorld(level([[0, 'P'], [20, 'k'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    damageUnit(w.enemies[0], 10);
    play(w, {}, 40);
    expect(w.events.filter((e) => e.type === 'explosion')).toHaveLength(0);
    play(w, {}, 5);
    expect(w.events).toContainEqual({ type: 'explosion', x: 320, y: 24, big: true, source: 'suicide', range: 40 });
    expect(w.enemies).toHaveLength(0); // gibbed by its own blast
  });

  it('a corpse caught in a second blast is gibbed', () => {
    const w = createWorld(level([[0, 'P'], [20, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const m = w.enemies[0];
    damageUnit(m, 3);
    play(w, {}, 1);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'kill', x: m.x, y: m.y, kind: 'mook' }));
    for (let i = 0; i < 2; i++) {
      w.projectiles.push(blastAt(900 + i, m.x, m.y + 3)); // 10 damage each: 0 -> -10 -> -20
      play(w, {}, 1);
    }
    expect(m.gibbed).toBe(true);
    expect(w.events.some((e) => e.type === 'gib' && e.team === 'enemy')).toBe(true);
    expect(w.enemies).toHaveLength(0);
  });

  it('a suicide mook blown to pieces goes off at once (MookSuicide.Gib)', () => {
    const w = createWorld(level([[0, 'P'], [20, 'k'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const m = w.enemies[0];
    m.health = -5; // a corpse already, one blast from gibbing
    m.dead = true;
    w.projectiles.push(blastAt(900, m.x, m.y + 3));
    play(w, {}, 1);
    expect(w.events.filter((e) => e.type === 'explosion')).toHaveLength(2);
    expect(w.enemies).toHaveLength(0);
  });

  it('the airstrike grenade panics the mooks around it in its last half second (Grenade.RunWarnings)', () => {
    const w = createWorld(level([[0, 'P'], [10, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const m = w.enemies[0];
    w.projectiles.push({ id: 999, kind: 'marker', team: 'player', x: m.x + 10, y: m.y + 4, xI: 0, yI: 0, life: 0.4, bounces: 0, dead: false });
    play(w, {}, 2);
    expect(m.ai?.mental).toBe('panicking');
    expect(m.blindTime).toBeGreaterThan(0.8);
  });

  it('a bazooka shot kicks the mook back (xIBlast)', () => {
    const w = createWorld(level([[0, 'P'], [12, 'z'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const m = w.enemies[0];
    w.player.x = m.x - 100;
    w.camera.x = m.x;
    m.facing = -1;
    m.ai!.mental = 'alerted';
    m.ai!.queue = [{ type: 'fire', duration: 1, c: 0, r: 0 }];
    play(w, {}, 3);
    expect(w.projectiles.some((p) => p.kind === 'rocket')).toBe(true);
    expect(m.xIBlast).toBeGreaterThan(30);
  });

  it('blasts tear up long grass (Map.DamageDoodads)', () => {
    const lvl = { ...level([[0, 'P'], [27, 'F']]), grass: [{ c: 10, r: 2 }] };
    const w = createWorld(lvl, TEST_STATS, BROLUSCONI, () => 0.5);
    expect(w.grass).toHaveLength(1);
    w.projectiles.push(blastAt(900, 160, 30));
    play(w, {}, 1);
    expect(w.grass[0].health).toBe(1);
    w.projectiles.push(blastAt(901, 160, 30));
    play(w, {}, 1);
    expect(w.grass[0].destroyed).toBe(true);
  });

  it('jumping high over a checkpoint still reaches it (the ground-height probe)', () => {
    const w = createWorld(level([[0, 'P'], [10, 'C'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    w.player.x = 160;
    w.player.y = 24 + 80; // 80 over the ground: out of the feet check's 40
    w.player.yI = 200;
    play(w, {}, 1);
    expect(w.checkpoints[0].activated).toBe(true);
  });
});


describe('fire (RocketBombardment and MookSuicide)', () => {
  it('an airstrike bomb sets fire to the mooks around it; the fire goes out half a second later and hurts', () => {
    const w = createWorld(level([[2, 'P'], [15, 'm'], [17, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    w.projectiles.push(blastAt(99, 240, 24, 'bomb'));
    play(w, {}, 1);
    const [near, edge] = w.enemies;
    expect(near.dead).toBe(true);
    expect(edge.dead).toBe(false);
    expect(edge.burnDamage).toBe(1); // Map.HitUnits(..., 1, Fire, range * 1.2)
    expect(edge.ai?.mental).toBe('panicking');
    expect(edge.burnTime).toBe(1);
    play(w, {}, 32);
    expect(edge.burnTime).toBeLessThanOrEqual(0);
    expect(edge.health).toBe(2);
    expect(w.events.some((e) => e.type === 'flame')).toBe(true);
  });

  it('a suicide mook going off sends the mooks within range + 30 running, singed (BurnUnitsAround)', () => {
    const w = createWorld(level([[2, 'P'], [15, 'k'], [19, 'm'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const [suicide, other] = w.enemies;
    suicide.ai!.litFuse = true;
    suicide.ai!.suicideTimer = 0;
    play(w, {}, 1);
    expect(suicide.gibbed).toBe(true);
    expect(other.dead).toBe(false);
    expect(other.burnDamage).toBe(1);
    expect(other.ai?.mental).toBe('panicking');
  });
});

describe('the flex (TestVanDammeAnim gestures, BroBase.TriggerFlexEvent)', () => {
  // frames 0-6 at 0.0667 s, frame 7 held 0.24 s: frame 8 (the first flex event) comes 0.707 s in
  const FIRST_EVENT = 7 * 0.0667 + 0.24;

  it('plays the flex and, with the Alluring flex power, draws the mooks in range over', () => {
    // the mooks stand behind the bro, looking away from him
    const lv = { ...level([[1, 'm'], [4, 'm'], [8, 'P'], [27, 'F']]), flexPower: 'allure' as const };
    const w = createWorld(lv, TEST_STATS, BROLUSCONI, () => 0.5);
    const [far, near] = w.enemies;
    let prev = play(w, { gesture: true }, 1);
    expect(w.player.flex?.frame).toBe(0);
    prev = play(w, {}, Math.floor(FIRST_EVENT * 60) - 2, prev);
    expect(near.ai?.mental).toBe('idle');
    play(w, {}, 4, prev);
    expect(w.events.some((e) => e.type === 'flex')).toBe(true);
    expect(near.ai?.mental).toBe('attracted'); // 64 away: within Map.AttractMooks(96, 30)
    expect(far.ai?.mental).toBe('idle');
  });

  it('holds the last pose until a direction is pressed', () => {
    const w = createWorld(EMPTY, TEST_STATS, BROLUSCONI, () => 0.5);
    let prev = play(w, { gesture: true }, 1);
    prev = play(w, {}, 300, prev);
    expect(w.player.flex?.frame).toBeGreaterThan(54);
    play(w, { right: true }, 1, prev);
    expect(w.player.flex).toBeNull();
  });

  it('without a flex power it is only a flex', () => {
    const w = createWorld(level([[4, 'm'], [8, 'P'], [27, 'F']]), TEST_STATS, BROLUSCONI, () => 0.5);
    const prev = play(w, { gesture: true }, 1);
    play(w, {}, 60, prev);
    expect(w.events.some((e) => e.type === 'flex')).toBe(true);
    expect(w.enemies[0].ai?.mental).toBe('idle');
  });
});
