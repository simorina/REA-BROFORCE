import { CLIMB_FRAME_RATE, JUMP_FRAME_RATE, RUN_FRAME_RATE } from '../engine/constants';
import type { Unit } from '../engine/types';

export interface Frame {
  col: number;
  row: number; // counted from the top of the sheet
}

/** Body frame after TestVanDammeAnim's Animate* methods (lowerLeftPixel y = (row + 1) * 32). */
export function unitFrame(u: Unit): Frame {
  if (u.dead) return { col: u.onGround ? 5 : 4, row: 0 }; // AnimateActualDeath / AnimateFallingDeath
  if (u.wallClimbing) return { col: 12 + (Math.floor(u.animTime / CLIMB_FRAME_RATE) % 5), row: 2 }; // AnimateWallClimb
  if (!u.onGround) {
    // AnimateActualJumpingFrames (useNewFrames)
    const fast = Math.abs(u.xI) > 50;
    const f = Math.floor(u.animTime / JUMP_FRAME_RATE) % 3;
    if (u.yI > 20) return { col: (fast ? 0 : 6) + f, row: 2 };
    return { col: (fast ? 3 : 9) + f, row: 2 };
  }
  if (Math.abs(u.xI) > 1) {
    return { col: Math.floor(u.animTime / RUN_FRAME_RATE) % 8, row: u.dashing ? 3 : 1 }; // AnimateActualNewRunningFrames
  }
  return { col: 0, row: 0 }; // AnimateActualIdleFrames
}

export function stripFrame(age: number, duration: number, cols: number): number {
  return Math.min(cols - 1, Math.floor((age / duration) * cols));
}

export function loopFrame(time: number, frameRate: number, cols: number): number {
  return Math.floor(time / frameRate) % cols;
}
