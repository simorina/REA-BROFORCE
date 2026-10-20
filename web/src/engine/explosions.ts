import {
  BARREL_EXTRA_Y, BARREL_FORCE, BARREL_GROUND_DAMAGE, BARREL_UNIT_DAMAGE, BARREL_UNIT_RANGE_M,
  BARREL_Y_OFFSET, CRICKET, MIN_KNOCK_DIST, NOISE_BARREL, NOISE_ROCKET, SHELL_BLAST, SUICIDE_EXTRA_Y, SUICIDE_FORCE_M, TANK_GIB, TANK_GIB_RANGE,
  SUICIDE_GROUND_DAMAGE, SUICIDE_UNIT_DAMAGE, UNIT_BOX_HEIGHT,
} from './constants';
import type { TileMap } from './map';
import { damageUnit, knock } from './units';
import type { BlastTeam, BlockKind, GameStats, RocketStats, Team, Unit } from './types';

export interface Blast {
  x: number;
  y: number;
  groundY?: number; // where DamageGround centres, when not at y (the mine hits units 6 below its centre)
  groundDamage: number;
  groundRange: number; // DamageGround uses a sphere of radius range * 0.5
  unitDamage: number;
  unitRange: number;
  killRange: number;
  force: number;
  extraY: number;
  team: BlastTeam;
  big: boolean; // shakes the screen
  noise: number; // Map.DisturbWildLife range: mooks this close (plus their hearing) turn to look
  source: 'rocket' | 'bomb' | 'football' | 'barrel' | 'suicide' | 'shell' | 'bigRocket' | 'tank' | 'cricket' | 'mine'; // whose MakeEffects to show
  owner?: Unit; // the suicide mook that went off
  doodadDamage: number; // Map.DamageDoodads: what long grass and other doodads take ...
  doodadRange: number; // ... within this range
}

export interface BlastResult {
  destroyed: Array<{ c: number; r: number; kind: BlockKind }>;
  killed: number[];
}

/** Rocket.MakeEffects: DamageGround(damage, range); ExplodeUnits(range * 1.5, range, blastForce * 20, blastForceExtraY). */
export function rocketBlast(x: number, y: number, s: RocketStats, team: Team, big = true,
  source: Blast['source'] = 'rocket'): Blast {
  return {
    x, y, groundDamage: s.damage, groundRange: s.range, unitDamage: s.damage, unitRange: s.range * 1.5,
    killRange: s.range, force: s.blastForce * 20, extraY: s.blastForceExtraY, team, big, noise: NOISE_ROCKET, source,
    doodadDamage: s.damage, doodadRange: s.range * 0.6, // Rocket.MakeEffects
  };
}

/** NoisyCricket.MakeEffects: DamageGround(damage, range); ExplodeUnits(range, range * 0.7, blastForce * 40, 300). */
export function cricketBlast(x: number, y: number, s: GameStats['cricket'], team: Team): Blast {
  return {
    x, y, groundDamage: s.damage, groundRange: s.range, unitDamage: s.damage, unitRange: s.range,
    killRange: s.range * CRICKET.killRangeM, force: s.blastForce * CRICKET.forceM, extraY: CRICKET.extraY, team, big: true,
    noise: CRICKET.noise, source: 'cricket', doodadDamage: s.damage, doodadRange: s.range,
  };
}

/** MookSuicide.MakeEffects: fired by an enemy (playerNum < 0), so it alerts no one. */
export function suicideBlast(x: number, y: number, s: { range: number; blastForce: number }): Blast {
  return {
    x, y, groundDamage: SUICIDE_GROUND_DAMAGE, groundRange: s.range, unitDamage: SUICIDE_UNIT_DAMAGE,
    unitRange: s.range, killRange: s.range, force: s.blastForce * SUICIDE_FORCE_M, extraY: SUICIDE_EXTRA_Y,
    team: 'enemy', big: true, noise: 0, source: 'suicide',
    doodadDamage: 20, doodadRange: s.range, // MookSuicide.MakeEffects
  };
}

