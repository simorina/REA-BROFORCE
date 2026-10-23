import {
  attract, blind, followPath, fullyAlert, hearSound, panic, panicAi, playerDied, SCOUT_SHOUT, stopPanicking, thinkMook,
  type AlertScene, type DoorPoint,
} from './ai';
import type { BroDef } from './bro';
import { followCamera, isVisible, screenMaxY, type Camera } from './camera';
import {
  ALARM, ALERT_TOUCH, BAZOOKA_FIRE_DELAY, FLAME_WALL_SHAKE, JETPACK, SHAKE_TIME, CHECKPOINT_FAST_SPEED, CHECKPOINT_RANGE_X, CHECKPOINT_RANGE_X_FAST,
  CHECKPOINT_RANGE_Y, CHECKPOINT_SPAWN_UP, CHECKPOINT_Y_OFFSET, CORPSE_TIME, EXPLOSION_DURATION, EXTRACTION_TIME,
  FLAG_REACH, GRENADE_PANIC_RANGE, GRENADE_PANIC_RATE, GRENADE_PANIC_TIME, GRENADE_WARNING_LIFE, HALF_TILE,
  LIVES_START, PRISONER_RESCUE_DIST, RESCUE_INVULNERABLE, RESPAWN_DELAY, SPAWN_INVULNERABLE, SPECIAL2_TIME,
  SPEECH_DURATION, TILE, UNIT_BOX_HEIGHT, UNIT_WIDTH, BAZOOKA_RECOIL, DOOR_EXIT_INVULNERABLE, DOOR_FIRE_DAMAGE, SCOUT_WAVE_TIME,
  BOMB_FIRE_RANGE_M, SUICIDE_BURN_EXTRA, ALLURE_RANGE, FLEX_EVENT_FRAMES, FLEX_FRAME_RATE, FLEX_FRAMES, FLEX_HOLD,
  FLEX_RESTART_FRAME, FLEX_SLOW_FRAMES, FLEX_SLOW_RATE, TANK_EXIT_YI, MECH, DOG, DOG_BITE_COOLDOWN, GRENADIER_THROW_DELAY, CRICKET,
  NEURALISER, DJANGO, MOLOTOV, MORTAR, ELITE, FOE, ALIEN, BOOMER, BOOMER_SPAWNS, HELL_BIGGUY, SATAN, SKINLESS, SOULCATCHER_SPAWNS,
  UNDEAD_SUICIDE, WARLOCK,
} from './constants';
import { alarmDoor, collapseDoor, doorLostSupport, makeDoor, stepDoor, type DoorSpawn, type MookDoor } from './doors';
import { applyBlast, barrelBlast, suicideBlast, type Blast } from './explosions';
import { parseLevel, type LevelData } from './level';
import { makeBlock, type TileMap } from './map';
import { hearAlien, isAlien, makeAlienState, stepAlien } from './aliens';
import { makeDolphState, stepDolph } from './dolph';
import { DRONE, liveDrones, spawnDrones, stepDrones } from './drones';
import { blastOff, makeRocketpack, stepRocketpack } from './rocketpack';
import { burnLaser } from './laser';
import { stepZaps, type Zap } from './tesla';
import {
  boomerBlast, findPortalSpot, isBoomer, isDog, isHell, isHellBigGuy, isSuicide, makeHellState, stepBoomerDeath, stepUndeadCorpse,
  type HellState, type Portal,
} from './hell';
import { damageFoe, foeBlast, foeInBlast, makeFoe, nukeBlasts, stepFoe, type Foe } from './foes';
import { mineBlast, plantMine, steppedOn, type Mine, type MineSign } from './mines';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import {
  dropGrenade, fireBazookaRocket, fireDrunkRocket, fireLaunch, fireMinigunBullet, fireMookBullet, makeFlameWall, makeVomit, molotovFlames, skyRocket,
  spawnAirstrike, stepProjectile, throwGrenade,
} from './projectiles';
import {
  allVehicles, boardVehicles, callJet, callTank, carryDriver, driveVehicle, exitVehicle, hitVehicle, stepJets, stepTanks,
} from './driving';
import { stepJudo } from './judo';
import { REVOLVER_KIT, SPECIAL_KITS, WEAPON_KITS } from './kits';
import { damageUnit, inHitBox, makeUnit, runFiring, runGun } from './units';
import { bossDown, levelBossAlive, makeBoss, stepBoss } from './boss';
import { damageMech, makeMech, mechInBlast, stepMech, type Mech } from './mech';
import type { Jet } from './jet';
import type { Tank } from './tank';
import { vehicleInBlast, type Vehicle } from './vehicle';
import type { BlockKind, Controls, EnemyKind, GameStats, Projectile, ProjectileKind, Team, Unit, UnitKind } from './types';

/** Something the renderer times: a screen shake (SortOfFollow.Shake) or the bro's speech bubble. */
export interface Effect {
  kind: 'shake' | 'speech';
  x: number;
  y: number;
  age: number;
  duration: number;
  strength?: number; // a shake's, of a big blast's (1 when not given)
  text?: string;
  unit?: number; // the speaker a speech bubble hangs over (the bro's own lines name none)
}

/** Where a speech bubble hangs: over the unit (or the Goliath) it names, or over the bro. */
export function speaker(w: World, e: Effect): { x: number; y: number } | null {
  if (e.unit === undefined) return w.player;
  if (w.mech && w.mech.id === e.unit) return { x: w.mech.x, y: w.mech.y + MECH.box.height - 30 };
  return w.enemies.find((m) => m.id === e.unit) ?? null;
}

export interface Prisoner {
  x: number;
  y: number;
  freed: boolean;
}

/** A CheckPoint flagpole: its flag goes up the first time the bro reaches it, and he respawns there. */
export interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
  raisedAt: number;
}

/** DoodadGrass: a tuft of long grass mooks hide in (Map.IsInSubstance), destroyed by blasts. */
export interface Grass {
  x: number; // centre
  y: number;
  health: number;
  destroyed: boolean;
}

/** What happened during a step, for sound, particles and the voice line. Positions are world units. */
export type GameEvent =
  | { type: 'voice'; text: string; lang: string }
  | { type: 'shot'; weapon: ProjectileKind | 'judo' | 'blade' | 'cricket' | 'revolver' | 'm60' | 'flamethrower'; x: number; y: number; facing: 1 | -1 }
  | { type: 'explosion'; x: number; y: number; big: boolean; source: Blast['source']; range: number }
  | { type: 'airstrike'; x: number; y: number } // GrenadeAirstrike.Death: the marker calls the strike in
  | { type: 'block'; x: number; y: number; kind: BlockKind; damage: number }
  | { type: 'hit'; x: number; y: number; hitY: number; xI: number; yI: number }
  | { type: 'death'; x: number; y: number; xI: number; yI: number }
  | { type: 'kill'; x: number; y: number; kind: Exclude<UnitKind, 'bro'>; xI: number; yI: number }
  | { type: 'gib'; x: number; y: number; team: Team; kind: UnitKind; xI: number; yI: number }
  | { type: 'alert'; x: number; y: number }
  | { type: 'rescue'; x: number; y: number }
  | { type: 'checkpoint'; x: number; y: number }
  | { type: 'respawn'; x: number; y: number }
  | { type: 'flame'; x: number; y: number } // Mook.flames while it burns
  | { type: 'wave'; x: number; y: number } // ScoutMook.FireWeapon: a wave and a whistle instead of a shot
  | { type: 'doorCollapse'; x: number; y: number } // MookDoor.Collapse
  | { type: 'doorBlast'; x: number; y: number } // MookDoor.DestroyDoor with explodeAtEnd
  | { type: 'flex'; x: number; y: number } // TestVanDammeAnim.PlayFlexSound / TriggerFlexEvent
  | { type: 'boardTank'; x: number; y: number }
  | { type: 'exitTank'; x: number; y: number }
  | { type: 'boardJet'; x: number; y: number }
  | { type: 'bossCall'; x: number; y: number } // Epstein waves his guards in
  | { type: 'bossDown'; x: number; y: number }
  | { type: 'bossFled'; x: number; y: number } // into the smoke, to his Goliath
  | { type: 'shieldHit'; x: number; y: number } // a shot stopped by a riot shield
  | { type: 'shieldOff'; x: number; y: number; xI: number } // and the shield knocked away
  | { type: 'bite'; x: number; y: number }
  | { type: 'cricketBeam'; x: number; y: number } // the Noisy Cricket's trail
  | { type: 'django'; x: number; y: number } // Samuel becomes Django
  | { type: 'molotovBurst'; x: number; y: number } // Che's Molotov goes up
  | { type: 'flameWallPuff'; x: number; y: number; variant: number; delay: number; dir: 1 | -1; xI: number; hell?: boolean } // a cell of the wall catching fire (an enemy's: hell flames)
  | { type: 'exitJet'; x: number; y: number }
  | { type: 'gunSwitch'; x: number; y: number }
  | { type: 'jetpack'; x: number; y: number; facing: 1 | -1 } // a jetpack's thrust
  | { type: 'alarmWarning'; x: number; y: number } // the alarmist's dead man's switch, counting down
  | { type: 'siren'; x: number; y: number } // an alarm going off
  | { type: 'mineArmed'; x: number; y: number } // a mine stepped on: its click
  | { type: 'zapHit'; x: number; y: number; unit: boolean } // a Tesla arc strikes (a mook, or a wall or the air)
  | { type: 'laser'; phase: 'charge' | 'on' | 'hum' | 'stop' | 'overheat'; x: number; y: number } // the Tesla laser's sounds
  | { type: 'laserHit'; x: number; y: number; dir: -1 | 1 }; // where the Tesla laser eats into a block (dir: the way it runs)
export type WorldState = 'playing' | 'extracting' | 'won' | 'lost';

/** AlarmSystem, as "Alarm Megaphones": its siren and its paratroopers. */
export interface Alarm {
  x: number;
  y: number;
  siren: number; // alarmCounter
  drop: number; // paratrooperCounter
  waves: number; // paratrooper drops so far
}

export interface World {
  map: TileMap;
  stats: GameStats;
  bro: BroDef;
  roster: readonly BroDef[]; // the bros a rescue cycles through; `bro` is the one playing
  rng: () => number;
  player: Unit;
  spawn: { x: number; y: number }; // HeroController's checkpoint position: where the next bro appears
  enemies: Unit[];
  projectiles: Projectile[];
  effects: Effect[];
  prisoners: Prisoner[];
  checkpoints: Checkpoint[];
  grass: Grass[];
  doors: MookDoor[];
  alarms: Alarm[]; // set off by the alarmists' dead man's switches
  mortarSpread: { amount: number; side: 1 | -1 }; // RocketLaunch.offsetAmount / offsetSide (static in Broforce)
  mines: Mine[];
  foes: Foe[]; // enemy vehicles
  portals: Portal[]; // the warlocks' WarlockPortals
  zaps: Zap[]; // the Tesla gun's bolts (Broden's ElectricZap)
  drones: Unit[]; // the bro's Drone Machineguns
  signs: MineSign[]; // the Mine Field Signs over them
  doorPoints: DoorPoint[]; // the doors as ScoutMookInterestPoints
  tanks: Tank[]; // TankBroTank vehicles on the map
  jets: Jet[]; // Trump's jets
  boss: Unit | null; // Jeffrey Epstein, when the level has him (also among the enemies)
  mech: Mech | null; // his Goliath, the level's last fight
  driving: Vehicle | null; // what the player is in
  django: { time: number; shots: number; reload: number } | null; // Samuel as Django: time left, the revolver's state
  reboard: Vehicle | null; // the vehicle just left: no boarding it until he stands clear of it
  flexPower: 'allure' | null; // PlayerInventory.flexPowers: what flexing does
  flag: { x: number; y: number };
  lives: number;
  specialAmmo: number;
  respawnTimer: number;
  state: WorldState;
  extractionTime: number;
  time: number;
  nextId: number;
  camera: Camera; // SortOfFollow: gameplay uses it for visibility and the airstrike height
  events: GameEvent[];
  laughIndex: number; // PolymorphicAI.laughIndex, shared by every mook
}

