import { BOOMER, HELL_BIGGUY, LOST_SOUL, TILE, UNDEAD, WARLOCK } from './constants';
import type { Blast } from './explosions';
import type { TileMap } from './map';
import type { HellStats, Unit } from './types';

/** What a hell mob keeps on top of its mook's mind: each kind uses its own fields. */
export interface HellState {
  // UndeadTrooper
  rise: number; // resurrectionDelay: counting down while a bro is near the corpse
  waking: boolean; // isResurrecting: once started, the countdown runs on
  rising: number; // the resurrection frames still to play (s)
  hurt: boolean; // took damage since the last step: resets the resurrection, drops a summoned mook
  // MookSuicideUndead
  leap: boolean; // hasCharged: it leapt, and goes off when it lands
  flung: boolean; // in the air from a leap or a portal's launch: no steering until it lands (Tumble, FrontSomersault)
  summoned: number | null; // the warlock's portal raising it (its id), while it rises
  summonAge: number; // how long it has been rising
  // Warlock
  summon: number; // time into the summoning (-1: not summoning)
  cast: boolean; // this summoning has sent its portal
  portal: number | null; // activePortal
  // Satan
  laugh: number; // laughing time left
  fade: number; // FadeInMysteriously: time left
  seen: boolean; // he has faded in
  // MookHellBigGuy, MookHellArmouredBigGuy
  stun: number; // stunned time left
  fire: number; // fireAmount
  shield: number; // shieldDamage
  // SkinnedMook
  back: boolean; // onBackOf: riding the bro's back
  // MookHellBoomer, MookHellSoulCatcher
  dying: number; // time since it died (-1: alive)
  burst: boolean; // gone off (Gib)
  frame: number; // firingFrame (-1: not vomiting)
  frameTime: number;
  fireCounter: number;
  count: number; // bulletCount
}

export function makeHellState(rng: () => number): HellState {
  return {
    rise: undeadDelay(rng), waking: false, rising: 0, hurt: false, leap: false, flung: false, summoned: null, summonAge: 0, summon: -1, cast: false,
    portal: null, laugh: 0, fade: 0, seen: false, stun: 0, fire: 0, shield: 0, back: false, dying: -1, burst: false, frame: -1, frameTime: 0,
    fireCounter: 0, count: 0,
  };
}

const HELL_KINDS = new Set(['hell_dog', 'hell_boomer', 'hell_soulcatcher', 'hell_bigguy', 'hell_armoured', 'undead', 'undead_suicide', 'skinless', 'warlock', 'satan']);
/** Hell's mook-minded mobs (the lost soul has an alien's mind). */
export const isHell = (kind: string): boolean => HELL_KINDS.has(kind);
export const isDog = (kind: string): boolean => kind === 'dog' || kind === 'hell_dog';
export const isSuicide = (kind: string): boolean => kind === 'mook_suicide' || kind === 'undead_suicide';
export const isHellBigGuy = (kind: string): boolean => kind === 'hell_bigguy' || kind === 'hell_armoured';
export const isBoomer = (kind: string): boolean => kind === 'hell_boomer' || kind === 'hell_soulcatcher';

/** UndeadTrooper.ResetResurrectionDelay */
export const undeadDelay = (rng: () => number): number => UNDEAD.delay + rng() * UNDEAD.delayRand;

/**
 * UndeadTrooper.Update for its corpse: lying still on the ground with a bro within 96 x 24 (or once it has started), it
 * counts down and gets up with 2 health. A hit on the corpse starts it over; blown to pieces, it stays down. True on
 * the step it gets up (the rise itself, `rising`, is still to play).
 */
export function stepUndeadCorpse(m: Unit, player: Unit | null, rng: () => number, t: number): boolean {
  const h = m.hell;
  if (!h || m.gibbed) return false;
  if (h.hurt) {
    h.hurt = false;
    h.waking = false;
    h.rise = undeadDelay(rng);
  }
  const near = !!player && Math.abs(player.x - m.x) < UNDEAD.nearX && Math.abs(player.y - m.y) < UNDEAD.nearY;
  if (!m.onGround || Math.abs(m.xI) >= UNDEAD.still || !(near || h.waking)) return false;
  h.waking = true;
  if ((h.rise -= t) >= 0) return false;
  m.dead = false; // Resurrect
  m.health = UNDEAD.health;
  m.deadTime = 0;
  m.reported = { death: false, gib: false };
  h.waking = false;
  h.rise = undeadDelay(rng);
  h.rising = UNDEAD.riseFrames * UNDEAD.riseRate;
  return true;
}

/**
 * MookHellArmouredBigGuy.Damage: true when his armour takes the hit. A hit travelling the way he faces comes from behind
 * and hurts; from the front it bounces off unless he is panicking or 35 fire, or 60 of anything else, has worn it through.
 */
