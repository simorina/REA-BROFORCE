import { TILE } from './constants';
import type { TileMap } from './map';
import { findPath } from './pathfinding';
import type { Block, DoorStats, PathCaps, PathPoint } from './types';

/**
 * A port of MookDoor (DoodadMookDoor): a doorway mooks keep walking out of while it is on screen, up to
 * maxMookCount alive at once. A scout's alarm sends the next maxAlarmedMooksCount out quickly, each
 * following a path to where the scout saw the player. It sits on the block below it (Doodad.AttachDownwards):
 * when that block goes, the door collapses, lets out burning mooks for 1.5-3 s, then blows up.
 */
export interface MookDoor {
  c: number;
  r: number;
  x: number; // the doodad's position: its cell's centre
  y: number;
  attached: { c: number; r: number; block: Block } | null;
  spawning: boolean;
  counter: number; // spawningCounter
  mookCount: number; // mooks of this door still alive
  maxMookCount: number;
  alarmed: number; // alarmedMookCount
  path: PathPoint[] | null; // the alarmed mooks' path
  spawned: number; // _numMooksSpawned
  collapsed: boolean; // MookDoor.isDestroyed: set when it starts to collapse
  destroyedDelay: number;
  wrecked: boolean; // DestroyDoor has run: it shows its destroyed materials
}

/** A mook to bring out of a door this step. */
export interface DoorSpawn {
  kind: 'mook' | 'mook_suicide';
  onFire: boolean; // escaping a collapsing door (spawnEscapingUnitsOnFire)
  alarmed: boolean; // it follows the alarm path (if there is one); otherwise it walks out of the doorway
  path: PathPoint[] | null;
}

const DOOR_TIME_STEP = 0.0334; // MookDoor.Update clamps deltaTime to 0.0334
const ATTACH_RANGE = 48; // Doodad.AttachDownwards: a 48-unit ray down
const ALARM_TIME_LIMIT = 100; // MookDoor.AlarmMooks: PathfindingController.FindPath(..., 100f) milliseconds

export function makeDoor(c: number, r: number, map: TileMap, stats: DoorStats): MookDoor {
  const x = c * TILE;
  const y = r * TILE;
  let attached: MookDoor['attached'] = null;
  for (let rr = r - 1; rr >= 0 && y - (rr * TILE + TILE / 2) <= ATTACH_RANGE; rr--) {
    const block = map.get(c, rr);
    if (block) {
      attached = { c, r: rr, block };
      break;
    }
  }
  return {
    c, r, x, y, attached, spawning: !stats.closedAtStart, counter: 0, mookCount: 0, maxMookCount: stats.maxMookCount,
    alarmed: 0, path: null, spawned: 0, collapsed: false, destroyedDelay: 0, wrecked: false,
  };
}

/** MookDoor.AlarmMooks: the next mooks out follow a path from the door to the target. */
export function alarmDoor(d: MookDoor, c: number, r: number, map: TileMap, caps: PathCaps, stats: DoorStats,
  rng: () => number): void {
  d.alarmed = stats.maxAlarmed;
  d.path = findPath(map, d.c, d.r, c, r, caps, ALARM_TIME_LIMIT, rng);
}

/** MookDoor.Collapse */
export function collapseDoor(d: MookDoor, rng: () => number): void {
  d.destroyedDelay = 1.5 + rng() * 1.5;
  d.collapsed = true;
  d.attached = null;
}

/** Block.Collapse collapses the doodads attached to it, whatever replaces the block. */
export function doorLostSupport(d: MookDoor, map: TileMap): boolean {
  return d.attached !== null && map.get(d.attached.c, d.attached.r) !== d.attached.block;
}

/**
 * MookDoor.Update. `visible` is SetResolutionCamera.IsItVisible at the door. Returns the mooks to bring
 * out (at most one per step) and whether the door blew up this step (DestroyDoor).
 */
export function stepDoor(d: MookDoor, stats: DoorStats, dt: number, visible: boolean, rng: () => number):
  { spawns: DoorSpawn[]; blewUp: boolean } {
  const out: { spawns: DoorSpawn[]; blewUp: boolean } = { spawns: [], blewUp: false };
  if (!d.spawning) return out;
  const t = Math.min(dt, DOOR_TIME_STEP);
  const rate = stats.spawningRate;
  d.counter += t;
  if (d.counter >= rate) {
    if (d.collapsed && stats.maxAfterCollapse > 0) {
      d.counter -= rate * (0.9 + rng() * 0.2);
      if (d.mookCount < stats.maxAfterCollapse && visible) spawn(d, stats, rng, out);
    } else if (d.destroyedDelay <= 0) {
      if (d.alarmed > 0) {
        d.counter -= rate * (0.3 + rng() * 0.5);
        spawn(d, stats, rng, out);
        d.alarmed--;
      } else {
        d.counter -= rate * (0.9 + rng() * 0.2);
        if (d.mookCount < d.maxMookCount && visible) spawn(d, stats, rng, out);
      }
    } else {
      d.counter -= rate * (0.9 + rng() * 0.2 + rng() * 0.5);
      if (d.mookCount < d.maxMookCount) spawn(d, stats, rng, out);
    }
  }
  if (d.destroyedDelay > 0) {
    d.counter += t * 3;
    d.maxMookCount = stats.maxOnCollapse;
    d.destroyedDelay -= t;
    if (d.destroyedDelay <= 0) {
      // DestroyDoor
      if (stats.maxAfterCollapse <= 0) d.spawning = false;
      d.collapsed = true;
      d.wrecked = true;
      out.blewUp = stats.explodeAtEnd;
    }
  }
  return out;
}

/** MookDoor.SpawnMook and the door's half of ReleaseMook. */
function spawn(d: MookDoor, stats: DoorStats, rng: () => number, out: { spawns: DoorSpawn[] }): void {
  if (stats.limited > 0 && d.spawned >= stats.limited) return;
  d.spawned++;
  const suicide = rng() <= stats.chanceSuicide;
  const onFire = d.destroyedDelay > 0 && stats.escapeOnFire;
  const alarmed = d.alarmed > 0;
  if (!alarmed) d.mookCount++; // RegisterOriginDoor
  out.spawns.push({ kind: suicide ? 'mook_suicide' : 'mook', onFire, alarmed, path: alarmed ? d.path : null });
}
