import type { AlienSpeeds } from './aliens';
import type { AiStats, DoorStats, FoeStats, GameStats, PathCaps, RocketStats, UnitStats } from './types';

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

/** The old EnemyAI (MortarAI): sight, attackTime and sightDelay; it has no PolymorphicAI patrol or idle waits. */
function enemyAi(raw: Raw, key: string): AiStats {
  return {
    sightX: num(raw, key, 'sightRangeX'),
    sightY: num(raw, key, 'sightRangeY'),
    attackTime: num(raw, key, 'attackTime'),
    sightDelay: num(raw, key, 'sightDelay'),
    delayBetweenFiring: 0,
    patrolRadius: 0, // MortarAI.StartMoving does nothing: he stays put
    minIdleWait: 0.9, // EnemyAI.DoIdleThink: 0.9 - Random.value * 0.1 to the next think
    maxIdleWait: 1,
    hidingLookX: 64,
  };
}

/** A Tank's health, speed and mooks, and its AI's sight. */
function foe(raw: Raw, key: string, bike = false): FoeStats {
  const s: FoeStats = {
    health: num(raw, `foe_${key}`, 'health'),
    speed: num(raw, `foe_${key}`, 'tankSpeed'),
    mooks: bike ? 0 : num(raw, `foe_${key}`, 'mooksToSpawn'),
    sightX: num(raw, `ai_foe_${key}`, 'sightRangeX'),
    sightY: num(raw, `ai_foe_${key}`, 'sightRangeY'),
  };
  if (bike && key !== 'artillery' && key !== 'kopter') {
    s.attackX = num(raw, `ai_foe_${key}`, 'attackXRange');
    s.jumpForce = num(raw, `foe_${key}`, 'mookJumpForce');
  }
  return s;
}

/** An alien's DogAI: the PolymorphicAI fields and, when it has them, its attack range. */
function alienAi(raw: Raw, key: string): AiStats {
  const s = ai(raw, key);
  const x = raw[key]?.attackRangeX;
  const y = raw[key]?.attackRangeY;
  if (typeof x === 'number' && typeof y === 'number') Object.assign(s, { attackRangeX: x, attackRangeY: y });
  return s;
}

/** Alien's run speeds (a MookDog's); the mosquito, a plain Mook, runs at its speed. */
function alienSpeeds(raw: Raw, key: string): AlienSpeeds {
  const r = raw[key] ?? {};
  const pick = (f: string): number => (typeof r[f] === 'number' ? (r[f] as number) : num(raw, key, 'speed'));
  return { unaware: pick('unawareRunSpeed'), aware: pick('awareRunSpeed'), mega: Math.max(pick('awareMegaRunSpeed'), pick('unawareMegaRunSpeed')) };
}

