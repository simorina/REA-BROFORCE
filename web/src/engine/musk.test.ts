import { describe, expect, it } from 'vitest';
import { BROLUSCONI, BROS, MUSK } from '../bros';
import type { BroDef } from './bro';
import { FIXED_DT } from './constants';
import type { LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A flat floor: `cells` on the entity row (r 2), earth under it, steel bedrock. */
function floor(cells: Array<[number, string]>): LevelData {
  const row = (fill: string, put: Array<[number, string]> = []) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of put) a[c] = ch;
    return a.join('');
  };
  const e = row('.');
  return { cols: COLS, rows: 8, tiles: [e, e, e, e, e, row('.', cells), row('d'), row('s')] };
}

const world = (cells: Array<[number, string]>, bro: BroDef = MUSK): World => createWorld(floor(cells), TEST_STATS, [bro], () => 0.5);
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

  it('a press of fire lets off four zaps, one every 0.1 s, however long it is held (Broden.StartFiring, RunFiring)', () => {
    const w = world([[3, 'P'], [38, 'F']]);
    const seen = new Set<number>();
    play(w, steps(1), { fire: true }, () => w.zaps.forEach((z) => seen.add(z.id)));
    expect(seen.size).toBe(4);
  });

  it("a bolt locks onto the nearest mook ahead within 155 (twice Broden's reach) and arcs on to two more", () => {
    const w = world([[3, 'P'], [11, 'm'], [13, 'm'], [14, 'm'], [30, 'm'], [38, 'F']]);
    w.player.invulnerable = 999;
    const [a, b, c, far] = w.enemies;
    play(w, 1, { fire: true });
    play(w, steps(0.8));
    expect([a.dead, b.dead, c.dead]).toEqual([true, true, true]);
    expect(far.dead).toBe(false);
  });

  it('every bolt hits for 4, and every bolt of a press arcs on, not just the first', () => {
    const w = world([[3, 'P'], [11, 'm'], [13, 'm'], [38, 'F']]);
    w.player.invulnerable = 999;
    const [a, b] = w.enemies;
    a.health = b.health = 100;
    const arcs = new Set<number>();
    play(w, 1, { fire: true }, () => w.zaps.forEach((z) => z.target === b.id && arcs.add(z.id)));
    play(w, steps(0.8), {}, () => w.zaps.forEach((z) => z.target === b.id && arcs.add(z.id)));
    expect(a.health).toBe(100 - 4 * 4);
    expect(arcs.size).toBe(4);
  });

  it('with no mook ahead it strikes the first wall within 132 for 8: a dirt block goes', () => {
    const w = world([[3, 'P'], [7, 'd'], [38, 'F']]);
    expect(w.map.get(7, 2)).not.toBeNull();
    play(w, 1, { fire: true });
    play(w, steps(0.5));
    expect(w.map.get(7, 2)).toBeNull();
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
