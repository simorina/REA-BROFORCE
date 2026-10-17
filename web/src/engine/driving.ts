import { screenMaxY, VIEW_W } from './camera';
import {
  JET_BOMB, JET_BOX, JET_ROCKET_COOLDOWN, TANK_CRUSH, TANK_DRIVER_SHIELD, TANK_EJECT_INVULNERABLE, TANK_EXIT_BOOST,
  TANK_EXIT_Y, TANK_EXIT_YI, TANK_GIB_YI, TILE, UNIT_HALF_WIDTH, UNIT_HEIGHT,
} from './constants';
import { barrelBlast, tankBlast, type Blast } from './explosions';
import { NO_FLY, jetDrop, makeJet, stepJetBody, type Jet } from './jet';
import { unitHitsSolid } from './physics';
import { dropJetBomb, fireBigRocket, fireJetRockets, fireShell } from './projectiles';
import { NO_DRIVE, makeTank, pressFire, stepTankBody, stepTurret, switchGun, tankDrop, type Tank } from './tank';
import { damageUnit, inHitBox, knock } from './units';
import type { Controls } from './types';
import { damageVehicle, stepCountdown, vehicleBox, type Vehicle } from './vehicle';
import type { World } from './world';

/** GrenadeAirstrike.SpawnTank: the tank falls in over the flattest ground near the grenade, facing the throw. */
export function callTank(w: World, x: number, y: number, facing: 1 | -1): void {
  const d = tankDrop(w.map, x, y, screenMaxY(w.camera), w.camera.x - VIEW_W / 2);
  w.tanks.push(makeTank(w.nextId++, d.x, d.y, d.fallback ? 1 : facing));
}

/** Every vehicle on the map. */
export const allVehicles = (w: World): Vehicle[] => [...w.tanks, ...w.jets];

const overlaps = (x: number, y: number, v: Vehicle): boolean => {
  const b = vehicleBox(v);
  return Math.abs(x - v.x) < UNIT_HALF_WIDTH + b.halfWidth && y < v.y + b.height && y + UNIT_HEIGHT > v.y;
};

/** Can it be climbed into now? A tank once it has landed; a jet that has landed and still has fuel. */
const boardable = (v: Vehicle): boolean =>
  v.kind === 'tank' ? v.onGround : (v as Jet).state === 'landed' && (v as Jet).fuel > 0;

/** Standing beside it, not under or over it: dropped from a jet in the air he lands below it before it comes down. */
const clearOf = (x: number, v: Vehicle): boolean => Math.abs(x - v.x) >= UNIT_HALF_WIDTH + vehicleBox(v).halfWidth;

/** Unit.PilotUnit: walking into a ready, empty vehicle climbs in (the one just left only after standing clear of it). */
export function boardVehicles(w: World): void {
  const p = w.player;
  if (w.reboard && p.onGround && clearOf(p.x, w.reboard)) w.reboard = null;
  if (w.driving || p.dead) return;
  for (const v of allVehicles(w)) {
    if (v.driven || v.exploded || !boardable(v) || v === w.reboard || !overlaps(p.x, p.y, v)) continue;
    v.driven = true;
    w.driving = v;
    if (v.kind === 'jet') (v as Jet).state = 'flying';
    p.attack = null;
    p.flex = null;
    p.wallClimbing = false;
    w.events.push({ type: v.kind === 'tank' ? 'boardTank' : 'boardJet', x: v.x, y: v.y });
    return;
  }
}

/** MookArmouredGuy.DisChargePilotRPC: the driver leaves the vehicle (where depends on the kind). */
export function exitVehicle(w: World, disChargeYI: number): void {
  const v = w.driving;
  if (!v) return;
  if (v.kind === 'tank') outOfTank(w, v as Tank, disChargeYI);
  else outOfJet(w, v as Jet);
  v.driven = false;
  w.driving = null;
  w.reboard = v;
  w.events.push({ type: v.kind === 'tank' ? 'exitTank' : 'exitJet', x: v.x, y: v.y });
}

/** The tank's hatch: at (X, Y + 32) with yI = disChargeYI + 100, lower under a low ceiling. */
function outOfTank(w: World, k: Tank, disChargeYI: number): void {
  const p = w.player;
  // under a low ceiling he comes out as high as there is room for, without the pop (he'd be pushed up through it)
  let y = k.y + TANK_EXIT_Y;
  while (y > k.y && unitHitsSolid(w.map, k.x, y)) y -= 1;
  p.x = k.x;
  p.y = y;
  p.xI = k.xI;
  p.xIBlast = 0;
  p.yI = y < k.y + TANK_EXIT_Y ? 0 : disChargeYI + TANK_EXIT_BOOST;
  p.onGround = false;
  k.drive = NO_DRIVE;
}

/**
 * Out of the jet: dropping from under it in the air, else beside it (the way it faces, then the other), else on top
 * of it. The first spot free of blocks wins (the map's sides count as walls); its own spot is always free.
 */
function outOfJet(w: World, j: Jet): void {
  const p = w.player;
  const side = JET_BOX.halfWidth + UNIT_HALF_WIDTH + 1;
  const spots: Array<[number, number]> = [
    ...(j.onGround ? [] : [[j.x, j.y - UNIT_HEIGHT] as [number, number]]),
    [j.x + j.facing * side, j.y],
    [j.x - j.facing * side, j.y],
    [j.x, j.y + JET_BOX.height],
  ];
  const [x, y] = spots.find(([sx, sy]) => !unitHitsSolid(w.map, sx, sy)) ?? [j.x, j.y];
  p.x = x;
  p.y = y;
  p.xI = j.xI;
  p.xIBlast = 0;
  p.yI = 0;
  p.onGround = false;
  j.drive = NO_FLY;
}