const cellX = (c: number): number => c * TILE;

/** The minds that aren't a plain mook's: an alien's (aliens.ts), a hell mob's extras (hell.ts). */
function setupMind(m: Unit, rng: () => number): void {
  if (isAlien(m.kind)) {
    m.ai = null;
    m.alien = makeAlienState(rng);
    m.facing = rng() < 0.5 ? -1 : 1;
  }
  if (isHell(m.kind)) m.hell = makeHellState(rng);
}
const feetY = (r: number): number => r * TILE - HALF_TILE;

export function createWorld(level: LevelData, stats: GameStats, roster: readonly BroDef[],
  rng: () => number = Math.random): World {
  if (roster.length === 0) throw new Error('createWorld: the roster is empty');
  const bro = roster[0];
  const parsed = parseLevel(level, stats);
  let nextId = 1;
  const spawn = { x: cellX(parsed.player.c), y: feetY(parsed.player.r) };
  const player = makeUnit(nextId++, 'bro', 'player', spawn.x, spawn.y, stats.bros[bro.base]);
  const enemies = parsed.enemies.map((e) => makeUnit(nextId++, e.kind, 'enemy', cellX(e.c), feetY(e.r), stats.units[e.kind]));
  enemies.forEach((m, i) => {
    if (!parsed.enemies[i].startDead) return;
    // ZMookUndeadStartDead: UndeadTrooper.Start with no health lies there dead (either way round) until a bro comes near
    m.health = 0;
    m.dead = true;
    m.facing = rng() < 0.5 ? -1 : 1;
    m.reported = { death: true, gib: false };
  });
  for (const m of enemies) {
    setupMind(m, rng);
    if (m.kind === 'mook_dolph') { // the universal soldier: his own mind, not a mook's
      m.ai = null;
      m.dolph = makeDolphState(m.x);
    }
    if (m.kind === 'mook_ninja' && m.ai) { // MookNinja.Start / MookNinjaAI: crouched in hiding, looking either way
      m.ai.mental = 'hiding';
      m.facing = rng() < 0.5 ? -1 : 1;
    }
  }
  const boss = parsed.boss ? makeBoss(nextId++, cellX(parsed.boss.c), feetY(parsed.boss.r), stats, parsed.mech !== null) : null;
  if (boss) enemies.push(boss);
  const mech = parsed.mech ? makeMech(nextId++, cellX(parsed.mech.c), feetY(parsed.mech.r), stats, parsed.map) : null;
  const doors = parsed.doors.map((d) => makeDoor(d.c, d.r, parsed.map, stats.door));
  const foes: Foe[] = [];
  for (const p of parsed.foes) {
    const f = makeFoe(nextId++, p.kind, cellX(p.c), feetY(p.r), stats.foes[p.kind], parsed.map);
    foes.push(f);
    if (f.kind === 'apc') { // MookAPC.Start: its motorbike waits on its roof (MotorBikeDummy1), disabled
      const bike = makeFoe(nextId++, 'bike', f.x - f.facing * FOE.apc.roofX, f.y + FOE.apc.roofY, stats.foes.bike, parsed.map);
      Object.assign(bike, { hidden: true, carrier: f.id, facing: 1 });
      foes.push(bike);
    }
  }
  const camera = { x: spawn.x, y: spawn.y };
  followCamera(camera, spawn, parsed.map, 1);
  // CheckPoint.Update: the three blocks under a flagpole turn to steel when destroyed
  for (const cp of parsed.checkpoints) {
    for (let dc = -1; dc <= 1; dc++) {
      const b = parsed.map.get(cp.c + dc, cp.r - 1);
      if (b) b.replacement = makeBlock('steel', stats);
    }
  }
  const mines = parsed.signs.map((s) => plantMine(parsed.map, s, rng)).filter((m): m is Mine => m !== null);
  return {
    map: parsed.map, stats, bro, roster, rng, player, spawn, enemies, projectiles: [], effects: [],
    prisoners: parsed.cages.map((c) => ({ x: cellX(c.c), y: feetY(c.r), freed: false })),
    checkpoints: parsed.checkpoints.map((c) => ({ x: cellX(c.c), y: feetY(c.r), activated: false, raisedAt: 0 })),
    grass: parsed.grass.map((c) => ({ x: cellX(c.c), y: c.r * TILE, health: stats.grass.health, destroyed: false })),
    doors, alarms: [], mortarSpread: { amount: 0, side: 1 }, mines, foes, portals: [], zaps: [], drones: [], signs: parsed.signs.map((s) => ({ c: s.c, r: s.r, x: cellX(s.c), y: s.r * TILE, fallen: false })), doorPoints: doors.map((d) => ({ c: d.c, r: d.r, x: d.x, y: d.y })), tanks: [], jets: [], boss, mech, driving: null, django: null, reboard: null, flexPower: level.flexPower ?? null,
    flag: { x: cellX(parsed.flag.c), y: feetY(parsed.flag.r) },
    lives: LIVES_START, specialAmmo: bro.specialAmmo ?? stats.bros[bro.base].specialAmmo, respawnTimer: 0,
    state: 'playing', extractionTime: 0, time: 0, nextId, camera, events: [], laughIndex: 0,
  };
}

function intentFrom(c: Controls, prev: Controls): MoveIntent {
  return { dir: c.left === c.right ? 0 : c.left ? -1 : 1, jumpPressed: c.jump && !prev.jump, jumpHeld: c.jump, dash: c.dash };
}

/** The top of the first block under (x, y): TestVanDammeAnim.groundHeight. */
function groundHeight(w: World, x: number, y: number): number {
  const c = Math.floor((x + HALF_TILE) / TILE);
  for (let r = Math.floor((y + HALF_TILE) / TILE); r >= 0; r--) if (w.map.get(c, r)) return r * TILE + HALF_TILE;
  return -Infinity;
}

/**
 * TestVanDammeAnim.CheckForCheckPoints: Map.CheckCheckPoint at the bro's feet, and again at ground height + 32
 * while he is 48 to 196 above the ground. Reaching a flagpole raises its flag and moves the respawn point there.
 */
function checkCheckpoints(w: World): void {
  const p = w.player;
  const gh = groundHeight(w, p.x, p.y);
  checkCheckpointsAt(w, p.y);
  if (p.y > gh + 48 && p.y < gh + 196) checkCheckpointsAt(w, gh + 32);
}

function checkCheckpointsAt(w: World, y: number): void {
  const p = w.player;
  for (const cp of w.checkpoints) {
    const dx = cp.x - p.x;
    const fast = Math.abs(p.xI) > CHECKPOINT_FAST_SPEED && Math.sign(p.xI) === Math.sign(dx);
    if (Math.abs(dx) >= (fast ? CHECKPOINT_RANGE_X_FAST : CHECKPOINT_RANGE_X)) continue;
    if (Math.abs(cp.y + CHECKPOINT_Y_OFFSET - y) >= CHECKPOINT_RANGE_Y) continue;
    if (!cp.activated) {
      cp.activated = true;
      cp.raisedAt = w.time;
      w.events.push({ type: 'checkpoint', x: cp.x, y: cp.y });
    }
    w.spawn = { x: cp.x, y: cp.y + CHECKPOINT_SPAWN_UP }; // CheckPoint.ActivateInternal / ReactivateInternal
  }
}

/** The area test shared by Map.AlertNearbyMooks, PanicUnits, BlindUnits and AttractMooks. */
function inArea(u: Unit, x: number, y: number, xRange: number, yRange: number): boolean {
  const dx = u.x - x;
  if (Math.abs(dx) - xRange >= UNIT_WIDTH || (u.y === y && dx === 0)) return false;
  return Math.abs(u.y + UNIT_BOX_HEIGHT / 2 + 3 - y) - yRange < UNIT_BOX_HEIGHT;
}

const liveEnemies = (w: World) => w.enemies.filter((m) => !m.dead && m.invulnerable <= 0);

const alertScene = (w: World): AlertScene =>
  ({ player: w.player.dead ? null : w.player, doors: w.doorPoints, map: w.map, runSpeed: w.stats.scoutRunSpeed });

/** Map.AlertNearbyMooks */
export function alertMooks(w: World, x: number, y: number, xRange: number, yRange: number): void {
  for (const m of liveEnemies(w)) {
    if (inArea(m, x, y, xRange, yRange)) fullyAlert(m, w.stats.ai[m.kind as EnemyKind], x, y, w.rng, alertScene(w));
  }
}

/** Map.PanicUnits(x, y, range, time, forgetPlayer, runRandomDirection: true) */
export function panicUnits(w: World, x: number, y: number, range: number, time: number, forgetPlayer: boolean): void {
  for (const m of liveEnemies(w)) if (inArea(m, x, y, range, range)) panic(m, time, forgetPlayer);
}

/** Map.BlindUnits: flashbangs and the like (no weapon in Brolusconi's kit sets it off) */
export function blindUnits(w: World, x: number, y: number, range: number, time: number): void {
  for (const m of liveEnemies(w)) if (inArea(m, x, y, range, range)) blind(m, time, w.rng);
}

/** Map.AttractMooks: decoys and the flex power (none in Brolusconi's kit) */
export function attractMooks(w: World, x: number, y: number, xRange: number, yRange: number): void {
  for (const m of liveEnemies(w)) if (inArea(m, x, y, xRange, yRange)) attract(m, x, y, w.rng);
}

/** Map.IsInSubstance: inside a tuft of long grass (Doodad.IsPointInRange) */
export function inGrass(w: World, x: number, y: number, range: number): boolean {
  const { width, height } = w.stats.grass;
  return w.grass.some((g) => !g.destroyed && Math.abs(g.x - x) < range + width / 2 && Math.abs(g.y - y) < range + height / 2);
}

/** HeroController brings in a new bro after a death: ours is picked at random, never the one who just died. */
function respawn(w: World): void {
  w.lives -= 1;
  w.django = null; // the next bro comes back as himself
  const others = w.roster.filter((b) => b !== w.bro);
  if (others.length > 0) w.bro = others[Math.min(others.length - 1, Math.floor(w.rng() * others.length))];
  w.specialAmmo = w.bro.specialAmmo ?? w.stats.bros[w.bro.base].specialAmmo; // he comes with his own specials
  w.player = makeUnit(w.nextId++, 'bro', 'player', w.spawn.x, w.spawn.y, w.stats.bros[w.bro.base]);
  w.player.invulnerable = SPAWN_INVULNERABLE;
  w.events.push({ type: 'respawn', x: w.spawn.x, y: w.spawn.y });
}

