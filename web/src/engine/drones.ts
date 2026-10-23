import type { Blast } from './explosions';
import type { Projectile, Unit } from './types';
import { damageUnit, makeUnit, runFiring, runGun } from './units';
import type { World } from './world';

/**
 * Elon Musk's special: Broforce's "Drone Machinegun" (Drone, a TestVanDammeAnim led by its reviveSource). It flies after
 * the bro (xOffset -14 behind him, yOffset 14 up, a quarter of that while he ducks), fires when he fires and dies to a
 * single hit; dead, it falls on RunDeadGravity's 660 and blows up once it has been down 0.8 s (Drone.Gib). Ours: up to
 * three at once, each a little further back and up (Broforce gives a bro one).
 */
export const DRONE = {
  slots: [[-14, 14], [-26, 24], [-4, 28]] as ReadonlyArray<readonly [number, number]>, max: 3, duckM: 0.27,
  spawnY: 3, // SpawnDrone_Networked at (X, Y + 3)
  muzzleX: 6, muzzleY: 8, bulletSpeed: 400, jitter: 20, // Drone.UseFire: (X + dir*6, Y + 8) at dir*400, Random.Range(-20, 20)
  fall: 660, gibDelay: 0.8, // RunDeadGravity, Update
  // Drone.Gib: DamageGround(16, 24), ExplodeUnits(5, 32, 22.4, 160, 200)
  blast: { groundDamage: 16, groundRange: 24, unitDamage: 5, unitRange: 32, killRange: 22.4, force: 160, extraY: 200 },
};

/** CalculateMovement's speed for a gap: 2.5, 1.5 or 1 times its speed past 13, 8 and 5 (15, 10, 5 and 3 times up and down), else the gap a second. */
function chase(gap: number, speed: number, far: number, mid: number, farM: number): number {
  const a = Math.abs(gap);
  if (a > far) return Math.sign(gap) * speed * farM;
  if (a > mid) return Math.sign(gap) * speed * 1.5;
  if (a > 5) return Math.sign(gap) * speed;
  return gap;
}

export const liveDrones = (w: World): number => w.drones.filter((d) => !d.dead).length;

/** BroBase.SpawnDrone: a new drone at the bro, if he has fewer than three. */
export function spawnDrone(w: World): boolean {
  if (liveDrones(w) >= DRONE.max) return false;
  const p = w.player;
  const s = w.stats.drone;
  const d = makeUnit(w.nextId++, 'drone', 'player', p.x, p.y + DRONE.spawnY, {
    ...w.stats.bros.bro_base, speed: s.speed, health: s.health, fireRate: s.fireRate, canWallClimb: false, canDash: false,
  });
  d.facing = p.facing;
  w.drones.push(d);
  return true;
}

function droneBullet(w: World, d: Unit): Projectile {
  return {
    id: w.nextId++, kind: 'rifle', team: 'player', x: d.x + d.facing * DRONE.muzzleX, y: d.y + DRONE.muzzleY,
    xI: d.facing * DRONE.bulletSpeed, yI: -DRONE.jitter + w.rng() * DRONE.jitter * 2, life: w.stats.rifle.life, bounces: 0, dead: false,
  };
}

/** Every drone: following and firing with the bro, or falling and going up. The bro's death takes them. */
export function stepDrones(w: World, fire: boolean, t: number, blasts: Blast[]): void {
  const p = w.player;
  let slot = 0;
  for (const d of w.drones) {
    d.animTime += t;
    if (!d.dead && p.dead) damageUnit(d, d.health, true);
    if (d.dead) {
      d.deadTime += t;
      d.yI -= DRONE.fall * t;
      const nx = d.x + d.xI * t;
      const ny = d.y + d.yI * t;
      d.onGround = w.map.solidAt(nx, ny);
      if (d.onGround) {
        d.xI = 0;
        d.yI = 0;
      } else {
        d.x = nx;
        d.y = ny;
      }
      if ((d.onGround && d.deadTime > DRONE.gibDelay) || d.y < -64 || d.gibbed) {
        d.gibbed = true;
        blasts.push({ x: d.x, y: d.y, ...DRONE.blast, team: 'player', big: true, noise: 80, source: 'rocket', doodadDamage: 0, doodadRange: 0 });
      }
      continue;
    }
    const [ox, oy] = DRONE.slots[Math.min(slot++, DRONE.slots.length - 1)];
    const tx = p.x + p.facing * ox;
    const ty = p.y + (p.ducking ? oy * DRONE.duckM : oy);
    const speed = d.stats.speed;
    d.xI = chase(tx - d.x, speed, 13, 8, 2.5);
    d.yI = chase(ty - d.y, speed, 15, 10, 3);
    d.x += d.xI * t;
    d.y += d.yI * t;
    d.facing = p.facing; // CheckFacingDirection: its reviveSource's
    if (runFiring(d, fire && !p.dead, t)) {
      w.projectiles.push(droneBullet(w, d));
      d.gunFrame = 3;
      d.gunCounter = 0;
      w.events.push({ type: 'shot', weapon: 'rifle', x: d.x, y: d.y, facing: d.facing });
    }
    runGun(d, t);
  }
  w.drones = w.drones.filter((d) => !d.gibbed);
}
