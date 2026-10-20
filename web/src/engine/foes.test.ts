import { describe, expect, it } from 'vitest';
import { BROLUSCONI } from '../bros';
import { FIXED_DT } from './constants';
import { foeAt } from './foes';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';
import { NO_CONTROLS } from './types';
import { createWorld, stepWorld, type World } from './world';

const COLS = 60;

/** A flat strip: the bro at column `bro`, a foe at `at`, solid steel ends; `ground` overrides tiles of the ground row. */
function road(foe: string, at = 30, bro = 2, ground: Array<[number, string]> = []): LevelData {
  const row = (fill: string, cells: Array<[number, string]>) => {
    const a = Array<string>(COLS).fill(fill);
    for (const [c, ch] of cells) a[c] = ch;
    return a.join('');
  };
  const empty = row('.', []);
  return {
    cols: COLS, rows: 10,
    tiles: [empty, empty, empty, empty, empty, empty, row('.', [[bro, 'P'], [at, foe], [58, 'F']]), row('d', ground), row('d', []), row('s', [])],
  };
}

function play(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) stepWorld(w, NO_CONTROLS, NO_CONTROLS, FIXED_DT);
}
const steps = (s: number) => Math.round(s / FIXED_DT);

/** A world whose camera sees the foe (the bro stands a few blocks off it). */
function near(foe: string, at = 30, gap = 14, ground: Array<[number, string]> = []): World {
  const w = createWorld(road(foe, at, at - gap, ground), TEST_STATS, [BROLUSCONI], () => 0.5);
  w.player.invulnerable = 999;
  return w;
}

