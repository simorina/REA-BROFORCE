import type { BubbleDef } from './fxdata';

export const BUBBLE_FRAME_TIME = 0.0334; // ReactionBubble.Update steps a frame every 0.0334 s

/**
 * ReactionBubble's frame `age` seconds after RestartBubble: it pops up to animatedRestFrame, rests there
 * for restTime, then folds away and hides on animatedFinishFrame (-1).
 */
export function bubbleFrame(def: BubbleDef, age: number): number {
  const restAt = def.animatedRestFrame * BUBBLE_FRAME_TIME;
  if (age < 0) return -1;
  if (age < restAt) return Math.floor(age / BUBBLE_FRAME_TIME);
  if (age < restAt + def.restTime) return def.animatedRestFrame;
  const frame = def.animatedRestFrame + Math.floor((age - restAt - def.restTime) / BUBBLE_FRAME_TIME);
  return frame >= def.animatedFinishFrame ? -1 : frame;
}

/**
 * ReactionBubble.Update for a still bubble (animatedBubble off) restarted with RestartBubble(life): it
 * rises 5 into place over tweenTime, holds, then rises 5 more as it fades. Null once its life is over.
 */
export function stillBubble(def: BubbleDef, age: number, life: number): { offsetY: number; alpha: number } | null {
  if (age < 0 || age >= life) return null;
  let m = 1;
  let offsetY = 0;
  if (age < def.tweenTime) {
    m = age / def.tweenTime;
    offsetY = -5 * (1 - m);
  } else if (age >= life - def.tweenTime) {
    m = (life - age) / def.tweenTime;
    offsetY = 5 * (1 - m);
  }
  const sinM = def.flash ? Math.sin(age * def.sinSpeed) : 1;
  return { offsetY, alpha: (sinM * 0.3 + 0.7) * m + (1 - m) * m };
}

/** RestartBubble starts 5 below and tweens up to its place over tweenTime. */
export function bubbleOffsetY(def: BubbleDef, age: number): number {
  return age < def.tweenTime ? -5 * (1 - age / def.tweenTime) : 0;
}
