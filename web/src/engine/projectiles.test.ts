import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import {
  fireBigRocket, fireM60Bullet, fireMookBullet, fireNoisyCricket, fireRevolverBullet, fireShell, molotovFlames, throwMolotov, kickFootball, spawnAirstrike, stepProjectile,
  throwBody, throwMarker, useNeuraliser, type ProjectileEvent, type ProjectileWorld,
} from './projectiles';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';
import type { Projectile, Unit } from './types';

const world = (map = new TileMap(40, 10), units: Unit[] = []): ProjectileWorld => ({ map, units, stats: TEST_STATS });
function steps(p: Projectile, w: ProjectileWorld, n: number): ProjectileEvent[] {
  const events: ProjectileEvent[] = [];
  for (let i = 0; i < n && !p.dead; i++) events.push(...stepProjectile(p, w, FIXED_DT));
  return events;
}
function floorMap(cols = 40): TileMap {
  const m = new TileMap(cols, 10);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('dirt', TEST_STATS));
  return m;
}
const mook = (x = 40, y = 40) => {
  const m = makeUnit(2, 'mook', 'enemy', x, y, TEST_STATS.units.mook);
  m.facing = 1;
  return m;
};
const bro = (x = 80, y = 8) => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.bros.bro_base);

describe('bullets (Mook.UseFire, Projectile)', () => {
  it('fly at 250 u/s and expire after their 0.45 s life', () => {
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    expect(p.xI).toBe(250);
    steps(p, world(), 26);
    expect(p.dead).toBe(false);
    steps(p, world(), 2);
    expect(p.dead).toBe(true);
  });

  it('chip the block they hit', () => {
    const map = new TileMap(40, 10);
    map.set(5, 3, makeBlock('dirt', TEST_STATS)); // x 72..88, y 40..56; bullet flies at y 48
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    steps(p, world(map), 30);
    expect(p.dead).toBe(true);
    expect(map.get(5, 3)?.health).toBe(4);
  });

  it('kill the bro and pass by other mooks', () => {
    const target = bro(100, 40);
    const friend = mook(70, 40);
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    steps(p, world(new TileMap(40, 10), [friend, target]), 30);
    expect(friend.health).toBe(3);
    expect(target.dead).toBe(true);
  });

  it('blow up barrels', () => {
    const map = new TileMap(40, 10);
    map.set(5, 3, makeBlock('barrel', TEST_STATS));
    const p = fireMookBullet(1, mook(), TEST_STATS, () => 0.5);
    const events = steps(p, world(map), 30);
    expect(map.get(5, 3)).toBeNull();
    expect(events.map((e) => e.type)).toEqual(['block', 'explode']);
    expect(events[1].type === 'explode' && events[1].blast.team).toBe('neutral');
  });
});

describe('football (design weapon)', () => {
  it('bounces off the floor and loses energy', () => {
    const ball = kickFootball(1, bro());
    const w = world(floorMap());
    while (ball.bounces === 0 && !ball.dead) stepProjectile(ball, w, FIXED_DT);
    expect(ball.yI).toBeGreaterThan(0);
    expect(ball.yI).toBeLessThan(160);
  });

  it('explodes on touching an enemy', () => {
    const ball = kickFootball(1, bro());
    Object.assign(ball, { x: 118, y: 14, xI: 50, yI: 0 });
    const events = stepProjectile(ball, world(floorMap(), [mook(120, 8)]), FIXED_DT);
    expect(events).toHaveLength(1);
    expect(events[0].type === 'explode' && events[0].blast.team).toBe('player');
  });

  it('kicked point-blank into a wall, it explodes against the wall instead of bouncing behind', () => {
    const map = floorMap();
    for (let r = 1; r <= 5; r++) map.set(8, r, makeBlock('dirt', TEST_STATS)); // wall face at x = 120
    const ball = kickFootball(1, bro(113.9, 8)); // spawns at x = 121.9, inside the wall
    const events = stepProjectile(ball, world(map), FIXED_DT);
    expect(events).toHaveLength(1);
    expect(events[0].type === 'explode' && events[0].blast.x).toBeGreaterThanOrEqual(120);
  });

  it('explodes after its last bounce, before the fuse', () => {
    const ball = kickFootball(1, bro());
    Object.assign(ball, { x: 80, y: 40, xI: 0, yI: 0 });
    const events = steps(ball, world(floorMap()), 200);
    expect(events.some((e) => e.type === 'explode')).toBe(true);
    expect(ball.bounces).toBeGreaterThan(3);
    expect(ball.life).toBeGreaterThan(0);
  });
});