/** The driver's controls go to whatever he is in. */
export function driveVehicle(w: World, controls: Controls, prev: Controls): void {
  const v = w.driving;
  if (v && v.kind === 'tank') driveTank(w, v as Tank, controls, prev);
  else if (v && v.kind === 'jet') driveJet(w, v as Jet, controls, prev);
}

/** The pilot: arrows fly, X fires rockets (held, every 0.4 s), C drops a bomb, the gesture jumps out. */
function driveJet(w: World, j: Jet, controls: Controls, prev: Controls): void {
  j.drive = {
    dx: controls.left === controls.right ? 0 : controls.left ? -1 : 1,
    dy: controls.up === controls.down ? 0 : controls.up ? 1 : -1,
  };
  if (controls.fire && j.rocketCooldown <= 0) {
    w.projectiles.push(...fireJetRockets(() => w.nextId++, j, w.stats, w.rng));
    j.rocketCooldown = JET_ROCKET_COOLDOWN;
    w.events.push({ type: 'shot', weapon: 'bomb', x: j.x, y: j.y, facing: j.facing });
  }
  if (controls.special && !prev.special && j.bombCooldown <= 0) {
    w.projectiles.push(dropJetBomb(w.nextId++, j, w.stats));
    j.bombCooldown = JET_BOMB.cooldown;
    w.events.push({ type: 'shot', weapon: 'jetBomb', x: j.x, y: j.y, facing: j.facing });
  }
  if (controls.gesture && !prev.gesture) exitVehicle(w, 0);
}

/** The driver's controls: arrows drive, jump jumps, and the gesture climbs out (PressHighFiveMelee). */
function driveTank(w: World, k: Tank, controls: Controls, prev: Controls): void {
  k.drive = { dir: controls.left === controls.right ? 0 : controls.left ? -1 : 1, jump: controls.jump && !prev.jump };
  if (controls.fire && !prev.fire) pressFire(k.turret); // TankBroTank.StartFiring -> turret.FireWeapon
  if (controls.special && !prev.special) {
    switchGun(k.turret); // TankBroTank.PressSpecial
    w.events.push({ type: 'gunSwitch', x: k.x, y: k.y });
  }
  if (controls.gesture && !prev.gesture) exitVehicle(w, TANK_EXIT_YI);
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

/** Every tank: its body and its crush, its turret, its death countdown, and falling off the map. */
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
      gibVehicle(w, k, blasts);
    } else if (k.y < -64) {
      if (k.driven) exitVehicle(w, 0); // fell off the map: the driver drops out, the tank is gone
      k.exploded = true;
    }
  }
  w.tanks = w.tanks.filter((x) => !x.exploded);
}

/** Trump's signal grenade: the jet appears above the screen over it and comes down. */
export function callJet(w: World, x: number): void {
  const d = jetDrop(w.map, x, screenMaxY(w.camera));
  w.jets.push(makeJet(w.nextId++, d.x, d.y, 1));
}

/** Every jet: cooldowns, its body, the fuel running out, the countdown, and leaving the map. */
export function stepJets(w: World, t: number, blasts: Blast[]): void {
  const top = screenMaxY(w.camera);
  for (const j of w.jets) {
    if (j.exploded) continue;
    j.rocketCooldown = Math.max(0, j.rocketCooldown - t);
    j.bombCooldown = Math.max(0, j.bombCooldown - t);
    if (j.driven && j.state === 'flying' && j.fuel <= 0) j.state = 'descending'; // dry: it comes down
    stepJetBody(j, j.driven ? j.drive : NO_FLY, w.map, t, top);
    if (j.driven && j.state === 'landed' && j.fuel <= 0) exitVehicle(w, 0); // and puts him out beside it
    if (!j.driven && j.state === 'landed' && j.fuel <= 0) j.state = 'leaving';
    if (stepCountdown(j, w.stats.tank, t)) {
      gibVehicle(w, j, blasts);
    } else if (j.y < -64) {
      if (j.driven) exitVehicle(w, 0); // sank into a pit: the pilot drops out, the jet is gone
      j.exploded = true;
    }
  }
  w.jets = w.jets.filter((j) => !j.exploded);
}

/** The driver is carried along, hidden and shielded. */
export function carryDriver(w: World): void {
  const v = w.driving;
  if (!v) return;
  const p = w.player;
  p.x = v.x;
  p.y = v.y;
  p.xI = v.xI;
  p.yI = v.yI;
  p.facing = v.facing;
  p.onGround = v.onGround;
  p.invulnerable = Math.max(p.invulnerable, TANK_DRIVER_SHIELD);
}

/** MookArmouredGuy.Gib: the driver is thrown clear, then the vehicle blows up. */
export function gibVehicle(w: World, v: Vehicle, blasts: Blast[]): void {
  if (v.exploded) return;
  const massive = v.countdown >= 0; // deathCount > 9000: the countdown's massive blast
  if (v.driven) {
    exitVehicle(w, TANK_GIB_YI);
    w.player.invulnerable = Math.max(w.player.invulnerable, TANK_EJECT_INVULNERABLE);
    w.reboard = null;
  }
  v.exploded = true;
  blasts.push(tankBlast(v.x, v.y, massive));
}

/** A hit on a vehicle: past its limit an empty one gibs at once, a driven one counts down (damageVehicle). */
export function hitVehicle(w: World, v: Vehicle, damage: number, blasts: Blast[]): void {
  if (!v.exploded && damageVehicle(v, damage, w.stats.tank)) gibVehicle(w, v, blasts);
}

export const hitTank = hitVehicle; // the tank's tests know it by this name