/**
 * HeroController.SwapBro: a rescue adds a life and brings in the next bro. Ours takes over in place, keeping
 * the unit's position, motion and rescue invulnerability, with his own values and full specials.
 */
function swapBro(w: World): void {
  if (w.roster.length < 2) return;
  w.bro = w.roster[(w.roster.indexOf(w.bro) + 1) % w.roster.length];
  w.django = null;
  const stats = w.stats.bros[w.bro.base];
  w.player.stats = stats;
  w.player.health = stats.health;
  w.player.flex = null;
  w.player.attack = null;
  w.specialAmmo = w.bro.specialAmmo ?? stats.specialAmmo;
}

/**
 * TestVanDammeAnim.Update: pressing the gesture button flexes (SetGestureAnimation(Flex)), unless an early flex
 * is already under way. blockMovementForGesture stays set until a direction is pressed with the button up,
 * so a flex holds its last pose until the bro moves.
 */
function startOrStopFlex(p: Unit, controls: Controls, prev: Controls): void {
  if (controls.gesture && !prev.gesture && (!p.flex || p.flex.frame >= FLEX_RESTART_FRAME)) {
    p.flex = { frame: 0, counter: 0, block: true };
  }
  const f = p.flex;
  if (!f || controls.gesture) return;
  if (controls.left || controls.right || controls.up || controls.down) {
    p.flex = null;
    return;
  }
  const idle = p.onGround && Math.abs(p.xI) < 1;
  if (!f.block && (!idle || controls.fire || controls.special)) p.flex = null;
}

/** AnimateGesture for the flex: frame by frame, with the flex event on frames 8 and 18. */
function animateFlex(w: World, p: Unit, controls: Controls, t: number): void {
  const f = p.flex;
  if (!f) return;
  const rate = (frame: number) => (FLEX_SLOW_FRAMES.includes(frame) ? FLEX_SLOW_RATE : FLEX_FRAME_RATE);
  f.counter += t;
  while (p.flex && f.counter >= rate(f.frame)) {
    f.counter -= rate(f.frame);
    f.frame++;
    if (FLEX_EVENT_FRAMES.includes(f.frame)) flexEvent(w, p);
    if (f.frame - FLEX_HOLD > FLEX_FRAMES && !f.block && !controls.gesture) p.flex = null;
  }
}

/** TestVanDammeAnim.TriggerFlexEvent and BroBase's flex powers: the Alluring flex draws the mooks around. */
function flexEvent(w: World, p: Unit): void {
  w.events.push({ type: 'flex', x: p.x, y: p.y });
  if (w.flexPower === 'allure') attractMooks(w, p.x, p.y, ALLURE_RANGE.x, ALLURE_RANGE.y);
}

function stepPlayer(w: World, controls: Controls, prev: Controls, t: number, blasts: Blast[]): void {
  const p = w.player;
  if (p.dead) {
    p.deadTime += t;
    p.laser = undefined; // his laser goes out with him
    if (!p.gibbed) stepUnit(p, NO_INTENT, w.map, t, w.time);
    w.respawnTimer -= t;
    if (w.respawnTimer <= 0) {
      if (w.lives > 0) respawn(w);
      else w.state = 'lost';
    }
    return;
  }
  if (p.invulnerable > 0) p.invulnerable = p.invulnerable - t > 1e-9 ? p.invulnerable - t : 0;
  if (w.driving) {
    driveVehicle(w, controls, prev);
    p.laser = undefined; // at the wheel his laser goes out
  } else {
    if (!p.attack) startOrStopFlex(p, controls, prev);
    const fromX = p.x;
    const jumpWas = p.jumpTime;
    stepUnit(p, p.attack ? NO_INTENT : intentFrom(controls, prev), w.map, t, w.time); // BroLee holds still to strike
    if (w.enemies.some((e) => e.hell?.back)) p.x = fromX + (p.x - fromX) * SKINLESS.slow; // a skinless mook on his back
    if (w.bro.jetpack) {
      // The Brocketeer's jetpack: lit by a jump, kept up while jump is held
      const s = w.stats.rocketpack;
      const r = (p.rocketpack ??= makeRocketpack(s));
      if (jumpWas <= 0 && p.jumpTime > 0) blastOff(r, s, controls.left, controls.right);
      stepRocketpack(p, r, s, { jump: controls.jump, left: controls.left, right: controls.right }, t);
      if (r.on && (r.flame += t) > 0.05) {
        r.flame -= 0.05;
        w.events.push({ type: 'jetpack', x: p.x - p.facing * 4, y: p.y + 4, facing: p.facing });
      }
    } else {
      p.rocketpack = undefined;
    }
    animateFlex(w, p, controls, t);
    p.fireCooldown -= t;
    const weapon = w.django ? REVOLVER_KIT : WEAPON_KITS[w.bro.weapon];
    if (weapon.step) weapon.step(w, p, controls.fire && !p.attack, t);
    else if (controls.fire && (weapon.repeat || !prev.fire) && !p.attack && p.fireCooldown <= 0) {
      weapon.fire(w, p);
      p.fireCooldown = p.stats.fireRate;
    }
    if (w.bro.weapon === 'tesla' && !w.django) burnLaser(w, p, t, blasts, (f, damage) => hitFoe(w, f, damage, blasts));
    else p.laser = undefined;
    stepJudo(w, p, t, blasts);
    runGun(p, t);
    if (w.django && (w.django.time -= t) <= 0) w.django = null; // Django's time is up
    const droneBay = w.bro.special !== 'drone' || liveDrones(w) < DRONE.max; // six drones at most
    if (controls.special && !prev.special && w.specialAmmo > 0 && droneBay) {
      w.specialAmmo -= 1;
      const thrown = SPECIAL_KITS[w.bro.special](w.nextId++, p, controls.down);
      const line = w.bro.special === 'django' ? DJANGO.line : w.bro.voiceLine;
      w.effects.push({ kind: 'speech', x: p.x, y: p.y + 40, age: 0, duration: SPEECH_DURATION, text: line });
      w.events.push({ type: 'voice', text: line, lang: w.bro.voiceLang });
      if (thrown) {
        w.projectiles.push(thrown);
        w.events.push({ type: 'shot', weapon: thrown.kind, x: p.x, y: p.y, facing: p.facing });
      }
      if (w.bro.special === 'django') {
        w.django = { time: DJANGO.time, shots: 0, reload: 0 };
        w.events.push({ type: 'django', x: p.x, y: p.y });
      }
      if (w.bro.special === 'drone') spawnDrones(w);
    }
  }
  if (p.y < -64 && !w.driving) {
    p.invulnerable = 0;
    damageUnit(p, p.health);
  }
  for (const pr of w.prisoners) {
    if (!pr.freed && Math.abs(p.x - pr.x) < PRISONER_RESCUE_DIST && Math.abs(p.y - pr.y) < PRISONER_RESCUE_DIST) {
      pr.freed = true;
      w.lives += 1;
      p.invulnerable = Math.max(p.invulnerable, RESCUE_INVULNERABLE); // RescueBro.Free: the freed bro is invulnerable
      w.events.push({ type: 'rescue', x: pr.x, y: pr.y });
      swapBro(w);
    }
  }
  if (p.dead) return;
  boardVehicles(w);
  checkCheckpoints(w);
  alertMooks(w, p.x, p.y, ALERT_TOUCH, ALERT_TOUCH); // TestVanDammeAnim.AlertNearbyMooks, every frame
  // the flag is locked while the island's boss lives
  if (Math.abs(p.x - w.flag.x) < FLAG_REACH && Math.abs(p.y - w.flag.y) < FLAG_REACH * 2 && !levelBossAlive(w)) {
    const k = w.driving;
    if (k) {
      exitVehicle(w, TANK_EXIT_YI);
      p.y = k.y; // down on the ground for the extraction, which stops moving him
      p.yI = 0;
      p.onGround = true;
    }
    w.state = 'extracting';
    w.extractionTime = 0;
    w.projectiles = [];
    p.xI = 0;
    p.attack = null; // he boards in his own pose, not frozen mid-strike
    p.flex = null;
  }
}

