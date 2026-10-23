import { SHAKE_TIME, UNIT_HALF_WIDTH, UNIT_HEIGHT } from './constants';
import { barrelBlast, type Blast } from './explosions';
import { foeAt, type Foe } from './foes';
import { getColumn, getRow, type TileMap } from './map';
import { damageMech, mechAt } from './mech';
import { arcZap } from './tesla';
import type { Unit } from './types';
import { damageUnit, knock } from './units';
import type { World } from './world';

/**
 * Elon Musk's Tesla laser: Satan's LaserBeam ("BossLaserBeam") in his hands, in Tesla blue. Fire charges it (the thin
 * line swelling to full width over beamStartupDelayDelay), then the beam runs from the gun to the first solid block and
 * every damageRate burns whatever crosses its damageBeamWidth and eats away the block at its end; let go, it dissipates
 * (disappateTime). The screen shakes while it burns. Ours: a quarter-second charge, a 400 reach (Satan's: the screen),
 * a tunnel two blocks high (his height), a battery of 2.5 s of beam that overheats, and Tesla arcs leaping off it to the
 * mooks above and below. A tap still fires a 0.3 s pulse.
 */
export const LASER = {
  ox: 14, oy: 9, // the Tesla gun's muzzle
  charge: 0.25, minOn: 0.3, fade: 0.25, // BossLaserBeam: beamStartupDelayDelay 1, disappateTime 0.4
  reach: 400, width: 20, hurtWidth: 10, step: 2, // beamWidth 20, damageBeamWidth 10
  tick: 0.05, damage: 2, blockDamage: 3, knockX: 40, knockY: 15, hitEvery: 3,
  battery: 2.5, recharge: 2, rechargeDelay: 0.35, resume: 0.35, // seconds of beam; to refill; the wait; fires again at
  arcEvery: 0.12, arcRange: 72, arcChain: 1, arcChainRange: 40,
  shakeEvery: 0.1, shake: 0.35, // SortOfFollow.Shake(0.2) every 0.1 s
  fxEvery: 0.06, humEvery: 0.12, ventEvery: 0.15, recoil: 18, gunRate: 0.05,
};

export interface LaserState {
  phase: 'off' | 'charge' | 'on' | 'fade';
  time: number; // in this phase
  on: number; // how long the beam has been on (a tap owes minOn)
  battery: number; // 0-1
  overheated: boolean; // run flat: no beam until it has cooled to `resume`
  rest: number; // since it last fired: the battery waits rechargeDelay
  xs: number; // the bro: the back of what it burns
  x0: number; // the muzzle
  y0: number;
  x1: number; // where the beam ends
  blocked: boolean; // it ends on a block (not at its reach)
  dir: -1 | 1;
  tick: number; // the damage clock (damageRate)
  ticks: number;
  arc: number;
  shake: number;
  fx: number;
  hum: number;
  vent: number;
}

export function makeLaser(): LaserState {
  return {
    phase: 'off', time: 0, on: 0, battery: 1, overheated: false, rest: 0, xs: 0, x0: 0, y0: 0, x1: 0, blocked: false, dir: 1,
    tick: 0, ticks: 0, arc: 0, shake: 0, fx: 0, hum: 0, vent: 0,
  };
}

/** LaserBeam.RunLength: Physics.Raycast along the beam: where it first meets a block, else its full reach. */
export function beamEnd(map: TileMap, x0: number, y0: number, dir: number): { x: number; blocked: boolean } {
  for (let d = 0; d <= LASER.reach; d += LASER.step) {
    if (map.solidAt(x0 + dir * d, y0)) return { x: x0 + dir * d, blocked: true };
  }
  return { x: x0 + dir * LASER.reach, blocked: false };
}

/** Whether a unit is in the beam's way: its box across the burning width, between the bro and the beam's end. */
export function inBeam(l: LaserState, u: Unit): boolean {
  const lo = Math.min(l.xs, l.x1) - UNIT_HALF_WIDTH;
  const hi = Math.max(l.xs, l.x1) + UNIT_HALF_WIDTH;
  return u.x >= lo && u.x <= hi && u.y <= l.y0 + LASER.hurtWidth / 2 && u.y + UNIT_HEIGHT >= l.y0 - LASER.hurtWidth / 2;
}

/**
 * The Tesla gun's trigger (the weapon kit's step): fire starts a charge, the charge lights the beam, and the beam holds
 * while fire is held (at least minOn) and the battery lasts. Out of fire, the battery refills after rechargeDelay; run
 * flat, it overheats and vents until it is back to `resume`. Where the beam runs is worked out every step.
 */
