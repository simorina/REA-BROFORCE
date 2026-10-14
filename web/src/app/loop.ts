import { FIXED_DT } from '../engine/constants';

export const MAX_FRAME_TIME = 0.25;

/** Runs as many fixed steps as the accumulated time allows and returns the leftover. */
export function advance(accumulator: number, frameTime: number, step: (dt: number) => void): number {
  let acc = accumulator + Math.min(Math.max(frameTime, 0), MAX_FRAME_TIME);
  while (acc >= FIXED_DT - 1e-9) {
    step(FIXED_DT);
    acc -= FIXED_DT;
  }
  return acc;
}

export function createLoop(step: (dt: number) => void, render: (frameTime: number) => void) {
  let acc = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  const frame = (now: number) => {
    if (!running) return;
    const frameTime = last ? (now - last) / 1000 : FIXED_DT;
    last = now;
    acc = advance(acc, frameTime, step);
    render(Math.min(frameTime, MAX_FRAME_TIME));
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
