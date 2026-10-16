import { describe, expect, it } from 'vitest';
import { applyBlast, barrelBlast, rocketBlast } from './explosions';
import { TileMap, makeBlock } from './map';
import { TEST_STATS } from './testStats';
import { makeUnit } from './units';

const rocket = TEST_STATS.rocketMook; // damage 10, range 28, blastForce 20, extraY 300
const mookAt = (x: number, y = 72) => makeUnit(2, 'mook', 'enemy', x, y, TEST_STATS.units.mook);
const broAt = (x: number, y = 72) => makeUnit(1, 'bro', 'player', x, y, TEST_STATS.bros.bro_base);

describe('applyBlast (Rocket.MakeEffects + Map.ExplodeUnits + MapController.DamageGround)', () => {
  it('destroys dirt within half the range and spares steel', () => {
    const map = new TileMap(10, 10);
    map.set(5, 5, makeBlock('dirt', TEST_STATS));
    map.set(6, 5, makeBlock('steel', TEST_STATS));
    const res = applyBlast(map, [], rocketBlast(80, 80, rocket, 'player'));
    expect(res.destroyed).toEqual([{ c: 5, r: 5, kind: 'dirt' }]);
    expect(map.get(6, 5)?.kind).toBe('steel');
  });

  it('kills and knocks back an enemy inside the kill range', () => {
    const m = mookAt(100); // chest 20 units right of the blast
    const res = applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(res.killed).toEqual([2]);
    expect(m.xI).toBeGreaterThan(0);
    expect(m.yI).toBeGreaterThan(0);
  });

  it("doesn't hurt the player with their own blast but still knocks them", () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], rocketBlast(80, 80, rocket, 'player'));
    expect(p.dead).toBe(false);
    expect(p.xI).toBeGreaterThan(0);
  });

  it('an enemy rocket kills the bro', () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], rocketBlast(80, 80, rocket, 'enemy'));
    expect(p.dead).toBe(true);
  });

  it('barrels hurt everyone, including the player', () => {
    const p = broAt(90);
    applyBlast(new TileMap(10, 10), [p], barrelBlast(85, 80, 50));
    expect(p.dead).toBe(true);
  });

  it('only knocks units between the kill range and the outer range', () => {
    const m = mookAt(115); // 35 away: outside killRange 28, inside unitRange 42
    applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(m.health).toBe(3);
    expect(m.xI).toBeGreaterThan(0);
  });

  it('ignores units outside the range, gibbed and invulnerable units', () => {
    const far = mookAt(200);
    const gibbed = mookAt(85);
    gibbed.gibbed = true;
    const spawning = broAt(85);
    spawning.invulnerable = 0.5;
    applyBlast(new TileMap(10, 10), [far, gibbed, spawning], rocketBlast(80, 80, rocket, 'enemy'));
    expect(far.xI).toBe(0);
    expect(gibbed.xI).toBe(0);
    expect(spawning.xI).toBe(0);
    expect(spawning.dead).toBe(false);
  });

  it('knocks corpses about and gibs them below -10 health (TestVanDammeAnim.gibThreshold)', () => {
    const corpse = mookAt(85);
    const res1 = applyBlast(new TileMap(10, 10), [corpse], rocketBlast(80, 80, rocket, 'player'));
    expect(res1.killed).toEqual([2]);
    expect(corpse.health).toBe(-7);
    expect(corpse.gibbed).toBe(false);
    const res2 = applyBlast(new TileMap(10, 10), [corpse], rocketBlast(80, 80, rocket, 'player'));
    expect(res2.killed).toEqual([]); // already dead
    expect(corpse.gibbed).toBe(true);
  });

  it('a blast centred exactly on a unit keeps velocities finite', () => {
    const m = mookAt(80, 77); // body centre (Y + height / 2) at y = 80
    applyBlast(new TileMap(10, 10), [m], rocketBlast(80, 80, rocket, 'player'));
    expect(Number.isFinite(m.xI) && Number.isFinite(m.yI)).toBe(true);
  });
});
