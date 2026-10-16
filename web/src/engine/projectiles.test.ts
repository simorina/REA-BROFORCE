import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { TileMap, makeBlock } from './map';
import {
  fireBigRocket, fireMookBullet, fireShell, kickFootball, spawnAirstrike, stepProjectile, throwBody, throwMarker,
  type ProjectileEvent, type ProjectileWorld,
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
