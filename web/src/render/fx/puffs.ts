import { getColumn, getRow, type TileMap } from '../../engine/map';
import type { PuffDef, RGBA } from '../fxdata';

/** A running Puff: a strip animation that drifts with drag (or gravity) and dies on its last frame. */
export interface PuffInstance {
  def: PuffDef;
  x: number;
  y: number;
  xI: number;
  yI: number;
  flip: 1 | -1;
  color: RGBA;
  delay: number;
  counter: number;
  frame: number;
  rowIndex: number;
  loopsLeft: number;
  dead: boolean;
  follow?: { x: number; y: number }; // parented to a unit: x/y are then relative to it
}

export function makePuff(def: PuffDef, x: number, y: number, flip: 1 | -1 = 1, xI = 0, yI = 0,
  color: RGBA = [1, 1, 1, 1], delay = 0): PuffInstance {
  return { def, x, y, xI, yI, flip, color, delay, counter: 0, frame: 0, rowIndex: 1, loopsLeft: def.numLoops ?? 0, dead: false };
}

/** Puff.Update */
export function stepPuff(p: PuffInstance, t: number, map: TileMap): void {
  if (p.dead) return;
  if (p.delay > 0) {
    p.delay -= t;
    return;
  }
  const d = p.def;
  p.x += p.xI * t;
  p.y += p.yI * t;
  if (!d.useGravity) {
    p.xI *= 1 - t * 15;
    p.yI *= 1 - t * 15;
  } else {
    p.xI *= 1 - t * 2;
    p.yI = p.yI * (1 - t * 2) - d.gravityM * 1000 * t;
  }
  p.counter += t;
  const steps = Math.floor(p.counter / d.frameRate);
  const rows = d.rows ?? 1;
  for (let i = 0; i < steps; i++) {
    p.counter -= d.frameRate;
    p.frame++;
    if (p.frame === (d.pauseFrame ?? -1)) p.counter -= d.pauseTime ?? 0;
    if (p.frame >= d.frames) {
      if (rows <= 1 || p.rowIndex >= rows) {
        p.dead = true;
        return;
      }
      p.rowIndex++;
      p.frame = 0;
    }
    if (p.loopsLeft > 0 && (p.rowIndex - 1) * d.frames + p.frame >= (d.loopEndFrame ?? 0)) {
      p.rowIndex = 1;
      p.frame = d.loopStartFrame ?? 0;
      p.loopsLeft--;
    }
  }
  if (d.requiresGroundBelow && !map.isSolid(getColumn(p.x), getRow(p.y) - 1)) p.dead = true;
}

/** The texture rectangle of the current frame: SetLowerLeftPixel(frame * spriteSize, spriteLowerPixel * rowIndex). */
export function puffRect(p: PuffInstance): [number, number, number, number] {
  const [, y, w, h] = p.def.rect;
  const lower = y + h; // the prefab's lowerLeftPixel.y
  return [p.frame * p.def.spriteSize, lower * p.rowIndex - h, w, h];
}