/** BarrelBlock explosion: fired as playerNum 15, so it hurts everyone. */
export function barrelBlast(x: number, y: number, range: number): Blast {
  return {
    x, y: y + BARREL_Y_OFFSET, groundDamage: BARREL_GROUND_DAMAGE, groundRange: range,
    unitDamage: BARREL_UNIT_DAMAGE, unitRange: range * BARREL_UNIT_RANGE_M, killRange: range,
    force: BARREL_FORCE, extraY: BARREL_EXTRA_Y, team: 'neutral', big: true, noise: NOISE_BARREL, source: 'barrel',
    doodadDamage: BARREL_GROUND_DAMAGE, doodadRange: range,
  };
}

/** Map.ExplodeUnits: enemies (playerNum < 0) are always hurt; players only by other teams. */
export function canDamage(blast: BlastTeam, unit: Team): boolean {
  return unit === 'enemy' || blast !== unit;
}

export function applyBlast(map: TileMap, units: readonly Unit[], b: Blast): BlastResult {
  const destroyed: BlastResult['destroyed'] = [];
  for (const [c, r] of map.cellsInCircle(b.x, b.groundY ?? b.y, b.groundRange * 0.5)) {
    const kind = map.damage(c, r, b.groundDamage);
    if (kind) destroyed.push({ c, r, kind });
  }
  const killed: number[] = [];
  for (const u of units) {
    // corpses are knocked and damaged too, which is how they fly and gib; invulnerable units are skipped
    if (u.gibbed || u.invulnerable > 0) continue;
    let dx = u.x - b.x;
    const dy = u.y + UNIT_BOX_HEIGHT / 2 - b.y;
    if (Math.abs(dx) >= b.unitRange || Math.abs(dy) >= b.unitRange) continue;
    const d2 = dx * dx + dy * dy;
    if (d2 < b.killRange * b.killRange) {
      if (canDamage(b.team, u.team)) {
        const d = Math.max(Math.sqrt(d2), 1);
        let extraY = b.extraY;
        if (Math.abs(dx) < b.unitRange * 0.4) {
          dx *= 0.66;
          extraY *= 1.5;
        }
        knock(u, (dx / d) * b.force, (dy / d) * b.force + extraY);
        if (damageUnit(u, b.unitDamage)) killed.push(u.id);
      } else {
        const d = Math.max(Math.sqrt(d2), MIN_KNOCK_DIST);
        knock(u, (dx / d) * b.force, (dy / d) * b.force + b.extraY);
      }
    } else if (d2 < b.unitRange * b.unitRange) {
      const d = Math.max(Math.sqrt(d2), MIN_KNOCK_DIST);
      knock(u, (dx / d) * b.force, (dy / d) * b.force + b.extraY);
    }
  }
  return { destroyed, killed };
}

/** HeavyShell.MakeEffects: DamageGround(damage, range); ExplodeUnits(damage, range, range, 350, 300); DamageDoodads(1, range * 0.6). */
export function shellBlast(x: number, y: number, s: { damage: number; range: number }, team: Team): Blast {
  return {
    x, y, groundDamage: s.damage, groundRange: s.range, unitDamage: s.damage, unitRange: s.range, killRange: s.range,
    force: SHELL_BLAST.force, extraY: SHELL_BLAST.extraY, team, big: true, noise: NOISE_ROCKET, source: 'shell',
    doodadDamage: 1, doodadRange: s.range * 0.6,
  };
}

/** MookArmouredGuy.Gib: the countdown's massive blast or the smaller one; fired as playerNum -15, it hurts everyone. */
export function tankBlast(x: number, y: number, massive: boolean): Blast {
  const ground = massive ? TANK_GIB_RANGE.massive : TANK_GIB_RANGE.small;
  return {
    x, y: y + TANK_GIB.yOffset, groundDamage: TANK_GIB.ground, groundRange: ground, unitDamage: TANK_GIB.damage,
    unitRange: massive ? TANK_GIB_RANGE.massive : TANK_GIB_RANGE.smallUnits, killRange: TANK_GIB.killRange,
    force: TANK_GIB.force, extraY: TANK_GIB.extraY, team: 'neutral', big: true, noise: NOISE_BARREL, source: 'tank',
    doodadDamage: TANK_GIB.ground, doodadRange: ground,
  };
}
