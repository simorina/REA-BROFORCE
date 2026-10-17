import type { AiStats, DoorStats, GameStats, PathCaps, RocketStats, UnitStats } from './types';

type Raw = Record<string, Record<string, unknown>>;

function num(raw: Raw, key: string, field: string): number {
  const value = raw[key]?.[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`values.json: ${key}.${field} is missing or not a number`);
  }
  return value;
}

function unit(raw: Raw, key: string, bro = false): UnitStats {
  return {
    speed: num(raw, key, 'speed'),
    jumpForce: num(raw, key, '_jumpForce'),
    health: num(raw, key, 'health'),
    fireRate: num(raw, key, 'fireRate'),
    maxFallSpeed: num(raw, key, 'maxFallSpeed'),
    canWallClimb: num(raw, key, 'canWallClimb') !== 0,
    canDash: num(raw, key, 'canDash') !== 0,
    specialAmmo: num(raw, key, 'originalSpecialAmmo'),
    hearingX: num(raw, key, 'hearingRangeX'),
    hearingY: num(raw, key, 'hearingRangeY'),
    canHideInGrass: !bro && num(raw, key, 'canHideInGrass') !== 0,
    canBeSetOnFire: !bro && num(raw, key, 'canBeSetOnFire') !== 0,
    panicsOnFire: !bro && num(raw, key, 'willPanicWhenOnFire') !== 0,
  };
}

function path(raw: Raw, key: string): PathCaps {
  const caps = raw[key]?.capabilities as Raw[string] | undefined;
  if (!caps) throw new Error(`values.json: ${key}.capabilities is missing`);
  const wrapped: Raw = { [key]: caps };
  return {
    canJump: num(wrapped, key, 'canJump') !== 0,
    jumpHeight: num(wrapped, key, 'jumpHeight'),
    maxDropDistance: num(wrapped, key, 'maxDropDistance'),
    canWallClimb: num(wrapped, key, 'canWallClimb') !== 0,
    fudge: num(wrapped, key, 'fudge') !== 0,
    agentSize: num(raw, key, 'agentSize'),
  };
}

function door(raw: Raw, key: string): DoorStats {
  const flag = (f: string) => num(raw, key, f) !== 0;
  return {
    spawningRate: num(raw, key, 'spawningRate'),
    maxMookCount: num(raw, key, 'maxMookCount'),
    chanceSuicide: num(raw, key, 'chanceToSpawnSuicideMook'),
    maxAlarmed: num(raw, key, 'maxAlarmedMooksCount'),
    closedAtStart: flag('closedAtStart'),
    limited: num(raw, key, 'limitedNumberOfMooks'),
    maxOnCollapse: num(raw, key, 'maxMooksOnCollapse'),
    maxAfterCollapse: num(raw, key, 'maxMookCountAfterCollapse'),
    escapeOnFire: flag('spawnEscapingUnitsOnFire'),
    explodeAtEnd: flag('explodeAtEnd'),
    alwaysWalkOut: flag('mooksAlwaysWalkOut'),
    startSuspicious: flag('mooksStartSuspicious'),
  };
}

