import {
  attract, blind, followPath, fullyAlert, hearSound, panic, panicAi, playerDied, SCOUT_SHOUT, stopPanicking, thinkMook,
  type AlertScene, type DoorPoint,
} from './ai';
import type { BroDef } from './bro';
import { followCamera, isVisible, screenMaxY, type Camera } from './camera';
import {
  ALERT_TOUCH, BAZOOKA_FIRE_DELAY, CHECKPOINT_FAST_SPEED, CHECKPOINT_RANGE_X, CHECKPOINT_RANGE_X_FAST,
  CHECKPOINT_RANGE_Y, CHECKPOINT_SPAWN_UP, CHECKPOINT_Y_OFFSET, CORPSE_TIME, EXPLOSION_DURATION, EXTRACTION_TIME,
  FLAG_REACH, GRENADE_PANIC_RANGE, GRENADE_PANIC_RATE, GRENADE_PANIC_TIME, GRENADE_WARNING_LIFE, HALF_TILE,
  LIVES_START, PRISONER_RESCUE_DIST, RESCUE_INVULNERABLE, RESPAWN_DELAY, SPAWN_INVULNERABLE, SPECIAL2_TIME,
  SPEECH_DURATION, TILE, UNIT_BOX_HEIGHT, UNIT_WIDTH, BAZOOKA_RECOIL, DOOR_EXIT_INVULNERABLE, DOOR_FIRE_DAMAGE, SCOUT_WAVE_TIME,
  BOMB_FIRE_RANGE_M, SUICIDE_BURN_EXTRA, ALLURE_RANGE, FLEX_EVENT_FRAMES, FLEX_FRAME_RATE, FLEX_FRAMES, FLEX_HOLD,
  FLEX_RESTART_FRAME, FLEX_SLOW_FRAMES, FLEX_SLOW_RATE, TANK_EXIT_YI,
} from './constants';
import { alarmDoor, collapseDoor, doorLostSupport, makeDoor, stepDoor, type DoorSpawn, type MookDoor } from './doors';
import { applyBlast, barrelBlast, suicideBlast, type Blast } from './explosions';
import { parseLevel, type LevelData } from './level';
import { makeBlock, type TileMap } from './map';
import { NO_INTENT, stepUnit, type MoveIntent } from './physics';
import {
  fireBazookaRocket, fireMookBullet, spawnAirstrike, stepProjectile,
} from './projectiles';
import {
  allVehicles, boardVehicles, callJet, callTank, carryDriver, driveVehicle, exitVehicle, hitVehicle, stepJets, stepTanks,
} from './driving';
import { stepJudo } from './judo';
import { SPECIAL_KITS, WEAPON_KITS } from './kits';
import { damageUnit, makeUnit, runFiring, runGun } from './units';
import { bossAlive, bossDown, makeBoss, stepBoss } from './boss';
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
  text?: string;
  unit?: number; // the speaker a speech bubble hangs over (the bro's own lines name none)
}

