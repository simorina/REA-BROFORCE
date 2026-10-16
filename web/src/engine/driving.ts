import { screenMaxY, VIEW_W } from './camera';
import {
  TANK_BOX, TANK_CRUSH, TANK_DRIVER_SHIELD, TANK_EJECT_INVULNERABLE, TANK_EXIT_BOOST, TANK_EXIT_Y, TANK_EXIT_YI, TANK_GIB_YI,
  TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, tankBlast, type Blast } from './explosions';
import { fireBigRocket, fireShell } from './projectiles';
import {
  NO_DRIVE, damageTank, makeTank, pressFire, stepCountdown, stepTankBody, stepTurret, switchGun, tankDrop, type Tank,
} from './tank';
import { damageUnit, inHitBox, knock } from './units';
import type { Controls } from './types';
import type { World } from './world';

/** GrenadeAirstrike.SpawnTank: the tank falls in over the flattest ground near the grenade, facing the throw. */
export function callTank(w: World, x: number, y: number, facing: 1 | -1): void {
  const d = tankDrop(w.map, x, y, screenMaxY(w.camera), w.camera.x - VIEW_W / 2);
  w.tanks.push(makeTank(w.nextId++, d.x, d.y, d.fallback ? 1 : facing));
}

const overlaps = (x: number, y: number, k: Tank): boolean =>
  Math.abs(x - k.x) < UNIT_HALF_WIDTH + TANK_BOX.halfWidth && y < k.y + TANK_BOX.height && y + UNIT_HEIGHT > k.y;

/** Unit.PilotUnit: walking into a landed, empty tank climbs in (the one just left only after standing clear of it). */
export function boardTanks(w: World): void {
  const p = w.player;
  if (w.reboard && p.onGround && !overlaps(p.x, p.y, w.reboard)) w.reboard = null;
  if (w.driving || p.dead) return;
  for (const k of w.tanks) {
    if (k.driven || k.exploded || !k.onGround || k === w.reboard || !overlaps(p.x, p.y, k)) continue;
    k.driven = true;
    w.driving = k;
    p.attack = null;
    p.flex = null;
    p.wallClimbing = false;
    w.events.push({ type: 'boardTank', x: k.x, y: k.y });
    return;
  }
}

/** MookArmouredGuy.DisChargePilotRPC: the driver pops out of the hatch at (X, Y + 32) with yI = disChargeYI + 100. */
export function exitTank(w: World, disChargeYI: number): void {
  const k = w.driving;
  if (!k) return;
  const p = w.player;
  p.x = k.x;
  p.y = k.y + TANK_EXIT_Y;
  p.xI = k.xI;
  p.xIBlast = 0;
  p.yI = disChargeYI + TANK_EXIT_BOOST;
  p.onGround = false;
  k.driven = false;
  k.drive = NO_DRIVE;
  w.driving = null;
  w.reboard = k;
  w.events.push({ type: 'exitTank', x: k.x, y: k.y });
}

/** The driver's controls: arrows drive, jump jumps, and the gesture climbs out (PressHighFiveMelee). */
export function driveTank(w: World, controls: Controls, prev: Controls): void {
  const k = w.driving;
  if (!k) return;
  k.drive = { dir: controls.left === controls.right ? 0 : controls.left ? -1 : 1, jump: controls.jump && !prev.jump };
  if (controls.fire && !prev.fire) pressFire(k.turret); // TankBroTank.StartFiring -> turret.FireWeapon
  if (controls.special && !prev.special) {
    switchGun(k.turret); // TankBroTank.PressSpecial
    w.events.push({ type: 'gunSwitch', x: k.x, y: k.y });
  }
  if (controls.gesture && !prev.gesture) exitTank(w, TANK_EXIT_YI);
}

/** TankBroTank.CrushGroundWhileMoving(4, 5, 10, 8): the units and the block just ahead of the treads. */
function crushAhead(w: World, k: Tank, blasts: Blast[]): void {
  const ux = k.x + k.facing * TANK_CRUSH.offset;
  for (const m of w.enemies) {
    if (m.dead || m.invulnerable > 0 || !inHitBox(m, ux, k.y + 2, TANK_CRUSH.unitsRange)) continue;
    knock(m, k.xI, 40); // Map.HitLivingUnits(..., xI, 40, ...)
    damageUnit(m, TANK_CRUSH.units);
  }
  const gx = k.x + k.facing * (TANK_CRUSH.offset + 2);
  for (const [gy, damage] of [[k.y + 21, TANK_CRUSH.top], [k.y + 12, TANK_CRUSH.ground]] as const) {
    for (const [c, r] of w.map.cellsInCircle(gx, gy, TANK_CRUSH.groundRange / 2)) {
      const kind = w.map.damage(c, r, damage);
      if (kind) w.events.push({ type: 'block', x: c * TILE, y: r * TILE, kind, damage });
      if (kind === 'barrel') blasts.push(barrelBlast(c * TILE, r * TILE, w.stats.barrelRange));
    }
  }
}

/** Every tank: its body and its crush, then the driver is carried along, hidden and shielded. */
export function stepTanks(w: World, t: number, blasts: Blast[]): void {
  for (const k of w.tanks) {
    if (k.exploded) continue;
    const crushes = stepTankBody(k, k.driven ? k.drive : NO_DRIVE, w.map, w.stats.tank, t);
    for (let i = 0; i < crushes; i++) crushAhead(w, k, blasts);
    const shot = stepTurret(k.turret, t);
    if (shot === 'shell') {
      w.projectiles.push(fireShell(w.nextId++, k, w.stats));
      w.events.push({ type: 'shot', weapon: 'shell', x: k.x, y: k.y, facing: k.facing });
    } else if (shot === 'cannon') {
      w.projectiles.push(fireBigRocket(w.nextId++, k, w.stats));
      w.events.push({ type: 'shot', weapon: 'bigRocket', x: k.x, y: k.y, facing: k.facing });
    }
    if (stepCountdown(k, w.stats.tank, t)) {
      gibTank(w, k, blasts);
    } else if (k.y < -64) {
      if (k.driven) exitTank(w, 0); // fell off the map: the driver drops out, the tank is gone
      k.exploded = true;
    }
  }
  const k = w.driving;
  if (k) {
    const p = w.player;
    p.x = k.x;
    p.y = k.y;
    p.xI = k.xI;
    p.yI = k.yI;
    p.facing = k.facing;
    p.onGround = k.onGround;
    p.invulnerable = Math.max(p.invulnerable, TANK_DRIVER_SHIELD);
  }
  w.tanks = w.tanks.filter((x) => !x.exploded);
}

/** MookArmouredGuy.Gib: the driver is thrown clear, then the tank blows up. */
export function gibTank(w: World, k: Tank, blasts: Blast[]): void {
  if (k.exploded) return;
  const massive = k.countdown >= 0; // deathCount > 9000: the countdown's massive blast
  if (k.driven) {
    exitTank(w, TANK_GIB_YI);
    w.player.invulnerable = Math.max(w.player.invulnerable, TANK_EJECT_INVULNERABLE);
    w.reboard = null;
  }
  k.exploded = true;
  blasts.push(tankBlast(k.x, k.y, massive));
}

/** A hit on a tank: past its limit an empty one gibs at once, a driven one counts down (damageTank). */
export function hitTank(w: World, k: Tank, damage: number, blasts: Blast[]): void {
  if (!k.exploded && damageTank(k, damage, w.stats.tank)) gibTank(w, k, blasts);
}