describe('airstrike (BroBase.UseSpecial + GrenadeAirstrike.Death)', () => {
  it('the marker calls the strike when its fuse runs out', () => {
    const marker = throwMarker(1, bro(), false);
    expect([marker.xI, marker.yI]).toEqual([200, 150]);
    const events = steps(marker, world(floorMap()), 61);
    expect(events).toEqual([{ type: 'airstrike', x: marker.x, y: marker.y }]);
  });

  it('ducking lobs the marker short', () => {
    const marker = throwMarker(1, bro(), true);
    expect([marker.xI, marker.yI]).toEqual([30, 70]);
  });

  it('spawns five bombs from the upper left at 45 degrees', () => {
    let id = 0;
    const bombs = spawnAirstrike(() => ++id, 500, 100, 100, TEST_STATS, () => 0);
    expect(bombs.map((b) => [b.x, b.y])).toEqual([[20, 680], [20, 640], [20, 600], [20, 560], [20, 520]]);
    expect(bombs.every((b) => b.xI === 200 && b.yI === -200 && b.team === 'player')).toBe(true);
    // each reaches y = 100 at x = 500 + (offset - 480): spread from x - 60 to x + 100
    expect(bombs.map((b) => b.x + (b.y - 100))).toEqual([600, 560, 520, 480, 440]);
  });

  it('bombs fly in from outside the map and explode on the ground', () => {
    let id = 0;
    const bombs = spawnAirstrike(() => ++id, 500, 100, 100, TEST_STATS, () => 0);
    const w = world(floorMap(60));
    const events = bombs.flatMap((b) => steps(b, w, 400));
    expect(events.filter((e) => e.type === 'explode')).toHaveLength(5);
  });
});

describe('thrown bodies (the judo throw)', () => {
  it('fly ahead in an arc and blow up where they land, leaving gibs', () => {
    const p = throwBody(1, bro(80, 8), 'mook');
    expect([p.kind, p.x, p.y, p.xI, p.yI, p.body]).toEqual(['body', 90, 18, 180, 240, 'mook']);
    const events = steps(p, world(floorMap()), 120);
    expect(p.dead).toBe(true);
    expect(p.x).toBeGreaterThan(160); // lands about 85 px ahead
    const e = events.find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.team, e.blast.big]).toEqual(['football', 'player', false]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'gib', kind: 'mook' }));
  });

  it('blow up against a wall', () => {
    const map = floorMap();
    for (let r = 1; r <= 3; r++) map.set(7, r, makeBlock('steel', TEST_STATS)); // x 104..120, up to y 56
    const p = throwBody(1, bro(80, 8), 'mook');
    steps(p, world(map), 120);
    expect(p.dead).toBe(true);
    expect(p.x).toBeLessThan(110);
  });

  it('blow up on the first enemy they hit', () => {
    const p = throwBody(1, bro(80, 8), 'mook');
    const events = steps(p, world(floorMap(), [mook(168, 8)]), 120);
    expect(p.dead).toBe(true);
    expect(p.x).toBeLessThan(168);
    expect(events.some((e) => e.type === 'explode')).toBe(true);
  });

  it('a thrown suicide mook goes off with its own big blast, which spares the bro', () => {
    const p = throwBody(1, bro(80, 8), 'mook_suicide');
    const e = steps(p, world(floorMap()), 120).find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.team, e.blast.big]).toEqual(['suicide', 'player', true]);
  });
});