export function armourStops(u: Unit, amount: number, dir: number, fire: boolean): boolean {
  const h = u.hell;
  if (!h || u.kind !== 'hell_armoured') return false;
  if (fire) h.fire += amount;
  else h.shield += amount;
  const behind = dir !== 0 && Math.sign(dir) === u.facing;
  const worn = u.ai?.mental === 'panicking' || h.fire > HELL_BIGGUY.armourFire || h.shield > HELL_BIGGUY.armourShield;
  return !(behind || (worn && u.health > 0));
}

/**
 * MookHellBoomer.Death and ChangeFrame while dying: 0.2 s invulnerable, it swells (7 frames at 0.05) and flashes until
 * warningTime is up, then gibs. Blown to pieces first, it goes at once. True on the step it bursts.
 */
export function stepBoomerDeath(m: Unit, warning: number, t: number): boolean {
  const h = m.hell;
  if (!h || h.burst) return false;
  if (h.dying < 0) {
    h.dying = 0;
    if (!m.gibbed) m.invulnerable = BOOMER.invulnerable;
  } else {
    h.dying += t;
  }
  if (!m.gibbed && h.dying < Math.max(BOOMER.swellFrames * BOOMER.frameRate, warning)) return false;
  h.burst = true;
  m.gibbed = true;
  return true;
}

/** MookHellBoomer.CreateGibEffects: DamageGround(15, range * 1.33), ExplodeUnits(9, range * 1.25, range, 460, 200). */
export function boomerBlast(x: number, y: number, range: number): Blast {
  return {
    x, y: y + BOOMER.y, groundDamage: BOOMER.groundDamage, groundRange: range * BOOMER.groundRangeM, unitDamage: BOOMER.damage,
    unitRange: range * BOOMER.unitRangeM, killRange: range, force: BOOMER.force, extraY: BOOMER.extraY, team: 'enemy', big: true, noise: 80,
    source: 'suicide', doodadDamage: 20, doodadRange: range,
  };
}

/** HellLostSoul.MakeEffects: DamageGround(15, explodeRange); ExplodeUnits(9, explodeRange * 2.3, ..., 500, 300), the bro within explodeRange * 1.33 * 0.7. */
export function lostSoulBlast(x: number, y: number, s: HellStats['lostSoul']): Blast {
  return {
    x, y: y + LOST_SOUL.y, groundY: y, groundDamage: LOST_SOUL.groundDamage, groundRange: s.explodeRange, unitDamage: LOST_SOUL.damage,
    unitRange: s.explodeRange * LOST_SOUL.unitRangeM, killRange: s.explodeRange * LOST_SOUL.broRangeM * s.broHarmM, force: LOST_SOUL.force,
    extraY: LOST_SOUL.extraY, team: 'enemy', big: true, noise: 80, source: 'rocket', doodadDamage: 0, doodadRange: 0,
  };
}

/** A WarlockPortal: its projectile's flight, growing, raising its undead suicide mook, launching it, shrinking. */
export interface Portal {
  id: number;
  owner: number; // the warlock
  x: number;
  y: number;
  delay: number; // the guided projectile still on its way
  frame: number;
  frameTime: number;
  phase: 'grow' | 'open' | 'shrink';
  unit: number | null; // the mook it raises
  intro: number; // the mook's summoning intro still to play
  launch: number; // launchDelay left
  rise: number; // riseTime left
  age: number; // safetyTimeout
}

/**
 * WarlockPortal.FindSuitableSpawnPos: a block within 5 of the bro with 3 free above it and a clear line from 4 above it
 * to just over him; the portal opens in the cell over that block. Null when there is none.
 */
export function findPortalSpot(map: TileMap, x: number, y: number, rng: () => number): { x: number; y: number } | null {
  const c0 = Math.floor((x + TILE / 2) / TILE);
  const r0 = Math.floor((y + TILE / 2) / TILE);
  const spots: Array<{ x: number; y: number }> = [];
  for (let c = c0 - WARLOCK.search; c < c0 + WARLOCK.search; c++) {
    for (let r = Math.max(1, r0 - WARLOCK.search); r < r0 + WARLOCK.search; r++) {
      if (!map.isSolid(c, r)) continue;
      let free = true;
      for (let k = r + 1; k <= r + WARLOCK.clear; k++) if (map.isSolid(c, k)) free = false;
      if (!free || !clearLine(map, c * TILE, (r + 4) * TILE, x, y + 4)) continue;
      spots.push({ x: c * TILE, y: (r + 1) * TILE });
    }
  }
  return spots.length ? spots[Math.min(spots.length - 1, Math.floor(rng() * spots.length))] : null;
}

function clearLine(map: TileMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
  for (let i = 1; i < n; i++) if (map.solidAt(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}