function stepEnemies(w: World, t: number, blasts: Blast[]): void {
  const player = w.player.dead ? null : w.player;
  for (const m of w.enemies) {
    const ai = m.ai;
    if (m.invulnerable > 0) m.invulnerable = m.invulnerable - t > 1e-9 ? m.invulnerable - t : 0; // TestVanDammeAnim.Update
    if (m.hell?.summoned != null) continue; // rising out of a warlock's portal, which moves it
    if (m.hell && !m.dead) m.hell.hurt = false; // the portals have seen it
    if (m.dolph) {
      stepDolph(w, m, t, blasts);
      continue;
    }
    if (m.alien) {
      const kind = m.kind as EnemyKind;
      stepAlien(m, {
        map: w.map, player, stats: w.stats.ai[kind], speeds: w.stats.alienSpeeds[m.kind as keyof GameStats['alienSpeeds']], rng: w.rng,
        time: w.time, blasts, flexing: () => w.player.flex !== null,
        panicMooks: (x, y, range) => panicUnits(w, x, y, range, ALIEN.panicTime, false),
        alert: (x, y) => { w.events.push({ type: 'alert', x, y }); },
        hug: (x, y) => { w.events.push({ type: 'bite', x, y }); },
        lostSoul: w.stats.hell.lostSoul,
      }, t);
      if (m.dead) m.deadTime += t;
      stepBurning(w, m, t);
      if (m.y < -64 && !m.dead) damageUnit(m, m.health);
      continue;
    }
    if (m.dead) {
      m.deadTime += t;
      if (m.kind === 'boss' && !m.gibbed) bossDown(w, m, blasts);
      if (m.kind === 'mook_grenadier' && m.ai && !m.ai.droppedGrenade) { // MookGrenadier.DropDeathGrenade
        m.ai.droppedGrenade = true;
        w.projectiles.push(dropGrenade(w.nextId++, m));
      }
      // MookSuicide.Update: a killed suicide mook goes off 0.7 s later, whatever killed it (MookSuicideUndead the same)
      if (isSuicide(m.kind) && ai && !ai.exploded && (ai.deathFuse -= t) <= 0) explodeSuicide(w, m, blasts);
      if (m.kind === 'undead' && stepUndeadCorpse(m, player, w.rng, t)) {
        reviveUndead(m);
        continue;
      }
      if (isBoomer(m.kind) && stepBoomerDeath(m, boomerStats(w, m).warning, t)) burstBoomer(w, m, blasts);
      if (m.hell) m.hell.back = false; // a skinless mook killed on the bro's back falls off
      if (!m.gibbed) stepUnit(m, NO_INTENT, w.map, t, w.time);
      if (m.jet) stepJetpack(w, m, t, blasts);
      if (m.kind === 'mook_alarmist') stepDeadManSwitch(w, m, t);
      stepBurning(w, m, t);
      continue;
    }
    if (m.kind === 'boss') {
      stepBoss(w, m, t);
      stepBurning(w, m, t);
      continue;
    }
    if (m.hell && stepHellBusy(w, m, m.hell, t)) {
      stepBurning(w, m, t);
      continue;
    }
    const kind = m.kind as EnemyKind;
    const bubble = ai?.bubble;
    const rambro = ai?.rambro ?? 0;
    const out = thinkMook(m, {
      map: w.map, player, rng: w.rng, stats: w.stats.ai[kind], visible: isVisible(w.camera, m.x, m.y, 128, 128),
      onScreen: (x, y, bx, by) => isVisible(w.camera, x, y, bx, by), inGrass: (x, y, range) => inGrass(w, x, y, range),
      path: w.stats.paths[kind], doors: w.doorPoints, runSpeed: w.stats.scoutRunSpeed, dogRunSpeed: w.stats.dogRunSpeed,
      jumpRange: w.stats.elite.jumpRange,
    }, t);
    // MookNinja.Damage: a hit gives a hidden ninja away
    if (m.kind === 'mook_ninja' && ai?.mental === 'hiding' && m.health < m.stats.health) {
      fullyAlert(m, w.stats.ai.mook_ninja, w.player.x, w.player.y, w.rng);
    }
    const jet = m.jet;
    if (jet?.on) out.intent = { ...out.intent, hover: jet.height, jumpPressed: false, jumpHeld: false };
    else if (jet && (jet.spiral || jet.crash >= 0)) out.intent = { ...NO_INTENT }; // sputtering, then out of control
    if (m.special2 >= 0 && ((m.special2 += t) > SPECIAL2_TIME || out.intent.dir !== 0 || !m.onGround)) m.special2 = -1;
    if ((ai?.bubble === '!' && bubble !== '!') || (ai && ai.rambro > rambro)) w.events.push({ type: 'alert', x: m.x, y: m.y });
    if (out.alertNearby) alertMooks(w, m.x, m.y, SCOUT_SHOUT.x, SCOUT_SHOUT.y);
    if (out.alarm) {
      alarmDoor(w.doors[out.alarm.door], out.alarm.c, out.alarm.r, w.map, w.stats.paths.mook, w.stats.door, w.rng);
    }
    if (m.kind === 'mook_bruiser_elite') {
      if (ai?.mental === 'alerted') out.intent.speed = m.stats.speed * w.stats.elite.runSpeedMultiplier; // MookBigGuyElite.GetSpeed
      if (m.getUp > 0) out.intent = { ...NO_INTENT }; // getting up after a stomp
      if (out.intent.jumpPressed && m.onGround) m.hasJumped = true; // MookBigGuyElite.Jump
    }
    if (m.hell) hellIntent(w, m, m.hell, out, t);
    m.landYI = 0;
    stepUnit(m, out.intent, w.map, t, w.time);
    if (m.kind === 'mook_bruiser_elite') stepEliteLanding(m, t, blasts);
    if (m.hell?.flung && m.onGround && m.yI <= 0) {
      m.hell.flung = false;
      if (m.hell.leap) explodeSuicide(w, m, blasts); // MookSuicideUndead.Land: having leapt, it goes off where it lands
    }
    if (m.kind === 'skinless' && m.hell) tryRide(w, m, m.hell);
    if (m.waveTime > 0) m.waveTime -= t; // ScoutMook.Update
    if (isSuicide(m.kind)) {
      if (out.explode) explodeSuicide(w, m, blasts);
    } else if (isDog(m.kind)) {
      dogBite(w, m, t);
    } else if (isHellBigGuy(m.kind)) {
      hellWave(w, m, out.fire, t);
    } else if (isBoomer(m.kind)) {
      vomit(w, m, out.fire, t);
    } else if (m.kind === 'skinless' || m.kind === 'satan' || m.kind === 'warlock') {
      // SkinnedMook and Satan.UseFire do nothing; the warlock's fire is his summoning (hellIntent)
    } else if (runFiring(m, out.fire && !(jet && (jet.spiral || jet.crash >= 0)), t)) {
      useFire(w, m); // MookJetpack.UseFire: not while it sputters or spirals
    }
    if (jet) stepJetpack(w, m, t, blasts);
    stepBurning(w, m, t);
    if (m.kind === 'mook_bruiser' || m.kind === 'mook_bruiser_elite' || isHellBigGuy(m.kind)) runGun(m, t); // MookBigGuy.RunGun: his gun's muzzle frames
    if (m.y < -64) damageUnit(m, m.health);
  }
}

/**
 * The stretches a hell mob spends out of its mook's mind: an undead getting up (UndeadTrooper's resurrection frames, then
 * FinishResurrecting: suspicious), a stunned hell Bruiser, Satan fading in the first time he is on screen
 * (FadeInMysteriously, invulnerable; then ForceFullyAlert), a Soul Catcher that has seen the bro (SoulCatcherAI: it kills
 * itself), a skinless mook riding the bro's back (flexing shakes it off, dead). True when the mind is skipped this step.
 */
function stepHellBusy(w: World, m: Unit, h: HellState, t: number): boolean {
  const ai = m.ai;
  if (h.back) {
    const p = w.player;
    if (p.dead || p.flex) {
      h.back = false;
      m.xI = p.xI;
      m.yI = p.yI + 50;
      if (p.flex) damageUnit(m, m.health + 1, true);
      return true;
    }
    m.x = p.x - p.facing * SKINLESS.backX; // RunJumpOnBack
    m.y = p.y + SKINLESS.backY;
    m.facing = p.facing;
    m.xI = m.yI = 0;
    m.animTime += t;
    return true;
  }
  if (m.kind === 'hell_soulcatcher' && ai?.mental === 'alerted') {
    damageUnit(m, m.health + 1, true);
    return true;
  }
  if (m.kind === 'satan' && !h.seen && isVisible(w.camera, m.x, m.y, 16, 16)) {
    h.seen = true;
    h.fade = SATAN.fadeFrames * SATAN.fadeRate;
    m.invulnerable = h.fade;
  }
  let busy = false;
  if (h.rising > 0) {
    busy = true;
    if ((h.rising -= t) <= 0 && ai) {
      ai.queue = [];
      ai.mental = 'suspicious';
      ai.walkDir = m.facing;
    }
  } else if (h.stun > 0) {
    busy = true;
    h.stun -= t;
  } else if (h.fade > 0) {
    busy = true;
    if ((h.fade -= t) <= 0) fullyAlert(m, w.stats.ai.satan, w.player.x, w.player.y, w.rng, alertScene(w));
  }
  if (!busy) return false;
  m.landYI = 0;
  stepUnit(m, NO_INTENT, w.map, t, w.time);
  return true;
}

/** UndeadTrooper.Resurrect: up again with its mind wiped, waiting while it rises. */
function reviveUndead(m: Unit): void {
  const ai = m.ai;
  if (!ai) return;
  ai.queue = [];
  ai.mental = 'idle';
  ai.seenPlayer = false;
  ai.setup = false; // Reassess
}

/**
 * What a hell mob makes of its mind's output: the skinless mook's speeds and no shooting; Satan laughing at the bro
 * instead of shooting (eight laughs, then ForgetPlayer); the warlock's fire starting his summoning, the portal sent on
 * its 13th frame; the undead suicide mook's leap, and no steering while it flies.
 */
function hellIntent(w: World, m: Unit, h: HellState, out: { intent: MoveIntent; fire: boolean; leap?: boolean }, t: number): void {
  const ai = m.ai;
  if (m.kind === 'skinless') {
    out.fire = false;
    out.intent.speed = ai?.mental === 'alerted' ? SKINLESS.alertSpeed : SKINLESS.speed;
  } else if (m.kind === 'satan') {
    if (out.fire && h.laugh <= 0) {
      h.laugh = SATAN.laughs * SATAN.laughFrames * SATAN.laughRate;
      w.events.push({ type: 'alert', x: m.x, y: m.y });
    }
    out.fire = false;
    if (h.laugh > 0) {
      out.intent = { ...NO_INTENT };
      if ((h.laugh -= t) <= 0 && ai) {
        ai.seenPlayer = false;
        ai.mental = 'idle';
        ai.queue = [];
      }
    }
  } else if (m.kind === 'warlock') {
    if (out.fire && h.summon < 0 && h.portal === null) {
      h.summon = 0;
      h.cast = false;
    }
    out.fire = false;
    if (h.summon >= 0) {
      out.intent = { ...NO_INTENT };
      h.summon += t;
      if (!h.cast && h.summon >= WARLOCK.castFrame * WARLOCK.summonRate) {
        h.cast = true;
        castPortal(w, m, h);
      }
      if (h.summon >= WARLOCK.summonFrames * WARLOCK.summonRate) h.summon = -1;
    }
  } else if (m.kind === 'undead_suicide' && out.leap && m.onGround && !h.flung) {
    m.xI = m.facing * m.stats.speed * UNDEAD_SUICIDE.leapSpeedM; // MookSuicideUndead.PressSpecial
    m.yI = m.stats.jumpForce * UNDEAD_SUICIDE.leapJumpM;
    m.onGround = false;
    h.leap = h.flung = true;
  }
  if (h.flung) out.intent = { ...NO_INTENT };
}

/** SkinnedMook.RunJumpOnBack: running or standing, it jumps on a bro within 8 x 16 who faces the other way. */
function tryRide(w: World, m: Unit, h: HellState): void {
  const p = w.player;
  if (m.dead || p.dead || !m.onGround || p.facing === m.facing) return;
  if (Math.abs(p.x - m.x) > SKINLESS.reachX || Math.abs(p.y - m.y) > SKINLESS.reachY) return;
  if (w.enemies.some((e) => e !== m && e.hell?.back)) return; // skinnedMookOnMyBack: one at a time
  h.back = true;
  m.x = p.x - p.facing * SKINLESS.backX;
  m.y = p.y + SKINLESS.backY;
  m.facing = p.facing;
  m.xI = m.yI = 0;
  w.events.push({ type: 'bite', x: m.x, y: m.y });
}

/** MookHellBigGuy.StartFiring: a flame wave along the ground his way (his own FlameWallExplosion), then 2 s to the next. */
function hellWave(w: World, m: Unit, fire: boolean, t: number): void {
  m.fireDelay -= t;
  if (!fire || m.fireDelay > 0 || m.blindTime > 0) return;
  w.projectiles.push(makeFlameWall(w.nextId++, m, w.stats.hell.flameWall));
  m.fireDelay = HELL_BIGGUY.fireDelay;
  m.gunFrame = 6;
  m.gunCounter = 0;
  w.events.push({ type: 'shot', weapon: 'flamethrower', x: m.x, y: m.y, facing: m.facing });
}

/**
 * MookHellBoomer.RunFiring with its firing frames: from frame 12 down at 0.05, looping 6-3 while the trigger is held; on
 * 6-3 a drop every fireRate, each reaching further (bulletCount), and only while it is on screen.
 */