describe("the tank's projectiles", () => {
  const tank = { x: 80, y: 8, facing: 1 as const };

  it('the mortar shell leaves at (X + 17, Y + 33) at (135, 135), coasts, slows, then falls and blows up', () => {
    const p = fireShell(1, tank, TEST_STATS);
    expect([p.kind, p.x, p.y, p.xI, p.yI]).toEqual(['shell', 97, 41, 135, 135]);
    steps(p, world(floorMap()), 6); // 0.1 s: no drag yet
    expect(p.xI).toBeCloseTo(135, 5);
    steps(p, world(floorMap()), 15); // 0.35 s: slowed
    expect(p.xI).toBeLessThan(130);
    const e = steps(p, world(floorMap()), 400).find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.groundDamage, e.blast.unitRange, e.blast.force]).toEqual(['shell', 10, 36, 350]);
  });

  it('the big rocket leaves at (X + 24, Y + 22) at 44 and gains 120 u/s² of speed', () => {
    const p = fireBigRocket(1, tank, TEST_STATS);
    expect([p.kind, p.x, p.y, p.xI, p.crush]).toEqual(['bigRocket', 104, 30, 44, 3]);
    steps(p, world(new TileMap(60, 10)), 30);
    expect(p.xI).toBeCloseTo(44 + 120 * 0.5, 0);
  });

  it('the big rocket crushes through a wall layer instead of bouncing', () => {
    const map = new TileMap(60, 10);
    for (let r = 1; r <= 3; r++) map.set(8, r, makeBlock('dirt', TEST_STATS)); // x 120..136
    const p = fireBigRocket(1, { x: 70, y: 10, facing: 1 }, TEST_STATS);
    steps(p, world(map), 40);
    expect(map.get(8, 2)).toBeNull();
    expect(p.crush).toBe(2);
    expect(p.x).toBeGreaterThan(136);
  });

  it('the big rocket blows up after its 1 s life with its own blast', () => {
    const p = fireBigRocket(1, tank, TEST_STATS);
    const e = steps(p, world(new TileMap(60, 10)), 70).find((x) => x.type === 'explode');
    expect(e?.type === 'explode' && [e.blast.source, e.blast.groundDamage, e.blast.killRange]).toEqual(['bigRocket', 15, 56]);
  });
});

describe("Che Guevara's M60 (Rambro) and Molotov (GrenadeMolotov)", () => {
  const che = () => {
    const u = makeUnit(1, 'bro', 'player', 50, 30, TEST_STATS.bros.bro_rambro);
    u.facing = 1;
    return u;
  };
  const fires = (evs: ProjectileEvent[]) => evs.filter((e): e is Extract<ProjectileEvent, { type: 'fire' }> => e.type === 'fire');

  it("the M60's bullet is Bullet Rambo, from (x + 10, y + 8) at 400, up to 20 off level (TestVanDammeAnim.UseFire)", () => {
    const p = fireM60Bullet(1, che(), TEST_STATS, () => 0.5);
    expect([p.kind, p.team, p.x, p.y, p.xI, p.yI, p.life]).toEqual(['rifle', 'player', 60, 38, 400, 0, TEST_STATS.rifle.life]);
    expect(fireM60Bullet(1, che(), TEST_STATS, () => 0).yI).toBe(-20);
    expect(fireM60Bullet(1, che(), TEST_STATS, () => 0.999).yI).toBe(19);
  });

  it('the Molotov is thrown like any special grenade (BroBase.UseSpecial)', () => {
    const m = throwMolotov(1, che(), false);
    const a = throwMarker(1, che(), false);
    expect([m.kind, m.x, m.y, m.xI, m.yI]).toEqual(['molotov', a.x, a.y, a.xI, a.yI]);
  });

  it('it bursts where it lands (deathOnBounce)', () => {
    const p = throwMolotov(1, che(), false);
    const evs = steps(p, world(floorMap(80)), 200);
    expect(p.dead).toBe(true);
    const burst = evs.find((e) => e.type === 'molotov');
    expect(burst?.type === 'molotov' && burst.y).toBeGreaterThanOrEqual(8); // on top of the floor, not in it
  });

  it('it bursts on a mook it flies into, setting him alight (RunMovement: HitLivingUnits(1, Fire, 24))', () => {
    const p = throwMolotov(1, che(), false);
    const target = mook(70, 30);
    const evs = steps(p, world(new TileMap(80, 20), [target]), 30);
    expect(fires(evs)[0]).toMatchObject({ range: 24, damage: 1 });
    expect(evs.some((e) => e.type === 'molotov')).toBe(true);
  });

  it('it throws four little fires up and around (GrenadeMolotov.Death: Point3OnCircle, 210-260)', () => {
    const flames = molotovFlames(() => 7, 100, 40, TEST_STATS, () => 0.5);
    expect(flames).toHaveLength(4);
    const a0 = 0.3 - 0.25;
    const angles = [a0, a0 + 0.9, a0 + 1.7, a0 + 2.5];
    flames.forEach((f, i) => {
      expect(f).toMatchObject({ kind: 'molotovFire', team: 'player', x: 100, y: 42, life: 1 });
      expect(f.xI).toBeCloseTo(Math.cos(angles[i]) * 235);
      expect(f.yI).toBeCloseTo(Math.sin(angles[i]) * 235);
    });
  });

  it('a little fire burns a range of 16 around itself as it flies, and 24 where it lands, then is gone', () => {
    const [f] = molotovFlames(() => 7, 100, 40, TEST_STATS, () => 0.5);
    const evs = steps(f, world(floorMap(80)), 200);
    const ranges = fires(evs).map((e) => e.range);
    expect(ranges).toContain(16);
    expect(ranges.at(-1)).toBe(24);
    expect(f.dead).toBe(true);
  });
});

