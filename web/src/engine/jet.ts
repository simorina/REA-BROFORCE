import {
  HALF_TILE, JET_BOX, JET_DESCENT, JET_ENTRY, JET_FAST_DESCENT, JET_FLY, JET_FUEL, JET_LEAVE_SPEED, TILE,
} from './constants';
import { cellBottom, cellLeft, getColumn, getRow, type TileMap } from './map';
import type { Vehicle } from './vehicle';

export interface JetDrive {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

export const NO_FLY: JetDrive = { dx: 0, dy: 0 };

/** descending -> landed -> flying (piloted) -> descending ... ; leaving when dry and empty. */
export type JetState = 'descending' | 'landed' | 'flying' | 'leaving';

/** Trump's jet: Broforce's Harrier, piloted. */
export interface Jet extends Vehicle {
  kind: 'jet';
  state: JetState;
  fuel: number;
  drive: JetDrive;
  rocketCooldown: number;
  bombCooldown: number;
  animTime: number;
}

export function makeJet(id: number, x: number, y: number, facing: 1 | -1): Jet {
  return {
    kind: 'jet', id, x, y, xI: 0, yI: 0, facing, onGround: false, driven: false, damage: 0, countdown: -1,
    countdownCounter: 0, exploded: false, state: 'descending', fuel: JET_FUEL, drive: NO_FLY, rocketCooldown: 0,
    bombCooldown: 0, animTime: 0,
  };
}

/** It appears above the screen over the grenade, its box inside the map. */
export function jetDrop(map: TileMap, x: number, screenMaxY: number): { x: number; y: number } {
  const lo = cellLeft(0) + JET_BOX.halfWidth;
  const hi = cellLeft(map.cols) - JET_BOX.halfWidth;
  return { x: Math.min(Math.max(x, lo), hi), y: screenMaxY + JET_ENTRY };
}

const EPS = 0.001;

function boxHits(map: TileMap, x: number, y: number): boolean {
  return map.boxHitsSolid(x - JET_BOX.halfWidth, y, x + JET_BOX.halfWidth, y + JET_BOX.height);
}

/** The top of the highest block under the jet's box at or below y (-Infinity over a pit). */
function groundBelow(map: TileMap, x: number, y: number): number {
  let best = -Infinity;
  for (let c = getColumn(x - JET_BOX.halfWidth); c <= getColumn(x + JET_BOX.halfWidth - EPS); c++) {
    for (let r = Math.min(map.rows - 1, getRow(y)); r >= 0; r--) {
      const top = r * TILE + HALF_TILE;
      if (map.get(c, r) && top <= y + EPS) {
        best = Math.max(best, top);
        break;
      }
    }
  }
  return best;
}

const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

/** One fixed step of the jet: its descent, its flight while piloted, or its leaving. */
export function stepJetBody(j: Jet, drive: JetDrive, map: TileMap, t: number, screenMaxY: number): void {
  j.animTime += t;
  if (j.state === 'leaving') {
    j.yI = JET_LEAVE_SPEED;
    j.y += j.yI * t;
    j.onGround = false;
    if (j.y > screenMaxY + 64) j.exploded = true;
    return;
  }
  if (j.state === 'flying' && !j.driven) j.state = 'descending';
  if (j.state === 'descending') {
    const ground = groundBelow(map, j.x, j.y);
    const speed = j.y - ground > JET_DESCENT.slowZone ? JET_FAST_DESCENT : JET_DESCENT.slow;
    j.xI = 0;
    j.yI = -speed;
    j.y -= speed * t;
    j.onGround = false;
    if (j.y <= ground) {
      j.y = ground;
      j.yI = 0;
      j.onGround = true;
      j.state = 'landed';
    }
    return;
  }
  if (j.state === 'landed') {
    j.xI = 0;
    j.yI = 0;
    j.onGround = true;
    return;
  }
  // flying, piloted
  if (drive.dx !== 0) j.facing = drive.dx;
  j.xI = approach(j.xI, drive.dx * JET_FLY.x, JET_FLY.accel * t);
  j.yI = approach(j.yI, drive.dy * JET_FLY.y, JET_FLY.accel * t);
  const nx = j.x + j.xI * t;
  if (boxHits(map, nx, j.y)) {
    if (j.xI > 0) j.x = cellLeft(getColumn(nx + JET_BOX.halfWidth)) - JET_BOX.halfWidth - EPS;
    else if (j.xI < 0) j.x = cellLeft(getColumn(nx - JET_BOX.halfWidth)) + TILE + JET_BOX.halfWidth + EPS;
    j.xI = 0;
  } else {
    j.x = nx;
  }
  let ny = j.y + j.yI * t;
  const top = map.rows * TILE - HALF_TILE - JET_BOX.height; // no higher than the map's top row
  if (ny > top) {
    ny = top;
    j.yI = Math.min(j.yI, 0);
  }
  if (boxHits(map, j.x, ny)) {
    if (j.yI <= 0) j.y = cellBottom(getRow(ny)) + TILE;
    else j.y = cellBottom(getRow(ny + JET_BOX.height)) - JET_BOX.height - EPS;
    j.yI = 0;
  } else {
    j.y = ny;
  }
  j.onGround = boxHits(map, j.x, j.y - 0.5);
  if (!j.onGround) j.fuel = Math.max(0, j.fuel - t);
}
