import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { fullyAlert } from './ai';
import { unitFrame } from '../render/animation';
import { DOG, FIXED_DT, SHIELD } from './constants';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls, type EnemyKind, type Projectile, type Unit } from './types';
import { damageUnit, knock, makeUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 30;

/** A flat strip: the bro at column 2 and one enemy (rows top to bottom). */
function strip(enemy: string, c = 12): LevelData {
  const row = (fill: string, at: Array<[number, string]> = []) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [col, ch] of at) a[col] = ch;
    return a.join('');
  };
  const empty = row('.');
  return { cols: COLS, rows: 8, tiles: [empty, empty, empty, empty, empty, row('.', [[2, 'P'], [c, enemy], [27, 'F']]), row('d'), row('s')] };
}

function play(w: World, controls: Partial<Controls>, frames: number): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}

const steps = (seconds: number) => Math.round(seconds / FIXED_DT);
const shot = (kind: Projectile['kind'], team: Projectile['team'], x: number, y: number, xI: number): Projectile =>
  ({ id: 1e6 + Math.round(x), kind, team, x, y, xI, yI: 0, life: 1, bounces: 0, dead: false });

/** A world with its one enemy alerted to the bro. */
function alerted(enemy: string, kind: EnemyKind, c = 12): { w: World; m: Unit } {
  const w = createWorld(strip(enemy, c), TEST_STATS, [BROLUSCONI], () => 0.5);
  const m = w.enemies[0];
  fullyAlert(m, TEST_STATS.ai[kind], w.player.x, w.player.y, () => 0.5);
  return { w, m };
}

describe('the new enemies in the levels', () => {
  it("reads the riot shield mook ('h'), the grenadier ('n') and the dog ('q')", () => {
    const lvl = parseLevel({ cols: 6, rows: 2, tiles: ['Phnq.F', 'dddddd'] }, TEST_STATS);
    expect(lvl.enemies.map((e) => e.kind)).toEqual(['mook_shield', 'mook_grenadier', 'dog']);
  });
});

