import type { SpecialId, WeaponId } from './bro';
import { startJudo } from './judo';
import { CRICKET, REVOLVER, RIFLE } from './constants';
import { getColumn, getRow } from './map';
import {
  fireM60Bullet, fireNoisyCricket, fireRevolverBullet, fireRifleBullet, fireRpgRocket, throwMolotov, kickFootball, throwGlaive,
  throwJetMarker, throwMarker, throwNukeMarker, throwTankMarker, useNeuraliser,
} from './projectiles';
import type { Projectile, Unit } from './types';
import { damageUnit, knock, runFiring } from './units';
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

/** Brononymous.UseFire / FireWeapon: the Noisy Cricket's shot; it kicks him up and back, and fireDelay holds the next. */
function fireCricket(w: World, p: Unit): void {
  w.projectiles.push(fireNoisyCricket(w.nextId++, p, w.stats));
  p.fireDelay = CRICKET.fireDelay;
  p.gunFrame = 3;
  p.gunCounter = 0;
  p.yI += CRICKET.kickY;
  p.xIBlast = -p.facing * CRICKET.kickX;
  w.events.push({ type: 'shot', weapon: 'cricket', x: p.x, y: p.y, facing: p.facing });
}

/** Rambro.FireWeapon: one M60 bullet and the muzzle frames. */
function shootM60(w: World, p: Unit): void {
  w.projectiles.push(fireM60Bullet(w.nextId++, p, w.stats, w.rng));
  p.gunFrame = 3;
  p.gunCounter = 0;
  w.events.push({ type: 'shot', weapon: 'm60', x: p.x, y: p.y, facing: p.facing });
}

/** Blade's signature katana slash: slices blocks and enemies, and deflects enemy bullets. */
function slashBlade(w: World, p: Unit): void {
  p.xI += p.facing * 90;
  p.gunFrame = 6; // Blade.UseFire: the katana's slash runs down its gun frames 6 to 0 (runGun)
  p.gunCounter = 0;
  w.map.damage(getColumn(p.x + p.facing * 14), getRow(p.y + 6), 10);
  for (const m of w.enemies) {
    if (m.dead) continue;
    if (Math.abs(m.y - p.y) < 18 && Math.sign(m.x - p.x) === p.facing && Math.abs(m.x - p.x) < 32) {
      damageUnit(m, 30);
      knock(m, p.facing * 220, 160);
      w.events.push({ type: 'hit', x: m.x, y: m.y, hitY: m.y, xI: p.facing * 220, yI: 160 });
    }
  }
  for (const proj of w.projectiles) {
    if (proj.team === 'enemy' && Math.abs(proj.x - p.x) < 32 && Math.abs(proj.y - (p.y + 8)) < 24) {
      proj.team = 'player';
      proj.xI = p.facing * Math.abs(proj.xI || 250);
      proj.yI = -proj.yI;
    }
  }
  w.events.push({ type: 'shot', weapon: 'blade', x: p.x, y: p.y, facing: p.facing });
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
  m60: {
    repeat: true,
    fire: shootM60,
    step(w, p, fire, t) {
      if (runFiring(p, fire, t)) shootM60(w, p); // TestVanDammeAnim.StartFiring / RunFiring at Rambro's fireRate
    },
  },
  cricket: {
    repeat: true,
    fire: fireCricket,
    step(w, p, fire, t) {
      if (runFiring(p, fire, t)) fireCricket(w, p); // TestVanDammeAnim.StartFiring / RunFiring
    },
  },
  blade: {
    repeat: false,
    fire: slashBlade,
  },
  rpg: {
    repeat: true,
    fire(w, p) {
      w.projectiles.push(fireRpgRocket(w.nextId++, p, w.stats));
      p.gunFrame = 3;
      p.gunCounter = 0;
      w.events.push({ type: 'shot', weapon: 'rocket', x: p.x, y: p.y, facing: p.facing });
    },
  },
};

/** DirtyHarry.UseFire / FireWeapon: Django's .44; the sixth shot starts the reload and holds the next for 0.86 s. */
function fireRevolver(w: World, p: Unit): void {
  const d = w.django;
  if (!d) return;
  w.projectiles.push(fireRevolverBullet(w.nextId++, p, w.stats, w.rng));
  p.fireDelay = REVOLVER.fireDelay;
  p.gunFrame = 3;
  p.gunCounter = 0;
  w.events.push({ type: 'shot', weapon: 'revolver', x: p.x, y: p.y, facing: p.facing });
  if (++d.shots >= REVOLVER.shots) {
    d.shots = 0;
    d.reload = REVOLVER.reload;
    p.fireDelay = REVOLVER.reloadFire;
  }
}

/** Samuel as Django: Dirty Brorry's revolver, six shots and a reload with the cylinder open (DirtyHarry.Update). */
export const REVOLVER_KIT: WeaponKit = {
  repeat: true,
  fire: fireRevolver,
  step(w, p, fire, t) {
    const d = w.django;
    if (d && d.reload > 0) {
      d.reload -= t;
      if (d.reload <= REVOLVER.open && d.reload > REVOLVER.close) {
        p.gunFrame = REVOLVER.openFrame;
        p.gunCounter = 0;
      } else if (d.reload <= REVOLVER.close && p.gunFrame === REVOLVER.openFrame) {
        p.gunFrame = 0;
      }
    }
    if (runFiring(p, fire, t, REVOLVER.fireRate)) fireRevolver(w, p); // TestVanDammeAnim.StartFiring / RunFiring
  },
};

/** A bro's special: what BroBase.UseSpecial throws (nothing for Django: the world turns him). */
export const SPECIAL_KITS: Record<SpecialId, (id: number, p: Unit, ducking: boolean) => Projectile | null> = {
  airstrike: throwMarker,
  tank: throwTankMarker,
  jet: throwJetMarker,
  neuralyzer: useNeuraliser,
  glaive: throwGlaive,
  nuke: throwNukeMarker,
  django: () => null,
  molotov: throwMolotov,
};
