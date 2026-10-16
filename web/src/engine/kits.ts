import type { SpecialId, WeaponId } from './bro';
import { kickFootball, throwMarker } from './projectiles';
import type { Projectile, Unit } from './types';
import type { World } from './world';

/** A bro's weapon: what pressing fire does, and whether holding fire keeps firing at the fireRate. */
export interface WeaponKit {
  repeat: boolean;
  fire(w: World, p: Unit): void;
}

export const WEAPON_KITS: Record<WeaponId, WeaponKit> = {
  football: {
    repeat: true,
    fire(w, p) {
      w.projectiles.push(kickFootball(w.nextId++, p));
      w.events.push({ type: 'shot', weapon: 'football', x: p.x, y: p.y, facing: p.facing });
    },
  },
};

/** A bro's special: what BroBase.UseSpecial throws. Ammo, the speech bubble and the voice are the same for all. */
export const SPECIAL_KITS: Record<SpecialId, (id: number, p: Unit, ducking: boolean) => Projectile> = {
  airstrike: throwMarker,
};