describe('the Bruiser (MookBigGuy, BigGuyAI)', () => {
  it("reads the Bruiser ('B'), tough with his 25 health", () => {
    expect(parseLevel({ cols: 4, rows: 2, tiles: ['PB.F', 'dddd'] }, TEST_STATS).enemies.map((e) => e.kind)).toEqual(['mook_bruiser']);
    expect(createWorld(strip('B'), TEST_STATS, [BROLUSCONI], () => 0.5).enemies[0].health).toBe(25);
  });

  it('alerted, he sprays the bro with a burst of minigun bullets, one every 0.07 s for his 1.2 s of firing', () => {
    const { w, m } = alerted('B', 'mook_bruiser', 9);
    w.player.invulnerable = 999;
    const seen = new Set<number>();
    for (let i = 0; i < steps(4); i++) {
      play(w, {}, 1);
      for (const p of w.projectiles) if (p.kind === 'minigun') seen.add(p.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(15);
    expect(m.gunFrame).toBeGreaterThanOrEqual(0);
  });

  it('he barely budges when hit: a twentieth of the push, his blast capped at 10, a fifth of the lift (MookBigGuy.Knock)', () => {
    const m = makeUnit(2, 'mook_bruiser', 'enemy', 100, 8, TEST_STATS.units.mook_bruiser);
    knock(m, 220, 160);
    expect([m.xI, m.xIBlast, m.yI]).toEqual([11, 10, 32]);
  });

  it('a hit at half health or worse, or of 10 or more, makes him stumble and hold his fire 0.15 s (MookBigGuy.Damage)', () => {
    const m = makeUnit(2, 'mook_bruiser', 'enemy', 100, 8, TEST_STATS.units.mook_bruiser);
    damageUnit(m, 3);
    expect(m.fireDelay).toBe(0);
    damageUnit(m, 10);
    expect(m.fireDelay).toBeCloseTo(0.15);
    m.fireDelay = 0;
    damageUnit(m, 1); // 11 left: under half his 25
    expect(m.fireDelay).toBeCloseTo(0.15);
  });
});

describe('the jetpack mooks (MookJetpack, MookJetpackBazooka)', () => {
  it("reads the jetpack mook ('j') and the jetpack bazooka mook ('J')", () => {
    expect(parseLevel({ cols: 5, rows: 2, tiles: ['PjJ.F', 'ddddd'] }, TEST_STATS).enemies.map((e) => e.kind)).toEqual(['mook_jetpack', 'mook_jetpack_bazooka']);
  });

  it('alerted, it lights its jetpack after 0.55 s and flies up to hover 48 above the ground', () => {
    const { w, m } = alerted('j', 'mook_jetpack');
    w.player.invulnerable = 999;
    play(w, {}, steps(0.5));
    expect(m.jet?.on).toBe(false);
    play(w, {}, steps(3));
    expect(m.jet?.on).toBe(true);
    expect(m.y).toBeGreaterThan(24 + 36);
    expect(m.y).toBeLessThan(24 + 60);
  });

  it('flying, the trooper fires bullets and the bazooka mook rockets', () => {
    for (const [ch, kind, shot] of [['j', 'mook_jetpack', 'bullet'], ['J', 'mook_jetpack_bazooka', 'rocket']] as const) {
      const { w } = alerted(ch, kind, 9);
      w.player.invulnerable = 999;
      const kinds = new Set<string>();
      for (let i = 0; i < steps(6); i++) {
        play(w, {}, 1);
        for (const p of w.projectiles) kinds.add(p.kind);
      }
      expect(kinds.has(shot)).toBe(true);
    }
  });

  it('a hit wrecks its jetpack: after a moment it crashes and blows up', () => {
    const { w, m } = alerted('j', 'mook_jetpack');
    w.player.invulnerable = 999;
    play(w, {}, steps(3));
    expect(m.jet?.on).toBe(true);
    damageUnit(m, 1);
    expect(m.jet?.on).toBe(false);
    let blew = false;
    for (let i = 0; i < steps(5) && !blew; i++) {
      play(w, {}, 1);
      blew = w.events.some((e) => e.type === 'explosion' && e.source === 'suicide');
    }
    expect(blew).toBe(true);
    expect(m.gibbed).toBe(true);
    expect(w.enemies).not.toContain(m); // blown to pieces: gone
  });

  it('killed, it blows up a moment after it comes down', () => {
    const w = createWorld(strip('j'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    damageUnit(m, m.health);
    play(w, {}, steps(1));
    expect(m.gibbed).toBe(false);
    play(w, {}, steps(1.5));
    expect(m.gibbed).toBe(true);
    expect(w.events.some((e) => e.type === 'explosion' && e.source === 'suicide')).toBe(true);
  });
});

describe('the ninja (MookNinja, MookNinjaAI)', () => {
  it("reads the ninja ('N') and starts him crouched in hiding, looking either way", () => {
    expect(parseLevel({ cols: 4, rows: 2, tiles: ['PN.F', 'dddd'] }, TEST_STATS).enemies.map((e) => e.kind)).toEqual(['mook_ninja']);
    const w = createWorld(strip('N'), TEST_STATS, [BROLUSCONI], () => 0.5);
    expect(w.enemies[0].ai?.mental).toBe('hiding');
  });

  it('ignores the bro in plain sight until he comes within 48, then jumps out at him', () => {
    const w = createWorld(strip('N', 9), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    play(w, {}, steps(2));
    expect(m.ai?.mental).toBe('hiding');
    expect(m.ducking).toBe(true);
    w.player.x = m.x - 40;
    let rose = false;
    for (let i = 0; i < steps(1) && !rose; i++) {
      play(w, {}, 1);
      rose = m.yI > 0;
    }
    expect(m.ai?.mental).toBe('alerted');
    expect(rose).toBe(true);
    expect(m.facing).toBe(-1);
  });

  it('a hit gives him away', () => {
    const w = createWorld(strip('N'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    damageUnit(m, 1);
    play(w, {}, 2);
    expect(m.ai?.mental).toBe('alerted');
  });

  it('crouches on row 6 while hidden and flips through row 2, columns 21-30, as he leaps (MookNinja.Animate*)', () => {
    const w = createWorld(strip('N'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    play(w, {}, steps(0.5));
    expect(unitFrame(m)).toEqual({ col: 5, row: 6 });
    Object.assign(m, { onGround: false, yI: 100, animTime: 0.06 });
    m.ai!.mental = 'alerted';
    m.ducking = false;
    expect(unitFrame(m)).toEqual({ col: 23, row: 2 });
  });
});

describe('the alarmist (MookGeneral "ZMook Alarmist", DeadManSwitchAlarmTrap)', () => {
  it("reads the alarmist ('A'): he carries no gun", () => {
    expect(parseLevel({ cols: 4, rows: 2, tiles: ['PA.F', 'dddd'] }, TEST_STATS).enemies.map((e) => e.kind)).toEqual(['mook_alarmist']);
    const { w } = alerted('A', 'mook_alarmist', 9);
    play(w, {}, steps(4));
    expect(w.projectiles).toHaveLength(0);
  });

  it('killed, his dead man\'s switch sets off an alarm 0.25 s later, flashing red till then', () => {
    const w = createWorld(strip('A'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    damageUnit(m, m.health);
    play(w, {}, steps(0.2));
    expect(w.alarms).toHaveLength(0);
    expect(w.events.some((e) => e.type === 'alarmWarning')).toBe(true);
    play(w, {}, steps(0.1));
    expect(w.alarms).toHaveLength(1);
    expect(w.events.some((e) => e.type === 'siren')).toBe(true);
  });

  it("the siren brings the mooks around running, and every 9 s (the first after 3) four paratroopers drop in, three waves at most", () => {
    const lvl = strip('A', 12);
    lvl.tiles[5] = lvl.tiles[5].slice(0, 20) + 'm' + lvl.tiles[5].slice(21);
    const w = createWorld(lvl, TEST_STATS, [BROLUSCONI], () => 0.5);
    w.player.invulnerable = 1e9;
    const [a, m] = w.enemies;
    damageUnit(a, a.health);
    play(w, {}, steps(0.4));
    expect(m.ai?.mental).toBe('alerted');
    const count = () => w.enemies.filter((e) => e.kind === 'mook' && !e.dead).length;
    play(w, {}, steps(2.5));
    expect(count()).toBe(1);
    play(w, {}, steps(1));
    expect(count()).toBe(5);
    expect(w.enemies.filter((e) => e.kind === 'mook').slice(1).every((e) => e.ai?.mental === 'alerted')).toBe(true);
    play(w, {}, steps(40));
    expect(w.enemies.filter((e) => e.kind === 'mook').length).toBeLessThanOrEqual(13);
  });
});

describe("the riot shield mook (MookRiotShield)", () => {
  it('his shield stops shots at his face; shots in his back hurt him', () => {
    const w = createWorld(strip('h'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    m.facing = -1; // facing the bro, to his left
    w.projectiles.push(shot('bullet', 'player', m.x - 8, m.y + 8, 300)); // flying right, from the bro into his face
    play(w, {}, 1);
    expect(m.health).toBe(TEST_STATS.units.mook_shield.health);
    expect(m.shield).toBe(SHIELD.points - TEST_STATS.bullet.damage);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'shieldHit' }));
    w.projectiles.push(shot('bullet', 'player', m.x + 8, m.y + 8, -300)); // flying left, into his back
    play(w, {}, 1);
    expect(m.health).toBe(TEST_STATS.units.mook_shield.health - TEST_STATS.bullet.damage);
  });

  it('enough shots knock his shield away, and after that they hurt him', () => {
    const w = createWorld(strip('h'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    m.facing = -1;
    m.shield = 1;
    w.projectiles.push(shot('bullet', 'player', m.x - 8, m.y + 8, 300));
    play(w, {}, 1);
    expect(m.shield).toBe(0);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'shieldOff' }));
    w.projectiles.push(shot('bullet', 'player', m.x - 8, m.y + 8, 300));
    play(w, {}, 1);
    expect(m.health).toBeLessThan(TEST_STATS.units.mook_shield.health);
  });

  it('an explosion knocks his shield away at once', () => {
    const w = createWorld(strip('h'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    w.projectiles.push({ ...shot('bomb', 'player', m.x, m.y + 8, 0), yI: -1 }); // inside him: it goes off at once
    play(w, {}, 2);
    expect(m.shield).toBe(0);
  });

  it('he never shoots', () => {
    const { w } = alerted('h', 'mook_shield', 8);
    w.player.invulnerable = 1e9;
    play(w, {}, steps(6));
    expect(w.events.some((e) => e.type === 'shot')).toBe(false);
  });
});

describe('the grenadier (MookGrenadier)', () => {
  it('is tough: the prefab gives him 15 health', () => {
    expect(TEST_STATS.units.mook_grenadier.health).toBe(15);
  });

  it('alerted, he lobs a grenade at the bro; it bounces and goes off when its fuse burns down', () => {
    const { w, m } = alerted('n', 'mook_grenadier');
    w.player.invulnerable = 1e9;
    let grenade: Projectile | undefined;
    for (let i = 0; i < steps(4) && !grenade; i++) {
      play(w, {}, 1);
      grenade = w.projectiles.find((p) => p.kind === 'grenade');
    }
    expect(grenade).toMatchObject({ team: 'enemy' });
    expect(Math.sign(grenade!.xI)).toBe(Math.sign(w.player.x - m.x));
    expect(grenade!.yI).toBeGreaterThan(0);
    const before = w.events.filter((e) => e.type === 'explosion').length;
    play(w, {}, steps(3));
    expect(grenade!.dead).toBe(true);
    expect(w.events.filter((e) => e.type === 'explosion').length).toBeGreaterThan(before);
  });

  it('dying, he drops a grenade (MookGrenadier.DropDeathGrenade)', () => {
    const w = createWorld(strip('n'), TEST_STATS, [BROLUSCONI], () => 0.5);
    damageUnit(w.enemies[0], 15);
    play(w, {}, 1);
    expect(w.projectiles.filter((p) => p.kind === 'grenade')).toHaveLength(1);
  });
});

describe('the dog (MookDog)', () => {
  it('alerted, it runs at the bro faster than a mook and bites him', () => {
    const { w, m } = alerted('q', 'dog', 9);
    play(w, {}, steps(0.6)); // its alert reaction, then off it goes
    const x0 = m.x;
    play(w, {}, steps(0.4));
    expect(x0 - m.x).toBeGreaterThan(TEST_STATS.units.mook.speed * 0.4 * 1.3); // well faster than a walking mook
    play(w, {}, steps(3));
    expect(w.player.dead).toBe(true);
    expect(w.events).toContainEqual(expect.objectContaining({ type: 'bite' }));
  });

  it('one shot kills it', () => {
    const w = createWorld(strip('q'), TEST_STATS, [BROLUSCONI], () => 0.5);
    const m = w.enemies[0];
    w.projectiles.push(shot('bullet', 'player', m.x + 8, m.y + 8, -300));
    play(w, {}, 1);
    expect(m.dead).toBe(true);
    expect(DOG.bite).toBe(3);
  });
});
