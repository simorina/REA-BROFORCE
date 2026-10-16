import { JET_BOX, TANK_BOX, TANK_COUNTDOWN, TANK_EMPTY_LIMIT } from './constants';
import type { Blast } from './explosions';
import type { TankStats } from './types';

export type VehicleKind = 'tank' | 'jet';

/** What the tank and the jet share: MookArmouredGuy's piloting, damage and death countdown. */
export interface Vehicle {
  kind: VehicleKind;
  id: number;
  x: number;
  y: number; // its bottom, like a unit's feet
  xI: number;
  yI: number;
  facing: 1 | -1;
  onGround: boolean;
  driven: boolean;
  damage: number; // MookArmouredGuy.shieldDamage + fireAmount
  countdown: number; // deathCountdown ticks, -1 until the death countdown starts
  countdownCounter: number;
  exploded: boolean; // gone: blown up, fallen off the map, or flown away
}

export const vehicleBox = (v: Vehicle): { halfWidth: number; height: number } => (v.kind === 'tank' ? TANK_BOX : JET_BOX);

/**
 * MookArmouredGuy.Damage / TankBroTank.Damage: hits add up. Past maxDamageBeforeExploding a driven vehicle starts its
 * death countdown. True when it must gib at once: an empty one past 60.
 */
export function damageVehicle(v: Vehicle, amount: number, s: TankStats): boolean {
  v.damage += amount;
  if (v.driven && v.damage > s.maxDamage && v.countdown < 0) v.countdown = 0;
  return !v.driven && !v.exploded && v.damage > TANK_EMPTY_LIMIT;
}

/** MookArmouredGuy.Update (deathCount > 2): a tick every 0.2667 s after the first 0.4667, speeding up to 5x. */
export function stepCountdown(v: Vehicle, s: TankStats, t: number): boolean {
  if (v.countdown < 0) return false;
  v.countdownCounter += t * (1 + Math.min(TANK_COUNTDOWN.speedup, Math.max(0, (v.countdown / s.countdownThreshold) * TANK_COUNTDOWN.speedup)));
  if (v.countdownCounter >= TANK_COUNTDOWN.first) {
    v.countdownCounter -= TANK_COUNTDOWN.step;
    v.countdown += 1;
  }
  return v.countdown >= s.countdownThreshold;
}

const HIT_MARGIN = 2;

/** The first standing vehicle whose box holds (x, y): enemy shots stop on it. */
export function vehicleAt(vehicles: readonly Vehicle[], x: number, y: number): Vehicle | null {
  for (const v of vehicles) {
    if (v.exploded) continue;
    const b = vehicleBox(v);
    if (Math.abs(x - v.x) <= b.halfWidth + HIT_MARGIN && y >= v.y - HIT_MARGIN && y <= v.y + b.height + HIT_MARGIN) return v;
  }
  return null;
}

/** Map.ExplodeUnits reaching the vehicle: its box within the blast's unit range. */
export function vehicleInBlast(v: Vehicle, b: Blast): boolean {
  const box = vehicleBox(v);
  return Math.abs(v.x - b.x) < b.unitRange + box.halfWidth && Math.abs(v.y + box.height / 2 - b.y) < b.unitRange + box.height / 2;
}