describe("Django's revolver (DirtyHarry, Bullet DirtyBrory: BulletSnakeBroskin)", () => {
  const samuel = () => {
    const u = makeUnit(1, 'bro', 'player', 50, 30, TEST_STATS.bros.bro_lee);
    u.facing = 1;
    return u;
  };

  it('the bullet leaves from (x + 14, y + 8.5) at 750, up to 10 off level, and lives 0.3 s', () => {
    const p = fireRevolverBullet(1, samuel(), TEST_STATS, () => 0.5);
    expect([p.kind, p.team, p.x, p.y, p.xI, p.yI, p.life]).toEqual(['revolver', 'player', 64, 38.5, 750, 0, 0.3]);
    expect(fireRevolverBullet(1, samuel(), TEST_STATS, () => 0).yI).toBe(-10);
  });

  it('it goes through two mooks, 4 damage to the first and 3 to the second, and is gone', () => {
    const p = fireRevolverBullet(1, samuel(), TEST_STATS, () => 0.5);
    const [a, b, c] = [mook(90, 32), mook(110, 32), mook(130, 32)];
    b.id = 3; // the helper gives every mook id 2, and a bullet hits each unit (by id) once
    c.id = 4;
    steps(p, world(new TileMap(80, 20), [a, b, c]), 30);
    expect(TEST_STATS.units.mook.health - a.health).toBe(4);
    expect(TEST_STATS.units.mook.health - b.health).toBe(3);
    expect(c.health).toBe(TEST_STATS.units.mook.health);
    expect(p.dead).toBe(true);
  });

  it('in the open it flies about 0.3 s at 750 (0.99 of real time, like the Noisy Cricket)', () => {
    const p = fireRevolverBullet(1, samuel(), TEST_STATS, () => 0.5);
    steps(p, world(new TileMap(80, 20)), 60);
    expect(p.x - 64).toBeGreaterThan(750 * 0.3 * 0.99 - 14);
    expect(p.x - 64).toBeLessThan(750 * 0.3 * 0.99 + 14);
  });

  it('a wall stops it and takes its damage', () => {
    const map = new TileMap(80, 20);
    map.set(6, 2, makeBlock('dirt', TEST_STATS)); // x 96-112
    const health = map.get(6, 2)!.health;
    const p = fireRevolverBullet(1, samuel(), TEST_STATS, () => 0.5);
    steps(p, world(map), 60);
    expect(p.dead).toBe(true);
    expect(p.x).toBeLessThanOrEqual(112);
    expect(map.get(6, 2)?.health ?? 0).toBeLessThan(health);
  });
});

