import { describe, expect, it } from 'vitest';
import { BROLUSCONI, BROS, MUSK } from '../bros';
import type { BroDef } from './bro';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls, type Projectile } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A level with cells on any row: r 2 is the floor's surface (the entity row), r 1 earth, r 0 steel bedrock. */
function rows(byRow: Record<number, Array<[number, string]>>): LevelData {
  const tiles: string[] = [];
  for (let r = 7; r >= 0; r--) {
    const a = Array<string>(COLS).fill(r === 0 ? 's' : r === 1 ? 'd' : '.');
    for (const [c, ch] of byRow[r] ?? []) a[c] = ch;
    tiles.push(a.join(''));
  }
  return { cols: COLS, rows: 8, tiles };
}
const floor = (cells: Array<[number, string]>): LevelData => rows({ 2: cells });

const world = (cells: Array<[number, string]>, bro: BroDef = MUSK): World => createWorld(floor(cells), TEST_STATS, [bro], () => 0.5);
const worldOf = (byRow: Record<number, Array<[number, string]>>): World => createWorld(rows(byRow), TEST_STATS, [MUSK], () => 0.5);
const steps = (s: number) => Math.round(s / FIXED_DT);

/** Plays `frames` steps holding `controls`; the step before counts as released (a press on the first). */
function play(w: World, frames: number, controls: Partial<Controls> = {}, onStep?: () => void): void {
  const c = { ...NO_CONTROLS, ...controls };
  let prev = NO_CONTROLS;
  for (let i = 0; i < frames; i++) {
    stepWorld(w, c, prev, FIXED_DT);
    prev = c;
    onStep?.();
  }
}

