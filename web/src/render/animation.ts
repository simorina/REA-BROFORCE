import {
  CLIMB_FRAME_RATE, ELITE, FLEX_FRAMES, FLEX_ROW, JUDO_COL, JUDO_FRAMES, JUDO_ROW, JUMP_FRAME_RATE, RUN_FRAME_RATE, TANK_RUN_FRAME_RATE,
} from '../engine/constants';
import type { TileMap } from '../engine/map';
import type { Tank, Turret } from '../engine/tank';

const PANIC_FRAME_RATE = 0.044455; // Mook.AnimateRunning while burning, blind or scared
const SPECIAL2_FRAME_RATE = 0.045; // MookSuicide.AnimateSpecial2, with frame 9 held for 1 s
const NINJA_FLIP_RATE = 0.025; // MookNinja.AnimateActualJumpingFrames

/** MookSuicide.AnimateSpecial2's frame t seconds in. */
export function special2Frame(t: number): number {
  const held = 9 * SPECIAL2_FRAME_RATE;
  if (t < held) return Math.floor(t / SPECIAL2_FRAME_RATE);
  if (t < held + 1) return 9;
  return Math.min(16, 10 + Math.floor((t - held - 1) / SPECIAL2_FRAME_RATE));
}
import type { Unit } from '../engine/types';

export interface Frame {
  col: number;
  row: number; // counted from the top of the sheet
}

/** Body frame after TestVanDammeAnim's Animate* methods (lowerLeftPixel y = (row + 1) * 32). */
export function unitFrame(u: Unit): Frame {
  if (u.dead) return { col: u.onGround ? 5 : 4, row: 0 }; // AnimateActualDeath / AnimateFallingDeath
  if (u.attack) return { col: JUDO_COL + Math.min(u.attack.frame, JUDO_FRAMES - 1), row: JUDO_ROW + u.attack.row }; // BroLee.AnimateAttackForwards
  if (u.special2 >= 0) return { col: special2Frame(u.special2), row: 7 }; // MookSuicide.AnimateSpecial2
  if (u.flex) return { col: Math.min(u.flex.frame, FLEX_FRAMES - 1), row: FLEX_ROW }; // AnimateGesture (Flex)
  if (u.wallClimbing) return { col: 12 + (Math.floor(u.animTime / CLIMB_FRAME_RATE) % 5), row: 2 }; // AnimateWallClimb
  // Mook.AnimateRunning while burning, blind or panicking; ScoutMook's has four frames and also waves
  const scout = u.kind === 'mook_scout';
  if (u.onGround && (u.blindTime > 0 || u.burnTime > 0 || (scout && u.waveTime > 0)) && Math.abs(u.xI) > 1) {
    return { col: 21 + (Math.floor(u.animTime / PANIC_FRAME_RATE) % (scout ? 4 : 8)), row: 0 };
  }
  if (u.kind === 'mook_ninja' && u.ducking && u.ai?.mental === 'hiding') return { col: 5, row: 6 }; // MookNinja: crouched, hidden
  if (u.kind === 'mook_bruiser_elite') {
    // MookBigGuyElite.ChangeFrame: getting up after a stomp, frames 21-24; AnimateJumping: frame 21 leaping at you
    if (u.getUp > 0) return { col: ELITE.getUpCol + Math.min(3, Math.floor((ELITE.getUp - u.getUp) / (ELITE.getUp / 4))), row: 0 };
    if (!u.onGround && u.yI < 30 && u.ai?.mental === 'alerted') return { col: ELITE.jumpCol, row: 0 };
  }
  if (u.ducking) return { col: 6, row: 0 }; // AnimateActualIdleDuckingFrames
  if (u.jet?.spiral && Math.abs(u.xI) + Math.abs(u.yI) > 200) {
    // MookJetpack.SetSpiralFrame: the frame of its flight's angle on row 10
    return { col: Math.max(0, Math.min(12, 12 - Math.floor((Math.atan2(u.yI, Math.abs(u.xI)) / Math.PI + 0.5) * 12.99))), row: 9 };
  }
  if (u.kind === 'mook_ninja' && !u.onGround && u.yI >= -150) {
    return { col: 21 + (Math.floor(u.animTime / NINJA_FLIP_RATE) % 10), row: 2 }; // MookNinja.AnimateActualJumpingFrames: the flip
  }
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

const FLAME_SINK = 32; // FlameBullet.Update: the flame's sprite (flameObjectTranform) moves down 32 a second

/** A FlameThrower Bullet `age` seconds out: its AnimatedTexture's frame (once through, loop off) and how far it has sunk. */
export function flameLook(age: number, anim: { frames: number; frameRate: number }): { frame: number; dy: number } {
  return { frame: Math.min(anim.frames - 1, Math.max(0, Math.floor(age / anim.frameRate))), dy: -FLAME_SINK * age };
}

/** Hobro_anim: columns 0-3 are the standing idle; 4-5 are death poses, so the cage loop stays on 0-3. */
export function prisonerFrame(time: number): number {
  return loopFrame(time, 0.15, 4);
}

/** Jungle earth (DirtBlock5) wears its grass (frame 0) only under open air; covered it is plain earth (frame 1). */
export function blockFrame(map: TileMap, c: number, r: number): number {
  return map.get(c, r)?.kind === 'dirt' && map.get(c, r + 1) ? 1 : 0;
}

/** The Goliath's turning frames (its sheet turns it from right, 0, through facing us, 3, to left, 6). */
export const mechFrame = (look: number): number => Math.min(6, Math.max(0, Math.round(look)));

const JET_WHEELS = 8; // the Harrier frame's lowest opaque pixels (its wheels) sit 8 px above the frame's bottom

/**
 * Where the jet's frame is centred. Broforce's Harrier hangs from a pivot in mid-air (it only hovers), so its SpriteSM
 * offset would sink our landed jet's wheels 12 px into the ground; ours stands on them at its y.
 */
/** Helicopter.StartIdleAnim: hovering, the AnimatedTexture is off on its idle frame (GetDirection: 4 faces left). */
export function helicopterFrame(facing: 1 | -1): number {
  return facing < 0 ? 4 : 0;
}

export function jetFrameCentreY(y: number, frameH: number): number {
  return y + frameH / 2 - JET_WHEELS;
}

/** TankBroTank: AnimateActualIdleFrames (0, 0); AnimateRunning, columns 0-2 at runningFrameRate; AnimateJumping, row 1 by yI. */
export function tankHullFrame(k: Tank): Frame {
  if (!k.onGround) {
    const col = k.yI > 100 ? 1 : k.yI > 66 ? 2 : k.yI > 33 ? 3 : k.yI > 0 ? 4 : k.yI > -33 ? 5 : k.yI > -66 ? 6 : 7;
    return { col, row: 1 };
  }
  if (Math.abs(k.xI) > 1) return { col: Math.floor(k.animTime / TANK_RUN_FRAME_RATE) % 3, row: 0 };
  return { col: 0, row: 0 };
}

/** TankBroTankTurret.SetTurretFrame: the mortar's frames on row 0, the gun switch on row 1, the cannon's on row 2. */
export function turretFrame(tu: Turret): Frame {
  if (tu.switching) return { col: tu.switchFrame, row: 1 };
  const row = tu.gun === 0 ? 0 : 2;
  return { col: tu.firing ? tu.frame : 0, row };
}