export function stepLaserGun(w: World, p: Unit, fire: boolean, t: number): void {
  const l = (p.laser ??= makeLaser());
  const x = p.x + p.facing * LASER.ox;
  const y = p.y + LASER.oy;
  const stop = (phase: 'stop' | 'overheat') => {
    l.phase = 'fade';
    l.time = 0;
    w.events.push({ type: 'laser', phase, x, y });
  };
  if (l.phase === 'off' || l.phase === 'fade') {
    if (fire && !l.overheated && l.battery > 0) {
      l.phase = 'charge';
      l.time = 0;
      l.on = 0;
      w.events.push({ type: 'laser', phase: 'charge', x, y });
    } else if (l.phase === 'fade' && (l.time += t) >= LASER.fade) {
      l.phase = 'off';
    }
  } else if (l.phase === 'charge') {
    if ((l.time += t) >= LASER.charge) {
      l.phase = 'on';
      l.time = 0;
      l.on = 0;
      l.tick = LASER.tick; // it burns at once
      w.events.push({ type: 'laser', phase: 'on', x, y });
    }
  } else {
    l.time += t;
    l.on += t;
    if ((l.battery -= t / LASER.battery) <= 0) {
      l.battery = 0;
      l.overheated = true;
      stop('overheat');
    } else if (!fire && l.on >= LASER.minOn) {
      stop('stop');
    }
  }
  if (l.phase === 'off' || l.phase === 'fade') {
    if ((l.rest += t) >= LASER.rechargeDelay) l.battery = Math.min(1, l.battery + t / LASER.recharge);
    if (l.overheated && l.battery >= LASER.resume) l.overheated = false;
    if (l.overheated && (l.vent += t) >= LASER.ventEvery) {
      l.vent -= LASER.ventEvery;
      w.events.push({ type: 'jetpack', x, y: y + 2, facing: p.facing }); // it vents: a puff of smoke off the gun
    }
  } else {
    l.rest = 0;
  }
  l.dir = p.facing;
  l.xs = p.x;
  l.x0 = x;
  l.y0 = y;
  const end = beamEnd(w.map, x, y, l.dir);
  l.x1 = end.x;
  l.blocked = end.blocked;
  if (l.phase === 'on') {
    p.gunFrame = 1 + (Math.floor(l.time / LASER.gunRate) % 3); // the muzzle frames, round and round
    p.gunCounter = 0;
  }
}

/**
 * LaserBeam.RunDamage while it burns, every damageRate: the units in its way take 2 and a shove (the dead too, until they
 * come apart), and so do the vehicles and the Goliath; the block at its end, and the one over it, take 3; enemy shots on
 * its line burn up (every step). Every arcEvery a Tesla arc leaps off it to the nearest mook above or below. It shakes
 * the screen, kicks the bro back a little, and throws sparks where it eats into a block.
 */
export function burnLaser(w: World, p: Unit, t: number, blasts: Blast[], hitFoe: (f: Foe, damage: number) => void): void {
  const l = p.laser;
  if (!l || l.phase !== 'on') return;
  const lo = Math.min(l.xs, l.x1);
  const hi = Math.max(l.xs, l.x1);
  for (const pr of w.projectiles) {
    if (pr.team === 'enemy' && !pr.dead && pr.x >= lo && pr.x <= hi && Math.abs(pr.y - l.y0) < LASER.width / 2 + 2) pr.dead = true;
  }
  l.tick += t;
  while (l.tick >= LASER.tick) {
    l.tick -= LASER.tick;
    l.ticks++;
    for (const m of w.enemies) {
      if (m.gibbed || (!m.dead && m.invulnerable > 0) || !inBeam(l, m)) continue;
      damageUnit(m, LASER.damage, false, { dir: l.dir, fire: true });
      knock(m, l.dir * LASER.knockX, LASER.knockY);
      if (l.ticks % LASER.hitEvery === 0 || m.dead) {
        w.events.push({ type: 'hit', x: m.x, y: m.y, hitY: l.y0, xI: l.dir * LASER.knockX, yI: LASER.knockY });
      }
    }
    const foes = new Set<Foe>();
    let mech = false;
    for (let x = l.xs; l.dir > 0 ? x <= l.x1 : x >= l.x1; x += l.dir * 8) {
      const f = foeAt(w.foes, x, l.y0);
      if (f) foes.add(f);
      mech = mech || mechAt(w.mech, x, l.y0);
    }
    for (const f of foes) hitFoe(f, LASER.damage);
    if (mech && w.mech) damageMech(w, w.mech, LASER.damage);
    if (l.blocked) {
      const c = getColumn(l.x1);
      const r = getRow(l.y0);
      for (const rr of [r, r + 1]) {
        const kind = w.map.damage(c, rr, LASER.blockDamage);
        if (kind) w.events.push({ type: 'block', x: c * 16, y: rr * 16, kind, damage: LASER.blockDamage });
        if (kind === 'barrel') blasts.push(barrelBlast(c * 16, rr * 16, w.stats.barrelRange));
      }
    }
  }
  if ((l.arc += t) >= LASER.arcEvery) {
    l.arc -= LASER.arcEvery;
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const m of w.enemies) {
      if (m.dead || m.invulnerable > 0 || m.x < lo || m.x > hi || inBeam(l, m)) continue;
      const d = Math.abs(m.y + UNIT_HEIGHT / 2 - l.y0);
      if (d <= LASER.arcRange && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (best) arcZap(w, best.x, l.y0, best, LASER.arcChain, LASER.arcChainRange, l.dir);
  }
  if ((l.shake += t) >= LASER.shakeEvery) {
    l.shake -= LASER.shakeEvery;
    w.effects.push({ kind: 'shake', x: p.x, y: p.y, age: 0, duration: SHAKE_TIME, strength: LASER.shake });
  }
  if (l.blocked && (l.fx += t) >= LASER.fxEvery) {
    l.fx -= LASER.fxEvery;
    w.events.push({ type: 'laserHit', x: l.x1, y: l.y0, dir: l.dir });
  }
  if ((l.hum += t) >= LASER.humEvery) {
    l.hum -= LASER.humEvery;
    w.events.push({ type: 'laser', phase: 'hum', x: l.x0, y: l.y0 });
  }
  if (p.onGround) p.xIBlast = -l.dir * LASER.recoil;
}
