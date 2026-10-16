import type { SpecialId, WeaponId } from './bro';
import { startJudo } from './judo';
import { RIFLE } from './constants';
import { fireRifleBullet, kickFootball, throwJetMarker, throwMarker, throwTankMarker } from './projectiles';
import type { Projectile, Unit } from './types';
import { runFiring } from './units';
import type { World } from './world';

/** A bro's weapon: what pressing fire does, and whether holding fire keeps firing at the fireRate. */
export interface WeaponKit {
  repeat: boolean;
  fire(w: World, p: Unit): void;
  step?(w: World, p: Unit, fire: boolean, t: number): void; // when present it runs the weapon each step instead of repeat/fire
}

/** BroniversalSoldier.FireWeapon: one bullet, and the muzzle frames. */
function shootRifle(w: World, p: Unit): void {
  w.projectiles.push(fireRifleBullet(w.nextId++, p, w.stats, w.rng));
  p.gunFrame = 3;
  p.gunCounter = 0;
  w.events.push({ type: 'shot', weapon: 'rifle', x: p.x, y: p.y, facing: p.facing });
}

/** BroniversalSoldier.UseFire: the first shot of a burst, two more to come, and extraFireDelay before the next. */
function rifleBurst(w: World, p: Unit): void {
  shootRifle(w, p);
  p.burstLeft = RIFLE.burst;
  p.burstCounter = 0;
  p.fireDelay = w.stats.rifle.extraFireDelay;
}

export const WEAPON_KITS: Record<WeaponId, WeaponKit> = {
  football: {
    repeat: true,
    fire(w, p) {
      w.projectiles.push(kickFootball(w.nextId++, p));
      w.events.push({ type: 'shot', weapon: 'football', x: p.x, y: p.y, facing: p.facing });
    },
  },
  judo: {
    repeat: false,
    fire(w, p) {
      startJudo(p);
      w.events.push({ type: 'shot', weapon: 'judo', x: p.x, y: p.y, facing: p.facing });
    },
  },
  rifle: {
    repeat: true,
    fire: rifleBurst,
    step(w, p, fire, t) {
      if (runFiring(p, fire, t)) rifleBurst(w, p); // TestVanDammeAnim.StartFiring / RunFiring
      if (p.burstLeft > 0) {
        p.burstCounter += t; // BroniversalSoldier.Update
        if (p.burstCounter >= RIFLE.burstGap) {
          p.burstLeft--;
          p.burstCounter -= RIFLE.burstGap;
          shootRifle(w, p);
        }
      }
    },
  },
};

/** A bro's special: what BroBase.UseSpecial throws. Ammo, the speech bubble and the voice are the same for all. */
export const SPECIAL_KITS: Record<SpecialId, (id: number, p: Unit, ducking: boolean) => Projectile> = {
  airstrike: throwMarker,
  tank: throwTankMarker,
  jet: throwJetMarker,
};