/** Who a speech bubble hangs over: the unit it names, or the bro. */
export function speaker(w: World, e: Effect): Unit | null {
  return e.unit === undefined ? w.player : w.enemies.find((m) => m.id === e.unit) ?? null;
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
  | { type: 'shot'; weapon: ProjectileKind | 'judo'; x: number; y: number; facing: 1 | -1 }
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
  | { type: 'exitJet'; x: number; y: number }
  | { type: 'gunSwitch'; x: number; y: number };
export type WorldState = 'playing' | 'extracting' | 'won' | 'lost';

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
  doorPoints: DoorPoint[]; // the doors as ScoutMookInterestPoints
  tanks: Tank[]; // TankBroTank vehicles on the map
  jets: Jet[]; // Trump's jets
  boss: Unit | null; // Jeffrey Epstein, when the level has him (also among the enemies)
  driving: Vehicle | null; // what the player is in
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
  const boss = parsed.boss ? makeBoss(nextId++, cellX(parsed.boss.c), feetY(parsed.boss.r), stats) : null;
  if (boss) enemies.push(boss);
  const doors = parsed.doors.map((d) => makeDoor(d.c, d.r, parsed.map, stats.door));
  const camera = { x: spawn.x, y: spawn.y };
  followCamera(camera, spawn, parsed.map, 1);
  // CheckPoint.Update: the three blocks under a flagpole turn to steel when destroyed
  for (const cp of parsed.checkpoints) {
    for (let dc = -1; dc <= 1; dc++) {
      const b = parsed.map.get(cp.c + dc, cp.r - 1);
      if (b) b.replacement = makeBlock('steel', stats);
    }
  }
  return {
    map: parsed.map, stats, bro, roster, rng, player, spawn, enemies, projectiles: [], effects: [],
    prisoners: parsed.cages.map((c) => ({ x: cellX(c.c), y: feetY(c.r), freed: false })),
    checkpoints: parsed.checkpoints.map((c) => ({ x: cellX(c.c), y: feetY(c.r), activated: false, raisedAt: 0 })),
    grass: parsed.grass.map((c) => ({ x: cellX(c.c), y: c.r * TILE, health: stats.grass.health, destroyed: false })),
    doors, doorPoints: doors.map((d) => ({ c: d.c, r: d.r, x: d.x, y: d.y })), tanks: [], jets: [], boss, driving: null, reboard: null, flexPower: level.flexPower ?? null,
    flag: { x: cellX(parsed.flag.c), y: feetY(parsed.flag.r) },
    lives: LIVES_START, specialAmmo: stats.bros[bro.base].specialAmmo, respawnTimer: 0,
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

function respawn(w: World): void {
  w.lives -= 1;
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
  const stats = w.stats.bros[w.bro.base];
  w.player.stats = stats;
  w.player.health = stats.health;
  w.player.flex = null;
  w.player.attack = null;
  w.specialAmmo = stats.specialAmmo;
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
  } else {
    if (!p.attack) startOrStopFlex(p, controls, prev);
    stepUnit(p, p.attack ? NO_INTENT : intentFrom(controls, prev), w.map, t, w.time); // BroLee holds still to strike
    animateFlex(w, p, controls, t);
    p.fireCooldown -= t;
    const weapon = WEAPON_KITS[w.bro.weapon];
    if (weapon.step) weapon.step(w, p, controls.fire && !p.attack, t);
    else if (controls.fire && (weapon.repeat || !prev.fire) && !p.attack && p.fireCooldown <= 0) {
      weapon.fire(w, p);
      p.fireCooldown = p.stats.fireRate;
    }
    stepJudo(w, p, t, blasts);
    runGun(p, t);
    if (controls.special && !prev.special && w.specialAmmo > 0) {
      w.specialAmmo -= 1;
      const thrown = SPECIAL_KITS[w.bro.special](w.nextId++, p, controls.down);
      w.projectiles.push(thrown);
      w.effects.push({ kind: 'speech', x: p.x, y: p.y + 40, age: 0, duration: SPEECH_DURATION, text: w.bro.voiceLine });
      w.events.push(
        { type: 'voice', text: w.bro.voiceLine, lang: w.bro.voiceLang },
        { type: 'shot', weapon: thrown.kind, x: p.x, y: p.y, facing: p.facing },
      );
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
  if (Math.abs(p.x - w.flag.x) < FLAG_REACH && Math.abs(p.y - w.flag.y) < FLAG_REACH * 2 && !bossAlive(w)) {
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
    if (m.dead) {
      m.deadTime += t;
      if (m.kind === 'boss' && !m.gibbed) bossDown(w, m, blasts);
      // MookSuicide.Update: a killed suicide mook goes off 0.7 s later, whatever killed it
      if (m.kind === 'mook_suicide' && ai && !ai.exploded && (ai.deathFuse -= t) <= 0) explodeSuicide(w, m, blasts);
      if (!m.gibbed) stepUnit(m, NO_INTENT, w.map, t, w.time);
      stepBurning(w, m, t);
      continue;
    }
    if (m.kind === 'boss') {
      stepBoss(w, m, t);
      stepBurning(w, m, t);
      continue;
    }
    const kind = m.kind as EnemyKind;
    const bubble = ai?.bubble;
    const rambro = ai?.rambro ?? 0;
    const out = thinkMook(m, {
      map: w.map, player, rng: w.rng, stats: w.stats.ai[kind], visible: isVisible(w.camera, m.x, m.y, 128, 128),
      onScreen: (x, y, bx, by) => isVisible(w.camera, x, y, bx, by), inGrass: (x, y, range) => inGrass(w, x, y, range),
      path: w.stats.paths[kind], doors: w.doorPoints, runSpeed: w.stats.scoutRunSpeed,
    }, t);
    if (m.special2 >= 0 && ((m.special2 += t) > SPECIAL2_TIME || out.intent.dir !== 0 || !m.onGround)) m.special2 = -1;
    if ((ai?.bubble === '!' && bubble !== '!') || (ai && ai.rambro > rambro)) w.events.push({ type: 'alert', x: m.x, y: m.y });
    if (out.alertNearby) alertMooks(w, m.x, m.y, SCOUT_SHOUT.x, SCOUT_SHOUT.y);
    if (out.alarm) {
      alarmDoor(w.doors[out.alarm.door], out.alarm.c, out.alarm.r, w.map, w.stats.paths.mook, w.stats.door, w.rng);
    }
    stepUnit(m, out.intent, w.map, t, w.time);
    if (m.waveTime > 0) m.waveTime -= t; // ScoutMook.Update
    if (m.kind === 'mook_suicide') {
      if (out.explode) explodeSuicide(w, m, blasts);
    } else if (runFiring(m, out.fire, t)) {
      useFire(w, m);
    }
    stepBurning(w, m, t);
    if (m.y < -64) damageUnit(m, m.health);
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
  if (dealt > 0) damageUnit(m, dealt, true);
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
  damageUnit(m, m.burnDamage, true); // Map.KnockAndDamageUnit(this, this, burnDamage, Fizzle): no invulnerability check
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

/** Mook.UseFire and MookBazooka.UseFire: they only shoot while on screen. */
function useFire(w: World, m: Unit): void {
  if (m.kind === 'mook_scout') {
    if (!isVisible(w.camera, m.x, m.y)) return;
    m.waveTime = SCOUT_WAVE_TIME; // ScoutMook.FireWeapon
    w.events.push({ type: 'wave', x: m.x, y: m.y });
  } else if (m.kind === 'mook_bazooka') {
    if (!isVisible(w.camera, m.x, m.y + 8, 4, 8)) return;
    w.projectiles.push(fireBazookaRocket(w.nextId++, m, w.stats, w.rng));
    m.fireDelay = BAZOOKA_FIRE_DELAY; // MookBazooka.FireWeapon
    m.xIBlast = -m.facing * BAZOOKA_RECOIL;
    w.events.push({ type: 'shot', weapon: 'rocket', x: m.x, y: m.y, facing: m.facing });
  } else if (isVisible(w.camera, m.x, m.y)) {
    w.projectiles.push(fireMookBullet(w.nextId++, m, w.stats, w.rng));
    w.events.push({ type: 'shot', weapon: 'bullet', x: m.x, y: m.y, facing: m.facing });
  }
}

/** MookSuicide.MakeEffects: the blast at its feet, then it gibs. */
function explodeSuicide(w: World, m: Unit, blasts: Blast[]): void {
  if (!m.ai || m.ai.exploded) return;
  m.ai.exploded = true;
  blasts.push({ ...suicideBlast(m.x, m.y, w.stats.suicide), owner: m });
  if (!m.dead) {
    m.dead = true;
    m.deadTime = 0;
  }
  m.gibbed = true;
}

function stepProjectiles(w: World, t: number, blasts: Blast[]): void {
  const pw = { map: w.map, units: [w.player, ...w.enemies], stats: w.stats, vehicles: allVehicles(w) };
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
      else if (ev.type === 'callTank') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y }); // GrenadeAirstrike.MakeEffects
        callTank(w, ev.x, ev.y, ev.dir);
      } else if (ev.type === 'callJet') {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y });
        callJet(w, ev.x);
      } else {
        w.events.push({ type: 'airstrike', x: ev.x, y: ev.y });
        w.projectiles.push(...spawnAirstrike(() => w.nextId++, ev.x, ev.y, screenMaxY(w.camera), w.stats, w.rng));
      }
    }
  }
}