function ai(raw: Raw, key: string): AiStats {
  return {
    sightX: num(raw, key, 'sightRangeX'),
    sightY: num(raw, key, 'sightRangeY'),
    attackTime: num(raw, key, 'attackTime'),
    sightDelay: num(raw, key, 'sightDelay'),
    delayBetweenFiring: num(raw, key, 'delayBetweenFiring'),
    patrolRadius: num(raw, key, 'patrolBlocksRadius'),
    minIdleWait: num(raw, key, 'minIdleWaitDuration'),
    maxIdleWait: num(raw, key, 'maxIdleWaitDuration'),
    hidingLookX: num(raw, key, 'hidingLookXRange'),
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
      mook: unit(raw, 'mook'),
      mook_suicide: unit(raw, 'mook_suicide'),
      mook_bazooka: unit(raw, 'mook_bazooka'),
      mook_scout: unit(raw, 'mook_scout'),
      mook_shield: unit(raw, 'mook_shield'),
      mook_grenadier: unit(raw, 'mook_grenadier'),
      dog: unit(raw, 'dog'),
    },
    bros: { bro_base: unit(raw, 'bro_base', true), bro_lee: unit(raw, 'bro_lee', true), bro_soldier: unit(raw, 'bro_soldier', true) },
    ai: {
      mook: ai(raw, 'ai_mook'), mook_suicide: ai(raw, 'ai_mook_suicide'), mook_bazooka: ai(raw, 'ai_mook_bazooka'),
      mook_scout: ai(raw, 'ai_mook_scout'), mook_shield: ai(raw, 'ai_mook_shield'),
      mook_grenadier: ai(raw, 'ai_mook_grenadier'), dog: ai(raw, 'ai_dog'),
    },
    paths: {
      mook: path(raw, 'path_mook'), mook_suicide: path(raw, 'path_mook_suicide'), mook_bazooka: path(raw, 'path_mook_bazooka'),
      mook_scout: path(raw, 'path_mook_scout'),
      mook_shield: path(raw, 'path_mook'), // ZMookRiotShield has no PathAgent: a trooper's
      mook_grenadier: path(raw, 'path_mook_grenadier'), dog: path(raw, 'path_dog'),
    },
    scoutRunSpeed: num(raw, 'mook_scout', 'runSpeed'),
    dogRunSpeed: num(raw, 'dog', 'awareRunSpeed'),
    grenadeMook: {
      bounceM: num(raw, 'grenade_mook', 'bounceM'), frictionM: num(raw, 'grenade_mook', 'frictionM'),
      gravityM: num(raw, 'grenade_mook', 'gravityM'), damage: num(raw, 'grenade_mook', 'damage'),
      range: num(raw, 'grenade_mook', 'range'), blastForce: num(raw, 'grenade_mook', 'blastForce'),
    },
    door: door(raw, 'mook_door'),
    bullet: { damage: num(raw, 'bullet', 'damage'), life: num(raw, 'bullet', 'life') },
    rocketMook: rocket(raw, 'rocket_mook'),
    bomb: rocket(raw, 'bomb'),
    marker: { bounceM: num(raw, 'marker', 'bounceM'), frictionM: num(raw, 'marker', 'frictionM') },
    tank: {
      speed: num(raw, 'tank', 'speed'),
      jumpForce: num(raw, 'tank', '_jumpForce'),
      maxFallSpeed: num(raw, 'tank', 'maxFallSpeed'),
      maxDamage: num(raw, 'tank', 'maxDamageBeforeExploding'),
      countdownThreshold: num(raw, 'tank', 'deathCountdownExplodeThreshold'),
      cannonFireSpeed: num(raw, 'tank_turret', 'cannonFireSpeed'),
    },
    tankShell: { damage: num(raw, 'tank_shell', 'damage'), range: num(raw, 'tank_shell', 'range'), life: num(raw, 'tank_shell', 'life') },
    tankRocket: {
      ...rocket(raw, 'tank_rocket'),
      acceleration: num(raw, 'tank_rocket', 'horizontalAcceleration'),
      crushLayers: num(raw, 'tank_rocket', 'crushWallLayers'),
    },
    mech: { health: num(raw, 'mech', 'health') },
    rifle: {
      extraFireDelay: num(raw, 'bro_soldier', 'extraFireDelay'),
      damage: num(raw, 'rifle_bullet', 'damage'),
      life: num(raw, 'rifle_bullet', 'life'),
    },
    blocks: {
      dirt: { health: num(raw, 'block_dirt', 'health') },
      sand: { health: num(raw, 'block_sand', 'health') },
      brick: { health: num(raw, 'block_brick', 'health') },
      temple: { health: num(raw, 'block_brick', 'health') }, // the island's temple is WallBrick1, repainted
      steel: { health: num(raw, 'block_steel', 'health') },
      barrel: { health: num(raw, 'block_barrel', 'health') },
    },
    barrelRange: num(raw, 'block_barrel', 'range'),
    suicide: { range: num(raw, 'suicide_blast', 'range'), blastForce: num(raw, 'suicide_blast', 'blastForce') },
    grass: { health: num(raw, 'grass', 'health'), width: num(raw, 'grass', 'width'), height: num(raw, 'grass', 'height') },
  };
}
