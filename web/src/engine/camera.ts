import { CAMERA_LERP, CAMERA_Y_OFFSET, HALF_TILE, TILE } from './constants';

export const VIEW_W = 400; // world units visible across (16:9)
export const VIEW_H = 225;

export interface Camera {
  x: number; // centre of the view
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Eases towards the target (a little above it, like SortOfFollow) and keeps the view inside the map. */
export function followCamera(cam: Camera, target: { x: number; y: number }, map: { cols: number; rows: number }, dt: number): void {
  const k = Math.min(1, dt * CAMERA_LERP);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y + CAMERA_Y_OFFSET - cam.y) * k;
  cam.x = clamp(cam.x, -HALF_TILE + VIEW_W / 2, map.cols * TILE - HALF_TILE - VIEW_W / 2);
  cam.y = clamp(cam.y, -HALF_TILE + VIEW_H / 2, map.rows * TILE - HALF_TILE - VIEW_H / 2);
}

/** SortOfFollow.IsItSortOfVisible: inside the view grown by a buffer (0 for SetResolutionCamera.IsItVisible). */
export function isVisible(cam: Camera, x: number, y: number, bufferX = 0, bufferY = 0): boolean {
  return Math.abs(x - cam.x) < VIEW_W / 2 + bufferX && Math.abs(y - cam.y) < VIEW_H / 2 + bufferY;
}

/** SortOfFollow.GetScreenMaxY */
export const screenMaxY = (cam: Camera): number => cam.y + VIEW_H / 2;