/** Map.DisturbWildLife: mooks within the noise range plus their own hearing range hear it. */
function makeNoise(w: World, x: number, y: number, range: number): void {
  for (const m of w.enemies) {
    if (m.dead || !m.ai) continue;
    if (Math.abs(m.x - x) < range + m.stats.hearingX && Math.abs(m.y - y) < range + m.stats.hearingY) {
      hearSound(m, w.stats.ai[m.kind as EnemyKind], w.rng, x, y);
    }
  }
}

/** Applies blasts in order; destroyed barrels append their own blast, and each barrel can only be destroyed once. */
function resolveBlasts(w: World, blasts: Blast[]): void {
  const units = [w.player, ...w.enemies];
  for (let i = 0; i < blasts.length; i++) {
    const b = blasts[i];
    const res = applyBlast(w.map, units, b);
    if (b.big) w.effects.push({ kind: 'shake', x: b.x, y: b.y, age: 0, duration: EXPLOSION_DURATION });
    w.events.push({ type: 'explosion', x: b.x, y: b.y, big: b.big, source: b.source, range: b.groundRange });
    if (b.source === 'bomb') bombFire(w, b.x, b.y, b.groundRange * BOMB_FIRE_RANGE_M);
    if (b.source === 'suicide') burnAround(w, b.owner ?? null, b.x, b.y, b.groundRange + SUICIDE_BURN_EXTRA);
    if (b.noise > 0) makeNoise(w, b.x, b.y, b.noise);
    damageGrass(w, b);
    // Map.ExplodeUnits on the vehicles: enemy and neutral blasts (the player's own don't hurt his vehicles)
    if (b.team !== 'player') for (const v of allVehicles(w)) if (!v.exploded && vehicleInBlast(v, b)) hitVehicle(w, v, b.unitDamage, blasts);
    // MookSuicide.Gib: a suicide mook blown apart before it went off goes off right away
    for (const m of w.enemies) if (m.kind === 'mook_suicide' && m.gibbed) explodeSuicide(w, m, blasts);
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
  stepTanks(w, t, blasts);
  stepJets(w, t, blasts);
  carryDriver(w);
  stepEnemies(w, t, blasts);
  stepDoors(w, t);
  stepProjectiles(w, t, blasts);
  resolveBlasts(w, blasts);
  reportUnits(w);
  ageEffects(w, t);
  followCamera(w.camera, w.player, w.map, t);
  w.enemies = w.enemies.filter((e) => !(e.gibbed || (e.dead && e.deadTime > CORPSE_TIME)));
  w.projectiles = w.projectiles.filter((p) => !p.dead);
}
