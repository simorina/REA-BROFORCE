import type { GameStats, RocketStats, UnitStats } from './types';

type Raw = Record<string, Record<string, unknown>>;

function num(raw: Raw, key: string, field: string): number {
  const value = raw[key]?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`values.json: ${key}.${field} is missing or not a number`);
  }
  return value;
}

function unit(raw: Raw, key: string): UnitStats {
  return {
    speed: num(raw, key, 'speed'),
    jumpForce: num(raw, key, '_jumpForce'),
    health: num(raw, key, 'health'),
    fireRate: num(raw, key, 'fireRate'),
    maxFallSpeed: num(raw, key, 'maxFallSpeed'),
    canWallClimb: num(raw, key, 'canWallClimb') !== 0,
    canDash: num(raw, key, 'canDash') !== 0,
    specialAmmo: num(raw, key, 'originalSpecialAmmo'),
  };
}

function rocket(raw: Raw, key: string): RocketStats {
  return {
    damage: num(raw, key, 'damage'),
    range: num(raw, key, 'range'),
    blastForce: num(raw, key, 'blastForce'),
    blastForceExtraY: num(raw, key, 'blastForceExtraY'),
    life: num(raw, key, 'life'),
  };
}

export function parseValues(raw: Raw): GameStats {
  return {
    units: {
      bro: unit(raw, 'bro_base'),
      mook: unit(raw, 'mook'),
      mook_suicide: unit(raw, 'mook_suicide'),
      mook_bazooka: unit(raw, 'mook_bazooka'),
    },
    bullet: { damage: num(raw, 'bullet', 'damage'), life: num(raw, 'bullet', 'life') },
    rocketMook: rocket(raw, 'rocket_mook'),
    bomb: rocket(raw, 'bomb'),
    marker: { bounceM: num(raw, 'marker', 'bounceM'), frictionM: num(raw, 'marker', 'frictionM') },
    blocks: {
      dirt: { health: num(raw, 'block_dirt', 'health') },
      brick: { health: num(raw, 'block_brick', 'health') },
      steel: { health: num(raw, 'block_steel', 'health') },
      barrel: { health: num(raw, 'block_barrel', 'health') },
    },
    barrelRange: num(raw, 'block_barrel', 'range'),
    suicide: { range: num(raw, 'suicide_blast', 'range'), blastForce: num(raw, 'suicide_blast', 'blastForce') },
  };
}
