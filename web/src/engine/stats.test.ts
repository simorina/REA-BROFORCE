import { describe, expect, it } from 'vitest';
import { parseValues } from './stats';
import { RAW_VALUES, TEST_STATS } from './testStats';

describe('parseValues', () => {
  it("reads the beach sand's health; the temple is built of WallBrick1", () => {
    const s = parseValues(RAW_VALUES);
    expect(s.blocks.sand).toEqual({ health: 5 });
    expect(s.blocks.temple).toEqual(s.blocks.brick);
  });

  it("reads Broniversal Soldier as a bro and his rifle's bullet", () => {
    const s = parseValues(RAW_VALUES);
    expect(s.bros.bro_soldier).toMatchObject({ speed: 110, fireRate: 0.12, specialAmmo: 3, canHideInGrass: false });
    expect(s.rifle).toEqual({ extraFireDelay: 0.3, damage: 1, life: 0.45 });
  });

  it('maps values.json onto GameStats', () => {
    expect(parseValues(RAW_VALUES)).toEqual(TEST_STATS);
  });

  it('reads Double Bro Seven and BroLee as bros: no grass hiding, no fire panic', () => {
    const s = parseValues(RAW_VALUES);
    expect(s.bros.bro_lee).toMatchObject({ speed: 120, fireRate: 0.2, specialAmmo: 2, canWallClimb: true });
    expect(s.bros.bro_lee).toMatchObject({ canHideInGrass: false, canBeSetOnFire: false, panicsOnFire: false });
    expect(s.bros.bro_base.specialAmmo).toBe(4);
  });

  it('names bro_lee when it is missing (game-data extracted before Putin)', () => {
    const old: Record<string, Record<string, unknown>> = { ...RAW_VALUES };
    delete old.bro_lee;
    expect(() => parseValues(old)).toThrow('bro_lee.speed');
  });

  it('reads the tank, its turret and its two projectiles', () => {
    const s = parseValues(RAW_VALUES);
    expect(s.tank).toEqual({ speed: 60, jumpForce: 290, maxFallSpeed: -600, maxDamage: 25, countdownThreshold: 45, cannonFireSpeed: 44 });
    expect(s.tankShell).toEqual({ damage: 10, range: 36, life: 6 });
    expect(s.tankRocket).toEqual({ damage: 15, range: 56, blastForce: 16, blastForceExtraY: 220, life: 1, acceleration: 120, crushLayers: 3 });
  });

  it('names the missing field', () => {
    const raw = { ...RAW_VALUES, bomb: { damage: 10 } };
    expect(() => parseValues(raw)).toThrow('bomb.range');
  });

  it('rejects non-numeric values', () => {
    const raw = { ...RAW_VALUES, bullet: { damage: 'x', life: 0.45 } };
    expect(() => parseValues(raw)).toThrow('bullet.damage');
  });

  it('reads each mook AI component', () => {
    expect(parseValues(RAW_VALUES).ai.mook.sightDelay).toBe(1.66);
    const raw = { ...RAW_VALUES, ai_mook_bazooka: { ...RAW_VALUES.ai_mook_bazooka, sightRangeY: undefined } };
    expect(() => parseValues(raw)).toThrow('ai_mook_bazooka.sightRangeY');
  });
});

