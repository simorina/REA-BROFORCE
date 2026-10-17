import { MISSIONS } from '../levels';

const KEY = 'brolusconi.campaign';

/** How many missions are done, in order (0 up to MISSIONS.length), as saved; 0 when nothing (valid) is saved. */
export function loadProgress(): number {
  try {
    const n = Number.parseInt(localStorage.getItem(KEY) ?? '', 10);
    return Number.isNaN(n) ? 0 : Math.min(MISSIONS.length, Math.max(0, n));
  } catch {
    return 0;
  }
}

export function saveProgress(done: number): void {
  try {
    localStorage.setItem(KEY, String(done));
  } catch {
    // storage unavailable: the progress lasts for this session only
  }
}

/** The mission to play next: the first not done, or the last one again once the campaign is over. */
export const currentMission = (done: number): number => Math.min(done, MISSIONS.length - 1);

export const campaignComplete = (done: number): boolean => done >= MISSIONS.length;

/** A win on the mission in play opens the next one; a loss, or a replay of a mission already done, changes nothing. */
export function afterMission(done: number, index: number, result: 'won' | 'lost'): number {
  return result === 'won' && index === done ? done + 1 : done;
}

type Spot = { x: number; y: number };

export const HELI_FLIGHT = 2.4; // seconds from one mission to the next
export const HELI_START: Spot = { x: 0.04, y: 0.16 }; // out at sea, where the first flight comes from
const ARC = 0.1; // how far above the straight line the helicopter flies halfway (fractions of the map's height)

/** Where the helicopter flies from to reach a mission: the mission before it, or the sea for the first. */
export const flightStart = (index: number): Spot => (index === 0 ? HELI_START : MISSIONS[index - 1].map);

/** The helicopter t seconds into a flight: eased along the line, up in an arc, facing the way it flies. */
export function heliAt(from: Spot, to: Spot, t: number): { x: number; y: number; facing: 1 | -1; landed: boolean } {
  const k = Math.min(1, Math.max(0, t / HELI_FLIGHT));
  const e = k * k * (3 - 2 * k);
  const facing = to.x < from.x ? -1 : 1;
  if (k === 1) return { x: to.x, y: to.y, facing, landed: true };
  return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * k) * ARC, facing, landed: false };
}