/** A Vector3 field, as the extractor writes it ({x, y, z}): its x and y. */
function vec(raw: Raw, key: string, field: string): { x: number; y: number } {
  const v = raw[key]?.[field] as { x?: unknown; y?: unknown } | undefined;
  if (!v || typeof v.x !== 'number' || typeof v.y !== 'number') throw new Error(`values.json: ${key}.${field} is not a vector`);
  return { x: v.x, y: v.y };
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
      mook_bruiser: unit(raw, 'mook_bruiser'),
      mook_jetpack: unit(raw, 'mook_jetpack'),
      mook_jetpack_bazooka: unit(raw, 'mook_jetpack_bazooka'),
      mook_ninja: unit(raw, 'mook_ninja'),
      mook_mortar: unit(raw, 'mook_mortar'),
      mook_bruiser_elite: unit(raw, 'mook_bruiser_elite'),
      mook_dolph: unit(raw, 'mook_dolph'),
      alien_xeno: unit(raw, 'alien_xeno'),
      alien_xeno_brain: unit(raw, 'alien_xeno_brain'),
      alien_hugger: unit(raw, 'alien_hugger'),
      alien_snake: unit(raw, 'alien_snake'),
      alien_melter: unit(raw, 'alien_melter'),
      alien_brute: unit(raw, 'alien_brute'),
      alien_mosquito: unit(raw, 'alien_mosquito'),
      hell_dog: unit(raw, 'hell_dog'),
      hell_lostsoul: unit(raw, 'hell_lostsoul'),
      hell_boomer: unit(raw, 'hell_boomer'),
      hell_soulcatcher: unit(raw, 'hell_soulcatcher'),
      hell_bigguy: unit(raw, 'hell_bigguy'),
      hell_armoured: unit(raw, 'hell_armoured'),
      undead: unit(raw, 'undead'),
      undead_suicide: unit(raw, 'undead_suicide'),
      skinless: unit(raw, 'skinless'),
      warlock: unit(raw, 'warlock'),
      satan: unit(raw, 'satan'),
      mook_alarmist: unit(raw, 'mook_alarmist'),
    },
    bros: {
      bro_base: unit(raw, 'bro_base', true), bro_lee: unit(raw, 'bro_lee', true), bro_soldier: unit(raw, 'bro_soldier', true),
      bro_in_black: unit(raw, 'bro_in_black', true), bro_rambro: unit(raw, 'bro_rambro', true), bro_ellen: unit(raw, 'bro_ellen', true),
    },
    ai: {
      mook: ai(raw, 'ai_mook'), mook_suicide: ai(raw, 'ai_mook_suicide'), mook_bazooka: ai(raw, 'ai_mook_bazooka'),
      mook_scout: ai(raw, 'ai_mook_scout'), mook_shield: ai(raw, 'ai_mook_shield'),
      mook_grenadier: ai(raw, 'ai_mook_grenadier'), dog: ai(raw, 'ai_dog'), mook_bruiser: ai(raw, 'ai_mook_bruiser'),
      mook_jetpack: ai(raw, 'ai_mook_jetpack'), mook_jetpack_bazooka: ai(raw, 'ai_mook_jetpack_bazooka'),
      mook_ninja: ai(raw, 'ai_mook_ninja'), mook_alarmist: ai(raw, 'ai_mook_alarmist'),
      mook_mortar: enemyAi(raw, 'ai_mook_mortar'),
      mook_bruiser_elite: ai(raw, 'ai_mook_bruiser_elite'),
      mook_dolph: ai(raw, 'ai_mook_dolph'),
      alien_xeno: alienAi(raw, 'ai_alien_xeno'),
      alien_xeno_brain: alienAi(raw, 'ai_alien_xeno_brain'),
      alien_hugger: alienAi(raw, 'ai_alien_hugger'),
      alien_snake: alienAi(raw, 'ai_alien_snake'),
      alien_melter: alienAi(raw, 'ai_alien_melter'),
      alien_brute: alienAi(raw, 'ai_alien_brute'),
      alien_mosquito: alienAi(raw, 'ai_alien_mosquito'),
      hell_dog: alienAi(raw, 'ai_hell_dog'),
      hell_lostsoul: alienAi(raw, 'ai_hell_lostsoul'),
      hell_boomer: ai(raw, 'ai_hell_boomer'),
      hell_soulcatcher: ai(raw, 'ai_hell_soulcatcher'),
      hell_bigguy: ai(raw, 'ai_hell_bigguy'),
      hell_armoured: ai(raw, 'ai_hell_armoured'),
      undead: ai(raw, 'ai_undead'),
      undead_suicide: ai(raw, 'ai_undead_suicide'),
      skinless: ai(raw, 'ai_skinless'),
      warlock: ai(raw, 'ai_warlock'),
      satan: ai(raw, 'ai_satan'),
    },
    paths: {
      mook: path(raw, 'path_mook'), mook_suicide: path(raw, 'path_mook_suicide'), mook_bazooka: path(raw, 'path_mook_bazooka'),
      mook_scout: path(raw, 'path_mook_scout'),
      mook_shield: path(raw, 'path_mook'), // ZMookRiotShield has no PathAgent: a trooper's
      mook_grenadier: path(raw, 'path_mook_grenadier'), dog: path(raw, 'path_dog'), mook_bruiser: path(raw, 'path_mook_bruiser'),
      mook_jetpack: path(raw, 'path_mook_jetpack'), mook_jetpack_bazooka: path(raw, 'path_mook_jetpack_bazooka'),
      mook_ninja: path(raw, 'path_mook_ninja'), mook_alarmist: path(raw, 'path_mook_alarmist'),
      mook_mortar: path(raw, 'path_mook_mortar'),
      mook_bruiser_elite: path(raw, 'path_mook_bruiser_elite'),
      alien_xeno: path(raw, 'path_alien_xeno'),
      alien_xeno_brain: path(raw, 'path_alien_xeno_brain'),
      alien_hugger: path(raw, 'path_alien_hugger'),
      alien_snake: path(raw, 'path_alien_snake'),
      alien_melter: path(raw, 'path_alien_melter'),
      alien_brute: path(raw, 'path_alien_brute'),
      alien_mosquito: path(raw, 'path_alien_mosquito'),
      hell_dog: path(raw, 'path_hell_dog'),
      hell_lostsoul: path(raw, 'path_hell_lostsoul'),
      // the hell Bruisers and the Boomers have no PathAgent: a Bruiser's
      hell_boomer: path(raw, 'path_mook_bruiser'),
      hell_soulcatcher: path(raw, 'path_mook_bruiser'),
      hell_bigguy: path(raw, 'path_mook_bruiser'),
      hell_armoured: path(raw, 'path_mook_bruiser'),
      undead: path(raw, 'path_undead'),
      undead_suicide: path(raw, 'path_undead_suicide'),
      skinless: path(raw, 'path_skinless'),
      warlock: path(raw, 'path_warlock'),
      satan: path(raw, 'path_mook'), // ZSatan has no PathAgent: a trooper's
      mook_dolph: { canJump: true, jumpHeight: 3, maxDropDistance: 4, canWallClimb: false, fudge: false, agentSize: 9 }, // he walks his own way
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
    minigun: { damage: num(raw, 'minigun_bullet', 'damage'), life: num(raw, 'minigun_bullet', 'life') },
    alarm: {
      delay: num(raw, 'alarm_switch', 'alarmDelay'), rate: num(raw, 'alarm', 'alarmRate'),
      paratrooperRate: num(raw, 'alarm', 'paratrooperRate'), activeMooks: num(raw, 'alarm', 'activeMookThreshold'),
    },
    jetpack: {
      range: num(raw, 'mook_jetpack', 'explosionRange'), blastForce: num(raw, 'mook_jetpack', 'blastForce'),
      spiralDelay: num(raw, 'mook_jetpack', 'spiralDelayDuration'),
    },
    rocketMook: rocket(raw, 'rocket_mook'),
    launch: rocket(raw, 'rocket_launch'),
    drunk: { ...rocket(raw, 'rocket_drunk'), drunkSpeed: num(raw, 'rocket_drunk', 'drunkSpeed'), acceleration: num(raw, 'rocket_drunk', 'acceleration') },
    alienSpeeds: {
      alien_xeno: alienSpeeds(raw, 'alien_xeno'),
      alien_xeno_brain: alienSpeeds(raw, 'alien_xeno_brain'),
      alien_hugger: alienSpeeds(raw, 'alien_hugger'),
      alien_snake: alienSpeeds(raw, 'alien_snake'),
      alien_melter: alienSpeeds(raw, 'alien_melter'),
      alien_brute: alienSpeeds(raw, 'alien_brute'),
      alien_mosquito: alienSpeeds(raw, 'alien_mosquito'),
      hell_lostsoul: alienSpeeds(raw, 'hell_lostsoul'),
    },
    tesla: { deviation: num(raw, 'tesla_zap', 'MaxDeviation'), life: num(raw, 'tesla_zap', 'MaxLife'), zapTime: num(raw, 'tesla_zap', 'ZapDuration') },
    drone: { speed: num(raw, 'drone', 'speed'), fireRate: num(raw, 'drone', 'fireRate'), health: num(raw, 'drone', 'health') },
    rocketpack: {
      duration: num(raw, 'rocketpack', 'hoverDuration'), force: num(raw, 'rocketpack', 'defaultHoverForce'),
      sinForce: num(raw, 'rocketpack', 'hoverSinForce'), sinSpeed: num(raw, 'rocketpack', 'hoverSinSpeed'),
      sinStart: num(raw, 'rocketpack', 'hoverSinStart'), side: vec(raw, 'rocketpack', 'jetpackSideDirection'),
      down: vec(raw, 'rocketpack', 'jetpackDownDirection'),
    },
    hell: {
      flameWall: {
        columns: num(raw, 'flame_wall_hell', 'maxCollumns'), rows: num(raw, 'flame_wall_hell', 'maxRows'),
        explosions: num(raw, 'flame_wall_hell', 'totalExplosions'), rate: num(raw, 'flame_wall_hell', 'explosionRate'),
        damage: num(raw, 'flame_wall_hell', 'damageAmount'), puffDelay: num(raw, 'flame_wall_hell', 'maxPuffDelay'),
        puffY: num(raw, 'flame_wall_hell', 'yExplosionOffset'),
      },
      vomit: {
        damage: num(raw, 'slime_vomit', 'damageInternal'), gravity: num(raw, 'slime_vomit', 'gravityM'), life: num(raw, 'slime_vomit', 'life'),
        size: num(raw, 'slime_vomit', 'projectileSize'),
      },
      portal: {
        launchDelay: num(raw, 'warlock_portal', 'launchDelay'), riseTime: num(raw, 'warlock_portal', 'riseTime'),
        riseSpeed: num(raw, 'warlock_portal', 'riseSpeed'),
      },
      boomer: { range: num(raw, 'hell_boomer', 'explosionRange'), warning: num(raw, 'hell_boomer', 'warningTime') },
      soulcatcher: { range: num(raw, 'hell_soulcatcher', 'explosionRange'), warning: num(raw, 'hell_soulcatcher', 'warningTime') },
      undeadSuicide: { range: num(raw, 'undead_suicide', 'range'), blastForce: num(raw, 'undead_suicide', 'blastForce') },
      lostSoul: {
        diveSpeed: num(raw, 'hell_lostsoul', 'diveSpeed'), diveSpeedMax: num(raw, 'hell_lostsoul', 'diveSpeedMax'),
        explodeRange: num(raw, 'hell_lostsoul', 'explodeRange'), broHarmM: num(raw, 'hell_lostsoul', 'broHarmRangeM'),
        seekTurn: num(raw, 'hell_lostsoul', 'seekTurningSpeedM'), wobbleSpeed: num(raw, 'hell_lostsoul', 'sinWobbleSpeed'),
        wobble: num(raw, 'hell_lostsoul', 'sinWobbleRadian'), diveDelay: num(raw, 'hell_lostsoul', 'diveDelayDuration'),
      },
    },
    foes: { truck: foe(raw, 'truck'), apc: foe(raw, 'apc'), bike: foe(raw, 'bike', true), nukebike: foe(raw, 'nukebike', true), artillery: {
      ...foe(raw, 'artillery', true), mooks: 0, attackTime: num(raw, 'ai_foe_artillery', 'attackTime'), sightDelay: num(raw, 'ai_foe_artillery', 'sightDelay'),
    }, kopter: {
      ...foe(raw, 'kopter', true), mooks: 0, sightDelay: num(raw, 'ai_foe_kopter', 'sightDelay'), speedY: num(raw, 'foe_kopter', 'verticalSpeed'),
    } },
    hugeBullet: { damage: num(raw, 'bullet_huge', 'damage'), life: num(raw, 'bullet_huge', 'life') },
    elite: { runSpeedMultiplier: num(raw, 'mook_bruiser_elite', 'runSpeedMultiplier'), jumpRange: num(raw, 'ai_mook_bruiser_elite', 'jumpRange') },
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
    cricket: {
      life: num(raw, 'cricket', 'life'), damage: num(raw, 'cricket', 'damage'),
      range: num(raw, 'cricket', 'range'), blastForce: num(raw, 'cricket', 'blastForce'), projectileSize: num(raw, 'cricket', 'projectileSize'),
    },
    molotov: { range: num(raw, 'molotov', 'range'), size: num(raw, 'molotov', 'size'), gravityM: num(raw, 'molotov', 'gravityM') },
    molotovFire: {
      range: num(raw, 'molotov_fire', 'range'), size: num(raw, 'molotov_fire', 'size'),
      gravityM: num(raw, 'molotov_fire', 'gravityM'), life: num(raw, 'molotov_fire', 'life'),
    },
    flamethrower: { fireRate: num(raw, 'flamethrower', 'fireRate') },
    flame: {
      life: num(raw, 'flame_bullet', 'life'), damage: num(raw, 'flame_bullet', 'damage'), size: num(raw, 'flame_bullet', 'projectileSize'),
      frames: num(raw, 'flame_anim', 'frames'), frameRate: num(raw, 'flame_anim', 'frameRate'),
    },
    flameWall: {
      columns: num(raw, 'flame_wall', 'maxCollumns'), rows: num(raw, 'flame_wall', 'maxRows'),
      explosions: num(raw, 'flame_wall', 'totalExplosions'), rate: num(raw, 'flame_wall', 'explosionRate'),
      damage: num(raw, 'flame_wall', 'damageAmount'), puffDelay: num(raw, 'flame_wall', 'maxPuffDelay'),
      puffY: num(raw, 'flame_wall', 'yExplosionOffset'),
    },
    revolver: {
      damage: num(raw, 'revolver_bullet', 'damage'), life: num(raw, 'revolver_bullet', 'life'),
      maxPenetrations: num(raw, 'revolver_bullet', 'maxPenetrations'), projectileSize: num(raw, 'revolver_bullet', 'projectileSize'),
    },
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