function vomit(w: World, m: Unit, fire: boolean, t: number): void {
  const h = m.hell;
  if (!h) return;
  if (fire && !m.wasFire) {
    h.frame = BOOMER.startFrame;
    h.frameTime = 0;
    h.fireCounter = 0;
  } else if (!fire && m.wasFire && h.frame >= 0) {
    h.count = 0;
    h.frame = Math.min(h.frame, 2);
  }
  m.wasFire = fire;
  if (h.frame < 0 || m.blindTime > 0) return;
  if ((h.frameTime += t) >= BOOMER.frameRate) {
    h.frameTime -= BOOMER.frameRate;
    h.frame--;
    if (h.frame < BOOMER.fireTo && fire) h.frame = BOOMER.loopFrom;
  }
  if (!fire || h.frame < BOOMER.fireTo || h.frame > BOOMER.loopFrom) return;
  if ((h.fireCounter += t) < m.stats.fireRate) return;
  h.fireCounter -= m.stats.fireRate;
  if (!isVisible(w.camera, m.x, m.y + 12, 36, 16)) return;
  h.count++;
  const xI = m.facing * (h.count * BOOMER.speedN + BOOMER.speed0);
  w.projectiles.push(makeVomit(w.nextId++, m, xI, BOOMER.up0 + BOOMER.upN * h.count, w.stats.hell.vomit.life));
}

const boomerStats = (w: World, m: Unit) => (m.kind === 'hell_soulcatcher' ? w.stats.hell.soulcatcher : w.stats.hell.boomer);

/** MookHellBoomer.CreateGibEffects and SpawnMooksOnDeath: its blast, then three undead suicide mooks (the Soul Catcher: five lost souls). */
function burstBoomer(w: World, m: Unit, blasts: Blast[]): void {
  blasts.push(boomerBlast(m.x, m.y, boomerStats(w, m).range));
  const catcher = m.kind === 'hell_soulcatcher';
  for (const [dx, dy, xI, yI] of catcher ? SOULCATCHER_SPAWNS : BOOMER_SPAWNS) {
    spawnThrown(w, catcher ? 'hell_lostsoul' : 'undead_suicide', m.x + dx, m.y + dy, xI, yI);
  }
}

/** MapController.SpawnMook_Networked with a throw: alerted, flying off the way it was thrown. */
function spawnThrown(w: World, kind: EnemyKind, x: number, y: number, xI: number, yI: number): Unit {
  const m = makeUnit(w.nextId++, kind, 'enemy', x, y, w.stats.units[kind]);
  setupMind(m, w.rng);
  m.xI = xI;
  m.yI = yI;
  if (xI !== 0) m.facing = xI < 0 ? -1 : 1;
  if (m.alien) {
    m.alien.alerted = true;
    m.alien.flying = true;
  } else {
    if (m.hell) m.hell.flung = true;
    fullyAlert(m, w.stats.ai[kind], w.player.x, w.player.y, w.rng, alertScene(w));
  }
  w.enemies.push(m);
  return m;
}

/** Warlock.SpawnPortalProjector: his guided projectile flies to a spot by the bro (FindSuitableSpawnPos), where the portal opens. */
function castPortal(w: World, m: Unit, h: HellState): void {
  const p = w.player;
  if (p.dead) return;
  const spot = findPortalSpot(w.map, p.x, p.y, w.rng);
  if (!spot) return;
  const s = w.stats.hell.portal;
  const portal: Portal = {
    id: w.nextId++, owner: m.id, x: spot.x, y: spot.y, delay: Math.hypot(spot.x - m.x, spot.y - m.y - 8) / WARLOCK.flight, frame: 0,
    frameTime: 0, phase: 'grow', unit: null, intro: WARLOCK.intro, launch: s.launchDelay, rise: s.riseTime, age: 0,
  };
  w.portals.push(portal);
  h.portal = portal.id;
  w.events.push({ type: 'shot', weapon: 'neuraliser', x: m.x, y: m.y, facing: m.facing });
}

/**
 * WarlockPortal.Update: it grows (6 frames), raises an undead suicide mook (its summoning intro, then up at riseSpeed
 * until launchDelay is spent) and launches it at the bro at 300 (+50 up), then shrinks away. A hurt mook, or a hurt or
 * dead warlock, drops it (DropUnit). Gone after 15 s whatever happens.
 */
function stepPortals(w: World, t: number): void {
  const s = w.stats.hell.portal;
  for (const o of w.portals) {
    o.age += t;
    if (o.delay > 0) {
      o.delay -= t;
      continue;
    }
    const owner = w.enemies.find((e) => e.id === o.owner);
    let unit = o.unit === null ? null : w.enemies.find((e) => e.id === o.unit) ?? null;
    if (unit && (!owner || owner.dead || owner.hell?.hurt || unit.dead || unit.hell?.hurt || o.age > WARLOCK.timeout)) {
      if (unit.hell) unit.hell.summoned = null; // DropUnit: it falls
      unit = null;
      o.unit = null;
      o.phase = 'shrink';
    }
    o.frameTime += t;
    while (o.frameTime >= WARLOCK.frameRate) {
      o.frameTime -= WARLOCK.frameRate;
      o.frame++;
      if (o.phase === 'grow' && o.frame >= WARLOCK.growFrames) {
        o.phase = 'open';
        const u = makeUnit(w.nextId++, 'undead_suicide', 'enemy', o.x, o.y, w.stats.units.undead_suicide); // SpawnUnit
        setupMind(u, w.rng);
        u.hell!.summoned = o.id;
        u.facing = w.player.x < o.x ? -1 : 1;
        w.enemies.push(u);
        o.unit = u.id;
        unit = u;
      } else if (o.phase === 'open' && o.frame > WARLOCK.openTo) {
        o.frame = WARLOCK.openFrom;
      }
    }
    if (o.phase === 'open' && unit?.hell) {
      unit.hell.summonAge += t;
      if (o.intro > 0) {
        o.intro -= t;
      } else if ((o.launch -= t) > 0) {
        if ((o.rise -= t) > 0) unit.y += s.riseSpeed * t;
      } else {
        const dx = w.player.x - o.x; // LaunchUnit
        const dy = w.player.y - o.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        unit.hell.summoned = null;
        unit.hell.flung = true;
        unit.xI = (dx / d) * WARLOCK.launch;
        unit.yI = (dy / d) * WARLOCK.launch + WARLOCK.launchUp;
        unit.onGround = false;
        fullyAlert(unit, w.stats.ai.undead_suicide, w.player.x, w.player.y, w.rng, alertScene(w));
        o.unit = null;
        o.phase = 'shrink';
      }
    }
  }
  w.portals = w.portals.filter((o) => !(o.phase === 'shrink' && o.frame > WARLOCK.shrinkTo) && o.age <= WARLOCK.timeout + 1);
  for (const m of w.enemies) {
    if (m.kind === 'warlock' && m.hell?.portal != null && !w.portals.some((o) => o.id === m.hell!.portal && o.phase !== 'shrink')) m.hell.portal = null;
  }
}

/** Mook.Damage with DamageType.Fire: the damage is saved up for when the fire goes out, and it panics. */
export function setOnFire(w: World, m: Unit, damage: number, xI: number): void {
  if (m.dead || !m.ai) return;
  let dealt = damage;
  if (m.stats.canBeSetOnFire) {
    if (m.burnDamage <= m.health * 5) {
      m.burnDamage += damage;
      dealt = 0;
    } else {
      dealt = m.burnDamage + damage;
    }
  }
  if (dealt > 0) damageUnit(m, dealt, true, { fire: true });
  if (m.dead) return;
  const kind = m.kind as EnemyKind;
  hearSound(m, w.stats.ai[kind], w.rng, m.x - xI, m.y);
  if (!m.stats.panicsOnFire || panicAi(m, xI < 0 ? -1 : 1, true)) m.burnTime = Math.min(2, Math.max(1, m.burnTime + 0.1));
}

/** Mook.Update while burning, RunBurning and StopBurning. */
function stepBurning(w: World, m: Unit, t: number): void {
  if (m.burnTime <= 0) return;
  m.burnCounter += t;
  if (m.burnCounter > 0.04) {
    m.burnCounter -= 0.13;
    if (!m.exitDoor) w.events.push({ type: 'flame', x: m.x, y: m.y + UNIT_BOX_HEIGHT });
  }
  m.burnTime -= t;
  if (!m.dead) m.burnTime -= t;
  if (m.burnTime > 0) return;
  stopPanicking(m, w.map, w.stats.ai[m.kind as EnemyKind]);
  m.xI = 0;
  damageUnit(m, m.burnDamage, true, { fire: true }); // Map.KnockAndDamageUnit(this, this, burnDamage, Fizzle): no invulnerability check
}

/** Mook.Start / RegisterOriginDoor: a ray 32 down from 6 above the feet puts the mook on the ground. */
function snapToGround(map: TileMap, m: Unit): void {
  const from = m.y + 6;
  const c = Math.floor((m.x + HALF_TILE) / TILE);
  for (let r = Math.floor((from + HALF_TILE) / TILE); r >= 0; r--) {
    const top = r * TILE + HALF_TILE;
    if (from - top > 32) return;
    if (map.get(c, r) && top <= from) {
      m.y = top;
      return;
    }
  }
}

/** MapController.SpawnMook at the door, then MookDoor.ReleaseMook. */
function releaseMook(w: World, index: number, s: DoorSpawn): void {
  const d = w.doors[index];
  const m = makeUnit(w.nextId++, s.kind, 'enemy', d.x, d.y, w.stats.units[s.kind]);
  if (s.alarmed) {
    snapToGround(w.map, m);
    if (s.path) followPath(m, s.path);
  } else {
    // Mook.RegisterOriginDoor: it appears a tile to one side, inside the doorway, and walks to its middle
    m.originDoor = index;
    let dir = 0;
    if (!d.collapsed || w.stats.door.alwaysWalkOut) {
      dir = w.rng() > 0.5 ? 1 : -1;
      m.x -= dir * TILE;
    }
    m.exitDoor = { x: d.x, dir };
    snapToGround(w.map, m);
    m.invulnerable = DOOR_EXIT_INVULNERABLE;
  }
  if (s.onFire) setOnFire(w, m, DOOR_FIRE_DAMAGE, 0);
  w.enemies.push(m);
}

/** MookDoor.Update for every door, and Block.Collapse taking down a door whose block is gone. */
function stepDoors(w: World, t: number): void {
  w.doors.forEach((d, i) => {
    if (doorLostSupport(d, w.map)) {
      collapseDoor(d, w.rng);
      w.events.push({ type: 'doorCollapse', x: d.x, y: d.y });
    }
    const res = stepDoor(d, w.stats.door, t, isVisible(w.camera, d.x, d.y), w.rng);
    for (const s of res.spawns) releaseMook(w, i, s);
    if (res.blewUp) blowUpDoor(w, d);
  });
}

/** MookDoor.DestroyDoor's explodeAtEnd: all show (the renderer's), and the shakes of its two large explosions. */
function blowUpDoor(w: World, d: MookDoor): void {
  w.events.push({ type: 'doorBlast', x: d.x, y: d.y });
  for (const delay of [0.3 + w.rng() * 0.5, 0]) {
    w.effects.push({ kind: 'shake', x: d.x, y: d.y, age: -delay, duration: EXPLOSION_DURATION });
  }
}

