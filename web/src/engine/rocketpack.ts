import type { RocketpackStats, Unit } from './types';

/**
 * The Brocketeer's jetpack on a bro who has one (Elon Musk). A jump lights it (BlastOff: hoverDuration of lift); holding
 * jump, every jetPackRate it pushes against its thrust direction, which turns 0.133 rad a tick toward the side he steers
 * to (or straight down), with a sinusoidal lift while he is slow and less once he is rising. Landing or dragging down a
 * wall puts it out.
 */
export const ROCKETPACK = {
  rate: 0.04, // jetPackRate
  turn: 0.133, turnMag: 45, // Vector3.RotateTowards(current, target, 0.133, 45)
  slow: 30, rising: 80, risingForce: 0.05, fastForce: 0.016, // yI < 30: hover force; < 80: 0.05; else 0.016
  liftOff: 0.5, liftOffForce: 0.03, // the first 0.5 s push 0.03 harder
  sideForce: 0.016, dashSideForce: 0.01, sinCap: 50, sinBelow: 70,
};

export interface RocketpackState {
  time: number; // hoverTime left
  sin: number; // hoverSinCounter
  counter: number; // jetPackCounter
  dir: { x: number; y: number }; // currentJetpackDirection
  flame: number; // a puff of exhaust now and then
  on: boolean; // pushing this step (for its flames)
}

export function makeRocketpack(s: RocketpackStats): RocketpackState {
  return { time: 0, sin: s.sinStart, counter: 0, dir: { ...s.down }, flame: 0, on: false };
}

/** TheBrocketeer.Jump: BlastOff, and the thrust turned the way he is going. */
export function blastOff(r: RocketpackState, s: RocketpackStats, left: boolean, right: boolean): void {
  r.time = s.duration;
  r.sin = s.sinStart;
  r.counter = 0;
  if (left) r.dir = { ...s.side };
  else if (right) r.dir = { x: -s.side.x, y: s.side.y };
}

/** Vector3.RotateTowards in the plane: at most `maxAngle` round and `maxMag` longer or shorter. */
function rotateTowards(v: { x: number; y: number }, to: { x: number; y: number }, maxAngle: number, maxMag: number): { x: number; y: number } {
  const a = Math.atan2(v.y, v.x);
  const b = Math.atan2(to.y, to.x);
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const angle = a + Math.max(-maxAngle, Math.min(maxAngle, d));
  const m0 = Math.hypot(v.x, v.y);
  const m1 = Math.hypot(to.x, to.y);
  const mag = m0 + Math.max(-maxMag, Math.min(maxMag, m1 - m0));
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
}

/** TheBrocketeer.Update / RunJetpack for a step. */
export function stepRocketpack(u: Unit, r: RocketpackState, s: RocketpackStats, input: { jump: boolean; left: boolean; right: boolean }, t: number): void {
  r.on = false;
  if (u.onGround || u.wallClimbing) { // Land, WallDrag
    r.time = 0;
    return;
  }
  if (!input.jump) return;
  r.time -= t;
  if (r.time <= 0) return;
  r.on = true;
  if (u.yI < ROCKETPACK.sinBelow) r.sin = Math.max(0, Math.min(ROCKETPACK.sinCap, r.sin - t * s.sinSpeed));
  r.counter += t * (0.4 + (r.time > 1 ? 0.3 : 0) + (r.time > 0.5 ? 0.3 : 0) + 0.2);
  if (r.counter <= ROCKETPACK.rate) return;
  r.counter -= ROCKETPACK.rate;
  const to = input.left ? s.side : input.right ? { x: -s.side.x, y: s.side.y } : s.down;
  r.dir = rotateTowards(r.dir, to, ROCKETPACK.turn, ROCKETPACK.turnMag);
  if (u.yI < ROCKETPACK.slow) u.yI -= r.dir.y * (s.force + s.sinForce * Math.sin(r.sin));
  else if (u.yI < ROCKETPACK.rising) u.yI -= r.dir.y * ROCKETPACK.risingForce;
  else u.yI -= r.dir.y * ROCKETPACK.fastForce;
  if (r.time > s.duration - ROCKETPACK.liftOff) u.yI -= r.dir.y * ROCKETPACK.liftOffForce;
  if ((r.dir.x < 0 && input.right) || (r.dir.x > 0 && input.left) || (!input.right && !input.left)) {
    u.xIBlast -= r.dir.x * (u.dashing ? ROCKETPACK.dashSideForce : ROCKETPACK.sideForce);
  }
}