describe("Bro In Black's Noisy Cricket and Neuraliser (Brononymous)", () => {
  const bib = () => {
    const u = makeUnit(1, 'bro', 'player', 50, 30, TEST_STATS.bros.bro_in_black);
    u.facing = 1;
    return u;
  };
  const blinds = (evs: ProjectileEvent[]) => evs.filter((e): e is Extract<ProjectileEvent, { type: 'blind' }> => e.type === 'blind');

  it('the Noisy Cricket shot leaves from (x + 14, y + 9.5) at 700 and lives 0.18 s (Brononymous.UseFire, its prefab)', () => {
    const p = fireNoisyCricket(1, bib(), TEST_STATS);
    expect([p.kind, p.team, p.x, p.y, p.xI, p.yI, p.life]).toEqual(['cricket', 'player', 64, 39.5, 700, 0, 0.18]);
  });

  it('in the open it flies 0.18 s at 700 (NoisyCricket.Update: t * 0.33, three times) and goes off: damage 10, range 28', () => {
    const p = fireNoisyCricket(1, bib(), TEST_STATS);
    const evs = steps(p, world(new TileMap(80, 20)), 60);
    expect(p.dead).toBe(true);
    expect(p.x - 64).toBeGreaterThan(700 * 0.18 * 0.99 - 13);
    expect(p.x - 64).toBeLessThan(700 * 0.18 * 0.99 + 13);
    const exp = evs.find((e) => e.type === 'explode');
    expect(exp?.type === 'explode' && exp.blast).toMatchObject({
      // NoisyCricket.MakeEffects: DamageGround(damage, range); ExplodeUnits(range, range * 0.7, blastForce * 40, 300)
      source: 'cricket', team: 'player', groundDamage: 10, groundRange: 28, unitDamage: 10, unitRange: 28, force: 800, extraY: 300,
    });
    expect(exp?.type === 'explode' && exp.blast.killRange).toBeCloseTo(19.6);
  });

  it('a direct hit does its full damage (Projectile.Fire: damageInternal = damage) and sets it off', () => {
    const p = fireNoisyCricket(1, bib(), TEST_STATS);
    const target = mook(80, 32);
    const evs = steps(p, world(new TileMap(80, 20), [target]), 10);
    expect(target.health).toBe(TEST_STATS.units.mook.health - TEST_STATS.cricket.damage);
    expect(evs.some((e) => e.type === 'hit')).toBe(true);
    expect(evs.some((e) => e.type === 'explode')).toBe(true);
  });

  it('a wall sets it off (NoisyCricket.ReflectProjectile)', () => {
    const map = new TileMap(80, 20);
    map.set(6, 2, makeBlock('steel', TEST_STATS)); // x 96-112
    const p = fireNoisyCricket(1, bib(), TEST_STATS);
    const evs = steps(p, world(map), 60);
    const exp = evs.find((e) => e.type === 'explode');
    expect(exp?.type === 'explode' && exp.blast.x).toBeLessThanOrEqual(112);
  });

  it('it leaves a beam puff every 16 units it flies (NoisyCricket.RunBeam)', () => {
    const p = fireNoisyCricket(1, bib(), TEST_STATS);
    const puffs = steps(p, world(new TileMap(80, 20)), 60).filter((e) => e.type === 'cricketBeam');
    expect(puffs.length).toBeGreaterThanOrEqual(6);
    expect(puffs.length).toBeLessThanOrEqual(9);
  });

  it('the Neuraliser starts at (x + 4, y + height + 3) and first blinds a range of 16 there (Neuraliser.EffectFirstUpdate)', () => {
    const p = useNeuraliser(1, bib(), false);
    expect([p.kind, p.x, p.y]).toEqual(['neuraliser', 54, 39]);
    expect(blinds(stepProjectile(p, world(new TileMap(80, 20)), FIXED_DT))[0]).toEqual({ type: 'blind', x: 54, y: 39, range: 16 });
  });

  it('its beam grows 16 units at a time, about 800 units a second, blinding a range of 24 at each tip', () => {
    const p = useNeuraliser(1, bib(), false);
    const w = world(new TileMap(80, 20));
    const evs = steps(p, w, Math.round(0.1 / FIXED_DT));
    const tips = blinds(evs).filter((e) => e.range === 24).map((e) => e.x);
    expect(tips.slice(0, 3)).toEqual([70, 86, 102]);
    expect(p.x - 54).toBeGreaterThan(80 - 24);
    expect(p.x - 54).toBeLessThan(80 + 24);
  });

  it('it stops 240 units out, flashes for 0.11 s and is gone', () => {
    const p = useNeuraliser(1, bib(), false);
    const evs = steps(p, world(new TileMap(80, 20)), Math.round(0.5 / FIXED_DT));
    const tips = blinds(evs).filter((e) => e.range === 24).map((e) => e.x);
    expect(Math.max(...tips) - 54).toBeLessThanOrEqual(240 + 16);
    expect(Math.max(...tips) - 54).toBeGreaterThan(224);
    expect(p.dead).toBe(true);
  });

  it('a wall stops it at its face', () => {
    const map = new TileMap(80, 20);
    map.set(8, 2, makeBlock('steel', TEST_STATS)); // x 128-144
    const p = useNeuraliser(1, bib(), false);
    const tips = blinds(steps(p, world(map), Math.round(0.5 / FIXED_DT))).map((e) => e.x);
    expect(Math.max(...tips)).toBeLessThanOrEqual(128);
  });
});