/**
 * RocketBombardment.MakeEffects: Map.HitUnits(firedBy, 1, Fire, range * 1.2, ...) sets fire to every unit in
 * range but the bro who called it in (this overload checks no team); corpses just take the point.
 */
function bombFire(w: World, x: number, y: number, range: number): void {
  for (const m of w.enemies) {
    if (m.gibbed || m.invulnerable > 0 || !inArea(m, x, y, range, range)) continue;
    if (m.dead) damageUnit(m, 1);
    else setOnFire(w, m, 1, 0);
  }
}

/** MookSuicide.MakeEffects: Map.BurnUnitsAround(this, 5, 1, range + 30, ...): Mook.BurnInternal on the mooks around. */
function burnAround(w: World, source: Unit | null, x: number, y: number, range: number): void {
  for (const m of w.enemies) {
    if (m === source || m.gibbed || m.invulnerable > 0 || !m.ai || !inArea(m, x, y, range, range)) continue;
    m.burnDamage += 1;
    if (!m.dead && m.burnTime <= 0 && panicAi(m, m.x - x < 0 ? -1 : 1, true)) m.burnTime = 1;
  }
}

/**
 * Map.HitUnits with DamageType.Fire, from the flamethrower's flames and the flame wall: the mooks in range catch fire
 * (Mook.Damage), and Epstein, who has no mook mind to catch fire with, takes the damage.
 */
function scorchUnits(w: World, x: number, y: number, range: number, damage: number, xI: number): void {
  for (const m of w.enemies) {
    if (m.dead || m.invulnerable > 0 || !inArea(m, x, y, range, range)) continue;
    if (m.ai) {
      setOnFire(w, m, damage, xI);
    } else {
      damageUnit(m, damage);
      w.events.push({ type: 'hit', x: m.x, y: m.y, hitY: y, xI, yI: 0 });
    }
  }
}

/** Map.HitUnits with fire from an enemy's flame wall: the bro in range burns. */
function burnPlayer(w: World, x: number, y: number, range: number, damage: number, xI: number): void {
  const p = w.player;
  if (p.dead || p.invulnerable > 0 || !inArea(p, x, y, range, range)) return;
  damageUnit(p, damage, false, { fire: true });
  w.events.push({ type: 'hit', x: p.x, y: p.y, hitY: y, xI, yI: 0 });
  w.events.push({ type: 'flame', x: p.x, y: p.y + UNIT_BOX_HEIGHT });
}

/** Map.HitProjectiles with fire (FlameWallExplosion.damageProjectiles): the mooks' bullets in range go out. */
function quenchShots(w: World, x: number, y: number, range: number): void {
  for (const p of w.projectiles) {
    if (p.team === 'enemy' && p.kind === 'bullet' && !p.dead && Math.abs(p.x - x) <= range && Math.abs(p.y - y) <= range) p.dead = true;
  }
}

/** Map.HitLivingUnits with DamageType.Fire: every living mook in range catches fire (Mook.Damage). */
function fireUnits(w: World, x: number, y: number, range: number, damage: number, xI: number): void {
  for (const m of w.enemies) {
    if (!m.dead && m.invulnerable <= 0 && inArea(m, x, y, range, range)) setOnFire(w, m, damage, xI);
  }
}

/** MookDog.RunFiring: alerted, it bites a bro in reach (a breath between bites). */
function dogBite(w: World, m: Unit, t: number): void {
  if (m.fireDelay > 0) {
    m.fireDelay -= t;
    return;
  }
  const p = w.player;
  if (m.ai?.mental !== 'alerted' || p.dead || !inHitBox(p, m.x + m.facing * 4, m.y + 4, DOG.range)) return;
  damageUnit(p, DOG.bite);
  m.fireDelay = DOG_BITE_COOLDOWN;
  w.events.push({ type: 'bite', x: m.x, y: m.y });
}

/** Mook.UseFire and MookBazooka.UseFire: they only shoot while on screen. */
function useFire(w: World, m: Unit): void {
  if (m.kind === 'mook_shield' || m.kind === 'mook_alarmist') return; // MookRiotShield.FireWeapon, MookGeneral.UseFire: nothing
  if (m.kind === 'mook_grenadier') {
    if (!isVisible(w.camera, m.x, m.y)) return;
    w.projectiles.push(throwGrenade(w.nextId++, m, w.player.x));
    m.fireDelay = GRENADIER_THROW_DELAY;
    w.events.push({ type: 'shot', weapon: 'grenade', x: m.x, y: m.y, facing: m.facing });
    return;
  }
  if (m.kind === 'mook_scout') {
    if (!isVisible(w.camera, m.x, m.y)) return;
    m.waveTime = SCOUT_WAVE_TIME; // ScoutMook.FireWeapon
    w.events.push({ type: 'wave', x: m.x, y: m.y });
  } else if (m.kind === 'mook_bazooka' || m.kind === 'mook_jetpack_bazooka') { // MookJetpackBazooka.FireWeapon: the same
    if (!isVisible(w.camera, m.x, m.y + 8, 4, 8)) return;
    const rocket = fireBazookaRocket(w.nextId++, m, w.stats, w.rng);
    if (m.blindTime > 0) rocket.team = 'player'; // Confused shot misses players and damages other enemies
    w.projectiles.push(rocket);
    m.fireDelay = BAZOOKA_FIRE_DELAY; // MookBazooka.FireWeapon
    m.xIBlast = -m.facing * BAZOOKA_RECOIL;
    w.events.push({ type: 'shot', weapon: 'rocket', x: m.x, y: m.y, facing: m.facing });
  } else if (m.kind === 'mook_bruiser_elite') {
    if (!isVisible(w.camera, m.x, m.y + 8, ELITE.visibleX, ELITE.visibleY) || m.getUp > 0) return;
    const rocket = fireDrunkRocket(w.nextId++, m, w.stats, w.rng); // MookBigGuyElite.UseFire
    if (m.blindTime > 0) rocket.team = 'player';
    w.projectiles.push(rocket);
    if (m.gunFrame <= 1) m.gunFrame = 3;
    m.gunCounter = 0;
    makeNoise(w, m.x, m.y, 40);
    w.events.push({ type: 'shot', weapon: 'rocket', x: m.x, y: m.y, facing: m.facing });
  } else if (m.kind === 'mook_mortar') {
    w.projectiles.push(fireLaunch(w.nextId++, m, w.stats)); // MookMortar.UseFire
    makeNoise(w, m.x, m.y, MORTAR.noise);
    w.events.push({ type: 'shot', weapon: 'shell', x: m.x, y: m.y, facing: m.facing });
  } else if (m.kind === 'mook_bruiser') {
    if (!isVisible(w.camera, m.x, m.y + 8, 6, 13)) return; // SortOfFollow.IsItSortOfVisible(X, Y + 8, 6, 13)
    const bullet = fireMinigunBullet(w.nextId++, m, w.stats, w.rng);
    if (m.blindTime > 0) bullet.team = 'player';
    w.projectiles.push(bullet);
    if (m.gunFrame <= 1) m.gunFrame = 3; // MookBigGuy.FireWeapon
    m.gunCounter = 0;
    w.events.push({ type: 'shot', weapon: 'minigun', x: m.x, y: m.y, facing: m.facing });
  } else if (isVisible(w.camera, m.x, m.y)) {
    const bullet = fireMookBullet(w.nextId++, m, w.stats, w.rng);
    if (m.blindTime > 0) bullet.team = 'player'; // Confused shot misses players and damages other enemies
    w.projectiles.push(bullet);
    w.events.push({ type: 'shot', weapon: 'bullet', x: m.x, y: m.y, facing: m.facing });
  }
}

/**
 * MookJetpack.Update: alerted (or suspicious) it lights its jetpack after jetpacksDelay; a wrecked jetpack sputters,
 * then the mook spirals off (ours: a jolt up and back) and blows up 0.7 s after it hits the ground. Dead, it sputters
 * once it is down, and goes up the same way; gibbed, it goes up at once (MookJetpack.Gib).
 */
function stepJetpack(w: World, m: Unit, t: number, blasts: Blast[]): void {
  const j = m.jet;
  if (!j || j.exploded) return;
  if (m.gibbed) {
    explodeJetpack(w, m, blasts);
    return;
  }
  if (m.dead) {
    j.on = false;
    if (j.crash < 0 && j.fuse < 0 && !j.spiral && m.onGround) j.crash = JETPACK.deadCrash;
  }
  if (j.crash >= 0 && (j.crash -= t) < 0) {
    j.spiral = true; // StartSpiralling
    j.spiralTime = 0;
    if (m.onGround) {
      j.fuse = JETPACK.fuse; // lowSpiralCurve: it blows up where it is
    } else {
      m.yI = JETPACK.spiralUp;
      m.xI = -m.facing * JETPACK.spiralBack;
    }
  }
  if (j.spiral && j.fuse < 0 && (m.onGround || (j.spiralTime += t) > JETPACK.spiralMax)) j.fuse = JETPACK.fuse;
  if (j.fuse >= 0 && (j.fuse -= t) < 0) {
    explodeJetpack(w, m, blasts);
    return;
  }
  const mental = m.ai?.mental;
  if (!m.dead && !j.on && !j.spiral && j.crash < 0 && (mental === 'alerted' || mental === 'suspicious') && (j.delay -= t) <= 0) {
    j.on = true; // StartJetPacks
  }
  if (j.on && (j.flameCounter += t) >= JETPACK.flameEvery) {
    j.flameCounter -= JETPACK.flameEvery;
    w.events.push({ type: 'jetpack', x: m.x, y: m.y, facing: m.facing });
  }
}

/** MookJetpack.Explode: ExplodeUnits(9, explosionRange, blastForce * 40, 300), DamageGround(10), BurnUnitsAround: the suicide mook's blast. */
function explodeJetpack(w: World, m: Unit, blasts: Blast[]): void {
  const j = m.jet;
  if (!j || j.exploded) return;
  j.exploded = true;
  j.on = false;
  blasts.push({ ...suicideBlast(m.x, m.y + JETPACK.blastY, w.stats.jetpack), owner: m });
  if (!m.dead) {
    m.dead = true;
    m.deadTime = 0;
  }
  m.gibbed = true;
}

/** DeadManSwitchAlarmTrap.Update: dead, the alarmist flashes red for alarmDelay, then sets the alarm off where he lies. */
function stepDeadManSwitch(w: World, m: Unit, t: number): void {
  const ai = m.ai;
  if (!ai || ai.alarmFuse < 0) return;
  const was = ai.alarmFuse;
  ai.alarmFuse += Math.min(t, 0.0334); // counting up to alarmDelay
  if (Math.floor(ai.alarmFuse / ALARM.warnEvery) > Math.floor(was / ALARM.warnEvery) || was === 0) {
    w.events.push({ type: 'alarmWarning', x: m.x, y: m.y + 10 });
  }
  if (ai.alarmFuse >= w.stats.alarm.delay) {
    ai.alarmFuse = -1;
    w.alarms.push({ x: m.x, y: m.y, siren: 0, drop: w.stats.alarm.paratrooperRate / 3, waves: 0 }); // AlarmSystem.Start / Activate
  }
}

