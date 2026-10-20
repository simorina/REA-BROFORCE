import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { DOG, FIXED_DT } from './constants';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A flat floor: the bro at `bro`, a mob at `at`, the flag at 38; `cells` puts more tiles on the floor row. */
function floor(mob: string, at = 24, bro = 14, cells: Array<[number, string]> = []): LevelData {
  const row = (fill: string, put: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of put) a[c] = ch;
    return a.join('');
  };
  const e = row('.', []);
  return { cols: COLS, rows: 10, tiles: [e, e, e, e, e, e, row('.', [[bro, 'P'], [at, mob], [38, 'F'], ...cells]), row('d', []), row('d', []), row('s', [])] };
}

function play(w: World, frames: number, controls: Partial<Controls> = {}): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}
const steps = (s: number) => Math.round(s / FIXED_DT);
const world = (mob: string, at = 24, bro = 14, cells: Array<[number, string]> = []): World =>
  createWorld(floor(mob, at, bro, cells), TEST_STATS, [BROLUSCONI], () => 0.5);
const first = (w: World, kind: string) => w.enemies.find((e) => e.kind === kind)!;
const explosions = (w: World, source?: string) => w.events.filter((e) => e.type === 'explosion' && (!source || e.source === source));

describe("hell's mobs", () => {
  it('reads the hell dog (e), lost soul (l), Boomer (O), Soul Catcher (p), hell Bruisers (1, 2), undead (u, r: lying dead), undead suicide (i), skinless (y), warlock (v) and Satan (6)', () => {
    const lvl = parseLevel({ cols: 14, rows: 2, tiles: ['PelOp12uriyv6F', 'dddddddddddddd'] }, TEST_STATS);
    expect(lvl.enemies.map((e) => e.kind)).toEqual([
      'hell_dog', 'hell_lostsoul', 'hell_boomer', 'hell_soulcatcher', 'hell_bigguy', 'hell_armoured', 'undead', 'undead', 'undead_suicide',
      'skinless', 'warlock', 'satan',
    ]);
    expect(lvl.enemies.map((e) => !!e.startDead)).toEqual([false, false, false, false, false, false, false, true, false, false, false, false]);
  });

  it('a killed undead trooper gets up again with 2 health, 1-1.5 s and a 0.8 s rise later, when the bro is within 96 (UndeadTrooper.Resurrect)', () => {
    const w = world('u', 19);
    const u = first(w, 'undead');
    w.player.invulnerable = 999;
    damageUnit(u, 3);
    expect(u.dead).toBe(true);
    play(w, steps(1.2));
    expect(u.dead).toBe(true);
    play(w, steps(1.1));
    expect(u.dead).toBe(false);
    expect(u.health).toBe(2);
  });

  it('lying dead from the start (ZMookUndeadStartDead), it stays down, past the corpse time, until the bro comes near', () => {
    const w = world('r', 30, 6);
    const u = first(w, 'undead');
    w.player.invulnerable = 999;
    expect(u.dead).toBe(true);
    play(w, steps(4));
    expect(w.enemies).toContain(u);
    expect(u.dead).toBe(true);
    w.player.x = 26 * 16;
    play(w, steps(3));
    expect(u.dead).toBe(false);
  });

  it('blown to pieces, an undead stays dead', () => {
    const w = world('u', 19);
    const u = first(w, 'undead');
    w.player.invulnerable = 999;
    damageUnit(u, 40);
    expect(u.gibbed).toBe(true);
    play(w, steps(3));
    expect(w.enemies.some((e) => e.kind === 'undead' && !e.dead)).toBe(false);
  });

  it('an undead suicide mook leaps at a bro within 54 and goes off when it lands (MookSuicideUndead.PressSpecial, Land)', () => {
    const w = world('i', 22, 14);
    const m = first(w, 'undead_suicide');
    w.player.invulnerable = 999;
    let leapt = false;
    let boom = false;
    for (let i = 0; i < steps(8) && !boom; i++) {
      play(w, 1);
      leapt = leapt || (m.hell?.leap === true && m.yI > 50);
      boom = explosions(w, 'suicide').length > 0;
    }
    expect(leapt).toBe(true);
    expect(boom).toBe(true);
  });

  it("a skinless mook never shoots; it runs at the bro (140 alerted) and jumps on his back, slowing him; flexing throws it off dead", () => {
    const w = world('y', 22, 14);
    const m = first(w, 'skinless');
    w.player.invulnerable = 999;
    let fastest = 0;
    for (let i = 0; i < steps(6) && !m.hell?.back; i++) {
      play(w, 1);
      fastest = Math.max(fastest, Math.abs(m.xI));
    }
    expect(w.projectiles.filter((p) => p.team === 'enemy')).toHaveLength(0);
    expect(fastest).toBeGreaterThan(100);
    expect(m.hell?.back).toBe(true);
    expect(Math.abs(m.x - (w.player.x - w.player.facing * 5))).toBeLessThan(1);
    stepWorld(w, { ...NO_CONTROLS, gesture: true }, NO_CONTROLS, FIXED_DT);
    play(w, steps(0.2), { gesture: true });
    expect(m.dead).toBe(true);
    expect(m.hell?.back).toBe(false);
  });

  it('Satan fades in, laughs at the bro instead of shooting (eight laughs), then forgets him (Satan, SatanAI)', () => {
    const w = world('6', 22, 14);
    const s = first(w, 'satan');
    w.player.invulnerable = 999;
    let laughed = false;
    let forgot = false;
    for (let i = 0; i < steps(10) && !forgot; i++) {
      play(w, 1);
      if ((s.hell?.laugh ?? 0) > 0) laughed = true;
      else if (laughed && s.ai && !s.ai.seenPlayer) forgot = true;
    }
    expect(laughed).toBe(true);
    expect(forgot).toBe(true);
    expect(w.projectiles.filter((p) => p.team === 'enemy')).toHaveLength(0);
  });

  it('the hell Bruiser sends a flame wave along the ground at the bro every 2 s, and burns him (MookHellBigGuy.FireWeapon)', () => {
    const w = world('1', 24, 14);
    w.player.invulnerable = 0;
    w.player.health = 50;
    let wave = false;
    for (let i = 0; i < steps(5) && w.player.health === 50; i++) {
      play(w, 1);
      wave = wave || w.projectiles.some((p) => p.kind === 'flameWall' && p.team === 'enemy');
    }
    expect(wave).toBe(true);
    expect(w.player.health).toBeLessThan(50);
  });

  it('a hit over 7 stuns the hell Bruiser for 3 s', () => {
    const w = world('1', 24, 14);
    const b = first(w, 'hell_bigguy');
    w.player.invulnerable = 999;
    damageUnit(b, 8);
    expect(b.hell?.stun).toBeCloseTo(3);
    play(w, steps(2.5));
    expect(w.projectiles.some((p) => p.kind === 'flameWall')).toBe(false);
  });

  it("the armoured hell Bruiser's front stops hits until 60 of them have worn it through; from behind they hurt (MookHellArmouredBigGuy.Damage)", () => {
    const w = world('2', 24, 14);
    const a = first(w, 'hell_armoured');
    expect(a.health).toBe(30);
    expect(a.facing).toBe(-1);
    damageUnit(a, 5, false, { dir: 1 }); // a shot travelling right hits him in the face
    expect(a.health).toBe(30);
    damageUnit(a, 5, false, { dir: -1 }); // and one travelling left, in the back
    expect(a.health).toBe(25);
    for (let i = 0; i < 12; i++) damageUnit(a, 5, false, { dir: 1 });
    expect(a.health).toBeLessThan(25);
  });

  it('the Boomer vomits a stream of slime that reaches further and further; killed, it swells for 1.2 s, bursts and throws out three undead suicide mooks', () => {
    const w = world('O', 20, 14);
    const b = first(w, 'hell_boomer');
    w.player.invulnerable = 999;
    const speeds: number[] = [];
    for (let i = 0; i < steps(6) && speeds.length < 3; i++) {
      play(w, 1);
      for (const p of w.projectiles) if (p.kind === 'vomit' && !speeds.includes(Math.abs(p.xI))) speeds.push(Math.abs(p.xI));
    }
    expect(speeds.length).toBeGreaterThanOrEqual(3);
    expect(speeds[2]).toBeGreaterThan(speeds[0]);
    damageUnit(b, 25);
    let burst = -1;
    for (let i = 0; i < steps(2) && burst < 0; i++) {
      play(w, 1);
      if (explosions(w).length > 0) burst = (i + 1) * FIXED_DT;
    }
    expect(burst).toBeGreaterThan(1.1);
    expect(burst).toBeLessThan(1.4);
    expect(w.enemies.filter((e) => e.kind === 'undead_suicide')).toHaveLength(3);
  });

  it('the Soul Catcher bursts as soon as it sees the bro and lets out five lost souls (SoulCatcherAI)', () => {
    const w = world('p', 22, 14);
    w.player.invulnerable = 999;
    let boom = false;
    for (let i = 0; i < steps(5) && !boom; i++) {
      play(w, 1);
      boom = explosions(w).length > 0;
    }
    expect(boom).toBe(true);
    expect(w.enemies.filter((e) => e.kind === 'hell_lostsoul')).toHaveLength(5);
  });

  it('a lost soul flies up, dives homing in on the bro and blows up on him (HellLostSoul)', () => {
    const w = world('l', 24, 14);
    w.player.invulnerable = 999;
    let near = false;
    for (let i = 0; i < steps(10) && !near; i++) {
      play(w, 1);
      near = explosions(w).some((e) => e.type === 'explosion' && Math.abs(e.x - w.player.x) < 40);
    }
    expect(near).toBe(true);
  });

  it('the warlock sees the bro through walls, opens a portal by him, and the undead suicide mook rising out of it is launched at him', () => {
    const w = world('v', 26, 14, [[22, 's']]);
    w.player.invulnerable = 999;
    let portal = false;
    let launched = false;
    for (let i = 0; i < steps(8) && !launched; i++) {
      play(w, 1);
      portal = portal || w.portals.length > 0;
      const m = w.enemies.find((e) => e.kind === 'undead_suicide');
      launched = !!m && m.hell?.summoned === null && Math.hypot(m.xI, m.yI) > 200; // LaunchUnit: at the bro, at 300
    }
    expect(portal).toBe(true);
    expect(launched).toBe(true);
  });

  it('hurting the warlock drops the mook his portal is raising', () => {
    const w = world('v', 26, 14);
    const v = first(w, 'warlock');
    w.player.invulnerable = 999;
    let m = undefined as ReturnType<typeof first> | undefined;
    for (let i = 0; i < steps(6) && !m; i++) {
      play(w, 1);
      m = w.enemies.find((e) => e.kind === 'undead_suicide' && e.hell?.summoned != null);
    }
    expect(m).toBeDefined();
    damageUnit(v, 1);
    play(w, 1);
    expect(m!.hell?.summoned).toBeNull();
  });

  it('the hell dog runs at the bro and bites him, like a dog (HellDog: MookDog)', () => {
    const w = world('e', 20, 14);
    w.player.invulnerable = 0;
    w.player.health = 50;
    for (let i = 0; i < steps(5) && w.player.health === 50; i++) play(w, 1);
    expect(w.player.health).toBe(50 - DOG.bite);
  });
});