describe('the troop truck (MookTruck, MookTruckPolyAI)', () => {
  it("reads the truck ('T') as a foe with its 20 health", () => {
    expect(parseLevel(road('T'), TEST_STATS).foes).toEqual([{ c: 30, r: 3, kind: 'truck' }]);
    const w = createWorld(road('T'), TEST_STATS, [BROLUSCONI], () => 0.5);
    expect(w.foes).toHaveLength(1);
    expect(w.foes[0]).toMatchObject({ kind: 'truck', health: 20, facing: -1, dead: false });
  });

  it('waits off screen; in sight it drives left (80) as far as its road goes: two blocks short of a gap, 15 at most', () => {
    const far = createWorld(road('T', 50, 2), TEST_STATS, [BROLUSCONI], () => 0.5);
    far.player.invulnerable = 999;
    play(far, steps(1));
    expect(far.foes[0].x).toBe(50 * 16);
    const w = near('T', 30, 25, [[24, '.']]); // a gap at column 24: it stops at column 26
    play(w, steps(0.6));
    expect(w.foes[0].xI).toBe(-80);
    play(w, steps(4));
    expect(Math.round(w.foes[0].x / 16)).toBe(26);
    expect(w.foes[0].xI).toBe(0);
  });

  it('there it unloads its seven mooks out of the back, one every 0.6 s, thrown out behind it', () => {
    const w = near('T', 30, 25, [[26, '.']]);
    const truck = w.foes[0];
    play(w, steps(10));
    const mooks = w.enemies.filter((e) => e.kind === 'mook');
    expect(mooks).toHaveLength(7);
    expect(truck.spawned).toBe(7);
  });

  it('a bro in front of it within 120 stops it at once, and the mooks come out alerted', () => {
    const w = near('T', 30, 6);
    play(w, steps(1.5));
    const truck = w.foes[0];
    expect(truck.alerted).toBe(true);
    const mooks = w.enemies.filter((e) => e.kind === 'mook');
    expect(mooks.length).toBeGreaterThan(0);
    expect(mooks[0].ai?.mental).toBe('alerted');
  });

  it("the bro's shots hit it (a second within 0.096 s does at most 1) and at 0 it blows up into a wreck", () => {
    const w = near('T');
    const truck = w.foes[0];
    expect(foeAt(w.foes, truck.x, truck.y + 16)).toBe(truck);
    expect(foeAt(w.foes, truck.x, truck.y + 80)).toBeNull();
    w.projectiles.push({ id: 900, kind: 'rocket', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, 3);
    expect(truck.health).toBeLessThan(20);
    for (let i = 0; i < 40 && !truck.dead; i++) {
      w.projectiles.push({ id: 1000 + i, kind: 'bullet', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
      play(w, 4);
    }
    expect(truck.dead).toBe(true);
    expect(foeAt(w.foes, truck.x, truck.y + 16)).toBeNull();
  });

  it('its death blast (12 within 32-48) hurts what is around it', () => {
    const w = near('T', 30, 25);
    const truck = w.foes[0];
    truck.health = 1;
    w.projectiles.push({ id: 900, kind: 'bullet', team: 'player', x: truck.x + 30, y: truck.y + 16, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    w.player.invulnerable = 0;
    w.player.x = truck.x - 20;
    play(w, 3);
    expect(truck.dead).toBe(true);
    expect(w.player.dead).toBe(true);
  });
});

describe('the motorbike (MookMotorBike, MookMotorBikePolyAI)', () => {
  it("reads the motorbike ('I') and the nuclear one ('Z')", () => {
    expect(parseLevel(road('I'), TEST_STATS).foes[0].kind).toBe('bike');
    expect(parseLevel(road('Z'), TEST_STATS).foes[0].kind).toBe('nukebike');
    expect(createWorld(road('I'), TEST_STATS, [BROLUSCONI], () => 0.5).foes[0]).toMatchObject({ health: 6, passenger: true });
  });

  it('on screen it comes at the bro at 150, and close to him its suicide mook leaps off at him', () => {
    const w = near('I', 30, 12);
    const bike = w.foes[0];
    play(w, steps(0.8));
    expect(bike.xI).toBe(-150);
    let leapt = false;
    for (let i = 0; i < steps(3) && !leapt; i++) {
      play(w, 1);
      leapt = w.enemies.some((e) => e.kind === 'mook_suicide');
    }
    expect(leapt).toBe(true);
    expect(bike.passenger).toBe(false);
    expect(w.enemies.find((e) => e.kind === 'mook_suicide')?.ai?.mental).toBe('alerted');
  });

  it('riding faster than 80 it runs the bro over (20 crush)', () => {
    const w = near('I', 30, 12);
    w.player.invulnerable = 0;
    w.foes[0].passenger = false; // no one to leap off
    for (let i = 0; i < steps(4) && !w.player.dead; i++) play(w, 1);
    expect(w.player.dead).toBe(true);
  });

  it('shot down, its driver jumps clear and its passenger bails out on fire', () => {
    const w = near('I', 30, 25);
    const bike = w.foes[0];
    bike.health = 1;
    w.projectiles.push({ id: 900, kind: 'bullet', team: 'player', x: bike.x + 12, y: bike.y + 10, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, 3);
    expect(bike.dead).toBe(true);
    expect(w.enemies.map((e) => e.kind).sort()).toEqual(['mook', 'mook_suicide']);
  });

  it('the nuclear bike, close to the bro (8), goes up in a nuclear blast that flattens the ground around it', () => {
    const w = near('Z', 30, 4);
    const bike = w.foes[0];
    w.player.x = bike.x - 20;
    let nuked = false;
    for (let i = 0; i < steps(1.5) && !nuked; i++) {
      play(w, 1);
      nuked = w.events.some((e) => e.type === 'explosion' && e.source === 'nuke');
    }
    expect(nuked).toBe(true);
    expect(w.map.get(30, 2)).toBeNull();
  });
});

describe('the APC (MookAPC)', () => {
  it("reads the APC ('V'): 40 health, a motorbike inside", () => {
    const w = createWorld(road('V'), TEST_STATS, [BROLUSCONI], () => 0.5);
    expect(w.foes.map((f) => f.kind)).toEqual(['apc', 'bike']);
    expect(w.foes[0].health).toBe(40);
    expect(w.foes[1].hidden).toBe(true);
  });

  it('with the bro in front of it, it lets its motorbike out, then four suicide mooks, one every 0.5 s', () => {
    const w = near('V', 30, 6);
    play(w, steps(1.5));
    expect(w.foes[1].hidden).toBe(false);
    const seen = new Set<number>();
    for (let i = 0; i < steps(5); i++) {
      play(w, 1);
      for (const e of w.enemies) if (e.kind === 'mook_suicide') seen.add(e.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4); // its four, and the bike's passenger
    expect(w.foes[0].spawned).toBe(4);
    expect(w.foes[0].open).toBe(true);
  });

  it('blown up early, it throws out three suicide mooks and its motorbike', () => {
    const w = near('V', 30, 25);
    const apc = w.foes[0];
    apc.health = 1;
    w.projectiles.push({ id: 900, kind: 'bullet', team: 'player', x: apc.x + 36, y: apc.y + 20, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, 3);
    expect(apc.dead).toBe(true);
    expect(w.enemies.filter((e) => e.kind === 'mook_suicide')).toHaveLength(3);
    expect(w.foes[1].hidden).toBe(false);
  });
});

describe('the artillery truck (MookArtilleryTruck, MookArtilleryTruckPolyAI)', () => {
  it("reads the artillery truck ('Q'): 25 health", () => {
    const w = createWorld(road('Q'), TEST_STATS, [BROLUSCONI], () => 0.5);
    expect(w.foes[0]).toMatchObject({ kind: 'artillery', health: 25 });
  });

  it('with the bro ahead it unfolds its cannon, then lobs volleys of three heavy shells at him', () => {
    const w = near('Q', 30, 12);
    const art = w.foes[0];
    const shells = new Map<number, number>();
    for (let i = 0; i < steps(5); i++) {
      play(w, 1);
      for (const p of w.projectiles) if (p.kind === 'shell' && p.team === 'enemy' && !shells.has(p.id)) shells.set(p.id, p.xI);
    }
    expect(art.alerted).toBe(true);
    expect(art.unfold).toBeGreaterThanOrEqual(59);
    expect(shells.size).toBeGreaterThanOrEqual(3);
    for (const xI of shells.values()) expect(Math.sign(xI)).toBe(-1);
  });

  it('a bro further off gets a harder lob: num = 0.2 + |dx| / 180 + dy / 300, at least 0.5', () => {
    const near1 = near('Q', 30, 6);
    const far1 = near('Q', 30, 11); // still on screen: it only opens fire once it is (IsItSortOfVisible(X, Y, -4, 32))
    const first = (w: World): number => {
      for (let i = 0; i < steps(5); i++) {
        play(w, 1);
        const s = w.projectiles.find((p) => p.kind === 'shell' && p.team === 'enemy');
        if (s) return s.yI;
      }
      return 0;
    };
    expect(first(far1)).toBeGreaterThan(first(near1));
  });
});

describe('the Mookopter (Mookopter, MookopterPolyAI)', () => {
  /** A wide arena: the kopter hangs four blocks over the ground at column 30. */
  function sky(gap = 10): World {
    const lvl = road('.', 30, 30 - gap);
    const rows = lvl.tiles.slice();
    rows[2] = rows[2].slice(0, 30) + 'H' + rows[2].slice(31);
    const w = createWorld({ ...lvl, tiles: rows }, TEST_STATS, [BROLUSCONI], () => 0.5);
    w.player.invulnerable = 999;
    return w;
  }

  it("reads the Mookopter ('H'): 65 health, hanging in the air", () => {
    const w = sky();
    expect(w.foes[0]).toMatchObject({ kind: 'kopter', health: 65 });
    play(w, steps(1));
    expect(w.foes[0].y).toBeGreaterThan(48 + 16);
  });

  it('spotting the bro, it hangs back 2.5 s, then crosses its arena (160 either side) bombing as it goes', () => {
    const w = sky();
    const k = w.foes[0];
    const x0 = k.x;
    play(w, steps(2));
    expect(Math.abs(k.x - x0)).toBeLessThan(8);
    let bombs = 0;
    let minX = x0;
    for (let i = 0; i < steps(6); i++) {
      play(w, 1);
      minX = Math.min(minX, k.x);
      bombs = Math.max(bombs, w.projectiles.filter((p) => p.kind === 'shell' && p.team === 'enemy').length);
    }
    expect(minX).toBeLessThan(x0 - 96);
    expect(bombs).toBeGreaterThan(0);
  });

  it('it comes down to the bro and fires its chaingun: a wind-up, then six huge bullets (5 each) at 450', () => {
    const w = sky();
    const seen = new Set<number>();
    for (let i = 0; i < steps(16); i++) {
      play(w, 1);
      for (const p of w.projectiles) if (p.kind === 'hugeBullet') seen.add(p.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('shot down, it falls out of the sky and crashes as a wreck', () => {
    const w = sky();
    const k = w.foes[0];
    k.health = 1;
    w.projectiles.push({ id: 900, kind: 'bullet', team: 'player', x: k.x + 20, y: k.y + 8, xI: -400, yI: 0, life: 1, bounces: 0, dead: false });
    play(w, 3);
    expect(k.dead).toBe(true);
    play(w, steps(3));
    expect(k.onGround).toBe(true);
    expect(k.y).toBeLessThan(48 + 2);
  });
});
