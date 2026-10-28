import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { bossFight, bossName, levelBossAlive } from './boss';
import { FIXED_DT } from './constants';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A flat arena: the bro at `bro`, the universal soldier at 24, the flag at 38. */
function arena(bro = 12): LevelData {
  const row = (fill: string, cells: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of cells) a[c] = ch;
    return a.join('');
  };
  const e = row('.', []);
  return { cols: COLS, rows: 10, tiles: [e, e, e, e, e, e, row('.', [[bro, 'P'], [24, 'U'], [38, 'F']]), row('d', []), row('d', []), row('s', [])] };
}

function play(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) stepWorld(w, NO_CONTROLS, NO_CONTROLS, FIXED_DT);
}
const steps = (s: number) => Math.round(s / FIXED_DT);

function fight(bro = 12): World {
  const w = createWorld(arena(bro), TEST_STATS, [BROLUSCONI], () => 0.5);
  w.player.invulnerable = 999;
  return w;
}
const dolph = (w: World) => w.enemies.find((e) => e.kind === 'mook_dolph')!;

describe('the universal soldier (DolphLundrenSoldier, DolfLundgrenAI)', () => {
  it("reads him ('U'): 110 health, the level's boss: the flag waits for him", () => {
    expect(parseLevel(arena(), TEST_STATS).enemies.map((e) => e.kind)).toEqual(['mook_dolph']);
    const w = fight(18);
    expect(dolph(w).health).toBe(110);
    expect(levelBossAlive(w)).toBe(true);
    play(w, steps(3));
    expect(bossName(w)).toBe('SOLDATO UNIVERSALE');
    expect(bossFight(w)).toBe('dolph');
  });

  it('on screen he fires barrages of drunk rockets from his launcher (siege mode, then one every 0.33 s)', () => {
    const w = fight(17);
    const seen = new Set<number>();
    for (let i = 0; i < steps(8); i++) {
      play(w, 1);
      for (const p of w.projectiles) if (p.kind === 'drunk') seen.add(p.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('knocked down, he lies 2 s, then gets up with 120 health and 60 more that soaks up hits', () => {
    const w = fight();
    const d = dolph(w);
    play(w, steps(0.5));
    damageUnit(d, 200);
    expect(d.dead).toBe(true);
    play(w, steps(2.5));
    expect(d.dead).toBe(false);
    expect(d.health).toBe(120);
    play(w, steps(1.8));
    const before = d.health;
    damageUnit(d, 5);
    expect(d.health).toBeGreaterThanOrEqual(before - 5);
  });

  it('explosions never gib him (canGib off)', () => {
    const w = fight();
    const d = dolph(w);
    damageUnit(d, 500);
    expect(d.gibbed).toBe(false);
  });

  it('the third time he goes down he stays down: the flag opens', () => {
    const w = fight();
    const d = dolph(w);
    for (let i = 0; i < 3; i++) {
      d.dolph!.bonus = 0;
      d.invulnerable = 0;
      damageUnit(d, 999);
      play(w, steps(5));
    }
    expect(d.dolph!.defeated).toBe(true);
    expect(levelBossAlive(w)).toBe(false);
  });

  it('falling off the map beats him at once', () => {
    const w = fight();
    const d = dolph(w);
    d.y = -80;
    play(w, 2);
    expect(d.dolph!.defeated).toBe(true);
  });

  it('with the bro right by him he crouches and super jumps, coming down with a blast', () => {
    const w = fight(23);
    const d = dolph(w);
    let top = d.y;
    let blasted = false;
    for (let i = 0; i < steps(8) && !blasted; i++) {
      play(w, 1);
      top = Math.max(top, d.y);
      blasted = w.events.some((e) => e.type === 'explosion' && e.source === 'stomp');
    }
    expect(top).toBeGreaterThan(40 + 64);
    expect(blasted).toBe(true);
  });
});