/** AlarmSystem.Update for the megaphones: the siren every alarmRate, and paratroopers every paratrooperRate. */
function stepAlarms(w: World, t: number): void {
  const s = w.stats.alarm;
  for (const a of w.alarms) {
    a.siren -= t;
    if (a.siren < 0) {
      a.siren += s.rate;
      w.events.push({ type: 'siren', x: a.x, y: a.y });
      if (isVisible(w.camera, a.x, a.y, ALARM.visible, ALARM.visible)) alertMooks(w, a.x, a.y, ALARM.alertRange, ALARM.alertRange);
    }
    if (a.waves >= ALARM.waves) continue;
    a.drop -= t;
    if (a.drop > 0 || !isVisible(w.camera, a.x, a.y, ALARM.dropVisible, ALARM.dropVisible)) continue;
    a.drop += s.paratrooperRate;
    const sky = [a.x, a.x - 16, a.x + 16].every((x) => !w.map.boxHitsSolid(x - 1, a.y + 8, x + 1, a.y + ALARM.sky));
    const active = w.enemies.filter((e) => !e.dead).length;
    if (!sky || active >= s.activeMooks) continue;
    a.waves++;
    const y = screenMaxY(w.camera) + ALARM.dropY;
    for (let i = 0; i < ALARM.drop; i++) { // AlarmSystem.CallInParatroopers
      const m = makeUnit(w.nextId++, 'mook', 'enemy', a.x + (i - (ALARM.drop - 1) / 2) * ALARM.spacing, y + w.rng() * 8, w.stats.units.mook);
      w.enemies.push(m);
      fullyAlert(m, w.stats.ai.mook, w.player.x, w.player.y, w.rng);
    }
  }
}

/**
 * Mine: TestVanDammeAnim.CheckForTraps sets it off under anyone not invulnerable (corpses too), Detonate's fuse runs
 * out into Explode; Block.Collapse sets it off at once. A sign falls when the ground under it goes.
 */
function stepMines(w: World, t: number, blasts: Blast[]): void {
  const units = [w.player, ...w.enemies];
  for (const m of w.mines) {
    if (m.state === 'exploded') continue;
    if (w.map.get(m.c, m.r) !== m.block) m.fuse = 0;
    else if (m.state === 'armed' && units.some((u) => !u.gibbed && u.invulnerable <= 0 && !u.exitDoor && steppedOn(m, u))) {
      m.state = 'detonating';
      w.events.push({ type: 'mineArmed', x: m.x, y: m.y });
    }
    if (m.state === 'detonating') m.fuse -= t;
    if (m.fuse <= 0) {
      m.state = 'exploded';
      blasts.push(mineBlast(m));
    }
  }
}

function dropSigns(w: World): void {
  for (const s of w.signs) if (!s.fallen && !w.map.get(s.c, s.r - 1)) s.fallen = true;
}

/** MookSuicide.MakeEffects: the blast at its feet, then it gibs. */
function explodeSuicide(w: World, m: Unit, blasts: Blast[]): void {
  if (!m.ai || m.ai.exploded) return;
  m.ai.exploded = true;
  blasts.push({ ...suicideBlast(m.x, m.y, m.kind === 'undead_suicide' ? w.stats.hell.undeadSuicide : w.stats.suicide), owner: m });
  if (!m.dead) {
    m.dead = true;
    m.deadTime = 0;
  }
  m.gibbed = true;
}

function stepProjectiles(w: World, t: number, blasts: Blast[]): void {
  const pw = { map: w.map, units: [w.player, ...w.drones, ...w.enemies], stats: w.stats, vehicles: allVehicles(w), mech: w.mech, rng: w.rng, foes: w.foes };
  for (const p of w.projectiles) {
    // Grenade.RunWarnings: in its last half second a grenade sends the mooks around it running
    if (p.kind !== 'marker' || p.dead || p.life >= GRENADE_WARNING_LIFE) continue;
    p.warning = (p.warning ?? 0) - t;
    if (p.warning <= 0) {
      p.warning += GRENADE_PANIC_RATE;
      panicUnits(w, p.x, p.y, GRENADE_PANIC_RANGE, GRENADE_PANIC_TIME, false);
    }
  }
  for (const p of [...w.projectiles]) {
    for (const ev of stepProjectile(p, pw, t)) {
      if (ev.type === 'explode') blasts.push(ev.blast);
      else if (ev.type === 'block') w.events.push({ type: 'block', x: cellX(ev.c), y: ev.r * TILE, kind: ev.kind, damage: ev.damage });
      else if (ev.type === 'hit') w.events.push({ type: 'hit', x: ev.unit.x, y: ev.unit.y, hitY: ev.y, xI: ev.xI, yI: ev.yI });
      else if (ev.type === 'gib') w.events.push({ type: 'gib', x: ev.x, y: ev.y, team: 'enemy', kind: ev.kind, xI: ev.xI, yI: ev.yI });
      else if (ev.type === 'hitVehicle') hitVehicle(w, ev.vehicle, ev.damage, blasts);
      else if (ev.type === 'shieldHit') {
        w.events.push({ type: 'shieldHit', x: ev.x, y: ev.y });
        if (ev.broke) w.events.push({ type: 'shieldOff', x: ev.unit.x, y: ev.unit.y, xI: ev.unit.xI });
      } else if (ev.type === 'hitMech') {
        if (w.mech) damageMech(w, w.mech, ev.damage);
      }
      else if (ev.type === 'callTank') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y }); // GrenadeAirstrike.MakeEffects
        callTank(w, ev.x, ev.y, ev.dir);
      } else if (ev.type === 'callJet') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y });
        callJet(w, ev.x);
      } else if (ev.type === 'blind') {
        blindUnits(w, ev.x, ev.y, ev.range, NEURALISER.blindTime); // the Neuraliser's beam
      } else if (ev.type === 'cricketBeam') {
        w.events.push(ev);
      } else if (ev.type === 'fire') {
        fireUnits(w, ev.x, ev.y, ev.range, ev.damage, ev.xI);
      } else if (ev.type === 'flameFx') {
        w.events.push({ type: 'flame', x: ev.x, y: ev.y });
      } else if (ev.type === 'scorch') {
        if (ev.team === 'enemy') burnPlayer(w, ev.x, ev.y, ev.range, ev.damage, ev.xI);
        else scorchUnits(w, ev.x, ev.y, ev.range, ev.damage, ev.xI);
      } else if (ev.type === 'quench') {
        quenchShots(w, ev.x, ev.y, ev.range);
      } else if (ev.type === 'flameWallPuff') {
        w.events.push(ev);
      } else if (ev.type === 'wallShake') {
        w.effects.push({ kind: 'shake', x: ev.x, y: ev.y, age: 0, duration: SHAKE_TIME, strength: FLAME_WALL_SHAKE });
      } else if (ev.type === 'molotov') {
        // GrenadeMolotov.Death: Map.HitLivingUnits(3, Fire, 12) and four little fires
        fireUnits(w, ev.x, ev.y, MOLOTOV.burst, MOLOTOV.burstDamage, 0);
        w.projectiles.push(...molotovFlames(() => w.nextId++, ev.x, ev.y, w.stats, w.rng, p.team));
        w.events.push({ type: 'molotovBurst', x: ev.x, y: ev.y });
      } else if (ev.type === 'hitFoe') {
        hitFoe(w, ev.foe, ev.damage, blasts);
      } else if (ev.type === 'callMortar') {
        callMortarStrike(w);
      } else if (ev.type === 'callNuke') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y });
        const y = screenMaxY(w.camera) + 160;
        w.projectiles.push({
          id: w.nextId++,
          kind: 'bigRocket',
          team: 'player',
          x: ev.x,
          y,
          xI: 0,
          yI: -480,
          life: 3,
          bounces: 0,
          dead: false,
          crush: 5,
        });
      } else {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y });
        w.projectiles.push(...spawnAirstrike(() => w.nextId++, ev.x, ev.y, screenMaxY(w.camera), w.stats, w.rng));
      }
    }
  }
}

/** MookBigGuyElite.FallDamage and ChangeFrame: a hard landing crushes what is around his feet, then he gets up. */
function stepEliteLanding(m: Unit, t: number, blasts: Blast[]): void {
  if (m.getUp > 0 && m.onGround) m.getUp = Math.max(0, m.getUp - t);
  const v = m.landYI;
  if (m.dead || v >= ELITE.landing) return;
  const hard = v < ELITE.hard;
  if (hard || v < ELITE.soft || m.hasJumped) {
    const c = hard ? ELITE.crush : ELITE.light;
    blasts.push({
      x: m.x, y: m.y, groundDamage: hard ? ELITE.crush.ground : 0, groundRange: hard ? ELITE.crush.groundRange : 0,
      unitDamage: c.damage, unitRange: c.range, killRange: c.kill, force: c.force, extraY: c.extraY, team: 'enemy', big: hard,
      noise: 0, source: 'stomp', doodadDamage: 0, doodadRange: 0, spare: m,
    });
    m.getUp = ELITE.getUp;
    m.xI = 0;
    if (m.ai) m.ai.queue = [{ type: 'wait', duration: ELITE.getUpWait, c: -1, r: -1 }];
  }
  m.hasJumped = false;
}

/** The enemy vehicles: each its own AI (foes.ts); the mooks they let out join the enemies. */
function stepFoes(w: World, t: number, blasts: Blast[]): void {
  const player = w.player.dead ? null : w.player;
  for (const f of [...w.foes]) {
    if (f.hidden) { // riding on its APC's roof
      const apc = w.foes.find((c) => c.id === f.carrier);
      if (apc) Object.assign(f, { x: apc.x - apc.facing * FOE.apc.roofX, y: apc.y + FOE.apc.roofY });
      continue;
    }
    stepFoe(f, w.stats.foes[f.kind], {
      map: w.map, player, visible: (x, y, bx, by) => isVisible(w.camera, x, y, bx, by),
      spawnMook: (kind, x, y, xI, yI, alerted) => { spawnFoeMook(w, kind, x, y, xI, yI, alerted); },
      releaseBike: (apc) => releaseBike(w, apc),
      hurtPlayer: (damage) => { if (player) damageUnit(player, damage); },
      nuke: (bike) => nuke(w, bike, blasts),
      fireShell: (x, y, xI, yI) => {
        w.projectiles.push({ id: w.nextId++, kind: 'shell', team: 'enemy', x, y, xI, yI, life: w.stats.tankShell.life, bounces: 0, dead: false });
        w.events.push({ type: 'shot', weapon: 'shell', x, y, facing: xI < 0 ? -1 : 1 });
      },
      rng: w.rng,
      fireHuge: (x, y, xI, yI) => {
        w.projectiles.push({ id: w.nextId++, kind: 'hugeBullet', team: 'enemy', x, y, xI, yI, life: w.stats.hugeBullet.life, bounces: 0, dead: false });
        w.events.push({ type: 'shot', weapon: 'minigun', x, y, facing: xI < 0 ? -1 : 1 });
      },
      warn: (x, y) => { w.events.push({ type: 'alarmWarning', x, y }); },
    }, t);
    if (f.y < -64 && !f.dead) damageFoe(f, f.health, w.time);
  }
}

