import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS, type Controls } from './types';
import { damageUnit } from './units';
import { createWorld, stepWorld, type World } from './world';

const COLS = 40;

/** A flat lab floor: the bro at `bro`, an alien at `at`, the flag at 38; `cells` puts more tiles on the floor row. */
function lab(alien: string, at = 24, bro = 14, cells: Array<[number, string]> = []): LevelData {
  const row = (fill: string, put: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of put) a[c] = ch;
    return a.join('');
  };
  const e = row('.', []);
  return { cols: COLS, rows: 10, tiles: [e, e, e, e, e, e, row('.', [[bro, 'P'], [at, alien], [38, 'F'], ...cells]), row('d', []), row('d', []), row('s', [])] };
}

function play(w: World, frames: number, controls: Partial<Controls> = {}): void {
  const c = { ...NO_CONTROLS, ...controls };
  for (let i = 0; i < frames; i++) stepWorld(w, c, c, FIXED_DT);
}
const steps = (s: number) => Math.round(s / FIXED_DT);

function world(alien: string, at = 24, bro = 14, cells: Array<[number, string]> = []): World {
  return createWorld(lab(alien, at, bro, cells), TEST_STATS, [BROLUSCONI], () => 0.5);
}
const first = (w: World, kind: string) => w.enemies.find((e) => e.kind === kind)!;

describe('the aliens (Alien, AlienClimber, their DogAI minds)', () => {
  it('reads the xenomorph (X), its brain-box kind (Y), the facehugger (f), the snake (S), the melter (L), the brute (K) and the mosquito (W)', () => {
    const lvl = parseLevel({ cols: 9, rows: 2, tiles: ['PXYfSLKWF', 'ddddddddd'] }, TEST_STATS);
    expect(lvl.enemies.map((e) => e.kind)).toEqual(['alien_xeno', 'alien_xeno_brain', 'alien_hugger', 'alien_snake', 'alien_melter', 'alien_brute', 'alien_mosquito']);
  });

  it('a xenomorph that sees the bro runs at him (120) and claws him (6)', () => {
    const w = world('X');
    const x = first(w, 'alien_xeno');
    w.player.invulnerable = 0;
    w.player.health = 50;
    let fastest = 0;
    for (let i = 0; i < steps(4) && w.player.health === 50; i++) {
      play(w, 1);
      fastest = Math.max(fastest, Math.abs(x.xI));
    }
    expect(fastest).toBeGreaterThan(90);
    expect(w.player.health).toBe(44);
  });

  it('a facehugger within 90 crouches and leaps at the bro, and hugs his face: 2 s later he dies (InseminateUnits)', () => {
    const w = world('f', 20);
    const h = first(w, 'alien_hugger');
    w.player.invulnerable = 0;
    let hugged = false;
    for (let i = 0; i < steps(8) && !hugged; i++) {
      play(w, 1);
      hugged = h.alien!.hugging;
    }
    expect(hugged).toBe(true);
    play(w, steps(1.5));
    expect(w.player.dead).toBe(false);
    play(w, steps(0.7));
    expect(w.player.dead).toBe(true);
  });

  it('flexing when the 2 s are up throws the facehugger off unharmed', () => {
    const w = world('f', 20);
    const h = first(w, 'alien_hugger');
    w.player.invulnerable = 0;
    for (let i = 0; i < steps(8) && !h.alien!.hugging; i++) play(w, 1);
    expect(h.alien!.hugging).toBe(true);
    play(w, steps(0.6));
    stepWorld(w, { ...NO_CONTROLS, gesture: true }, NO_CONTROLS, FIXED_DT); // the press
    play(w, steps(1.8), { gesture: true });
    expect(w.player.dead).toBe(false);
    expect(h.alien!.hugging).toBe(false);
  });

  it('a melter runs up to the bro and bursts in acid; killed, it bursts on the ground 0.4 s later', () => {
    const w = world('L', 22);
    w.player.invulnerable = 999;
    let acid = false;
    for (let i = 0; i < steps(5) && !acid; i++) {
      play(w, 1);
      acid = w.events.some((e) => e.type === 'explosion' && e.source === 'acid');
    }
    expect(acid).toBe(true);
    const w2 = world('L', 30);
    damageUnit(first(w2, 'alien_melter'), 5);
    let burst = -1;
    for (let i = 0; i < steps(1) && burst < 0; i++) {
      play(w2, 1);
      if (w2.events.some((e) => e.type === 'explosion' && e.source === 'acid')) burst = i * FIXED_DT;
    }
    expect(burst).toBeGreaterThan(0.3);
  });

  it('the brute (100 health) charges a bro within 190, smashing what is in its way, and rams him (20)', () => {
    const w = world('K', 28, 18);
    const b = first(w, 'alien_brute');
    expect(b.health).toBe(100);
    w.player.invulnerable = 0;
    w.player.health = 50;
    let fastest = 0;
    for (let i = 0; i < steps(6) && w.player.health === 50; i++) {
      play(w, 1);
      fastest = Math.max(fastest, Math.abs(b.xI));
    }
    expect(fastest).toBeGreaterThan(100);
    expect(w.player.health).toBe(30);
  });

  it('charging into steel stuns the brute', () => {
    const w = world('K', 28, 18, [[24, 's'], [25, 's']]);
    const b = first(w, 'alien_brute');
    w.player.invulnerable = 999;
    b.alien!.alerted = true; // the steel hides the bro from it; it has heard him
    b.facing = -1;
    let stunned = false;
    for (let i = 0; i < steps(6) && !stunned; i++) {
      play(w, 1);
      stunned = b.alien!.stun > 0;
    }
    expect(stunned).toBe(true);
  });

  it('a mosquito takes off, dives at the bro along its line and bursts in acid', () => {
    const w = world('W', 24, 14);
    const m = first(w, 'alien_mosquito');
    w.player.invulnerable = 999;
    let flew = false;
    let acid = false;
    for (let i = 0; i < steps(8) && !acid; i++) {
      play(w, 1);
      flew = flew || m.y > 40 + 24;
      acid = w.events.some((e) => e.type === 'explosion' && e.source === 'acid');
    }
    expect(flew).toBe(true);
    expect(acid).toBe(true);
  });

  it('mooks around an alerted alien panic (Map.PanicUnits, 36)', () => {
    const w = world('X', 24, 14, [[25, 'm']]);
    const mook = first(w, 'mook');
    first(w, 'alien_xeno').alien!.alerted = true;
    play(w, steps(0.4));
    expect(mook.ai?.mental).toBe('panicking');
  });
});
