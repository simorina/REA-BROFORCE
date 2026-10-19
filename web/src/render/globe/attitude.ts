/**
 * How the world map's helicopter holds itself, ported from Broforce's Helicopter3D: its nose turns after the way it
 * flies (RunInput's RotateTowards), it rolls into the turn and dips its nose while it flies (DoBanking, which sets the
 * model's local angles to forward × bankDegrees × 0.4 of pitch and bank × bankDegrees of roll).
 */
import { dot, normalize, type Vec3 } from './orbit';

export interface Attitude {
  facing: Vec3; // where the nose points, along the globe
  bank: number; // -1..1, the roll into a turn: positive dips the right side (Helicopter3D.bankingAmount, sign flipped)
  forward: number; // 0..1, how far the nose dips (bankingForwardAmount)
  trick: number; // 0..1, quickens a long turn (trickBankSpeed)
}

const TURNING = (5 * Math.PI) / 180; // DoBanking: a turn of more than 5 degrees banks

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t)); // Mathf.Lerp
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function along(v: Vec3, up: Vec3): Vec3 | null {
  const d = dot(v, up);
  const t: Vec3 = [v[0] - d * up[0], v[1] - d * up[1], v[2] - d * up[2]];
  const l = Math.hypot(t[0], t[1], t[2]);
  return l < 1e-9 ? null : [t[0] / l, t[1] / l, t[2] / l];
}

/** The signed angle from `facing` to `way` about `up`: positive turns right. */
function turn(facing: Vec3, way: Vec3, up: Vec3): number {
  return Math.atan2(dot(way, cross(facing, up)), dot(way, facing));
}

export const restingAttitude = (facing: Vec3): Attitude => ({ facing: normalize(facing), bank: 0, forward: 0, trick: 0 });

/** One frame: `up` is where the helicopter is over the globe, `move` the way it moves (null while it hovers). */
export function stepAttitude(a: Attitude, up: Vec3, move: Vec3 | null, dt: number, sideSpeed: number): Attitude {
  const u = normalize(up);
  let facing = along(a.facing, u) ?? along([0, 1, 0], u) ?? ([1, 0, 0] as Vec3);
  const way = move ? along(move, u) : null;
  let { bank, forward, trick } = a;
  if (way) {
    const angle = turn(facing, way, u);
    const step = Math.sign(angle || 1) * Math.min(Math.abs(angle), dt * (2 + Math.abs(bank) * 6 + trick * 6));
    const right = cross(facing, u);
    const c = Math.cos(step);
    const s = Math.sin(step);
    facing = normalize([facing[0] * c + right[0] * s, facing[1] * c + right[1] * s, facing[2] * c + right[2] * s]);
    const left = turn(facing, way, u);
    if (Math.abs(left) > TURNING) {
      bank = lerp(bank, left > 0 ? 1 : -1, dt * sideSpeed);
      forward = lerp(forward, 0.5, dt * 3);
      trick = lerp(trick, 1, dt * 0.5);
    } else {
      bank = lerp(bank, 0, dt * 7);
      forward = lerp(forward, 1, dt * 3);
      trick = lerp(trick, 0, dt * 5);
    }
  } else {
    bank = lerp(bank, 0, dt * 7);
    forward = lerp(forward, 0, dt * 3);
    trick = lerp(trick, 0, dt * 5);
  }
  return { facing, bank, forward, trick };
}
