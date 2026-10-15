import { TILE } from '../../engine/constants';
import { cellBottom, cellLeft, getColumn, getRow, type TileMap } from '../../engine/map';

export interface RayHit {
  x: number;
  y: number;
  nx: number; // surface normal of the face hit
  ny: number;
  c: number;
  r: number;
}

/**
 * Physics.Raycast against the block grid: the first block cell the ray enters within maxDist, with the
 * point and the normal of the face it went through. Like Unity, the cell the ray starts in is ignored.
 */
export function raycastBlocks(map: TileMap, x0: number, y0: number, dx: number, dy: number, maxDist: number): RayHit | null {
  const len = Math.hypot(dx, dy);
  if (len === 0 || maxDist <= 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  let c = getColumn(x0);
  let r = getRow(y0);
  const stepC = ux > 0 ? 1 : ux < 0 ? -1 : 0;
  const stepR = uy > 0 ? 1 : uy < 0 ? -1 : 0;
  let tMaxX = stepC === 0 ? Infinity : ((stepC > 0 ? cellLeft(c) + TILE : cellLeft(c)) - x0) / ux;
  let tMaxY = stepR === 0 ? Infinity : ((stepR > 0 ? cellBottom(r) + TILE : cellBottom(r)) - y0) / uy;
  const tDeltaX = stepC === 0 ? Infinity : TILE / Math.abs(ux);
  const tDeltaY = stepR === 0 ? Infinity : TILE / Math.abs(uy);
  for (let guard = 0; guard < 256; guard++) {
    let t: number;
    let nx = 0;
    let ny = 0;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      c += stepC;
      nx = -stepC;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      r += stepR;
      ny = -stepR;
    }
    if (t > maxDist) return null;
    if (map.get(c, r)) return { x: x0 + ux * t, y: y0 + uy * t, nx, ny, c, r };
  }
  return null;
}