describe('Elon Musk, the ultra-tech bro', () => {
  it('is a bro with the Tesla gun, the drone, the jetpack and "Occupy Mars!", and a rescue can bring him', () => {
    expect(MUSK).toMatchObject({ id: 'musk', name: 'Elon Musk', sheet: 'musk', weapon: 'tesla', special: 'drone', jetpack: true, voiceLine: 'Occupy Mars!' });
    expect(BROS).toContain(MUSK);
  });

  it("fire charges his laser for a quarter of a second, then its beam burns every mook on its line up to the first wall (Satan's LaserBeam)", () => {
    const w = worldOf({ 2: [[3, 'P'], [7, 'm'], [12, 'm'], [18, 'm'], [22, 's'], [26, 'm'], [38, 'F']] });
    w.player.invulnerable = 999;
    const [a, b, c, safe] = w.enemies;
    play(w, steps(0.2), { fire: true });
    expect(w.player.laser?.phase).toBe('charge');
    expect(a.health).toBe(a.stats.health);
    play(w, steps(0.8), { fire: true });
    expect([a.dead, b.dead, c.dead]).toEqual([true, true, true]);
    expect(safe.dead).toBe(false);
  });

  it('it bores a tunnel two blocks high through earth and reaches on beyond it; steel stops it', () => {
    const w = worldOf({ 2: [[3, 'P'], [8, 'd'], [12, 's'], [38, 'F']], 3: [[8, 'd'], [12, 's']] });
    play(w, steps(1.2), { fire: true });
    expect([w.map.get(8, 2), w.map.get(8, 3)]).toEqual([null, null]);
    expect(w.map.get(12, 2)).not.toBeNull();
    expect(w.player.laser!.x1).toBeGreaterThan(8 * 16);
  });

  it('a tap still fires a pulse of 0.3 s', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    let on = 0;
    play(w, 1, { fire: true });
    play(w, steps(1), {}, () => {
      if (w.player.laser?.phase === 'on') on += FIXED_DT;
    });
    expect(on).toBeGreaterThanOrEqual(0.28);
    expect(on).toBeLessThan(0.4);
  });

  it('its battery holds 2.5 s of beam; then it overheats, and fires again only once it has cooled off', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, steps(2.9), { fire: true });
    const l = w.player.laser!;
    expect(l.overheated).toBe(true);
    expect(l.phase).not.toBe('on');
    let back = -1;
    let t = 0;
    play(w, steps(2), { fire: true }, () => {
      t += FIXED_DT;
      if (back < 0 && w.player.laser?.phase === 'on') back = t;
    });
    expect(back).toBeGreaterThan(0.8);
    expect(back).toBeLessThan(1.6);
  });

  it('it sounds its charge, its blast as it lights and its overheat alarm as the battery runs flat', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    const phases: string[] = [];
    play(w, steps(2.9), { fire: true }, () => {
      for (const e of w.events) if (e.type === 'laser' && e.phase !== 'hum') phases.push(e.phase);
      w.events.length = 0;
    });
    expect(phases).toEqual(['charge', 'on', 'overheat']);
  });

  it('Tesla arcs leap off the beam to the mooks above it', () => {
    const w = worldOf({ 2: [[3, 'P'], [38, 'F']], 3: [[12, 'b']], 4: [[12, 'm']] });
    w.player.invulnerable = 999;
    const m = w.enemies[0];
    let arced = false;
    play(w, steps(1), { fire: true }, () => {
      arced = arced || w.zaps.some((z) => z.target === m.id);
    });
    expect(arced).toBe(true);
    expect(m.dead).toBe(true);
  });

  it('it burns up the enemy shots on its line', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, steps(0.35), { fire: true });
    const shot: Projectile = { id: 9999, kind: 'bullet', team: 'enemy', x: w.player.x + 120, y: w.player.y + 9, xI: -250, yI: 0, life: 2, bounces: 0, dead: false };
    w.projectiles.push(shot);
    play(w, 2, { fire: true });
    expect(shot.dead).toBe(true);
  });

  it('it vaporizes the corpses on its line', () => {
    const w = world([[3, 'P'], [9, 'm'], [38, 'F']]);
    const m = w.enemies[0];
    damageUnit(m, m.health);
    play(w, steps(1), { fire: true });
    expect(m.gibbed).toBe(true);
  });

  it('it throws sparks back at him where it strikes a wall; none where it runs out in the air', () => {
    const sparks = (w: World): number[] => {
      const dirs: number[] = [];
      play(w, steps(1), { fire: true }, () => {
        for (const e of w.events) if (e.type === 'laserHit') dirs.push(e.dir);
        w.events.length = 0;
      });
      return dirs;
    };
    const struck = sparks(world([[3, 'P'], [12, 's'], [38, 'F']]));
    expect(struck.length).toBeGreaterThan(5);
    expect(new Set(struck)).toEqual(new Set([1]));
    expect(sparks(world([[3, 'P'], [38, 'F']]))).toEqual([]);
  });

  it('his laser goes out when he dies', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, steps(0.5), { fire: true });
    expect(w.player.laser?.phase).toBe('on');
    w.player.invulnerable = 0;
    damageUnit(w.player, w.player.health);
    play(w, 1, { fire: true });
    expect(w.player.laser).toBeUndefined();
  });

  it('the special sends up two drones; the first follows him 14 behind and 14 up, and they fire when he fires (Drone)', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, 1, { special: true });
    play(w, steps(1));
    expect(w.drones).toHaveLength(2);
    const d = w.drones[0];
    expect(Math.abs(d.x - (w.player.x - w.player.facing * 14))).toBeLessThan(4); // the last 5 px it closes at the gap a second
    expect(Math.abs(d.y - (w.player.y + 14))).toBeLessThan(4);
    const shots = new Set<number>();
    play(w, steps(0.6), { fire: true }, () => {
      for (const p of w.projectiles) if (p.team === 'player' && p.kind === 'rifle' && Math.abs(p.y - (d.y + 8)) < 4) shots.add(p.id);
    });
    expect(shots.size).toBeGreaterThanOrEqual(2);
  });

  it('each special sends up two drones: six at once, each in its own place', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    for (let i = 0; i < 3; i++) {
      play(w, 1, { special: true });
      play(w, 2);
    }
    expect(w.drones).toHaveLength(6);
    expect(w.specialAmmo).toBe(0);
    play(w, steps(1.5));
    const spots = new Set(w.drones.map((d) => `${Math.round(d.x / 6)},${Math.round(d.y / 6)}`));
    expect(spots.size).toBe(6);
  });

  it('a drone shot down falls burning and blows up (Drone.Death, Gib); its partner flies on', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, 1, { special: true });
    play(w, steps(0.5));
    const [hit, partner] = w.drones;
    damageUnit(hit, 1);
    let boom = false;
    play(w, steps(2), {}, () => {
      boom = boom || w.events.some((e) => e.type === 'explosion');
    });
    expect(boom).toBe(true);
    expect(w.drones).toEqual([partner]);
    expect(partner.dead).toBe(false);
  });

  it("the bro's death takes his drones with him", () => {
    const w = world([[3, 'P'], [38, 'F']]);
    play(w, 1, { special: true });
    play(w, steps(0.5));
    w.player.invulnerable = 0;
    damageUnit(w.player, w.player.health);
    play(w, steps(2.5));
    expect(w.drones).toHaveLength(0);
  });

  it('holding jump, his jetpack keeps him up about twice as long as a plain jump (TheBrocketeer.RunJetpack: 2.2 s of lift at most)', () => {
    const airtime = (bro: BroDef): number => {
      const w = world([[3, 'P'], [38, 'F']], bro);
      play(w, steps(0.3));
      let t = 0;
      play(w, steps(6), { jump: true }, () => {
        if (!w.player.onGround) t += FIXED_DT;
      });
      return t;
    };
    const musk = airtime(MUSK);
    const plain = airtime(BROLUSCONI);
    expect(plain).toBeLessThan(1);
    expect(musk).toBeGreaterThan(plain * 1.6);
    expect(musk).toBeLessThan(2.2 + plain);
  });
});