/** MapController.SpawnMook(Jumping)_Networked: a mook out of a vehicle, alerted to the bro if it was. */
function spawnFoeMook(w: World, kind: 'mook' | 'mook_suicide', x: number, y: number, xI: number, yI: number, alerted: boolean): Unit {
  const m = makeUnit(w.nextId++, kind, 'enemy', x, y, w.stats.units[kind]);
  Object.assign(m, { xI, yI, onGround: false });
  w.enemies.push(m);
  if (alerted && !w.player.dead) fullyAlert(m, w.stats.ai[kind], w.player.x, w.player.y, w.rng);
  return m;
}

/** MookAPC.ReleaseMotorBike: its next motorbike rolls out, its AI switched on. */
function releaseBike(w: World, apc: Foe): boolean {
  const bike = w.foes.find((f) => f.hidden && f.carrier === apc.id);
  if (!bike) return false;
  Object.assign(bike, { hidden: false, x: apc.x - apc.facing * FOE.apc.roofX, y: apc.y + FOE.apc.roofY, carrier: -1, onGround: false });
  return true;
}

/** MookMotorBike.ExplodeNuclearBomb: the two blasts and BurnUnitsAround (160). */
function nuke(w: World, bike: Foe, blasts: Blast[]): void {
  blasts.push(...nukeBlasts(bike));
  burnAround(w, null, bike.x, bike.y, FOE.nuke.burn);
}

/** Tank.Damage and, at 0, Death: who bails out, MakeEffectsDeath's blast and BurnUnitsAround (64). */
function hitFoe(w: World, f: Foe, damage: number, blasts: Blast[]): void {
  if (!damageFoe(f, damage, w.time)) return;
  const b = FOE.bike;
  if (f.kind === 'apc') { // MookAPC.Death: after its blast, its bikes roll out
    for (let i = 0; i < 2; i++) {
      const bike = w.foes.find((c) => c.hidden && c.carrier === f.id);
      if (bike && releaseBike(w, f)) bike.immune = b.bailInvulnerable;
    }
    if (f.spawned < w.stats.foes.apc.mooks) {
      for (const [dx, xI, yI] of FOE.apc.deathMooks) {
        spawnFoeMook(w, 'mook_suicide', f.x + dx, f.y + FOE.apc.spawnY, xI, yI, true).invulnerable = b.bailInvulnerable;
      }
    }
  } else if (f.kind === 'bike' || f.kind === 'nukebike') { // MookMotorBike.Death
    const jump = w.stats.foes[f.kind].jumpForce ?? 0;
    if (f.kind === 'nukebike') {
      if (f.passenger) nuke(w, f, blasts);
    } else {
      if (f.passenger) {
        const m = spawnFoeMook(w, 'mook_suicide', f.x - f.facing * b.riderBack, f.y + b.riderY, b.bailXI, jump * b.bailM, true);
        m.invulnerable = b.bailInvulnerable;
        setOnFire(w, m, 1, b.bailXI);
      }
      const driver = spawnFoeMook(w, 'mook', f.x, f.y + b.riderY, f.facing * b.driverXI, jump * b.driverM, false);
      driver.invulnerable = b.bailInvulnerable;
    }
    f.passenger = false;
  }
  blasts.push(foeBlast(f));
  burnAround(w, null, f.x, f.y, FOE.death.burn);
}

/** RocketLaunch.MakeEffects with seekPlayer: a bombardment rocket over the bro, to one side and then the other. */
function callMortarStrike(w: World): void {
  if (w.player.dead) return;
  const s = w.mortarSpread;
  const x = Math.round((w.player.x + MORTAR.spread * (s.amount % MORTAR.spreadMod) * s.side) / TILE) * TILE;
  s.amount += 1 + Math.floor(w.rng() * 2);
  s.side = s.side === 1 ? -1 : 1;
  w.projectiles.push(skyRocket(w.nextId++, x, screenMaxY(w.camera) + MORTAR.skyY, MORTAR.fall, w.stats));
}

/** Map.DisturbWildLife: mooks within the noise range plus their own hearing range hear it. */
function makeNoise(w: World, x: number, y: number, range: number): void {
  for (const m of w.enemies) {
    if (m.alien) hearAlien(m, x, y, range);
    if (m.dead || !m.ai) continue;
    if (Math.abs(m.x - x) < range + m.stats.hearingX && Math.abs(m.y - y) < range + m.stats.hearingY) {
      hearSound(m, w.stats.ai[m.kind as EnemyKind], w.rng, x, y);
    }
  }
}

/** Applies blasts in order; destroyed barrels append their own blast, and each barrel can only be destroyed once. */
function resolveBlasts(w: World, blasts: Blast[]): void {
  const units = [w.player, ...w.drones, ...w.enemies];
  for (let i = 0; i < blasts.length; i++) {
    const b = blasts[i];
    const res = applyBlast(w.map, units, b);
    for (const m of w.enemies) { // MookRiotShield.Damage: an explosion knocks the shield away
      if (m.shield > 0 && inArea(m, b.x, b.y, b.unitRange, b.unitRange)) {
        m.shield = 0;
        w.events.push({ type: 'shieldOff', x: m.x, y: m.y, xI: m.x < b.x ? -100 : 100 });
      }
    }
    if (b.big) w.effects.push({ kind: 'shake', x: b.x, y: b.y, age: 0, duration: EXPLOSION_DURATION });
    w.events.push({ type: 'explosion', x: b.x, y: b.y, big: b.big, source: b.source, range: b.groundRange });
    if (b.source === 'bomb') bombFire(w, b.x, b.y, b.groundRange * BOMB_FIRE_RANGE_M);
    if (b.source === 'cricket') burnAround(w, null, b.x, b.y, b.groundRange * CRICKET.burnRangeM); // NoisyCricket: BurnUnitsAround
    if (b.source === 'suicide') burnAround(w, b.owner ?? null, b.x, b.y, b.groundRange + SUICIDE_BURN_EXTRA);
    if (b.noise > 0) makeNoise(w, b.x, b.y, b.noise);
    damageGrass(w, b);
    // Map.ExplodeUnits on the vehicles: enemy and neutral blasts (the player's own don't hurt his vehicles)
    if (b.team !== 'player') for (const v of allVehicles(w)) if (!v.exploded && vehicleInBlast(v, b)) hitVehicle(w, v, b.unitDamage, blasts);
    if (b.team === 'player' && w.mech && mechInBlast(w.mech, b)) damageMech(w, w.mech, b.unitDamage); // the bro's blasts on the Goliath
    // MookSuicide.Gib: a suicide mook blown apart before it went off goes off right away
    for (const f of w.foes) if (!f.dead && foeInBlast(f, b)) hitFoe(w, f, b.unitDamage, blasts); // Map.ExplodeUnits on the enemy vehicles
    for (const m of w.enemies) if (isSuicide(m.kind) && m.gibbed) explodeSuicide(w, m, blasts);
    for (const m of w.enemies) if (isBoomer(m.kind) && m.gibbed && m.hell && !m.hell.burst && stepBoomerDeath(m, 0, 0)) burstBoomer(w, m, blasts);
    for (const d of res.destroyed) {
      w.events.push({ type: 'block', x: cellX(d.c), y: d.r * TILE, kind: d.kind, damage: b.groundDamage });
      if (d.kind === 'barrel') blasts.push(barrelBlast(cellX(d.c), d.r * TILE, w.stats.barrelRange));
    }
  }
}

/** Map.DamageDoodads: blasts tear up the long grass in range (Doodad.IsPointInRange). */
function damageGrass(w: World, b: Blast): void {
  for (const g of w.grass) {
    if (g.destroyed) continue;
    if (Math.abs(g.x - b.x) < b.doodadRange + w.stats.grass.width / 2 && Math.abs(g.y - b.y) < b.doodadRange + w.stats.grass.height / 2) {
      g.health -= b.doodadDamage;
      if (g.health <= 0) g.destroyed = true;
    }
  }
}

/** Announces deaths and gibs once each; a dead player starts the respawn timer and amuses the mooks. */
function reportUnits(w: World): void {
  for (const u of [w.player, ...w.enemies]) {
    if (u.dead && !u.reported.death) {
      u.reported.death = true;
      if (u === w.player) {
        w.respawnTimer = RESPAWN_DELAY;
        w.events.push({ type: 'death', x: u.x, y: u.y, xI: u.xI, yI: u.yI });
        // Map.ForgetPlayer(..., amuseMooks): each laugh bumps the shared laugh index
        for (const m of w.enemies) playerDied(m, w.rng, m.ai?.mental === 'alerted' ? ++w.laughIndex : 0);
      } else {
        w.events.push({ type: 'kill', x: u.x, y: u.y, kind: u.kind as Exclude<UnitKind, 'bro'>, xI: u.xI, yI: u.yI });
        if (u.originDoor >= 0) w.doors[u.originDoor].mookCount--; // Mook.Death: MookDoor.RemoveMook
        u.originDoor = -1;
      }
    }
    if (u.gibbed && !u.reported.gib) {
      u.reported.gib = true;
      w.events.push({ type: 'gib', x: u.x, y: u.y, team: u.team, kind: u.kind, xI: u.xI, yI: u.yI });
    }
  }
}

function ageEffects(w: World, t: number): void {
  for (const e of w.effects) e.age += t;
  w.effects = w.effects.filter((e) => e.age < e.duration);
}

export function stepWorld(w: World, controls: Controls, prev: Controls, t: number): void {
  if (w.state === 'won' || w.state === 'lost') return;
  w.time += t;
  if (w.state === 'extracting') {
    w.extractionTime += t;
    if (w.extractionTime >= EXTRACTION_TIME) w.state = 'won';
    followCamera(w.camera, w.flag, w.map, t);
    ageEffects(w, t);
    return;
  }
  const blasts: Blast[] = [];
  reportUnits(w); // deaths caused outside a step still start the respawn timer
  stepPlayer(w, controls, prev, t, blasts);
  stepAlarms(w, t);
  stepTanks(w, t, blasts);
  stepJets(w, t, blasts);
  carryDriver(w);
  stepDrones(w, controls.fire && !w.player.attack && !w.driving, t, blasts);
  stepPortals(w, t);
  stepEnemies(w, t, blasts);
  stepFoes(w, t, blasts);
  stepMech(w, t, blasts);
  stepDoors(w, t);
  stepProjectiles(w, t, blasts);
  stepZaps(w, t, blasts);
  stepMines(w, t, blasts);
  resolveBlasts(w, blasts);
  dropSigns(w);
  reportUnits(w);
  ageEffects(w, t);
  followCamera(w.camera, w.player, w.map, t);
  // corpses go after a while; the universal soldier's waits for his last fall, an undead trooper's for good (it gets up)
  w.enemies = w.enemies.filter((e) => !(e.gibbed || (e.dead && e.deadTime > CORPSE_TIME && (!e.dolph || e.dolph.defeated) && e.kind !== 'undead')));
  w.projectiles = w.projectiles.filter((p) => !p.dead);
}
